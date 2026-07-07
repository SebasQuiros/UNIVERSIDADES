import {
  Injectable, CanActivate, ExecutionContext, Inject,
  ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { getCompanyCore } from '../company/company-core';

/**
 * CompanyEnabledGuard — Fase 1.
 *
 * Bloquea cualquier request hacia rutas con `:companyId` cuando la
 * Company tiene `isCompanyEnabled = false`, salvo que quien pega sea
 * TEACHER, ADMIN o SUPERADMIN (necesitan poder seguir gestionándola).
 *
 * Por qué un guard global:
 *   - Hay decenas de controllers con rutas `/companies/:companyId/...`
 *     (accounts, journal, invoices, ar, ap, bank, products, etc.).
 *   - Modificarlos uno por uno es propenso a olvidos y rompe el contrato
 *     "scopeado por company_id" exigido en la spec.
 *   - Un guard ejecutado después de JwtAuthGuard ve `req.user` y `req.params`
 *     y puede tomar decisión sin tocar ningún módulo existente.
 *
 * Performance:
 *   - Este guard GLOBAL corre ANTES que el `CompanyOwnerGuard` de ruta
 *     (@UseGuards), porque NestJS ejecuta los guards globales (APP_GUARD) antes
 *     que los de controller/route. Aprovechamos ese orden garantizado para
 *     resolver la fila `Company` UNA vez y dejarla en `req.company`; así el
 *     `CompanyOwnerGuard` la reusa en lugar de volver a leerla (dedupe
 *     en-request). Ver `common/company/company-core.ts` y `company-owner.guard.ts`.
 *   - Además, la fila core se cachea en Redis con TTL corto (fail-open): si
 *     Redis está caído se lee directo de la DB, exactamente como antes.
 */
@Injectable()
export class CompanyEnabledGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: any,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const companyId: string | undefined = req.params?.companyId;
    if (!companyId) return true; // ruta sin companyId → no aplica

    // Staff puede operar siempre (necesario para habilitar de nuevo, etc.)
    const role = req.user?.role;
    if (role === 'TEACHER' || role === 'ADMIN' || role === 'SUPERADMIN') {
      return true;
    }

    // Validación UUID antes de pegar a Prisma (evita 500 con error opaco)
    const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!UUID_RE.test(companyId)) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // Fila core (Redis con TTL corto → DB). Fail-open: ante cualquier problema
    // de Redis se lee directo de la DB.
    const company = await getCompanyCore(this.prisma, this.redis, companyId);
    if (!company) {
      // dejamos el 404 lo más cerca de la lógica de negocio:
      // muchos services ya tiran NotFoundException, así que para no duplicar
      // error semánticos, tiramos 404 acá también.
      throw new NotFoundException('Empresa no encontrada');
    }
    // Chequeo de habilitación — IDÉNTICO a antes (solo cambió de dónde salió la fila).
    if (!company.isCompanyEnabled) {
      throw new ForbiddenException(
        'Esta empresa está temporalmente deshabilitada por el profesor. ' +
        'Contactá a tu docente para más información.',
      );
    }

    // Dedupe en-request: dejamos la fila lista para que `CompanyOwnerGuard`
    // (guard de ruta, corre después) NO vuelva a leerla. Solo la exponemos si
    // hay un userId (mismo request, mismo usuario). Para empresas GROUP
    // resolvemos la membership del usuario (PER-USUARIO → nunca cacheada por id);
    // para INDIVIDUAL no se necesita (el owner-guard decide por `studentId`).
    const userId: string | undefined = req.user?.id;
    if (userId) {
      let memberships: { role: any }[] = [];
      if (company.mode === 'GROUP') {
        const m = await this.prisma.companyMembership.findFirst({
          where:  { companyId, userId },
          select: { role: true },
        });
        if (m) memberships = [m];
      }
      // Shape superset del que produce CompanyOwnerGuard hoy.
      req.company = { ...company, memberships };
    }

    return true;
  }
}
