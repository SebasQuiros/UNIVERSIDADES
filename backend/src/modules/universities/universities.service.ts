import { Injectable, Inject, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseAdminService } from '../../common/supabase/supabase-admin.service';
import { CreateUniversityDto, UpdateUniversityDto } from './dto/universities.dto';
import { EmailService } from '../notifications/email.service';
import { Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { invalidateAuthUser } from '../../common/auth/auth-cache';

// ── Helpers ──────────────────────────────────────────────────────────────────

const TEMP_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';

function generateTempPassword(length = 12): string {
  const bytes = randomBytes(length * 2);
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += TEMP_CHARS[bytes[i] % TEMP_CHARS.length];
  }
  return pass;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class UniversitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly supabaseAdmin: SupabaseAdminService,
    @Inject(REDIS_CLIENT) private readonly redis: any,
  ) {}

  async findAll() {
    return this.prisma.university.findMany({
      where:   { isActive: true },
      include: {
        plan:   { select: { id: true, name: true } },
        _count: { select: { users: true, courses: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const university = await this.prisma.university.findUnique({
      where:   { id },
      include: {
        plan:   { select: { id: true, name: true } },
        _count: { select: { users: true, courses: true } },
      },
    });
    if (!university) throw new NotFoundException('Universidad no encontrada');
    return university;
  }

  async create(dto: CreateUniversityDto) {
    return this.prisma.university.create({
      data: {
        name:        dto.name,
        shortName:   dto.shortName   ?? null,
        country:     dto.country     ?? 'Costa Rica',
        website:     dto.website     ?? null,
        logoUrl:     dto.logoUrl     ?? null,
        planId:      dto.planId      ?? null,
        maxStudents: dto.maxStudents ?? 5000,
        isActive:    true,
      },
    });
  }

  async findUsers(id: string, callerRole = 'ADMIN') {
    await this.findOne(id);
    // TEACHER only sees students — not other teachers or admins
    const roleFilter = callerRole === 'TEACHER' ? { role: 'STUDENT' as Role } : {};
    return this.prisma.user.findMany({
      where:   { universityId: id, ...roleFilter },
      select:  {
        id: true, name: true, email: true, role: true,
        isActive: true, createdAt: true, universityId: true,
        mustChangePassword: true, lastLogin: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create a user inside a university.
   * If `password` is omitted, a temporary one is auto-generated and returned
   * in plain text (one-time, never stored without hash).
   */
  async createUser(universityId: string, data: {
    name: string; email: string; password?: string; role: string;
  }) {
    await this.findOne(universityId);
    const email = data.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('El correo electrónico ya está registrado');

    const tempPassword = data.password ?? generateTempPassword();
    // La identidad y la contraseña viven en Supabase Auth; guardamos solo el authId.
    const authId = await this.supabaseAdmin.createUser({
      email,
      password: tempPassword,
      userMetadata: { name: data.name, role: data.role },
    });

    const user = await this.prisma.user.create({
      data: {
        authId,
        name:               data.name,
        email,
        role:               data.role as Role,
        universityId,
        isActive:           true,
        emailVerified:      true,
        mustChangePassword: false,
      },
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, createdAt: true, universityId: true,
        mustChangePassword: true,
      },
    });

    // Send welcome email (fire-and-forget — never throw)
    this.email.send(
      email,
      'Bienvenido a SJQA GROUP — Credenciales de acceso',
      this.email.newUserCredentialsHtml(data.name, email, tempPassword),
    ).catch(() => {});

    // Return the plaintext temp password only at creation time
    return { ...user, temporaryPassword: tempPassword };
  }

  /**
   * Change the role of a user within the university (ADMIN cannot promote to SUPERADMIN).
   */
  async updateUserRole(universityId: string, userId: string, role: string) {
    if (role === 'SUPERADMIN') {
      throw new ForbiddenException('No se puede asignar el rol SUPERADMIN desde este panel.');
    }
    const user = await this.prisma.user.findFirst({ where: { id: userId, universityId } });
    if (!user) throw new NotFoundException('Usuario no encontrado en esta universidad');
    if (user.role === 'SUPERADMIN') {
      throw new ForbiddenException('No se puede modificar un SUPERADMIN.');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data:  { role: role as Role, updatedAt: new Date() },
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, createdAt: true, universityId: true,
        mustChangePassword: true,
      },
    });
    // Invalida el cache authId→User: el cambio de rol es inmediato (fail-open).
    await invalidateAuthUser(this.redis, user.authId);
    return updated;
  }

  /**
   * Activate / deactivate a user within the university.
   */
  async toggleUserActive(universityId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, universityId } });
    if (!user) throw new NotFoundException('Usuario no encontrado en esta universidad');
    if (user.role === 'SUPERADMIN') {
      throw new ForbiddenException('No se puede desactivar un SUPERADMIN.');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data:  { isActive: !user.isActive, updatedAt: new Date() },
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, createdAt: true, universityId: true,
        mustChangePassword: true,
      },
    });
    // Invalida el cache authId→User: activar/desactivar es inmediato (fail-open).
    await invalidateAuthUser(this.redis, user.authId);
    return updated;
  }

  async update(id: string, dto: UpdateUniversityDto) {
    await this.findOne(id);
    return this.prisma.university.update({
      where: { id },
      data: {
        ...(dto.name        !== undefined && { name:        dto.name        }),
        ...(dto.shortName   !== undefined && { shortName:   dto.shortName   }),
        ...(dto.country     !== undefined && { country:     dto.country     }),
        ...(dto.website     !== undefined && { website:     dto.website     }),
        ...(dto.logoUrl     !== undefined && { logoUrl:     dto.logoUrl     }),
        ...(dto.planId      !== undefined && { planId:      dto.planId      }),
        ...(dto.maxStudents !== undefined && { maxStudents: dto.maxStudents }),
        updatedAt: new Date(),
      },
    });
  }

  async findMineForDisplay(universityId: string) {
    return this.prisma.university.findUnique({
      where:  { id: universityId },
      select: { id: true, name: true, shortName: true, logoUrl: true },
    });
  }

  // ── Find university by email domain ──────────────────────────────────────────
  async findByEmailDomain(domain: string) {
    const universities = await this.prisma.university.findMany({
      where:  { isActive: true },
      select: { id: true, name: true, shortName: true, settings: true },
    });
    const d = domain.toLowerCase();
    for (const uni of universities) {
      const domains: string[] = (uni.settings as any)?.emailDomains ?? [];
      if (domains.map((x: string) => x.toLowerCase()).includes(d)) {
        return { id: uni.id, name: uni.name, shortName: uni.shortName };
      }
    }
    return null;
  }

  // ── University analytics / stats ─────────────────────────────────────────────
  async getStats(universityId: string) {
    await this.findOne(universityId);

    const [users, courses, exercises, attempts] = await Promise.all([
      this.prisma.user.groupBy({
        by:    ['role'],
        where: { universityId },
        _count: { id: true },
      }),
      this.prisma.course.count({ where: { universityId, isActive: true } }),
      this.prisma.exercise.count({
        where: { isArchived: false, course: { universityId } },
      }),
      this.prisma.exerciseAttempt.findMany({
        where: {
          exercise: { course: { universityId } },
          status:   'GRADED',
          score:    { not: null },
        },
        select: { score: true, maxScore: true },
      }),
    ]);

    const roleMap = Object.fromEntries(users.map(u => [u.role, u._count.id]));
    const gradedCount = attempts.length;
    const avgScore = gradedCount
      ? Math.round(
          attempts.reduce((s, a) => s + (Number(a.score) / Number(a.maxScore)) * 100, 0) / gradedCount,
        )
      : null;

    return {
      totalStudents:  roleMap['STUDENT']  ?? 0,
      totalTeachers:  roleMap['TEACHER']  ?? 0,
      totalAdmins:    roleMap['ADMIN']    ?? 0,
      totalCourses:   courses,
      totalExercises: exercises,
      totalGraded:    gradedCount,
      avgScore,
    };
  }
}
