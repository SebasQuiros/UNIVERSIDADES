import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const AT_RISK_MASTERY = 60;   // % por debajo del cual un alumno está "en riesgo"
const AT_RISK_COVERAGE = 0.34; // fracción mínima de ejercicios calificados

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


  /**
   * Aislamiento multi-tenant del catálogo de competencias.
   * Las competencias con `universityId: null` son del catálogo GLOBAL y solo
   * SUPERADMIN puede tocarlas. El resto pertenece a una institución concreta.
   * Antes update/remove no validaban NADA: un profesor de un colegio podía
   * renombrar o borrar las competencias de acreditación de otra universidad.
   */
  private async _assertCanMutateCompetency(
    id: string,
    caller?: { id?: string; role?: string; universityId?: string | null },
  ) {
    const comp = await this.prisma.competency.findUnique({
      where: { id }, select: { id: true, universityId: true },
    });
    if (!comp) throw new NotFoundException('Competencia no encontrada');
    if (caller?.role === 'SUPERADMIN') return comp;
    if (!comp.universityId) {
      throw new ForbiddenException('El catálogo global solo lo edita el superadministrador.');
    }
    if (!caller?.universityId || comp.universityId !== caller.universityId) {
      throw new ForbiddenException('Esta competencia pertenece a otra institución.');
    }
    return comp;
  }

  async update(id: string, dto: Partial<UpsertCompetencyDto>, caller?: { id?: string; role?: string; universityId?: string | null }) {
    await this._assertCanMutateCompetency(id, caller);
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

  async remove(id: string, caller?: { id?: string; role?: string; universityId?: string | null }) {
    await this._assertCanMutateCompetency(id, caller);
    await this.prisma.competency.delete({ where: { id } });
    return { ok: true };
  }

  // ── Vínculo Exercise ↔ Competency ─────────────────────────────
  async getExerciseCompetencies(
    exerciseId: string,
    caller?: { id?: string; role?: string; universityId?: string | null },
  ) {
    // El catálogo de competencias puede ser propio de cada institución, así que
    // leer las de un ejercicio ajeno filtra su taxonomía pedagógica. La
    // escritura ya lo validaba; la lectura no. Falla CERRADO.
    if (caller?.role !== 'SUPERADMIN') {
      const ejercicio = await this.prisma.exercise.findUnique({
        where:  { id: exerciseId },
        select: { course: { select: { universityId: true } } },
      });
      if (!ejercicio) throw new NotFoundException('Ejercicio no encontrado');
      const uni = ejercicio.course?.universityId ?? null;
      if (!caller?.universityId || !uni || uni !== caller.universityId) {
        throw new ForbiddenException('El ejercicio pertenece a otra institución.');
      }
    }
    return this.prisma.exerciseCompetency.findMany({
      where: { exerciseId },
      include: { competency: true },
      orderBy: { competency: { order: 'asc' } },
    });
  }

  /** Reemplaza el conjunto de competencias vinculadas a un ejercicio. */
  async setExerciseCompetencies(
    exerciseId: string,
    links: ExerciseCompetencyLink[],
    caller?: { id?: string; role?: string; universityId?: string | null },
  ) {
    const exercise = await this.prisma.exercise.findUnique({
      where:  { id: exerciseId },
      select: { id: true, teacherId: true, course: { select: { universityId: true, teacherId: true } } },
    });
    if (!exercise) throw new NotFoundException('Ejercicio no encontrado');

    // Aislamiento: antes bastaba con conocer el UUID del ejercicio para
    // reescribir el mapeo de competencias de otra institución (evidencia de
    // acreditación). SUPERADMIN libre; TEACHER solo sus ejercicios; ADMIN solo
    // los de su institución. Falla cerrado.
    if (caller?.role !== 'SUPERADMIN') {
      const exUni = exercise.course?.universityId ?? null;
      if (caller?.role === 'TEACHER') {
        const owns = exercise.teacherId === caller?.id || exercise.course?.teacherId === caller?.id;
        const sameUni = !!caller?.universityId && !!exUni && caller.universityId === exUni;
        if (!owns && !sameUni) throw new ForbiddenException('Este ejercicio pertenece a otra institución.');
      } else if (caller?.role === 'ADMIN') {
        if (!caller?.universityId || !exUni || caller.universityId !== exUni) {
          throw new ForbiddenException('Este ejercicio pertenece a otra institución.');
        }
      } else {
        throw new ForbiddenException('Sin permiso para modificar competencias.');
      }
    }

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

  // ══════════════════════════════════════════════════════════════
  //  EVIDENCIA DE COMPETENCIAS (dashboards profesor / institucional)
  // ══════════════════════════════════════════════════════════════

  /**
   * Núcleo de agregación: dado un set de ejercicios (con sus competencias) y
   * los intentos GRADED, calcula dominio por competencia y por estudiante.
   */
  private aggregate(
    exercises: Array<{ id: string; maxScore: any; comps: Array<{ id: string; code: string; name: string; area: string }> }>,
    attempts: Array<{ exerciseId: string; studentId: string; score: any; maxScore: any }>,
  ) {
    const exMap = new Map(exercises.map(e => [e.id, e]));
    const compMeta = new Map<string, { id: string; code: string; name: string; area: string }>();
    for (const e of exercises) for (const c of e.comps) if (!compMeta.has(c.id)) compMeta.set(c.id, c);

    const compAgg = new Map<string, { sum: number; count: number; students: Set<string> }>();
    const stuAgg  = new Map<string, { sum: number; count: number; byComp: Map<string, { sum: number; count: number }> }>();

    for (const a of attempts) {
      const ex = exMap.get(a.exerciseId);
      if (!ex) continue;
      const max = Number(a.maxScore ?? ex.maxScore ?? 100) || 100;
      const pct = Math.max(0, Math.min(100, (Number(a.score ?? 0) / max) * 100));

      const s = stuAgg.get(a.studentId) ?? { sum: 0, count: 0, byComp: new Map() };
      s.sum += pct; s.count++;
      for (const c of ex.comps) {
        const ca = compAgg.get(c.id) ?? { sum: 0, count: 0, students: new Set<string>() };
        ca.sum += pct; ca.count++; ca.students.add(a.studentId);
        compAgg.set(c.id, ca);
        const sc = s.byComp.get(c.id) ?? { sum: 0, count: 0 };
        sc.sum += pct; sc.count++; s.byComp.set(c.id, sc);
      }
      stuAgg.set(a.studentId, s);
    }

    const competencies = Array.from(compMeta.values()).map(c => {
      const a = compAgg.get(c.id);
      return {
        id: c.id, code: c.code, name: c.name, area: c.area,
        masteryPct: a && a.count ? Math.round((a.sum / a.count) * 10) / 10 : null,
        evidenceCount: a?.count ?? 0,
        studentsAssessed: a?.students.size ?? 0,
      };
    }).sort((x, y) => x.code.localeCompare(y.code));

    return { compMeta, compAgg, stuAgg, competencies };
  }

  /** Dashboard del profesor: dominio por competencia + alumnos en riesgo de un curso. */
  async getCourseEvidence(courseId: string, user: { id: string; role: string; universityId?: string | null }) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, name: true, teacherId: true, universityId: true },
    });
    if (!course) throw new NotFoundException('Curso no encontrado');
    // ADMIN NO es global: antes cualquier ADMIN leía el dominio por competencia
    // y la lista nominal de "alumnos en riesgo" de CUALQUIER institución.
    if (user.role !== 'SUPERADMIN') {
      if (user.role === 'ADMIN') {
        if (!user.universityId || course.universityId !== user.universityId) {
          throw new ForbiddenException('Este curso pertenece a otra institución.');
        }
      } else if (course.teacherId !== user.id) {
        throw new ForbiddenException('No puedes ver un curso que no es tuyo');
      }
    }

    const exercisesRaw = await this.prisma.exercise.findMany({
      where: { courseId },
      select: {
        id: true, maxScore: true,
        competencies: { select: { competency: { select: { id: true, code: true, name: true, area: true } } } },
      },
    });
    const exercises = exercisesRaw.map(e => ({
      id: e.id, maxScore: e.maxScore,
      comps: e.competencies.map(x => ({ id: x.competency.id, code: x.competency.code, name: x.competency.name, area: x.competency.area as string })),
    }));
    const exerciseIds = exercises.map(e => e.id);

    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId, isActive: true },
      select: { student: { select: { id: true, name: true, email: true } } },
    });
    const students = enrollments.map(e => e.student);
    const studentIds = students.map(s => s.id);

    const attempts = exerciseIds.length && studentIds.length
      ? await this.prisma.exerciseAttempt.findMany({
          where: { exerciseId: { in: exerciseIds }, studentId: { in: studentIds }, status: 'GRADED', score: { not: null } },
          select: { exerciseId: true, studentId: true, score: true, maxScore: true },
        })
      : [];

    const { compMeta, stuAgg, competencies } = this.aggregate(exercises, attempts);

    const totalEx = exercises.length || 1;
    const roster = students.map(st => {
      const s = stuAgg.get(st.id);
      const count = s?.count ?? 0;
      const overallPct = s && count ? Math.round((s.sum / count) * 10) / 10 : null;
      const coverage = count / totalEx;
      const byComp: Record<string, number> = {};
      if (s) for (const [cid, v] of s.byComp) {
        const meta = compMeta.get(cid);
        if (meta) byComp[meta.code] = Math.round((v.sum / v.count) * 10) / 10;
      }
      const atRisk = (count > 0 && (overallPct ?? 0) < AT_RISK_MASTERY) || coverage < AT_RISK_COVERAGE;
      return {
        id: st.id, name: st.name, email: st.email,
        overallPct, completedExercises: count, totalExercises: exercises.length,
        coveragePct: Math.round(coverage * 1000) / 10, atRisk, byComp,
      };
    }).sort((a, b) => (a.overallPct ?? -1) - (b.overallPct ?? -1));

    const assessed = roster.filter(r => r.completedExercises > 0);
    const avgMastery = assessed.length
      ? Math.round((assessed.reduce((s, r) => s + (r.overallPct ?? 0), 0) / assessed.length) * 10) / 10
      : null;

    return {
      course: { id: course.id, name: course.name },
      summary: {
        totalStudents: students.length,
        totalExercises: exercises.length,
        avgMastery,
        atRiskCount: roster.filter(r => r.atRisk).length,
        competenciesCovered: competencies.length,
      },
      competencies,
      students: roster,
      generatedAt: new Date().toISOString(),
    };
  }

  /** Dashboard institucional: dominio por competencia y por curso (cohorte) de la universidad. */
  async getUniversityEvidence(universityId: string, user: { role: string; universityId?: string }) {
    if (!['ADMIN', 'SUPERADMIN'].includes(user.role)) {
      throw new ForbiddenException('Solo administración académica');
    }
    // FALLA CERRADO: con `&&`, un ADMIN sin institución asignada leía la
    // evidencia de acreditación de CUALQUIER institución.
    if (user.role === 'ADMIN' && (!user.universityId || user.universityId !== universityId)) {
      throw new ForbiddenException('Solo tu propia institución');
    }

    const courses = await this.prisma.course.findMany({
      where: { universityId },
      select: { id: true, name: true, period: true },
    });

    const exercisesRaw = await this.prisma.exercise.findMany({
      where: { course: { universityId } },
      select: {
        id: true, courseId: true, maxScore: true,
        competencies: { select: { competency: { select: { id: true, code: true, name: true, area: true } } } },
      },
    });
    const exercises = exercisesRaw.map(e => ({
      id: e.id, courseId: e.courseId, maxScore: e.maxScore,
      comps: e.competencies.map(x => ({ id: x.competency.id, code: x.competency.code, name: x.competency.name, area: x.competency.area as string })),
    }));
    const exerciseIds = exercises.map(e => e.id);
    const exCourse = new Map(exercises.map(e => [e.id, e.courseId]));

    const attempts = exerciseIds.length
      ? await this.prisma.exerciseAttempt.findMany({
          where: { exerciseId: { in: exerciseIds }, status: 'GRADED', score: { not: null } },
          select: { exerciseId: true, studentId: true, score: true, maxScore: true },
        })
      : [];

    // Agregado institucional por competencia (todas las carreras/cursos).
    const { competencies } = this.aggregate(exercises, attempts);

    // Por curso (cohorte).
    const byCourse = courses.map(c => {
      const exs = exercises.filter(e => e.courseId === c.id);
      const exIds = new Set(exs.map(e => e.id));
      const atts = attempts.filter(a => exIds.has(a.exerciseId));
      const { stuAgg, competencies: comps } = this.aggregate(exs, atts);
      const students = Array.from(stuAgg.values());
      const avg = students.length
        ? Math.round((students.reduce((s, v) => s + v.sum / v.count, 0) / students.length) * 10) / 10
        : null;
      const atRisk = students.filter(v => (v.sum / v.count) < AT_RISK_MASTERY).length;
      return {
        courseId: c.id, name: c.name, period: c.period,
        exercises: exs.length, studentsAssessed: students.length,
        avgMastery: avg, atRiskCount: atRisk,
        competenciesCovered: comps.filter(x => x.masteryPct !== null).length,
      };
    }).sort((a, b) => (b.avgMastery ?? -1) - (a.avgMastery ?? -1));

    const assessedCourses = byCourse.filter(c => c.avgMastery !== null);
    const overallMastery = assessedCourses.length
      ? Math.round((assessedCourses.reduce((s, c) => s + (c.avgMastery ?? 0), 0) / assessedCourses.length) * 10) / 10
      : null;

    return {
      summary: {
        totalCourses: courses.length,
        totalExercises: exercises.length,
        overallMastery,
        competenciesEvidenced: competencies.filter(c => c.masteryPct !== null).length,
        totalCompetencies: competencies.length,
        atRiskCount: byCourse.reduce((s, c) => s + c.atRiskCount, 0),
      },
      competencies,
      courses: byCourse,
      generatedAt: new Date().toISOString(),
    };
  }
}
