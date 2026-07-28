import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AutoGradingService } from '../grading/auto-grading.service';

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly autoGrading: AutoGradingService,
  ) {}

  // ── Vencimiento (spec UTN §2) ────────────────────────────────────────────
  // Sin job en segundo plano: se evalúa perezosamente cada vez que se ACCEDE
  // al intento (findOne/start) o se lista (findAll de STUDENT — lista acotada
  // a sus propios intentos). `exercise.settings.onExpiry` ('LOCK' por
  // defecto | 'AUTO_SUBMIT') decide qué pasa: bloquear (queda "Vencida",
  // solo lectura vía isReadonly) o entregar automáticamente (auto-califica
  // igual que una entrega normal).
  private isPastDue(dueDate: Date | null, status: string): boolean {
    return !!dueDate && dueDate.getTime() < Date.now()
      && (status === 'NOT_STARTED' || status === 'IN_PROGRESS');
  }

  /** Persiste la transición (OVERDUE o auto-entrega) si corresponde. Devuelve
   *  el intento actualizado, o el original si no había vencido. */
  private async applyExpiryIfNeeded(attempt: any, exercise: { dueDate: Date | null; settings: any }) {
    if (!this.isPastDue(exercise.dueDate, attempt.status)) return attempt;

    const onExpiry = exercise.settings?.onExpiry === 'AUTO_SUBMIT' ? 'AUTO_SUBMIT' : 'LOCK';

    if (onExpiry === 'AUTO_SUBMIT') {
      await this.prisma.exerciseAttempt.update({
        where: { id: attempt.id },
        data:  { status: 'SUBMITTED', submittedAt: new Date() },
      });
      await this.autoGrading.gradeAndSave(attempt.id).catch(() => null);
      return this.prisma.exerciseAttempt.findUnique({ where: { id: attempt.id } });
    }

    return this.prisma.exerciseAttempt.update({
      where: { id: attempt.id },
      data:  { status: 'OVERDUE' },
    });
  }

  // ── List attempts: student sees own, teacher sees attempts for their courses ──
  // `mineOnly` fuerza "solo mis propios intentos" sin importar el rol — lo usa
  // el espacio Educación cuando un profesor entra a probar como estudiante
  // (ve solo SU intento de vista previa, no los de sus estudiantes reales).
  async findAll(userId: string, userRole: string, mineOnly = false) {
    if (userRole === 'STUDENT' || mineOnly) {
      const attempts = await this.prisma.exerciseAttempt.findMany({
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

      // Overlay de visualización: marca "Vencida" sin persistir. La transición
      // real (auto-entrega/bloqueo) se aplica al abrir el intento en findOne.
      return attempts.map((a) =>
        this.isPastDue(a.exercise?.dueDate ?? null, a.status)
          ? { ...a, status: 'OVERDUE' as const }
          : a,
      );
    }

    // TEACHER: see attempts for exercises in their courses (isPreview=false —
    // excluye su propio intento de vista previa, que no es una entrega real).
    if (userRole === 'TEACHER') {
      return this.prisma.exerciseAttempt.findMany({
        where: {
          exercise:  { course: { teacherId: userId } },
          isPreview: false,
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

    // ADMIN → SOLO su institución (universidad/colegio). SUPERADMIN → todo.
    // Antes ambos veían TODOS los intentos de la plataforma: el admin de un
    // colegio podía leer las notas y el avance de los alumnos de otra
    // institución. El scope se aplica por la universidad del curso.
    if (userRole === 'ADMIN') {
      const admin = await this.prisma.user.findUnique({
        where: { id: userId }, select: { universityId: true },
      });
      // Falla cerrado: un ADMIN sin institución no ve nada.
      if (!admin?.universityId) return [];
      return this.prisma.exerciseAttempt.findMany({
        where: { exercise: { course: { universityId: admin.universityId } } },
        include: {
          exercise: { select: { id: true, title: true } },
          student:  { select: { id: true, name: true, email: true } },
          studentProgress: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      });
    }

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

    // Aislamiento entre instituciones para ADMIN: solo puede abrir intentos de
    // cursos de SU universidad/colegio (falla cerrado si no tiene institución).
    if (userRole === 'ADMIN') {
      const admin = await this.prisma.user.findUnique({
        where: { id: userId }, select: { universityId: true },
      });
      if (!admin?.universityId || attempt.exercise?.course?.universityId !== admin.universityId) {
        throw new ForbiddenException('Este intento pertenece a otra institución.');
      }
    }

    // Vencimiento — se evalúa cada vez que se abre el intento (ver helper).
    const updatedForExpiry = await this.applyExpiryIfNeeded(attempt, attempt.exercise);
    if (updatedForExpiry && updatedForExpiry.status !== attempt.status) {
      (attempt as any).status      = updatedForExpiry.status;
      (attempt as any).submittedAt = updatedForExpiry.submittedAt;
      (attempt as any).score       = (updatedForExpiry as any).score;
    }

    // Sesión de Aula (GROUP): la empresa del grupo cuelga del ejercicio, no del
    // intento (attemptId null), así que `attempt.company` viene null. La
    // resolvemos vía CompanyMembership para que el workspace no muestre el alta de
    // una empresa individual espuria (showSetup = IN_PROGRESS && !company).
    if (!attempt.company) {
      const group = await this.prisma.company.findFirst({
        where: {
          exerciseId:  attempt.exerciseId,
          mode:        'GROUP',
          memberships: { some: { userId: attempt.studentId } },
        },
        select: { id: true, name: true },
      });
      if (group) (attempt as any).company = group;
    }

    // M1: no filtrar la clave de respuestas al alumno. Para criterios answer-key
    // (p.ej. account_balance_gte "CODIGO:MONTO") `expectedValue` es la solución
    // del auto-grading. El STUDENT recibe la rúbrica SIN `expectedValue`; el staff
    // la recibe completa. Redacción post-fetch para no alterar el shape de la query.
    if (userRole === 'STUDENT' && (attempt as any).exercise?.rubrics) {
      (attempt as any).exercise.rubrics = (attempt as any).exercise.rubrics.map(
        ({ expectedValue: _drop, ...rest }: any) => rest,
      );
    }

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

    // Vencida (OVERDUE) es un estado "tarde" pero NO bloquea: se puede reanudar
    // y seguir trabajando. Solo se corta si el ejercicio quedó ENTREGADO (p.ej.
    // por auto-entrega al vencer, cuando el profe eligió AUTO_SUBMIT) o calificado.
    const exercise = await this.prisma.exercise.findUnique({
      where:  { id: attempt.exerciseId },
      select: { dueDate: true, settings: true },
    });
    const applied = await this.applyExpiryIfNeeded(
      attempt,
      { dueDate: exercise?.dueDate ?? null, settings: exercise?.settings },
    ) ?? attempt;
    if (applied.status === 'SUBMITTED' || applied.status === 'GRADED') {
      throw new BadRequestException('Este ejercicio ya fue entregado y no puede reabrirse.');
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

    // ── Auto-calificar al entregar ──────────────────────────────
    // Si el ejercicio tiene rúbricas, se califica solo (queda GRADED).
    // Si no, queda SUBMITTED para que el profe lo revise a mano.
    const graded = await this.autoGrading.gradeAndSave(attemptId).catch(() => null);
    const finalAttempt = graded
      ? await this.prisma.exerciseAttempt.findUnique({ where: { id: attemptId } })
      : updated;

    return {
      message: graded
        ? `¡Ejercicio entregado y calificado! Puntaje: ${graded.score}/${graded.maxScore}.`
        : 'Ejercicio enviado para calificación.',
      attempt: finalAttempt,
      autoGraded: !!graded,
    };
  }

  // ── Reopen a submitted/graded attempt (teacher of the course or admin) ──
  async reopen(attemptId: string, userId: string, userRole: string) {
    const attempt = await this.prisma.exerciseAttempt.findUnique({
      where:   { id: attemptId },
      include: { exercise: { include: { course: { select: { teacherId: true } } } } },
    });
    if (!attempt) throw new NotFoundException('Intento no encontrado');

    const isStaff = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
    if (!isStaff && attempt.exercise.course.teacherId !== userId) {
      throw new ForbiddenException('Solo el profesor del curso puede reabrir el intento');
    }
    if (attempt.status !== 'SUBMITTED' && attempt.status !== 'GRADED') {
      throw new BadRequestException('Solo se pueden reabrir intentos entregados o calificados');
    }

    const updated = await this.prisma.exerciseAttempt.update({
      where: { id: attemptId },
      data:  {
        status:      'IN_PROGRESS',
        submittedAt: null,
        gradedAt:    null,
        score:       null,
        feedback:    null,
      },
    });
    return { message: 'Intento reabierto. El estudiante puede corregir y volver a entregar.', attempt: updated };
  }

  // ── Internal helper: validate access ──
  private _assertAccess(attempt: any, userId: string, userRole: string) {
    if (userRole === 'SUPERADMIN') return;

    // ADMIN: solo intentos de SU institución. La validación real (con acceso a
    // BD) la hace `_assertAdminSameUniversity`; acá marcamos que no es acceso
    // libre. Antes el ADMIN podía abrir el intento de un alumno de otra
    // universidad/colegio y ver su nota y su avance.
    if (userRole === 'ADMIN') return;

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
        rank:      0,
      }))
      .sort((a, b) => b.xp - a.xp || b.completed - a.completed);

    // Asignar rank (1-based)
    leaderboard.forEach((r, i) => { r.rank = i + 1; });

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
