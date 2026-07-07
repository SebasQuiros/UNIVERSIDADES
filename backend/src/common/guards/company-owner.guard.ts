import {
  Injectable, CanActivate, ExecutionContext, Inject,
  NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { getCompanyCore } from '../company/company-core';

/**
 * CompanyOwnerGuard
 *
 * Applied to every endpoint that uses :companyId in the path.
 *
 * Reglas:
 *   STUDENT    → si la company es INDIVIDUAL, debe ser dueño (`studentId`).
 *                Si la company es GROUP, debe ser miembro (CompanyMembership).
 *   TEACHER    → read-only (GET); aislamiento por universidad.
 *                Universidad se deriva de `student.universityId` (INDIVIDUAL)
 *                o de `exercise.teacher.universityId` (GROUP).
 *   ADMIN      → read-only; mismo aislamiento que TEACHER.
 *   SUPERADMIN → acceso total.
 *
 * Attach `req.company` para que los services downstream no consulten de nuevo.
 *
 * Dedupe en-request (solo rendimiento, NO cambia el aislamiento):
 *   - `CompanyEnabledGuard` es un guard GLOBAL (APP_GUARD) y NestJS lo ejecuta
 *     ANTES que este guard de ruta. Cuando el usuario NO es staff, aquél ya
 *     resolvió la MISMA fila `Company` de este MISMO request/usuario y la dejó
 *     en `req.company`. La reusamos solo si el `id` coincide EXACTAMENTE y trae
 *     los campos que necesitamos; si no, leemos como siempre.
 *   - La DECISIÓN de acceso (ownership/rol/universidad) es IDÉNTICA a antes:
 *     solo cambia de dónde sale la fila.
 */
@Injectable()
export class CompanyOwnerGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: any,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req       = context.switchToHttp().getRequest();
    const user      = req.user;
    const companyId = req.params.companyId;

    if (!companyId) return true; // ruta sin :companyId — no aplica

    // Validación de formato UUID v4 antes de pegar a Prisma. Sin esto, un
    // companyId malformado en la URL hace que Prisma tire un error opaco
    // que el filtro global atrapa como 500 (falsa señal de "error interno").
    const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!UUID_RE.test(companyId)) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // ── Fuente de la fila (dedupe en-request → cache Redis → DB) ──────────────
    // 1) Reuso: si CompanyEnabledGuard ya resolvió ESTA empresa para ESTE
    //    request, la traemos de `req.company` (id exacto + campos requeridos).
    // 2) Si no (p. ej. staff, que saltea el enabled-guard), la resolvemos igual
    //    que antes, pero pasando por `getCompanyCore` (Redis con TTL corto,
    //    fail-open a DB). La membership es PER-USUARIO → siempre fresca de DB.
    let company: any =
      req.company && req.company.id === companyId
        && 'mode' in req.company && 'memberships' in req.company
        ? req.company
        : null;

    if (!company) {
      const core = await getCompanyCore(this.prisma, this.redis, companyId);
      if (!core) {
        throw new NotFoundException('Empresa no encontrada');
      }
      // Pre-traemos SOLO la membresía del usuario actual (si existe) y SOLO para
      // GROUP. Es mucho más barato que un `_count` y nos dice si STUDENT puede
      // entrar. Para INDIVIDUAL la decisión no la consulta (usa `studentId`),
      // así que no la leemos — comportamiento de acceso idéntico.
      let memberships: { role: any }[] = [];
      if (core.mode === 'GROUP' && user.role === 'STUDENT') {
        const m = await this.prisma.companyMembership.findFirst({
          where:  { companyId, userId: user.id },
          select: { role: true },
        });
        if (m) memberships = [m];
      }
      company = { ...core, memberships };
      req.company = company;
    }

    // SUPERADMIN — full access
    if (user.role === 'SUPERADMIN') {
      req.company = company;
      return true;
    }

    // TEACHER / ADMIN — read-only + university isolation
    if (user.role === 'TEACHER' || user.role === 'ADMIN') {
      const method = req.method.toUpperCase();
      if (method !== 'GET') {
        throw new ForbiddenException(
          'Los profesores y administradores solo pueden consultar datos. No pueden modificarlos.',
        );
      }
      // INDIVIDUAL → universidad del estudiante; GROUP → universidad del docente del exercise.
      const companyUniversityId =
        company.student?.universityId
        ?? company.exercise?.teacher?.universityId
        ?? null;
      if (
        user.universityId &&
        companyUniversityId &&
        companyUniversityId !== user.universityId
      ) {
        throw new ForbiddenException(
          'No tienes acceso a empresas de otras universidades.',
        );
      }
      req.company = company;
      return true;
    }

    // STUDENT
    //   INDIVIDUAL → debe ser dueño (studentId).
    //   GROUP      → debe figurar en CompanyMembership.
    if (company.mode === 'GROUP') {
      if (company.memberships.length === 0) {
        throw new ForbiddenException('No sos miembro de esta empresa.');
      }
    } else if (company.studentId !== user.id) {
      throw new ForbiddenException('No tienes acceso a esta empresa.');
    }

    req.company = company;
    return true;
  }
}
