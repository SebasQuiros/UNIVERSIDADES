import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateExerciseConfigDto } from './dto/exercise-config.dto';

/**
 * ExerciseConfigService — Fase 1 del Config Engine.
 *
 * - GET es read-only y accesible para cualquier usuario que pueda ver el ejercicio.
 *   Si el registro aún no existe (raro post-migración, pero puede ocurrir si un
 *   exercise se creó con un service que aún no auto-crea config), lo creamos
 *   on-the-fly con los defaults del schema.
 *
 * - UPDATE solo TEACHER/ADMIN/SUPERADMIN, y se BLOQUEA si Exercise.isPublished.
 *   El profesor debe ajustar antes de publicar; al publicar la config queda
 *   congelada para preservar consistencia académica entre estudiantes.
 *
 * - Validación de dueño: TEACHER solo puede tocar exercises de sus cursos.
 *   ADMIN/SUPERADMIN pueden tocar cualquiera (universidad o global).
 */
@Injectable()
export class ExerciseConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve la config del ejercicio. La crea con defaults si no existe.
   * Usa `upsert` para tolerar carreras concurrentes (dos GET simultáneos
   * sobre un exercise sin config no harán dos creates).
   */
  async findByExercise(exerciseId: string) {
    await this._assertExerciseExists(exerciseId);
    return this.prisma.exerciseConfig.upsert({
      where:  { exerciseId },
      create: { exerciseId },
      update: {}, // no-op si ya existe
    });
  }

  /** PUT/PATCH: actualiza config; bloqueado si el ejercicio ya está publicado. */
  async update(
    exerciseId: string,
    user: { id: string; role: string },
    dto: UpdateExerciseConfigDto,
  ) {
    const exercise = await this._assertExerciseExists(exerciseId);

    // ── Lock al publicar / archivar ──────────────────────────
    if (exercise.isPublished) {
      throw new ForbiddenException(
        'La configuración está bloqueada porque el ejercicio ya fue publicado. ' +
        'Para modificarla, despublicá el ejercicio primero.',
      );
    }
    if (exercise.isArchived) {
      throw new ForbiddenException(
        'No se puede modificar la configuración de un ejercicio archivado.',
      );
    }

    // ── Ownership: TEACHER solo sus cursos ────────────────────
    if (user.role === 'TEACHER' && exercise.teacherId !== user.id) {
      throw new ForbiddenException('No sos el profesor de este ejercicio.');
    }

    // upsert: si por algún motivo no había config aún, la crea con dto + defaults.
    return this.prisma.exerciseConfig.upsert({
      where:  { exerciseId },
      create: { exerciseId, ...dto },
      update: { ...dto },
    });
  }

  // ── Helpers ──────────────────────────────────────────────────

  private async _assertExerciseExists(exerciseId: string) {
    const exercise = await this.prisma.exercise.findUnique({
      where:  { id: exerciseId },
      select: { id: true, teacherId: true, isPublished: true, isArchived: true },
    });
    if (!exercise) throw new NotFoundException('Ejercicio no encontrado');
    return exercise;
  }
}
