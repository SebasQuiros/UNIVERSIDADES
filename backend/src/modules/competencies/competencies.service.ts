import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface UpsertCompetencyDto {
  code: string;
  name: string;
  description?: string;
  area?: 'CONTABLE' | 'TRIBUTARIO' | 'FINANCIERO' | 'COSTOS' | 'AUDITORIA' | 'DATOS' | 'GESTION';
  level?: number;
  order?: number;
  isActive?: boolean;
}

export interface ExerciseCompetencyLink {
  competencyId: string;
  weight?: number;
}

@Injectable()
export class CompetenciesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Catálogo visible para un usuario: las competencias globales
   * (universityId = NULL) más las propias de su universidad.
   */
  async listCatalog(universityId?: string | null) {
    return this.prisma.competency.findMany({
      where: {
        isActive: true,
        OR: [
          { universityId: null },
          ...(universityId ? [{ universityId }] : []),
        ],
      },
      orderBy: [{ order: 'asc' }, { code: 'asc' }],
      include: { _count: { select: { exercises: true, rubrics: true } } },
    });
  }

  async create(dto: UpsertCompetencyDto, universityId?: string | null) {
    return this.prisma.competency.create({
      data: {
        universityId: universityId ?? null,
        code:        dto.code,
        name:        dto.name,
        description: dto.description ?? null,
        area:        (dto.area ?? 'CONTABLE') as any,
        level:       dto.level ?? null,
        order:       dto.order ?? 0,
        isActive:    dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: Partial<UpsertCompetencyDto>) {
    const exists = await this.prisma.competency.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Competencia no encontrada');
    return this.prisma.competency.update({
      where: { id },
      data: {
        code:        dto.code        ?? undefined,
        name:        dto.name        ?? undefined,
        description: dto.description ?? undefined,
        area:        (dto.area as any) ?? undefined,
        level:       dto.level       ?? undefined,
        order:       dto.order       ?? undefined,
        isActive:    dto.isActive    ?? undefined,
      },
    });
  }

  async remove(id: string) {
    const exists = await this.prisma.competency.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Competencia no encontrada');
    await this.prisma.competency.delete({ where: { id } });
    return { ok: true };
  }

  // ── Vínculo Exercise ↔ Competency ─────────────────────────────
  async getExerciseCompetencies(exerciseId: string) {
    return this.prisma.exerciseCompetency.findMany({
      where: { exerciseId },
      include: { competency: true },
      orderBy: { competency: { order: 'asc' } },
    });
  }

  /** Reemplaza el conjunto de competencias vinculadas a un ejercicio. */
  async setExerciseCompetencies(exerciseId: string, links: ExerciseCompetencyLink[]) {
    const exercise = await this.prisma.exercise.findUnique({ where: { id: exerciseId } });
    if (!exercise) throw new NotFoundException('Ejercicio no encontrado');

    const clean = (links ?? []).filter(l => l.competencyId);
    await this.prisma.$transaction([
      this.prisma.exerciseCompetency.deleteMany({ where: { exerciseId } }),
      ...(clean.length
        ? [this.prisma.exerciseCompetency.createMany({
            data: clean.map(l => ({
              exerciseId,
              competencyId: l.competencyId,
              weight: l.weight ?? 1,
            })),
            skipDuplicates: true,
          })]
        : []),
    ]);
    return this.getExerciseCompetencies(exerciseId);
  }
}
