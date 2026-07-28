import {
  Injectable, CanActivate, ExecutionContext,
  NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * ClassSessionGuard
 *
 * Se aplica a las rutas `class-sessions/:id/*`. Resuelve la sesión, verifica el
 * acceso según el rol y la adjunta en `req.classSession` (y `req.participant`
 * si es estudiante). NO toca `CompanyOwnerGuard` ni el aislamiento contable —
 * vive en su propio namespace, separado de `companies/:companyId/*`.
 *
 *   SUPERADMIN → acceso total.
 *   ADMIN      → misma universidad que el docente de la sesión.
 *   TEACHER    → debe ser el dueño (`teacherId`).
 *   STUDENT    → debe ser participante de la sesión.
 *
 * Las rutas de mutación reservadas al profesor llevan además `@Roles(...)` +
 * `RolesGuard`, que corta antes para los estudiantes.
 */
@Injectable()
export class ClassSessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req  = context.switchToHttp().getRequest();
    const user = req.user;
    const id   = req.params.id;

    // Rutas sin :id (crear sesión, join por código) no pasan por acá.
    if (!id) return true;

    const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!UUID_RE.test(id)) throw new NotFoundException('Sesión de aula no encontrada');

    const session = await this.prisma.classSession.findUnique({
      where: { id },
      include: {
        exercise: { include: { teacher: { select: { universityId: true } } } },
      },
    });
    if (!session) throw new NotFoundException('Sesión de aula no encontrada');
    req.classSession = session;

    if (user.role === 'SUPERADMIN') return true;

    if (user.role === 'ADMIN') {
      // FALLA CERRADO: con `&&`, un ADMIN sin institución (o una sesión cuya
      // universidad no se resuelve) obtenía acceso a las sesiones de CUALQUIER
      // cliente, incluidas rutas de escritura (start/cancel/grade).
      const teacherUni = session.exercise?.teacher?.universityId ?? null;
      if (!user.universityId || !teacherUni || user.universityId !== teacherUni) {
        throw new ForbiddenException('No tenés acceso a sesiones de otra institución.');
      }
      return true;
    }

    if (user.role === 'TEACHER') {
      if (session.teacherId !== user.id) {
        throw new ForbiddenException('No sos el profesor de esta sesión de aula.');
      }
      return true;
    }

    // STUDENT — debe ser participante
    const participant = await this.prisma.classSessionParticipant.findUnique({
      where: { classSessionId_studentId: { classSessionId: id, studentId: user.id } },
    });
    if (!participant) {
      throw new ForbiddenException('No participás en esta sesión de aula.');
    }
    req.participant = participant;
    return true;
  }
}
