import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { COURSE_TEMPLATES, CourseTemplate } from './templates/contabilidad-i';

@Injectable()
export class CourseTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista de plantillas disponibles (metadatos, sin instanciar). */
  listTemplates() {
    return COURSE_TEMPLATES.map(t => ({
      key:            t.key,
      code:           t.code,
      name:           t.name,
      description:    t.description,
      exerciseCount:  t.exercises.length,
      competencyCodes: Array.from(new Set(t.exercises.flatMap(e => e.competencyCodes))).sort(),
    }));
  }

  getTemplate(key: string): CourseTemplate {
    const tpl = COURSE_TEMPLATES.find(t => t.key === key);
    if (!tpl) throw new NotFoundException(`Plantilla "${key}" no encontrada`);
    return tpl;
  }

  /**
   * Instancia una plantilla dentro de un Course existente del profesor:
   * crea Exercises publicados + sus ExerciseRubric + vínculos ExerciseCompetency.
   * Idempotente por título: no duplica ejercicios que ya existan en el curso.
   */
  async applyTemplate(courseId: string, templateKey: string, user: { id: string; role: string }) {
    const tpl = this.getTemplate(templateKey);

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, teacherId: true, universityId: true },
    });
    if (!course) throw new NotFoundException('Curso no encontrado');

    const isStaff = ['ADMIN', 'SUPERADMIN'].includes(user.role);
    if (course.teacherId !== user.id && !isStaff) {
      throw new ForbiddenException('No puedes modificar un curso que no es tuyo');
    }

    // Resolver competencias por code: globales (universityId NULL) o de la universidad del curso.
    const competencies = await this.prisma.competency.findMany({
      where: { OR: [{ universityId: null }, { universityId: course.universityId }] },
      select: { id: true, code: true, universityId: true },
    });
    // Preferir la específica de la universidad si existe el mismo code.
    const compByCode = new Map<string, string>();
    for (const c of competencies) {
      if (!compByCode.has(c.code) || c.universityId) compByCode.set(c.code, c.id);
    }

    // Evitar duplicados por título dentro del curso.
    const existing = await this.prisma.exercise.findMany({
      where: { courseId },
      select: { title: true },
    });
    const existingTitles = new Set(existing.map(e => e.title));

    const created: string[] = [];
    const skipped: string[] = [];

    for (const ex of tpl.exercises) {
      if (existingTitles.has(ex.title)) { skipped.push(ex.title); continue; }

      const exercise = await this.prisma.exercise.create({
        data: {
          courseId,
          teacherId:    course.teacherId,
          title:        ex.title,
          description:  ex.description,
          instructions: ex.instructions,
          difficulty:   ex.difficulty as any,
          type:         ex.type as any,
          maxScore:     100,
          isPublished:  true,
          rubrics: {
            create: ex.rubrics.map((r, i) => ({
              criterion:     r.criterion,
              description:   r.description,
              expectedValue: r.expectedValue ?? null,
              points:        r.points,
              order:         i,
              competencyId:  ex.competencyCodes[0] ? (compByCode.get(ex.competencyCodes[0]) ?? null) : null,
            })),
          },
          competencies: {
            create: ex.competencyCodes
              .map(code => compByCode.get(code))
              .filter((id): id is string => !!id)
              .map(competencyId => ({ competencyId, weight: 1 })),
          },
        },
      });
      created.push(exercise.title);
    }

    return {
      template: { key: tpl.key, code: tpl.code, name: tpl.name },
      courseId,
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
    };
  }
}
