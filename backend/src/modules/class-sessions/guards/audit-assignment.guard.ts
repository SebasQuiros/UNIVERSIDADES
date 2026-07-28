import {
  Injectable, CanActivate, ExecutionContext,
  NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * AuditAssignmentGuard — el ÚNICO guard que cruza la frontera entre empresas.
 *
 * Se diseña con el mismo cuidado que CompanyOwnerGuard, pero NO lo extiende ni
 * lo llama. Reglas invariantes:
 *
 *  1. Solo activo si la sesión está en AUDITORIA / CALIFICACION / FINALIZADA.
 *  2. La empresa auditada se resuelve EXCLUSIVAMENTE desde la asignación de
 *     auditoría del usuario (su `auditorCompanyId`), NUNCA desde un `companyId`
 *     que venga del cliente. Por eso la ruta de snapshot no lleva `:companyId`.
 *  3. Escritura de hallazgos (POST/PATCH/DELETE) solo si status === AUDITORIA.
 *  4. Staff (TEACHER dueño / ADMIN / SUPERADMIN) entra en modo observador
 *     (solo lectura), nunca escribe hallazgos.
 *
 * Adjunta `req.auditAssignment` (con `auditeeCompanyId`) y `req.participant`.
 * El service de snapshot lee SOLO `req.auditAssignment.auditeeCompanyId` y las
 * columnas `snapshot*` — jamás un `companyId` del cliente ni los libros vivos.
 */
@Injectable()
export class AuditAssignmentGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req  = context.switchToHttp().getRequest();
    const user = req.user;
    const id   = req.params.id;

    const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!id || !UUID_RE.test(id)) throw new NotFoundException('Sesión de aula no encontrada');

    const session = await this.prisma.classSession.findUnique({
      where: { id },
      include: { exercise: { include: { teacher: { select: { universityId: true } } } } },
    });
    if (!session) throw new NotFoundException('Sesión de aula no encontrada');

    if (!['AUDITORIA', 'CALIFICACION', 'FINALIZADA'].includes(session.status)) {
      throw new ForbiddenException('La auditoría no está disponible en esta fase.');
    }
    req.classSession = session;

    const method   = req.method.toUpperCase();
    const isWrite  = method !== 'GET';

    // ── Staff → observador (solo lectura) ──
    if (['SUPERADMIN', 'ADMIN', 'TEACHER'].includes(user.role)) {
      if (user.role === 'TEACHER' && session.teacherId !== user.id) {
        throw new ForbiddenException('No sos el profesor de esta sesión de aula.');
      }
      // ADMIN: mismo aislamiento por universidad que ClassSessionGuard (evita
      // fuga de metadatos —nombres de grupos/arquetipos— entre tenants).
      if (user.role === 'ADMIN') {
        // FALLA CERRADO (ver ClassSessionGuard).
        const teacherUni = session.exercise?.teacher?.universityId ?? null;
        if (!user.universityId || !teacherUni || user.universityId !== teacherUni) {
          throw new ForbiddenException('No tenés acceso a sesiones de otra institución.');
        }
      }
      if (isWrite) {
        throw new ForbiddenException('El staff no registra hallazgos de auditoría.');
      }
      req.auditObserver = true;
      return true;
    }

    // ── STUDENT → su empresa y su asignación ──
    const participant = await this.prisma.classSessionParticipant.findUnique({
      where: { classSessionId_studentId: { classSessionId: id, studentId: user.id } },
    });
    if (!participant?.companyId) {
      throw new ForbiddenException('No tenés una empresa asignada en esta sesión.');
    }

    const assignment = await this.prisma.classSessionAuditAssignment.findUnique({
      where: { auditorCompanyId: participant.companyId },
    });
    if (!assignment || assignment.classSessionId !== id) {
      throw new ForbiddenException('No tenés una empresa asignada para auditar en esta sesión.');
    }

    if (isWrite && session.status !== 'AUDITORIA') {
      throw new ForbiddenException('Ya no se aceptan cambios de hallazgos en esta fase.');
    }

    req.auditAssignment = assignment;
    req.participant      = participant;
    return true;
  }
}
