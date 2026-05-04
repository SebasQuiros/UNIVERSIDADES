import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
 */
export async function assertCompanyAccess(
  prisma: PrismaService,
  companyId: string,
  userId: string,
  opts: { staff?: boolean } = {},
): Promise<{ id: string; mode: 'INDIVIDUAL' | 'GROUP'; studentId: string | null; exerciseId: string | null }> {
  const company = await prisma.company.findUnique({
    where:  { id: companyId },
    select: {
      id: true, mode: true, studentId: true, exerciseId: true,
      memberships: {
        where:  { userId },
        select: { id: true },
        take:   1,
      },
    },
  });
  if (!company) throw new NotFoundException('Empresa no encontrada');
  if (opts.staff) {
    return { ...company } as any;
  }
  const isOwnerIndividual =
    company.mode === 'INDIVIDUAL' && company.studentId === userId;
  const isMemberGroup =
    company.mode === 'GROUP' && company.memberships.length > 0;
  if (!isOwnerIndividual && !isMemberGroup) {
    throw new ForbiddenException('No tienes acceso a esta empresa');
  }
  // No exponemos memberships fuera del helper.
  const { memberships: _m, ...rest } = company;
  return rest as any;
}
