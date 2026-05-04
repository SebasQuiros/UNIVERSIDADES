import {
  Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCourseDto, UpdateCourseDto, EnrollStudentDto } from './dto/courses.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(teacherId: string) {
    return this.prisma.course.findMany({
      where:   { teacherId, isActive: true },
      include: {
        university: { select: { id: true, name: true, shortName: true } },
        _count:     { select: { enrollments: true, exercises: true } },
      },
      orderBy: [{ university: { name: 'asc' } }, { createdAt: 'desc' }],
    });
  }

  async findById(courseId: string, requesterId: string, requesterRole: string, requesterUniversityId: string | null) {
    const course = await this.prisma.course.findUnique({
      where:   { id: courseId },
      include: {
        university:  { select: { id: true, name: true, shortName: true } },
        teacher:     { select: { id: true, name: true, email: true } },
        enrollments: {
          where:   { isActive: true },
          include: { student: { select: { id: true, name: true, email: true } } },
        },
        _count: { select: { exercises: true } },
      },
    });
    if (!course) throw new NotFoundException('Curso no encontrado');

    // Data isolation: SUPERADMIN can see any course; ADMIN and TEACHER must
    // belong to the same university as the course.
    if (requesterRole !== 'SUPERADMIN') {
      if (course.universityId !== requesterUniversityId) {
        throw new ForbiddenException('No tienes acceso a este curso');
      }
    }

    return course;
  }

  async findAll(universityId: string) {
    await this._checkUniversity(universityId);
    return this.prisma.course.findMany({
      where:   { universityId, isActive: true },
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        _count:  { select: { enrollments: true, exercises: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(universityId: string, courseId: string) {
    const course = await this.prisma.course.findFirst({
      where:   { id: courseId, universityId },
      include: {
        teacher:     { select: { id: true, name: true, email: true } },
        enrollments: {
          where:   { isActive: true },
          include: { student: { select: { id: true, name: true, email: true } } },
        },
        _count: { select: { exercises: true } },
      },
    });
    if (!course) throw new NotFoundException('Curso no encontrado');
    return course;
  }

  async create(universityId: string, teacherId: string, dto: CreateCourseDto) {
    await this._checkUniversity(universityId);
    return this.prisma.course.create({
      data: {
        universityId,
        teacherId,
        name:        dto.name,
        description: dto.description ?? null,
        code:        dto.code        ?? null,
        period:      dto.period      ?? null,
        isActive:    true,
      },
    });
  }

  async update(
    universityId: string,
    courseId: string,
    userId: string,
    userRole: string,
    dto: UpdateCourseDto,
  ) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, universityId },
    });
    if (!course) throw new NotFoundException('Curso no encontrado');

    if (userRole === 'TEACHER' && course.teacherId !== userId) {
      throw new ForbiddenException('Solo el profesor del curso puede modificarlo');
    }

    return this.prisma.course.update({
      where: { id: courseId },
      data: {
        ...(dto.name        !== undefined && { name:        dto.name        }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.code        !== undefined && { code:        dto.code        }),
        ...(dto.period      !== undefined && { period:      dto.period      }),
        updatedAt: new Date(),
      },
    });
  }

  async unenroll(universityId: string, courseId: string, studentId: string, userId: string, userRole: string) {
    const course = await this.prisma.course.findFirst({ where: { id: courseId, universityId } });
    if (!course) throw new NotFoundException('Curso no encontrado');
    if (userRole === 'TEACHER' && course.teacherId !== userId) {
      throw new ForbiddenException('Solo el profesor del curso puede remover estudiantes');
    }
    const enrollment = await this.prisma.enrollment.findFirst({ where: { courseId, studentId, isActive: true } });
    if (!enrollment) throw new NotFoundException('El estudiante no está inscrito en este curso');
    await this.prisma.enrollment.update({ where: { id: enrollment.id }, data: { isActive: false } });
    return { message: 'Estudiante removido del curso' };
  }

  async getStudentsWithProgress(universityId: string, courseId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, universityId },
      include: {
        enrollments: {
          where: { isActive: true },
          include: {
            student: { select: { id: true, name: true, email: true, createdAt: true } },
          },
          orderBy: { enrolledAt: 'asc' },
        },
        exercises: { where: { isPublished: true }, select: { id: true } },
      },
    });
    if (!course) throw new NotFoundException('Curso no encontrado');

    const exerciseIds = course.exercises.map((e) => e.id);
    const studentIds  = course.enrollments.map((e) => e.studentId);

    const attempts = await this.prisma.exerciseAttempt.findMany({
      where: { exerciseId: { in: exerciseIds }, studentId: { in: studentIds } },
      select: { studentId: true, status: true, score: true, maxScore: true },
    });

    return course.enrollments.map((enroll) => {
      const studentAttempts = attempts.filter((a) => a.studentId === enroll.studentId);
      const graded  = studentAttempts.filter((a) => a.status === 'GRADED');
      const avgScore = graded.length > 0
        ? Math.round(graded.reduce((s, a) => s + (Number(a.score) / Number(a.maxScore)) * 100, 0) / graded.length)
        : null;
      return {
        enrollmentId: enroll.id,
        enrolledAt:   enroll.enrolledAt,
        student:      enroll.student,
        stats: {
          totalExercises: exerciseIds.length,
          submitted:      studentAttempts.filter((a) => ['SUBMITTED', 'GRADED'].includes(a.status)).length,
          graded:         graded.length,
          avgScore,
        },
      };
    });
  }

  async remove(
    universityId: string,
    courseId: string,
    userId: string,
    userRole: string,
  ) {
    const course = await this.prisma.course.findFirst({
      where:   { id: courseId, universityId },
      include: { _count: { select: { exercises: true } } },
    });
    if (!course) throw new NotFoundException('Curso no encontrado');

    if (userRole === 'TEACHER' && course.teacherId !== userId) {
      throw new ForbiddenException('Solo el profesor del curso puede eliminarlo');
    }

    // Soft-delete: mark inactive
    await this.prisma.course.update({
      where: { id: courseId },
      data:  { isActive: false, updatedAt: new Date() },
    });

    return { message: 'Curso eliminado correctamente' };
  }

  async enroll(universityId: string, courseId: string, dto: EnrollStudentDto) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, universityId },
    });
    if (!course) throw new NotFoundException('Curso no encontrado');

    // Data isolation: student must belong to the same university as the course
    const student = await this.prisma.user.findFirst({
      where: { id: dto.studentId, role: 'STUDENT', isActive: true, universityId },
    });
    if (!student) throw new NotFoundException('Estudiante no encontrado, inactivo o no pertenece a esta universidad');

    const existing = await this.prisma.enrollment.findFirst({
      where: { courseId, studentId: dto.studentId },
    });
    if (existing) {
      if (existing.isActive) {
        throw new ConflictException('El estudiante ya está inscrito en este curso');
      }
      // Reactivate if previously removed
      return this.prisma.enrollment.update({
        where: { id: existing.id },
        data:  { isActive: true },
      });
    }

    return this.prisma.enrollment.create({
      data: { courseId, studentId: dto.studentId, isActive: true },
    });
  }

  async enrollBulk(
    universityId: string, courseId: string, emails: string[],
    userId: string, userRole: string,
  ) {
    const course = await this.prisma.course.findFirst({ where: { id: courseId, universityId } });
    if (!course) throw new NotFoundException('Curso no encontrado');
    if (userRole === 'TEACHER' && course.teacherId !== userId) {
      throw new ForbiddenException('Solo el profesor del curso puede inscribir estudiantes');
    }

    // Normalize and deduplicate
    const uniqueEmails = [...new Set(emails.map(e => e.trim().toLowerCase()).filter(Boolean))];
    if (uniqueEmails.length === 0) throw new BadRequestException('No se enviaron correos válidos');
    if (uniqueEmails.length > 200) throw new BadRequestException('Máximo 200 estudiantes por importación');

    // Fetch all matching students in one query
    // Data isolation: only students belonging to this university are enrolled
    const students = await this.prisma.user.findMany({
      where: { email: { in: uniqueEmails }, role: 'STUDENT', isActive: true, universityId },
      select: { id: true, email: true, name: true },
    });

    const foundEmails = new Set(students.map(s => s.email.toLowerCase()));
    const notFound = uniqueEmails.filter(e => !foundEmails.has(e));

    // Fetch existing enrollments for these students
    const existing = await this.prisma.enrollment.findMany({
      where: { courseId, studentId: { in: students.map(s => s.id) } },
    });
    const existingMap = new Map(existing.map(e => [e.studentId, e]));

    const toCreate: string[] = [];
    const toReactivate: string[] = [];
    const alreadyEnrolled: string[] = [];

    for (const student of students) {
      const enroll = existingMap.get(student.id);
      if (!enroll)              toCreate.push(student.id);
      else if (!enroll.isActive) toReactivate.push(enroll.id);
      else                       alreadyEnrolled.push(student.email);
    }

    await this.prisma.$transaction([
      ...(toCreate.length ? [this.prisma.enrollment.createMany({
        data: toCreate.map(studentId => ({ courseId, studentId, isActive: true })),
        skipDuplicates: true,
      })] : []),
      ...(toReactivate.length ? [this.prisma.enrollment.updateMany({
        where: { id: { in: toReactivate } },
        data:  { isActive: true },
      })] : []),
    ]);

    return {
      enrolled:        toCreate.length + toReactivate.length,
      alreadyEnrolled: alreadyEnrolled.length,
      notFound,
      total:           uniqueEmails.length,
    };
  }

  // ── Grades export ─────────────────────────────────────────────────────────
  async getCourseGrades(universityId: string, courseId: string) {
    const course = await this.prisma.course.findFirst({
      where:   { id: courseId, universityId },
      include: {
        exercises: {
          where:   { isPublished: true, isArchived: false },
          orderBy: { createdAt: 'asc' },
          select:  { id: true, title: true, maxScore: true },
        },
        enrollments: {
          where:   { isActive: true },
          include: { student: { select: { id: true, name: true, email: true } } },
          orderBy: { enrolledAt: 'asc' },
        },
      },
    });
    if (!course) throw new NotFoundException('Curso no encontrado');

    const attempts = await this.prisma.exerciseAttempt.findMany({
      where: {
        exerciseId: { in: course.exercises.map((e) => e.id) },
        studentId:  { in: course.enrollments.map((e) => e.studentId) },
      },
      select: { exerciseId: true, studentId: true, score: true, maxScore: true, status: true, gradedAt: true },
    });

    const attemptMap = new Map<string, Map<string, typeof attempts[0]>>();
    for (const a of attempts) {
      if (!attemptMap.has(a.studentId)) attemptMap.set(a.studentId, new Map());
      attemptMap.get(a.studentId)!.set(a.exerciseId, a);
    }

    return {
      course:    { id: course.id, name: course.name, code: course.code, period: course.period },
      exercises: course.exercises.map((e) => ({ id: e.id, title: e.title, maxScore: Number(e.maxScore) })),
      students:  course.enrollments.map((enrollment) => {
        const studentAttempts = attemptMap.get(enrollment.studentId) ?? new Map();
        const grades = course.exercises.map((exercise) => {
          const a = studentAttempts.get(exercise.id);
          return {
            exerciseId: exercise.id,
            score:      a?.score != null ? Number(a.score) : null,
            maxScore:   Number(exercise.maxScore),
            status:     a?.status ?? 'NOT_STARTED',
            gradedAt:   a?.gradedAt ?? null,
          };
        });
        const graded = grades.filter((g) => g.status === 'GRADED' && g.score !== null);
        const average = graded.length > 0
          ? graded.reduce((s, g) => s + (g.score! / g.maxScore) * 100, 0) / graded.length
          : null;
        return { student: enrollment.student, grades, average };
      }),
    };
  }

  // ── Analytics ──────────────────────────────────────────────────────────────
  async getCourseAnalytics(universityId: string, courseId: string) {
    const course = await this.prisma.course.findFirst({
      where:   { id: courseId, universityId },
      include: {
        exercises: {
          where:   { isPublished: true, isArchived: false },
          include: {
            attempts: {
              include: { studentProgress: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        enrollments: {
          where:   { isActive: true },
          include: { student: { select: { id: true, name: true, email: true } } },
          orderBy: { enrolledAt: 'asc' },
        },
      },
    });
    if (!course) throw new NotFoundException('Curso no encontrado');

    const totalStudents  = course.enrollments.length;
    const totalExercises = course.exercises.length;

    // ── studentProgress ─────────────────────────────────────────────────────
    const studentProgress = course.enrollments.map((enrollment) => {
      const student = enrollment.student;

      // For each exercise, find this student's attempt (or treat as NOT_STARTED)
      const perExercise = course.exercises.map((exercise) => {
        const attempt = exercise.attempts.find((a) => a.studentId === student.id);
        return {
          exerciseId: exercise.id,
          status:     attempt?.status ?? 'NOT_STARTED',
          score:      attempt?.score != null ? Number(attempt.score) : null,
          maxScore:   Number(exercise.maxScore),
          updatedAt:  attempt?.updatedAt ?? null,
        };
      });

      const completed   = perExercise.filter((e) => ['SUBMITTED', 'GRADED'].includes(e.status)).length;
      const inProgress  = perExercise.filter((e) => e.status === 'IN_PROGRESS').length;
      const notStarted  = perExercise.filter((e) => e.status === 'NOT_STARTED').length;

      const gradedItems = perExercise.filter((e) => e.status === 'GRADED' && e.score !== null);
      const averageGrade = gradedItems.length > 0
        ? Math.round(gradedItems.reduce((s, e) => s + (e.score! / e.maxScore) * 100, 0) / gradedItems.length)
        : null;

      const activities = perExercise
        .filter((e) => e.updatedAt !== null)
        .map((e) => e.updatedAt as Date);
      const lastActivity = activities.length > 0
        ? new Date(Math.max(...activities.map((d) => d.getTime()))).toISOString()
        : null;

      return {
        studentId:           student.id,
        studentName:         student.name,
        email:               student.email,
        exercisesTotal:      totalExercises,
        exercisesCompleted:  completed,
        exercisesInProgress: inProgress,
        exercisesNotStarted: notStarted,
        averageGrade,
        lastActivity,
        completionPct: totalExercises > 0 ? Math.round((completed / totalExercises) * 100) : 0,
      };
    });

    // ── exerciseStats ───────────────────────────────────────────────────────
    const exerciseStats = course.exercises.map((exercise) => {
      const attempts   = exercise.attempts;
      const submitted  = attempts.filter((a) => a.status === 'SUBMITTED').length;
      const graded     = attempts.filter((a) => a.status === 'GRADED').length;
      const maxScore   = Number(exercise.maxScore);
      const scores     = attempts.filter((a) => a.status === 'GRADED' && a.score != null).map((a) => Number(a.score));
      const avgGrade   = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length / maxScore * 100) : null;
      const notStarted = totalStudents - attempts.filter((a) => a.status !== 'NOT_STARTED').length;

      return {
        exerciseId:    exercise.id,
        exerciseName:  exercise.title,
        totalAttempts: attempts.length,
        submitted,
        graded,
        averageGrade:  avgGrade,
        notStarted:    Math.max(0, notStarted),
      };
    });

    // ── gradeDistribution ───────────────────────────────────────────────────
    const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const exercise of course.exercises) {
      const maxScore = Number(exercise.maxScore);
      for (const attempt of exercise.attempts) {
        if (attempt.status === 'GRADED' && attempt.score != null) {
          const pct = (Number(attempt.score) / maxScore) * 100;
          if (pct >= 90)      gradeDistribution.A++;
          else if (pct >= 80) gradeDistribution.B++;
          else if (pct >= 70) gradeDistribution.C++;
          else if (pct >= 60) gradeDistribution.D++;
          else                gradeDistribution.F++;
        }
      }
    }

    // ── overallStats ────────────────────────────────────────────────────────
    const avgCompletion = studentProgress.length > 0
      ? Math.round(studentProgress.reduce((s, sp) => s + sp.completionPct, 0) / studentProgress.length)
      : 0;

    const studentsWithGrade = studentProgress.filter((sp) => sp.averageGrade !== null);
    const avgGrade = studentsWithGrade.length > 0
      ? Math.round(studentsWithGrade.reduce((s, sp) => s + sp.averageGrade!, 0) / studentsWithGrade.length)
      : null;

    const studentsNotStarted  = studentProgress.filter((sp) => sp.exercisesCompleted === 0 && sp.exercisesInProgress === 0).length;
    const studentsCompleted   = studentProgress.filter((sp) => sp.completionPct === 100).length;

    return {
      course: {
        id:     course.id,
        name:   course.name,
        code:   course.code,
        period: course.period,
      },
      totalStudents,
      totalExercises,
      studentProgress,
      exerciseStats,
      gradeDistribution,
      overallStats: {
        avgCompletion,
        avgGrade,
        studentsNotStarted,
        studentsCompleted,
      },
    };
  }

  private async _checkUniversity(universityId: string) {
    const uni = await this.prisma.university.findUnique({
      where: { id: universityId },
    });
    if (!uni) throw new NotFoundException('Universidad no encontrada');
  }
}
