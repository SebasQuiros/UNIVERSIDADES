import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEMP_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';

function generateTempPassword(length = 8): string {
  const bytes = randomBytes(length * 2);
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += TEMP_CHARS[bytes[i] % TEMP_CHARS.length];
  }
  return pass;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActivityEntry {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  details: any;
  createdAt: Date;
  user: { id: string; name: string; email: string; role: string };
  universityName?: string | null;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class SuperadminService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Dashboard stats ─────────────────────────────────────────────────────────

  async getDashboardStats() {
    const [
      totalUniversities,
      activeUniversities,
      roleCounts,
      totalCourses,
      totalExercises,
      totalAttempts,
      plans,
      universities,
      recentMonths,
      topUniversities,
      recentActivity,
    ] = await Promise.all([
      this.prisma.university.count(),
      this.prisma.university.count({ where: { isActive: true } }),
      this.prisma.user.groupBy({ by: ['role'], _count: { id: true } }),
      this.prisma.course.count({ where: { isActive: true } }),
      this.prisma.exercise.count({ where: { isArchived: false } }),
      this.prisma.exerciseAttempt.count(),
      this.prisma.plan.findMany({ where: { isActive: true }, select: { priceUsd: true } }),
      this.prisma.university.findMany({
        where: { isActive: true },
        select: { planId: true, plan: { select: { priceUsd: true } } },
      }),
      this.prisma.university.findMany({
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.university.findMany({
        take: 5,
        where: { isActive: true },
        orderBy: { users: { _count: 'desc' } },
        select: {
          name: true,
          _count: { select: { users: { where: { role: 'STUDENT' } }, courses: true } },
        },
      }),
      this.prisma.activityLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
    ]);

    const roleMap = Object.fromEntries(roleCounts.map((r) => [r.role, r._count.id]));
    // Annual license revenue: ₡5,000 per active student (confidential — SUPERADMIN only)
    const PRICE_PER_STUDENT_CRC = 5000;
    const revenueEstimate = (roleMap['STUDENT'] ?? 0) * PRICE_PER_STUDENT_CRC;

    // Build last-6-months growth
    const now = new Date();
    const monthLabels: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('es', { month: 'short', year: '2-digit' });
      const count = recentMonths.filter((u) => {
        const ud = new Date(u.createdAt);
        return ud.getFullYear() === d.getFullYear() && ud.getMonth() === d.getMonth();
      }).length;
      monthLabels.push({ month: label, count });
    }

    const topUnisFormatted = topUniversities.map((u) => ({
      name: u.name,
      students: u._count.users,
      exercises: 0,
    }));

    return {
      totalUniversities,
      activeUniversities,
      totalUsers: Object.values(roleMap).reduce((a, b) => a + b, 0),
      totalStudents: roleMap['STUDENT'] ?? 0,
      totalTeachers: roleMap['TEACHER'] ?? 0,
      totalCourses,
      totalExercises,
      totalAttempts,
      revenueEstimate,
      universitiesGrowth: monthLabels,
      topUniversities: topUnisFormatted,
      recentActivity,
    };
  }

  // ── Universities CRUD ────────────────────────────────────────────────────────

  async getUniversities(filters?: { search?: string; isActive?: boolean }) {
    return this.prisma.university.findMany({
      where: {
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
        ...(filters?.search && {
          OR: [
            { name:      { contains: filters.search, mode: 'insensitive' } },
            { shortName: { contains: filters.search, mode: 'insensitive' } },
            { country:   { contains: filters.search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        plan:   { select: { id: true, name: true, priceUsd: true } },
        _count: { select: { users: true, courses: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUniversity(id: string) {
    const university = await this.prisma.university.findUnique({
      where: { id },
      include: {
        plan:    { select: { id: true, name: true, priceUsd: true } },
        users:   {
          select: {
            id: true, name: true, email: true, role: true,
            isActive: true, lastLogin: true, createdAt: true,
          },
          orderBy: { name: 'asc' },
        },
        courses: {
          where: { isActive: true },
          select: {
            id: true, name: true, code: true, period: true, isActive: true, createdAt: true,
            teacher: { select: { name: true } },
            _count:  { select: { enrollments: true, exercises: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count:  { select: { users: true, courses: true } },
      },
    });
    if (!university) throw new NotFoundException('Universidad no encontrada');

    // Count by role
    const roleCounts = await this.prisma.user.groupBy({
      by:    ['role'],
      where: { universityId: id },
      _count: { id: true },
    });
    const roleMap = Object.fromEntries(roleCounts.map((r) => [r.role, r._count.id]));

    return {
      ...university,
      stats: {
        totalStudents:  roleMap['STUDENT']  ?? 0,
        totalTeachers:  roleMap['TEACHER']  ?? 0,
        totalAdmins:    roleMap['ADMIN']    ?? 0,
        totalCourses:   university._count.courses,
      },
    };
  }

  async createUniversity(dto: {
    name: string;
    shortName?: string;
    country?: string;
    website?: string;
    planId?: string;
    maxStudents?: number;
    adminEmail?: string;
    adminName?: string;
  }) {
    // Check if admin email is already taken
    if (dto.adminEmail) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.adminEmail.toLowerCase().trim() },
      });
      if (existing) throw new ConflictException('El correo del administrador ya está registrado');
    }

    const university = await this.prisma.university.create({
      data: {
        name:        dto.name,
        shortName:   dto.shortName   ?? null,
        country:     dto.country     ?? 'Costa Rica',
        website:     dto.website     ?? null,
        planId:      dto.planId      ?? null,
        maxStudents: dto.maxStudents ?? 200,
        isActive:    true,
      },
    });

    let adminUser: any = null;
    let tempPassword: string | null = null;

    if (dto.adminEmail && dto.adminName) {
      tempPassword = generateTempPassword(10);
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      adminUser = await this.prisma.user.create({
        data: {
          name:               dto.adminName,
          email:              dto.adminEmail.toLowerCase().trim(),
          passwordHash,
          role:               Role.ADMIN,
          universityId:       university.id,
          isActive:           true,
          emailVerified:      true,
          mustChangePassword: true,
        },
        select: { id: true, name: true, email: true, role: true },
      });
    }

    return { university, adminUser, tempPassword };
  }

  async updateUniversity(
    id: string,
    dto: {
      name?: string;
      shortName?: string;
      country?: string;
      website?: string;
      planId?: string;
      maxStudents?: number;
    },
  ) {
    await this.getUniversity(id);
    return this.prisma.university.update({
      where: { id },
      data: {
        ...(dto.name        !== undefined && { name:        dto.name        }),
        ...(dto.shortName   !== undefined && { shortName:   dto.shortName   }),
        ...(dto.country     !== undefined && { country:     dto.country     }),
        ...(dto.website     !== undefined && { website:     dto.website     }),
        ...(dto.planId      !== undefined && { planId:      dto.planId      }),
        ...(dto.maxStudents !== undefined && { maxStudents: dto.maxStudents }),
        updatedAt: new Date(),
      },
    });
  }

  async toggleUniversityStatus(id: string) {
    const university = await this.prisma.university.findUnique({ where: { id } });
    if (!university) throw new NotFoundException('Universidad no encontrada');
    return this.prisma.university.update({
      where: { id },
      data:  { isActive: !university.isActive, updatedAt: new Date() },
    });
  }

  // ── Users management ─────────────────────────────────────────────────────────

  async getUsers(filters?: { role?: string; universityId?: string; search?: string }) {
    return this.prisma.user.findMany({
      where: {
        ...(filters?.role         && { role:        filters.role as Role }),
        ...(filters?.universityId && { universityId: filters.universityId }),
        ...(filters?.search && {
          OR: [
            { name:  { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
          ],
        }),
      },
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, emailVerified: true, lastLogin: true, createdAt: true,
        university: { select: { id: true, name: true, shortName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resetUserPassword(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const tempPassword = generateTempPassword(8);
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: true,
        updatedAt: new Date(),
      },
    });

    return { tempPassword };
  }

  async toggleUserStatus(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data:  { isActive: !user.isActive, updatedAt: new Date() },
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, emailVerified: true, lastLogin: true, createdAt: true,
        university: { select: { id: true, name: true, shortName: true } },
      },
    });
    return updated;
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    await this.prisma.user.delete({ where: { id: userId } });
  }

  // ── Plans management ─────────────────────────────────────────────────────────

  async getPlans() {
    const plans = await this.prisma.plan.findMany({
      orderBy: { maxStudents: 'asc' },
    });
    // Count universities per plan
    const counts = await this.prisma.university.groupBy({
      by: ['planId'],
      _count: { id: true },
    });
    const countMap = Object.fromEntries(
      counts.map((c) => [c.planId ?? 'none', c._count.id]),
    );
    return plans.map((p) => ({ ...p, universityCount: countMap[p.id] ?? 0 }));
  }

  async assignPlan(universityId: string, planId: string) {
    const [university, plan] = await Promise.all([
      this.prisma.university.findUnique({ where: { id: universityId } }),
      this.prisma.plan.findUnique({ where: { id: planId } }),
    ]);
    if (!university) throw new NotFoundException('Universidad no encontrada');
    if (!plan)       throw new NotFoundException('Plan no encontrado');
    return this.prisma.university.update({
      where: { id: universityId },
      data:  { planId, updatedAt: new Date() },
    });
  }

  // ── Activity log ─────────────────────────────────────────────────────────────

  async getActivityLog(
    limit = 50,
    filters?: { universityId?: string; userId?: string },
  ): Promise<ActivityEntry[]> {
    const logs = await this.prisma.activityLog.findMany({
      take: limit,
      where: {
        ...(filters?.userId && { userId: filters.userId }),
        ...(filters?.universityId && {
          user: { universityId: filters.universityId },
        }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true, name: true, email: true, role: true,
            university: { select: { name: true } },
          },
        },
      },
    });

    return logs.map((log) => ({
      id:            log.id,
      action:        log.action,
      entity:        log.entity,
      entityId:      log.entityId,
      details:       log.details,
      createdAt:     log.createdAt,
      user:          {
        id:    log.user.id,
        name:  log.user.name,
        email: log.user.email,
        role:  log.user.role,
      },
      universityName: (log.user as any).university?.name ?? null,
    }));
  }
}
