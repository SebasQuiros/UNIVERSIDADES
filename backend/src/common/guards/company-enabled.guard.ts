import {
  Injectable, CanActivate, ExecutionContext,
  ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
 *   - 1 SELECT por request a una tabla con índice por PK.
 *   - Si fuera cuello de botella (Fase 5), se cachea en Redis con TTL
 *     corto invalidado al togglearlo via `setEnabled`.
 */
@Injectable()
export class CompanyEnabledGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

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

    const company = await this.prisma.company.findUnique({
      where:  { id: companyId },
      select: { id: true, isCompanyEnabled: true },
    });
    if (!company) {
      // dejamos el 404 lo más cerca de la lógica de negocio:
      // muchos services ya tiran NotFoundException, así que para no duplicar
      // error semánticos, tiramos 404 acá también.
      throw new NotFoundException('Empresa no encontrada');
    }
    if (!company.isCompanyEnabled) {
      throw new ForbiddenException(
        'Esta empresa está temporalmente deshabilitada por el profesor. ' +
        'Contactá a tu docente para más información.',
      );
    }
    return true;
  }
}
