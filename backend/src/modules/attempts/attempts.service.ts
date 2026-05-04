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
}
