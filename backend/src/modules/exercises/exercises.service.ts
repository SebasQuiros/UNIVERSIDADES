import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExerciseDto, UpdateExerciseDto } from './dto/exercises.dto';
import { EmailService } from '../notifications/email.service';

@Injectable()
export class ExercisesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async findAll(courseId: string, role?: string) {
    await this._checkCourse(courseId);
    return this.prisma.exercise.findMany({
      where:   {
        courseId,
        ...(role === 'STUDENT' && { isPublished: true, isArchived: false }),
        ...(role !== 'STUDENT' && { isArchived: false }),
      },
      include: {
        rubrics: { orderBy: { order: 'asc' } },
        _count:  { select: { attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(courseId: string, exerciseId: string, role?: string) {
    const where: any = { id: exerciseId, courseId };
    if (role === 'STUDENT') {
      where.isPublished = true;
      where.isArchived = false;
    }
    const exercise = await this.prisma.exercise.findFirst({
      where,
      include: {
        rubrics:  { orderBy: { order: 'asc' } },
        teacher:  { select: { id: true, name: true, email: true } },
        _count:   { select: { attempts: true } },
      },
    });
    if (!exercise) throw new NotFoundException('Ejercicio no encontrado');
    return exercise;
  }

  async create(courseId: string, teacherId: string, dto: CreateExerciseDto) {
    await this._checkCourse(courseId);

    // Fase 1: cada Exercise nuevo recibe ExerciseConfig con defaults del schema.
    // Esto garantiza que el toggle engine tenga registro de config siempre,
    // sin depender únicamente del backfill de la migration.
    return this.prisma.exercise.create({
      data: {
        courseId,
        teacherId,
        title:        dto.title,
        description:  dto.description  ?? null,
        instructions: dto.instructions ?? null,
        difficulty:   (dto.difficulty  ?? 'BASIC') as any,
        type:         (dto.type        ?? 'FULL_CYCLE') as any,
        maxScore:     dto.maxScore     ?? 100,
        dueDate:      dto.dueDate      ? new Date(dto.dueDate) : null,
        isPublished:  false,
        settings:     (dto.settings as any) ?? {},
        rubrics: dto.rubrics?.length
          ? {
              create: dto.rubrics.map((r, i) => ({
                criterion:     r.criterion,
                description:   r.description,
                expectedValue: r.expectedValue ?? null,
                points:        r.points,
                order:         r.order ?? i,
              })),
            }
          : undefined,
        config: { create: {} }, // defaults: companyMode=INDIVIDUAL, autos hist./true
      },
      include: {
        rubrics: { orderBy: { order: 'asc' } },
        config:  true,
      },
    });
  }

  async update(
    courseId: string,
    exerciseId: string,
    userId: string,
    userRole: string,
    dto: UpdateExerciseDto,
  ) {
    const exercise = await this.prisma.exercise.findFirst({
      where: { id: exerciseId, courseId },
    });
    if (!exercise) throw new NotFoundException('Ejercicio no encontrado');

    if (userRole === 'TEACHER' && exercise.teacherId !== userId) {
      throw new ForbiddenException('Solo el profesor del ejercicio puede modificarlo');
    }

    if (exercise.isPublished) {
      throw new BadRequestException('No se puede editar un ejercicio ya publicado');
    }

    return this.prisma.exercise.update({
      where: { id: exerciseId },
      data: {
        ...(dto.title        !== undefined && { title:        dto.title        }),
        ...(dto.description  !== undefined && { description:  dto.description  }),
        ...(dto.instructions !== undefined && { instructions: dto.instructions }),
        ...(dto.difficulty   !== undefined && { difficulty:   dto.difficulty as any }),
        ...(dto.type         !== undefined && { type:         dto.type as any         }),
        ...(dto.maxScore     !== undefined && { maxScore:     dto.maxScore     }),
        ...(dto.dueDate      !== undefined && { dueDate:      dto.dueDate ? new Date(dto.dueDate) : null }),
        updatedAt: new Date(),
      },
      include: { rubrics: { orderBy: { order: 'asc' } } },
    });
  }

  async archive(courseId: string, exerciseId: string, userId: string, userRole: string) {
    const exercise = await this.prisma.exercise.findFirst({
      where: { id: exerciseId, courseId },
    });
    if (!exercise) throw new NotFoundException('Ejercicio no encontrado');
    if (userRole === 'TEACHER' && exercise.teacherId !== userId) {
      throw new ForbiddenException('Solo el profesor del ejercicio puede archivarlo');
    }
    await this.prisma.exercise.update({
      where: { id: exerciseId },
      data:  { isArchived: true, updatedAt: new Date() },
    });
    return { message: 'Ejercicio archivado' };
  }

  async remove(courseId: string, exerciseId: string, userId: string, userRole: string) {
    const exercise = await this.prisma.exercise.findFirst({
      where: { id: exerciseId, courseId },
    });
    if (!exercise) throw new NotFoundException('Ejercicio no encontrado');

    if (userRole === 'TEACHER' && exercise.teacherId !== userId) {
      throw new ForbiddenException('Solo el profesor del ejercicio puede eliminarlo');
    }

    // JournalLine has a direct company_id FK without onDelete:Cascade,
    // so we must delete them before the ExerciseAttempt → Company cascade fires.
    const attempts = await this.prisma.exerciseAttempt.findMany({
      where:  { exerciseId },
      select: { company: { select: { id: true } } },
    });
    const companyIds = attempts.flatMap(a => a.company ? [a.company.id] : []);

    await this.prisma.$transaction(async (tx) => {
      if (companyIds.length > 0) {
        // Delete records that have FK references WITHOUT onDelete:Cascade,
        // in the correct order before the Company cascade fires.
        // 1. InventoryMovement.product_id → Product (no cascade)
        await tx.inventoryMovement.deleteMany({ where: { companyId: { in: companyIds } } });
        // 2. Payment.client_id → Client (no cascade); must go before Client cascade
        await tx.payment.deleteMany({ where: { companyId: { in: companyIds } } });
        // 3. JournalLine.company_id → Company (no cascade)
        //    JournalLine.account_id → Account (no cascade)
        await tx.journalLine.deleteMany({ where: { companyId: { in: companyIds } } });
      }
      await tx.exerciseAttempt.deleteMany({ where: { exerciseId } });
      await tx.exercise.delete({ where: { id: exerciseId } });
    });
    return { message: 'Ejercicio eliminado' };
  }

  // ── Publish ───────────────────────────────────────────────────────────────────
  async publish(courseId: string, exerciseId: string, userId: string, userRole: string) {
    const exercise = await this.prisma.exercise.findFirst({
      where:   { id: exerciseId, courseId },
      include: { rubrics: true },
    });
    if (!exercise) throw new NotFoundException('Ejercicio no encontrado');

    if (userRole === 'TEACHER' && exercise.teacherId !== userId) {
      throw new ForbiddenException('Solo el profesor del ejercicio puede publicarlo');
    }

    if (exercise.isPublished) {
      throw new BadRequestException('El ejercicio ya está publicado');
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where:   { courseId, isActive: true },
      include: { student: { select: { id: true, name: true, email: true } } },
    });
    const course = await this.prisma.course.findUnique({
      where:  { id: courseId },
      select: { name: true },
    });

    if (enrollments.length === 0) {
      throw new BadRequestException(
        'No hay estudiantes inscritos en el curso. Inscribe estudiantes antes de publicar.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.exercise.update({
        where: { id: exerciseId },
        data:  { isPublished: true, updatedAt: new Date() },
      });

      for (const enrollment of enrollments) {
        const studentId = enrollment.student.id;

        const attempt = await tx.exerciseAttempt.create({
          data: {
            exerciseId,
            studentId,
            status:   'NOT_STARTED',
            maxScore: exercise.maxScore,
          },
        });

        await tx.studentProgress.create({
          data: {
            attemptId:     attempt.id,
            studentId,
            exerciseId,
            progressPct:   0,
            invoicesCount: 0,
            entriesCount:  0,
            clientsCount:  0,
            productsCount: 0,
            timeSpentMin:  0,
          },
        });

        await tx.notification.create({
          data: {
            userId:  studentId,
            title:   `Nuevo ejercicio asignado: ${exercise.title}`,
            body:    exercise.description
              ? `${exercise.description}${exercise.dueDate ? ` — Fecha límite: ${exercise.dueDate.toLocaleDateString('es-CR')}` : ''}`
              : exercise.dueDate
                ? `Fecha límite: ${exercise.dueDate.toLocaleDateString('es-CR')}`
                : null,
            type:    'EXERCISE_ASSIGNED',
            isRead:  false,
          },
        });
      }
    });

    const dueDateStr = exercise.dueDate
      ? exercise.dueDate.toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric' })
      : undefined;
    for (const enrollment of enrollments) {
      this.email.send(
        enrollment.student.email,
        `Nuevo ejercicio: ${exercise.title}`,
        this.email.exerciseAssignedHtml(
          enrollment.student.name,
          exercise.title,
          course?.name ?? 'tu curso',
          dueDateStr,
        ),
      );
    }

    return {
      message:          'Ejercicio publicado exitosamente',
      studentsNotified: enrollments.length,
      exerciseId,
    };
  }

  // ── Templates ─────────────────────────────────────────────────────────────────

  async findTemplates(teacherId: string) {
    const all = await this.prisma.exercise.findMany({
      where: { teacherId, isArchived: false },
      include: {
        rubrics: { orderBy: { order: 'asc' } },
        course:  { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return all.filter(e => {
      try { return (e.settings as any)?.isTemplate === true; }
      catch { return false; }
    });
  }

  async toggleTemplate(courseId: string, exerciseId: string, teacherId: string) {
    const exercise = await this.prisma.exercise.findFirst({
      where: { id: exerciseId, courseId },
    });
    if (!exercise) throw new NotFoundException('Ejercicio no encontrado');
    if (exercise.teacherId !== teacherId) {
      throw new ForbiddenException('Solo el profesor puede marcar sus propios ejercicios como plantilla');
    }

    const settings   = (exercise.settings as any) ?? {};
    const isTemplate = !settings.isTemplate;

    await this.prisma.exercise.update({
      where: { id: exerciseId },
      data:  { settings: { ...settings, isTemplate } },
    });

    return { isTemplate, exerciseId };
  }

  async createFromTemplate(courseId: string, templateId: string, teacherId: string) {
    const template = await this.prisma.exercise.findUnique({
      where:   { id: templateId },
      include: { rubrics: { orderBy: { order: 'asc' } } },
    });
    if (!template) throw new NotFoundException('Plantilla no encontrada');
    if (template.teacherId !== teacherId) {
      throw new ForbiddenException('Solo el profesor puede usar sus propias plantillas');
    }

    await this._checkCourse(courseId);

    const settings = (template.settings as any) ?? {};
    const { isTemplate: _flag, ...restSettings } = settings;

    return this.prisma.exercise.create({
      data: {
        courseId,
        teacherId,
        title:        `${template.title} (copia)`,
        description:  template.description,
        instructions: template.instructions,
        difficulty:   template.difficulty,
        type:         template.type,
        maxScore:     template.maxScore,
        dueDate:      null,
        isPublished:  false,
        settings:     restSettings,
        rubrics: template.rubrics.length
          ? {
              create: template.rubrics.map((r) => ({
                criterion:     r.criterion,
                description:   r.description,
                expectedValue: r.expectedValue,
                points:        r.points,
                order:         r.order,
              })),
            }
          : undefined,
      },
      include: { rubrics: { orderBy: { order: 'asc' } } },
    });
  }

  private async _checkCourse(courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Curso no encontrado');
  }
}
