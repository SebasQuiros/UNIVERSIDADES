import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackEventDto } from './dto/tracking.dto';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Register activity event ──────────────────────────────────────────────────
  async track(attemptId: string, userId: string, dto: TrackEventDto) {
    const attempt = await this._getAttemptForStudent(attemptId, userId);

    await this.prisma.activityTracking.create({
      data: {
        attemptId,
        studentId: userId,
        event:     dto.event as any,
        metadata:  (dto.metadata ?? {}) as any,
      },
    });

    // Update lastActivity on StudentProgress
    await this.prisma.studentProgress.updateMany({
      where: { attemptId },
      data:  { lastActivity: new Date(), updatedAt: new Date() },
    });

    return { message: 'Evento registrado', event: dto.event };
  }

  // ── Ping: update session time ────────────────────────────────────────────────
  async ping(attemptId: string, userId: string) {
    const attempt = await this._getAttemptForStudent(attemptId, userId);
    const now     = new Date();

    // Find the latest active session for this attempt
    const session = await this.prisma.sessionTracking.findFirst({
      where:   { attemptId, studentId: userId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });

    if (session) {
      // Calculate minutes elapsed since last ping
      const elapsedMs      = now.getTime() - session.lastPingAt.getTime();
      const elapsedMinutes = Math.floor(elapsedMs / 60_000);

      await this.prisma.sessionTracking.update({
        where: { id: session.id },
        data:  { lastPingAt: now },
      });

      // Add elapsed minutes to StudentProgress.timeSpentMin
      if (elapsedMinutes > 0) {
        const progress = await this.prisma.studentProgress.findUnique({
          where: { attemptId },
        });
        if (progress) {
          await this.prisma.studentProgress.update({
            where: { attemptId },
            data: {
              timeSpentMin: { increment: elapsedMinutes },
              lastActivity: now,
              updatedAt:    now,
            },
          });
        }
      }
    }

    return { message: 'Ping registrado', timestamp: now };
  }

  // ── Get progress (professor can also view) ────────────────────────────────────
  async getProgress(attemptId: string, userId: string, userRole: string) {
    const attempt = await this.prisma.exerciseAttempt.findUnique({
      where:   { id: attemptId },
      include: {
        exercise: {
          include: {
            rubrics: { orderBy: { order: 'asc' } },
            course:  { select: { teacherId: true } },
          },
        },
        studentProgress: true,
        company:         { select: { id: true, name: true } },
      },
    });

    if (!attempt) throw new NotFoundException('Intento no encontrado');

    // Access control
    if (userRole === 'STUDENT' && attempt.studentId !== userId) {
      throw new ForbiddenException('No tienes acceso a este intento');
    }
    if (userRole === 'TEACHER' && attempt.exercise?.course?.teacherId !== userId) {
      throw new ForbiddenException('Solo el profesor del curso puede ver este progreso');
    }

    // Recalculate live counts from company data
    let liveCounts = {
      invoicesCount:  0,
      entriesCount:   0,
      clientsCount:   0,
      productsCount:  0,
    };

    if (attempt.company?.id) {
      const companyId = attempt.company.id;
      const [invoices, entries, clients, products] = await Promise.all([
        this.prisma.invoice.count({ where: { companyId, status: { not: 'DRAFT' as any } } }),
        this.prisma.journalEntry.count({ where: { companyId, isReversed: false } }),
        this.prisma.client.count({ where: { companyId, isActive: true } }),
        this.prisma.product.count({ where: { companyId, isActive: true } }),
      ]);
      liveCounts = { invoicesCount: invoices, entriesCount: entries, clientsCount: clients, productsCount: products };

      // Update StudentProgress with live counts and recalculate progressPct
      const progressPct = this._calculateProgress(attempt.exercise?.rubrics ?? [], liveCounts);

      await this.prisma.studentProgress.updateMany({
        where: { attemptId },
        data: {
          invoicesCount:  liveCounts.invoicesCount,
          entriesCount:   liveCounts.entriesCount,
          clientsCount:   liveCounts.clientsCount,
          productsCount:  liveCounts.productsCount,
          progressPct,
          updatedAt:      new Date(),
        },
      });
    }

    const progress = await this.prisma.studentProgress.findUnique({
      where: { attemptId },
    });

    return {
      attempt: {
        id:          attempt.id,
        status:      attempt.status,
        startedAt:   attempt.startedAt,
        submittedAt: attempt.submittedAt,
        score:       attempt.score,
        maxScore:    attempt.maxScore,
      },
      progress,
      liveCounts,
    };
  }

  // ── Calculate progress % based on rubric criteria ─────────────────────────────
  private _calculateProgress(
    rubrics: Array<{ criterion: string; expectedValue: string | null }>,
    counts: { invoicesCount: number; entriesCount: number; clientsCount: number; productsCount: number },
  ): number {
    if (!rubrics.length) return 0;

    let satisfied = 0;
    for (const rubric of rubrics) {
      const expected = parseInt(rubric.expectedValue ?? '1', 10);
      switch (rubric.criterion) {
        case 'min_invoices':
          if (counts.invoicesCount >= expected) satisfied++;
          break;
        case 'min_clients':
          if (counts.clientsCount >= expected) satisfied++;
          break;
        case 'min_products':
          if (counts.productsCount >= expected) satisfied++;
          break;
        case 'min_entries':
          if (counts.entriesCount >= expected) satisfied++;
          break;
        default:
          break;
      }
    }

    return Math.min(100, Math.round((satisfied / rubrics.length) * 100));
  }

  // ── Get activity history ──────────────────────────────────────────────────────
  async getActivity(attemptId: string, userId: string, userRole: string) {
    const attempt = await this.prisma.exerciseAttempt.findUnique({
      where:   { id: attemptId },
      include: { exercise: { include: { course: { select: { teacherId: true } } } } },
    });
    if (!attempt) throw new NotFoundException('Intento no encontrado');
    if (userRole === 'STUDENT' && attempt.studentId !== userId) {
      throw new ForbiddenException('Sin acceso');
    }
    if (userRole === 'TEACHER' && attempt.exercise?.course?.teacherId !== userId) {
      throw new ForbiddenException('Sin acceso');
    }
    const [events, attempt2] = await Promise.all([
      this.prisma.activityTracking.findMany({
        where:   { attemptId },
        orderBy: { createdAt: 'asc' },
        take:    500,
      }),
      this.prisma.exerciseAttempt.findUnique({
        where:  { id: attemptId },
        select: { startedAt: true, submittedAt: true },
      }),
    ]);
    return { events, startedAt: attempt2?.startedAt ?? null, submittedAt: attempt2?.submittedAt ?? null };
  }

  // ── Register tab switch event ─────────────────────────────────────────────────
  async trackTabSwitch(attemptId: string, userId: string, count: number, timestamp?: string) {
    await this._getAttemptForStudent(attemptId, userId);

    await this.prisma.activityTracking.create({
      data: {
        attemptId,
        studentId: userId,
        event:    'EXERCISE_OPENED' as any, // reusing closest enum — metadata distinguishes it
        metadata: {
          type:      'TAB_SWITCH',
          count,
          timestamp: timestamp ?? new Date().toISOString(),
        } as any,
      },
    });

    // Count total tab switches for this attempt
    const tabSwitchCount = await this.prisma.activityTracking.count({
      where: {
        attemptId,
        metadata: { path: ['type'], equals: 'TAB_SWITCH' },
      },
    });

    await this.prisma.studentProgress.updateMany({
      where: { attemptId },
      data:  { lastActivity: new Date(), updatedAt: new Date() },
    });

    return { message: 'Cambio de pestaña registrado', tabSwitchCount };
  }

  // ── Get tab switch count for an attempt ───────────────────────────────────────
  async getTabSwitchCount(attemptId: string): Promise<number> {
    return this.prisma.activityTracking.count({
      where: {
        attemptId,
        metadata: { path: ['type'], equals: 'TAB_SWITCH' },
      },
    });
  }

  private async _getAttemptForStudent(attemptId: string, userId: string) {
    const attempt = await this.prisma.exerciseAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) throw new NotFoundException('Intento no encontrado');
    if (attempt.studentId !== userId) {
      throw new ForbiddenException('Solo el estudiante puede registrar actividad en su intento');
    }
    return attempt;
  }
}
