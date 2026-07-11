import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ── Tipos deterministas del motor pedagógico ────────────────────────────────
export type PedagogySeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface EmitInput {
  studentId: string;
  companyId?: string | null;
  attemptId?: string | null;
  type: string;
  severity?: PedagogySeverity;
  area?: string | null;
  context: Record<string, any>;
  message?: string | null;
}

export interface RecurringError {
  type: string;
  count: number;
  lastSeen: string; // ISO
}

export interface ListEventsOpts {
  attemptId?: string;
  unresolvedOnly?: boolean;
  limit?: number;
}

// Umbral de dominio a partir del cual un área se considera "fortaleza".
const STRENGTH_MASTERY = 80;

/**
 * PedagogyService — el MOTOR DETERMINISTA.
 *
 * Este servicio decide QUÉ es una situación de aprendizaje (emite eventos
 * pedagógicos) y mantiene el LearningProfile del estudiante recomputándolo
 * de forma 100% determinista a partir de los datos fuente (intentos
 * calificados + eventos). NUNCA llama al LLM ni interpreta nada: sólo cuenta,
 * agrega y promedia. La verbalización vive en PedagogyAiService.
 */
@Injectable()
export class PedagogyService {
  constructor(private readonly prisma: PrismaService) {}

  // ── emit ──────────────────────────────────────────────────────────────────
  /**
   * Crea un PedagogicalEvent Y actualiza el LearningProfile del estudiante de
   * forma determinista: incrementa recurringErrors[type] y stats.totalEvents.
   * Devuelve el evento creado.
   */
  async emit(input: EmitInput) {
    const event = await this.prisma.pedagogicalEvent.create({
      data: {
        studentId: input.studentId,
        companyId: input.companyId ?? null,
        attemptId: input.attemptId ?? null,
        type:      input.type,
        severity:  input.severity ?? 'INFO',
        area:      input.area ?? null,
        context:   (input.context ?? {}) as any,
        message:   input.message ?? null,
      },
    });

    // Actualiza el perfil de forma determinista (upsert).
    await this._bumpProfileForEvent(input.studentId, input.type, event.createdAt);

    return event;
  }

  /**
   * Incremento determinista del perfil ante un nuevo evento: sube el contador
   * de recurringErrors para ese type y stats.totalEvents. Upsert del perfil.
   */
  private async _bumpProfileForEvent(studentId: string, type: string, at: Date) {
    const profile = await this.getOrCreateProfile(studentId);

    const recurring: RecurringError[] = Array.isArray(profile.recurringErrors)
      ? (profile.recurringErrors as unknown as RecurringError[])
      : [];
    const stats: Record<string, any> =
      profile.stats && typeof profile.stats === 'object' ? (profile.stats as any) : {};

    const existing = recurring.find(r => r.type === type);
    if (existing) {
      existing.count += 1;
      existing.lastSeen = at.toISOString();
    } else {
      recurring.push({ type, count: 1, lastSeen: at.toISOString() });
    }
    recurring.sort((a, b) => b.count - a.count);

    stats.totalEvents = (Number(stats.totalEvents) || 0) + 1;

    await this.prisma.learningProfile.update({
      where: { studentId },
      data: {
        recurringErrors: recurring as any,
        stats:           stats as any,
      },
    });
  }

  // ── getOrCreateProfile ──────────────────────────────────────────────────────
  /** Devuelve el LearningProfile del estudiante, creándolo vacío si no existe. */
  async getOrCreateProfile(studentId: string) {
    const existing = await this.prisma.learningProfile.findUnique({
      where: { studentId },
    });
    if (existing) return existing;

    return this.prisma.learningProfile.create({
      data: {
        studentId,
        competencyMastery: {} as any,
        strengths:         [] as any,
        recurringErrors:   [] as any,
        stats:             {} as any,
      },
    });
  }

  // ── listEvents ──────────────────────────────────────────────────────────────
  async listEvents(studentId: string, opts: ListEventsOpts = {}) {
    return this.prisma.pedagogicalEvent.findMany({
      where: {
        studentId,
        ...(opts.attemptId ? { attemptId: opts.attemptId } : {}),
        ...(opts.unresolvedOnly ? { resolved: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(opts.limit ?? 50, 1), 200),
    });
  }

  // ── markResolved ────────────────────────────────────────────────────────────
  async markResolved(eventId: string, studentId: string) {
    const event = await this.prisma.pedagogicalEvent.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException('Evento pedagógico no encontrado');
    if (event.studentId !== studentId) {
      throw new ForbiddenException('No puedes resolver un evento que no es tuyo');
    }
    return this.prisma.pedagogicalEvent.update({
      where: { id: eventId },
      data:  { resolved: true },
    });
  }

  // ── rebuildProfile ──────────────────────────────────────────────────────────
  /**
   * Recomputa el LearningProfile 100% DETERMINISTA a partir de los datos fuente:
   *   (a) competencyMastery: de los intentos GRADED del estudiante, unidos a las
   *       competencias del ejercicio (ExerciseCompetency → Competency.area).
   *       Reutiliza la MISMA fórmula de dominio que CompetenciesService.aggregate:
   *       pct = clamp((score / maxScore) * 100) por intento, promediado por área.
   *       Además guarda avgScore global e historial por ejercicio en stats.
   *   (b) recurringErrors: conteo de PedagogicalEvent por type.
   *   (c) strengths: áreas con dominio ≥ 80.
   * Guarda y devuelve el perfil.
   */
  async rebuildProfile(studentId: string) {
    // Aseguramos que el perfil exista (para el update final).
    await this.getOrCreateProfile(studentId);

    // ── (a) Intentos calificados + competencias del ejercicio ───────────────
    const attempts = await this.prisma.exerciseAttempt.findMany({
      where: { studentId, status: 'GRADED', score: { not: null } },
      select: {
        score:    true,
        maxScore: true,
        exercise: {
          select: {
            id:    true,
            title: true,
            competencies: {
              select: { competency: { select: { area: true } } },
            },
          },
        },
        gradedAt: true,
      },
      orderBy: { gradedAt: 'asc' },
    });

    // Dominio por área (misma normalización que CompetenciesService).
    const areaAgg = new Map<string, { sum: number; count: number }>();
    let overallSum = 0;
    let overallCount = 0;
    const exerciseHistory: Array<{
      exerciseId: string;
      title: string;
      pct: number;
      date: string | null;
    }> = [];

    for (const a of attempts) {
      const max = Number(a.maxScore ?? 100) || 100;
      const pct = Math.max(0, Math.min(100, (Number(a.score ?? 0) / max) * 100));
      overallSum += pct;
      overallCount++;

      exerciseHistory.push({
        exerciseId: a.exercise.id,
        title:      a.exercise.title,
        pct:        Math.round(pct * 10) / 10,
        date:       a.gradedAt ? a.gradedAt.toISOString() : null,
      });

      for (const link of a.exercise.competencies) {
        const area = link.competency?.area as string | undefined;
        if (!area) continue;
        const agg = areaAgg.get(area) ?? { sum: 0, count: 0 };
        agg.sum += pct;
        agg.count++;
        areaAgg.set(area, agg);
      }
    }

    const competencyMastery: Record<string, number> = {};
    for (const [area, agg] of areaAgg) {
      competencyMastery[area] = agg.count
        ? Math.round((agg.sum / agg.count) * 10) / 10
        : 0;
    }

    const avgScore = overallCount
      ? Math.round((overallSum / overallCount) * 10) / 10
      : 0;

    // ── (b) recurringErrors: conteo determinista de eventos por type ────────
    const eventsByType = await this.prisma.pedagogicalEvent.groupBy({
      by: ['type'],
      where: { studentId },
      _count: { type: true },
      _max:   { createdAt: true },
    });
    const recurringErrors: RecurringError[] = eventsByType
      .map(g => ({
        type:     g.type,
        count:    g._count.type,
        lastSeen: (g._max.createdAt ?? new Date()).toISOString(),
      }))
      .sort((a, b) => b.count - a.count);

    const totalEvents = recurringErrors.reduce((s, r) => s + r.count, 0);

    // ── (c) strengths: áreas con dominio ≥ 80 ───────────────────────────────
    const strengths = Object.entries(competencyMastery)
      .filter(([, pct]) => pct >= STRENGTH_MASTERY)
      .map(([area, pct]) => ({ area, mastery: pct }));

    // Preserva stats previas y sobre-escribe las derivadas.
    const prev = await this.prisma.learningProfile.findUnique({ where: { studentId } });
    const prevStats: Record<string, any> =
      prev?.stats && typeof prev.stats === 'object' ? (prev.stats as any) : {};

    const stats = {
      ...prevStats,
      totalEvents,
      exercisesGraded: overallCount,
      avgScore,
      exerciseHistory,
      rebuiltAt: new Date().toISOString(),
    };

    return this.prisma.learningProfile.update({
      where: { studentId },
      data: {
        competencyMastery: competencyMastery as any,
        strengths:         strengths as any,
        recurringErrors:   recurringErrors as any,
        stats:             stats as any,
      },
    });
  }
}
