import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getCompanyCore } from '../company/company-core';

/**
 * Helper centralizado de verificación de acceso a una empresa, usado por
 * services que llaman a Prisma directamente (no solo desde HTTP). Sustituye
 * los métodos `verifyOwner` que se replicaban en 5 services con el bug de
 * solo soportar modo INDIVIDUAL.
 *
 * Reglas (alineadas con CompanyOwnerGuard):
 *   - INDIVIDUAL → estudiante dueño (`studentId`).
 *   - GROUP      → estudiante miembro (CompanyMembership).
 *
 * Los staff (TEACHER/ADMIN/SUPERADMIN) deberían usar el guard de HTTP, no
 * este helper. Si llamás desde un service interno con un userId de staff,
 * pasale `staff: true` y se saltea el ownership check.
 *
 * Rendimiento (sin cambiar la semántica): como este helper corre en services
 * y no tiene `req`, su vía de dedupe es el cache Redis. Si el caller pasa
 * `opts.redis`, la fila core sale del cache que ya calentó el guard en el mismo
 * request; la membership (GROUP) SIEMPRE se resuelve fresca de DB. Sin `redis`
 * (o con Redis caído) el comportamiento es idéntico al de hoy: lectura a DB.
 */
export async function assertCompanyAccess(
  prisma: PrismaService,
  companyId: string,
  userId: string,
  opts: { staff?: boolean; redis?: any } = {},
): Promise<{ id: string; mode: 'INDIVIDUAL' | 'GROUP'; studentId: string | null; exerciseId: string | null }> {
  // Fila core: Redis (si se pasó) con fail-open a DB. NO incluye memberships.
  const core = await getCompanyCore(prisma, opts.redis, companyId);
  if (!core) throw new NotFoundException('Empresa no encontrada');

  // Shape de retorno IDÉNTICO al histórico (no exponemos name/enabled/etc.).
  const result = {
    id: core.id,
    mode: core.mode,
    studentId: core.studentId,
    exerciseId: core.exerciseId,
  };

  if (opts.staff) {
    return result;
  }

  const isOwnerIndividual =
    core.mode === 'INDIVIDUAL' && core.studentId === userId;

  let isMemberGroup = false;
  if (core.mode === 'GROUP') {
    // PER-USUARIO → nunca cacheada por id de empresa; siempre fresca de DB.
    const membership = await prisma.companyMembership.findFirst({
      where:  { companyId, userId },
      select: { id: true },
    });
    isMemberGroup = !!membership;
  }

  if (!isOwnerIndividual && !isMemberGroup) {
    throw new ForbiddenException('No tienes acceso a esta empresa');
  }
  return result;
}
