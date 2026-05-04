import {
  Injectable, CanActivate, ExecutionContext,
  NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
 */
@Injectable()
export class CompanyOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

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

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true, name: true, mode: true,
        studentId: true, exerciseId: true,
        // Universidad para INDIVIDUAL viene del estudiante dueño;
        // para GROUP viene del teacher del exercise asociado.
        student:  { select: { universityId: true } },
        exercise: { select: { teacher: { select: { universityId: true } } } },
        // Pre-traemos solo la membresía del usuario actual (si existe). Es
        // mucho más barato que un `_count` y nos dice si STUDENT puede entrar.
        memberships: {
          where:  { userId: user.id },
          select: { role: true },
          take:   1,
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
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
