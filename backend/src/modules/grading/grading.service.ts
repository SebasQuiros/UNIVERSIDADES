import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GradeAttemptDto } from './dto/grading.dto';
import { EmailService } from '../notifications/email.service';

@Injectable()
export class GradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  // ── List all attempts for an exercise (teacher only) ─────────────────────────
  async listAttempts(courseId: string, exerciseId: string, userId: string, userRole: string) {
    const exercise = await this.prisma.exercise.findFirst({
      where:   { id: exerciseId, courseId },
      include: { course: { select: { teacherId: true } } },
    });
    if (!exercise) throw new NotFoundException('Ejercicio no encontrado');

    if (userRole === 'TEACHER' && exercise.course.teacherId !== userId) {
      throw new ForbiddenException('Solo el profesor del curso puede ver los intentos');
    }

    return this.prisma.exerciseAttempt.findMany({
      where:   { exerciseId },
      include: {
        student:         { select: { id: true, name: true, email: true } },
        gradedBy:        { select: { id: true, name: true } },
        studentProgress: true,
        company:         { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── Grade an attempt (teacher only) ──────────────────────────────────────────
  async grade(attemptId: string, userId: string, dto: GradeAttemptDto) {
    const attempt = await this.prisma.exerciseAttempt.findUnique({
      where:   { id: attemptId },
      include: {
        exercise: {
          include: {
            rubrics: true,
            course:  { select: { teacherId: true, name: true } },
          },
        },
        student: { select: { id: true, name: true, email: true } },
      },
    });
    if (!attempt) throw new NotFoundException('Intento no encontrado');

    if (attempt.exercise.course.teacherId !== userId) {
      throw new ForbiddenException('Solo el profesor del curso puede calificar este intento');
    }

    if (attempt.status === 'NOT_STARTED') {
      throw new BadRequestException('No se puede calificar un intento que no ha sido iniciado');
    }

    const maxScore = Number(attempt.maxScore);
    if (dto.score > maxScore) {
      throw new BadRequestException(
        `La calificación no puede superar el puntaje máximo de ${maxScore}`,
      );
    }

    // Store feedback + per-rubric comments as structured JSON
    let feedbackStr: string | null = null;
    const hasRubricComments = dto.rubricComments && Object.keys(dto.rubricComments).length > 0;
    if (dto.feedback || hasRubricComments) {
      feedbackStr = JSON.stringify({
        text:   dto.feedback       ?? '',
        rubric: dto.rubricComments ?? {},
      });
    }

    const now     = new Date();
    const updated = await this.prisma.exerciseAttempt.update({
      where: { id: attemptId },
      data: {
        score:      dto.score,
        feedback:   feedbackStr,
        gradedById: userId,
        gradedAt:   now,
        status:     'GRADED',
        updatedAt:  now,
      },
    });

    const scorePct = Math.round((dto.score / maxScore) * 100);

    await this.prisma.notification.create({
      data: {
        userId:  attempt.student.id,
        title:   `Tu ejercicio fue calificado: ${attempt.exercise.title}`,
        body:    `Obtuviste ${dto.score} de ${maxScore} puntos (${scorePct}%).${dto.feedback ? ` Retroalimentación: ${dto.feedback}` : ''}`,
        type:    'GRADED',
        isRead:  false,
      },
    });

    this.email.send(
      attempt.student.email,
      `Ejercicio calificado: ${attempt.exercise.title}`,
      this.email.gradedHtml(attempt.student.name, attempt.exercise.title, dto.score, maxScore, dto.feedback),
    );

    return updated;
  }

  // ── Get grade for an attempt ──────────────────────────────────────────────────
  async getGrade(attemptId: string, userId: string, userRole: string) {
    const attempt = await this.prisma.exerciseAttempt.findUnique({
      where:   { id: attemptId },
      include: {
        exercise: {
          select: {
            id: true, title: true, maxScore: true,
            rubrics: { orderBy: { order: 'asc' } },
            course:  { select: { teacherId: true } },
          },
        },
        gradedBy: { select: { id: true, name: true } },
      },
    });
    if (!attempt) throw new NotFoundException('Intento no encontrado');

    if (userRole === 'STUDENT' && attempt.studentId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta calificación');
    }
    if (userRole === 'TEACHER' && attempt.exercise.course.teacherId !== userId) {
      throw new ForbiddenException('Solo el profesor del curso puede ver esta calificación');
    }

    // Parse structured feedback JSON
    let feedbackText: string | null = null;
    let rubricComments: Record<string, string> = {};
    if (attempt.feedback) {
      try {
        const parsed = JSON.parse(attempt.feedback);
        if (parsed.text !== undefined || parsed.rubric !== undefined) {
          feedbackText   = parsed.text   || null;
          rubricComments = parsed.rubric || {};
        } else {
          feedbackText = attempt.feedback;
        }
      } catch {
        feedbackText = attempt.feedback;
      }
    }

    return {
      attemptId:     attempt.id,
      status:        attempt.status,
      score:         attempt.score,
      maxScore:      attempt.maxScore,
      feedback:      feedbackText,
      rubricComments,
      gradedAt:      attempt.gradedAt,
      gradedBy:      attempt.gradedBy,
      exercise: {
        id:      attempt.exercise.id,
        title:   attempt.exercise.title,
        rubrics: (attempt.exercise as any).rubrics,
      },
    };
  }

  // ── Live dashboard ────────────────────────────────────────────────────────────
  async getLiveDashboard(courseId: string, exerciseId: string, teacherId: string) {
    const exercise = await this.prisma.exercise.findFirst({
      where:   { id: exerciseId, courseId },
      include: { course: { select: { teacherId: true, name: true } } },
    });
    if (!exercise) throw new NotFoundException('Ejercicio no encontrado');
    if (exercise.course.teacherId !== teacherId) {
      throw new ForbiddenException('Solo el profesor del curso puede ver este panel');
    }

    const attempts = await this.prisma.exerciseAttempt.findMany({
      where:   { exerciseId },
      include: {
        student:          { select: { id: true, name: true, email: true } },
        studentProgress:  true,
        activityTracking: {
          where: { metadata: { path: ['type'], equals: 'TAB_SWITCH' } },
          select: { id: true },
        },
        sessionTracking: {
          where:   { endedAt: null },
          orderBy: { lastPingAt: 'desc' },
          take:    1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const now = Date.now();

    const students = attempts.map(a => {
      const lastPing = a.sessionTracking[0]?.lastPingAt ?? null;
      const msSince  = lastPing ? now - new Date(lastPing).getTime() : null;

      let onlineStatus: 'ACTIVE' | 'IDLE' | 'OFFLINE' | 'NOT_STARTED' | 'SUBMITTED' | 'GRADED';
      if      (a.status === 'NOT_STARTED') onlineStatus = 'NOT_STARTED';
      else if (a.status === 'SUBMITTED')   onlineStatus = 'SUBMITTED';
      else if (a.status === 'GRADED')      onlineStatus = 'GRADED';
      else if (msSince === null)           onlineStatus = 'OFFLINE';
      else if (msSince < 2 * 60_000)      onlineStatus = 'ACTIVE';
      else if (msSince < 10 * 60_000)     onlineStatus = 'IDLE';
      else                                 onlineStatus = 'OFFLINE';

      const prog = a.studentProgress;
      return {
        attemptId:      a.id,
        studentId:      a.student.id,
        studentName:    a.student.name,
        studentEmail:   a.student.email,
        status:         a.status,
        onlineStatus,
        lastPingAt:     lastPing,
        startedAt:      a.startedAt,
        submittedAt:    a.submittedAt,
        score:          a.score,
        progressPct:    Number(prog?.progressPct ?? 0),
        invoicesCount:  prog?.invoicesCount  ?? 0,
        entriesCount:   prog?.entriesCount   ?? 0,
        clientsCount:   prog?.clientsCount   ?? 0,
        productsCount:  prog?.productsCount  ?? 0,
        timeSpentMin:   prog?.timeSpentMin   ?? 0,
        lastActivity:   prog?.lastActivity   ?? null,
        tabSwitchCount: a.activityTracking.length,
      };
    });

    const summary = {
      total:      students.length,
      notStarted: students.filter(s => s.status === 'NOT_STARTED').length,
      inProgress: students.filter(s => s.status === 'IN_PROGRESS').length,
      submitted:  students.filter(s => s.status === 'SUBMITTED').length,
      graded:     students.filter(s => s.status === 'GRADED').length,
      active:     students.filter(s => s.onlineStatus === 'ACTIVE').length,
    };

    return {
      exerciseId,
      exerciseTitle: exercise.title,
      courseName:    exercise.course.name,
      maxScore:      Number(exercise.maxScore),
      dueDate:       exercise.dueDate,
      summary,
      students,
    };
  }

  // ── Broadcast message to students ─────────────────────────────────────────────
  async broadcast(courseId: string, exerciseId: string, teacherId: string, message: string) {
    const exercise = await this.prisma.exercise.findFirst({
      where:   { id: exerciseId, courseId },
      include: { course: { select: { teacherId: true } } },
    });
    if (!exercise) throw new NotFoundException('Ejercicio no encontrado');
    if (exercise.course.teacherId !== teacherId) {
      throw new ForbiddenException('Solo el profesor del curso puede enviar mensajes');
    }
    if (!message?.trim()) throw new BadRequestException('El mensaje no puede estar vacío');

    const attempts = await this.prisma.exerciseAttempt.findMany({
      where: {
        exerciseId,
        status: { in: ['NOT_STARTED', 'IN_PROGRESS'] as any },
      },
      select: { studentId: true },
    });

    if (attempts.length === 0) return { sent: 0, message: 'No hay estudiantes activos' };

    await this.prisma.notification.createMany({
      data: attempts.map(a => ({
        userId: a.studentId,
        title:  `Mensaje del profesor — ${exercise.title}`,
        body:   message.trim(),
        type:   'INFO' as any,
        isRead: false,
      })),
    });

    return { sent: attempts.length };
  }
}
