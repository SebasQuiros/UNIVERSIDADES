import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── List attempts: student sees own, teacher sees attempts for their courses ──
  async findAll(userId: string, userRole: string) {
    if (userRole === 'STUDENT') {
      return this.prisma.exerciseAttempt.findMany({
        where:   { studentId: userId },
        include: {
          exercise: {
            select: {
              id: true, title: true, difficulty: true, type: true,
              dueDate: true, maxScore: true,
              course: { select: { id: true, name: true, period: true } },
            },
          },
          studentProgress: true,
          company:         { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
    }

    // TEACHER: see attempts for exercises in their courses
    if (userRole === 'TEACHER') {
      return this.prisma.exerciseAttempt.findMany({
        where: {
          exercise: { course: { teacherId: userId } },
        },
        include: {
          exercise: {
            select: {
              id: true, title: true,
              course: { select: { id: true, name: true } },
            },
          },
          student:         { select: { id: true, name: true, email: true } },
          studentProgress: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
    }

    // ADMIN / SUPERADMIN: see all
    return this.prisma.exerciseAttempt.findMany({
      include: {
        exercise: { select: { id: true, title: true } },
        student:  { select: { id: true, name: true, email: true } },
        studentProgress: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
  }

  // ── Get one attempt (student: own / teacher: their course / admin: any) ──
  async findOne(attemptId: string, userId: string, userRole: string) {
    const attempt = await this.prisma.exerciseAttempt.findUnique({
      where:   { id: attemptId },
      include: {
        exercise: {
          include: {
            rubrics: { orderBy: { order: 'asc' } },
            course:  { select: { id: true, name: true, teacherId: true, universityId: true } },
          },
        },
        student:         { select: { id: true, name: true, email: true } },
        gradedBy:        { select: { id: true, name: true } },
        studentProgress: true,
        company:         { select: { id: true, name: true } },
        activityTracking: {
          orderBy: { createdAt: 'desc' },
          take:    20,
        },
      },
    });

    if (!attempt) throw new NotFoundException('Intento no encontrado');

    this._assertAccess(attempt, userId, userRole);
    return attempt;
  }

  // ── Start attempt: set startedAt + status IN_PROGRESS + create SessionTracking ──
  async start(attemptId: string, userId: string) {
    const attempt = await this.prisma.exerciseAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) throw new NotFoundException('Intento no encontrado');

    if (attempt.studentId !== userId) {
      throw new ForbiddenException('Solo el estudiante puede iniciar su propio intento');
    }

    if (attempt.status === 'GRADED') {
      throw new BadRequestException('Este intento ya fue calificado');
    }

    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.exerciseAttempt.update({
        where: { id: attemptId },
        data: {
          status:    'IN_PROGRESS',
          startedAt: attempt.startedAt ?? now,
          updatedAt: now,
        },
      });

      // Create a new session tracking record each time student starts/resumes
      await tx.sessionTracking.create({
        data: {
          attemptId,
          studentId:  userId,
          startedAt:  now,
          lastPingAt: now,
        },
      });

      return result;
    });

    return { message: 'Ejercicio iniciado', attempt: updated };
  }

  // ── Submit attempt: set status SUBMITTED + submittedAt ──
  async submit(attemptId: string, userId: string) {
    const attempt = await this.prisma.exerciseAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) throw new NotFoundException('Intento no encontrado');
    if (attempt.studentId !== userId) {
      throw new ForbiddenException('Solo el estudiante puede enviar su propio intento');
    }
    if (attempt.status === 'SUBMITTED' || attempt.status === 'GRADED') {
      throw new BadRequestException('Este intento ya fue enviado');
    }
    if (attempt.status === 'NOT_STARTED') {
      throw new BadRequestException('Debes iniciar el ejercicio antes de enviarlo');
    }

    const updated = await this.prisma.exerciseAttempt.update({
      where: { id: attemptId },
      data:  { status: 'SUBMITTED', submittedAt: new Date() },
    });

    return { message: 'Ejercicio enviado para calificación', attempt: updated };
  }

  // ── Internal helper: validate access ──
  private _assertAccess(attempt: any, userId: string, userRole: string) {
    if (userRole === 'SUPERADMIN' || userRole === 'ADMIN') return;

    if (userRole === 'STUDENT') {
      if (attempt.studentId !== userId) {
        throw new ForbiddenException('No tienes acceso a este intento');
      }
      return;
    }

    if (userRole === 'TEACHER') {
      if (attempt.exercise?.course?.teacherId !== userId) {
        throw new ForbiddenException('Solo el profesor del curso puede ver este intento');
      }
    }
  }

  // ── Stats for student progress page ──────────────────────────────────────
  async getStats(studentId: string) {
    const attempts = await this.prisma.exerciseAttempt.findMany({
      where: { studentId },
      include: {
        exercise:        { select: { title: true, difficulty: true, maxScore: true } },
        studentProgress: { select: { timeSpentMin: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const total      = attempts.length;
    const graded     = attempts.filter(a => a.status === 'GRADED');
    const submitted  = attempts.filter(a => a.status === 'SUBMITTED').length;
    const inProgress = attempts.filter(a => a.status === 'IN_PROGRESS').length;
    const notStarted = attempts.filter(a => a.status === 'NOT_STARTED').length;

    const scores = graded
      .filter(a => a.score != null && a.maxScore != null && Number(a.maxScore) > 0)
      .map(a => Math.round((Number(a.score) / Number(a.maxScore)) * 100));

    const avgPct   = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
    const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const totalTimeMin = attempts.reduce((s, a) => s + (a.studentProgress?.timeSpentMin ?? 0), 0);

    const scoreHistory = graded
      .filter(a => a.score != null && a.maxScore != null && Number(a.maxScore) > 0)
      .map(a => ({
        title:     a.exercise?.title ?? 'Ejercicio',
        pct:       Math.round((Number(a.score) / Number(a.maxScore)) * 100),
        score:     Number(a.score),
        maxScore:  Number(a.maxScore),
        date:      a.gradedAt ? a.gradedAt.toISOString() : null,
        difficulty: a.exercise?.difficulty ?? 'BASIC',
      }));

    // Group by difficulty
    const diffMap = new Map<string, number[]>();
    for (const h of scoreHistory) {
      if (!diffMap.has(h.difficulty)) diffMap.set(h.difficulty, []);
      diffMap.get(h.difficulty)!.push(h.pct);
    }
    const ORDER = ['BASIC', 'INTERMEDIATE', 'ADVANCED'];
    const LABEL: Record<string, string> = { BASIC: 'Básico', INTERMEDIATE: 'Intermedio', ADVANCED: 'Avanzado' };
    const difficultyData = ORDER
      .filter(d => diffMap.has(d))
      .map(d => {
        const vals = diffMap.get(d)!;
        return {
          name:   LABEL[d] ?? d,
          total:  vals.length,
          graded: vals.length,
          avgPct: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
        };
      });

    return { total, graded: graded.length, submitted, inProgress, notStarted, avgPct, bestScore, totalTimeMin, scoreHistory, difficultyData };
  }

  // ── Gamificación global (XP, niveles, ranking) ────────────────
  // XP por ejercicio calificado = pct (0-100) × multiplicador de dificultad.
  // El ranking se calcula entre estudiantes de la MISMA universidad.
  async getGamification(studentId: string, universityId?: string | null) {
    const DIFF_MULT: Record<string, number> = {
      BASIC: 1, INTERMEDIATE: 1.5, ADVANCED: 2,
    };

    // Niveles temáticos contables (XP acumulado mínimo)
    const LEVELS = [
      { min: 0,    name: 'Auxiliar Contable',   icon: '📋' },
      { min: 300,  name: 'Asistente Contable',  icon: '🧮' },
      { min: 800,  name: 'Contador Jr.',        icon: '📊' },
      { min: 1500, name: 'Contador',            icon: '💼' },
      { min: 2500, name: 'Contador Senior',     icon: '🏆' },
      { min: 4000, name: 'Gerente Financiero',  icon: '👔' },
      { min: 6000, name: 'CFO',                 icon: '👑' },
    ];

    const xpForAttempt = (score: any, maxScore: any, difficulty?: string) => {
      if (score == null || maxScore == null || Number(maxScore) <= 0) return 0;
      const pct  = (Number(score) / Number(maxScore)) * 100;
      const mult = DIFF_MULT[difficulty ?? 'BASIC'] ?? 1;
      return Math.round(pct * mult);
    };

    // Cargar al estudiante (para su universidad si no llegó por token)
    const me = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, avatarUrl: true, universityId: true },
    });
    const uniId = universityId ?? me?.universityId ?? null;

    // Estudiantes de la misma universidad (pool de ranking)
    const peers = uniId
      ? await this.prisma.user.findMany({
          where: { universityId: uniId, role: 'STUDENT' as any },
          select: { id: true, name: true, avatarUrl: true },
        })
      : (me ? [{ id: me.id, name: me.name, avatarUrl: me.avatarUrl }] : []);

    const peerIds = peers.map(p => p.id);

    // Todos los intentos calificados del pool en una sola query
    const gradedAttempts = peerIds.length
      ? await this.prisma.exerciseAttempt.findMany({
          where: { studentId: { in: peerIds }, status: 'GRADED' as any },
          select: {
            studentId: true, score: true, maxScore: true,
            exercise: { select: { difficulty: true } },
          },
        })
      : [];

    // XP acumulado por estudiante
    const xpMap = new Map<string, { xp: number; completed: number }>();
    for (const p of peerIds) xpMap.set(p, { xp: 0, completed: 0 });
    for (const a of gradedAttempts) {
      const cur = xpMap.get(a.studentId) ?? { xp: 0, completed: 0 };
      cur.xp += xpForAttempt(a.score, a.maxScore, a.exercise?.difficulty);
      cur.completed += 1;
      xpMap.set(a.studentId, cur);
    }

    // Leaderboard ordenado
    const leaderboard = peers
      .map(p => ({
        id:        p.id,
        name:      p.name,
        avatarUrl: p.avatarUrl,
        xp:        xpMap.get(p.id)?.xp ?? 0,
        completed: xpMap.get(p.id)?.completed ?? 0,
        isMe:      p.id === studentId,
      }))
      .sort((a, b) => b.xp - a.xp || b.completed - a.completed);

    // Asignar rank (1-based)
    leaderboard.forEach((r, i) => ((r as any).rank = i + 1));

    const myXp   = xpMap.get(studentId)?.xp ?? 0;
    const myRank = leaderboard.find(r => r.isMe)?.rank ?? null;

    // Nivel actual + progreso al siguiente
    const levelIdx  = [...LEVELS].reverse().findIndex(l => myXp >= l.min);
    const idx       = levelIdx === -1 ? 0 : LEVELS.length - 1 - levelIdx;
    const level     = LEVELS[idx];
    const nextLevel = LEVELS[idx + 1] ?? null;
    const xpIntoLevel = myXp - level.min;
    const xpForNext   = nextLevel ? nextLevel.min - level.min : 0;
    const levelPct    = nextLevel ? Math.min(100, Math.round((xpIntoLevel / xpForNext) * 100)) : 100;

    return {
      xp: myXp,
      level: { index: idx, name: level.name, icon: level.icon, min: level.min },
      nextLevel: nextLevel
        ? { name: nextLevel.name, icon: nextLevel.icon, min: nextLevel.min, xpRemaining: nextLevel.min - myXp }
        : null,
      levelPct,
      rank: myRank,
      totalStudents: leaderboard.length,
      completed: xpMap.get(studentId)?.completed ?? 0,
      leaderboard: leaderboard.slice(0, 10),  // top 10 + (mi posición si está fuera abajo)
      levels: LEVELS,
    };
  }
}
