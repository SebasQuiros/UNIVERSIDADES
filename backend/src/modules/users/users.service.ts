import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseAdminService } from '../../common/supabase/supabase-admin.service';
import { Role } from '@prisma/client';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { invalidateAuthUser } from '../../common/auth/auth-cache';

interface CreateUserData {
  name:          string;
  email:         string;
  password:      string;
  role:          Role;
  universityId:  string | null;
  avatarUrl?:    string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseAdmin: SupabaseAdminService,
    @Inject(REDIS_CLIENT) private readonly redis: any,
  ) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        university: { select: { id: true, name: true, shortName: true } },
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    // Ya no hay campos sensibles que ocultar: el auth vive en Supabase.
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async create(data: CreateUserData) {
    const email = data.email.toLowerCase().trim();

    // ── INVARIANTE MULTI-TENANT ───────────────────────────────────────────
    // Todo usuario DEBE pertenecer a una institución (universidad o colegio).
    // La única excepción es SUPERADMIN, que por diseño es global.
    // Un usuario "huérfano" (sin universityId) era la raíz de varias fugas
    // entre instituciones: los chequeos de tenant no tenían con qué comparar.
    if (data.role !== 'SUPERADMIN' && !data.universityId) {
      throw new BadRequestException(
        'Todo usuario debe pertenecer a una institución. Indicá la universidad o colegio.',
      );
    }
    if (data.universityId) {
      const uni = await this.prisma.university.findUnique({
        where: { id: data.universityId }, select: { id: true, isActive: true },
      });
      if (!uni) throw new BadRequestException('La institución indicada no existe.');
      if (!uni.isActive) throw new BadRequestException('La institución está inactiva.');
    }
    // Crea primero la identidad en Supabase Auth (idempotente por email) y
    // guarda su id en `authId`. Ya no almacenamos hash de contraseña localmente.
    const authId = await this.supabaseAdmin.createUser({
      email,
      password: data.password,
      userMetadata: { name: data.name, role: data.role },
    });
    return this.prisma.user.create({
      data: {
        authId,
        name:               data.name,
        email,
        role:               data.role,
        universityId:       data.universityId,
        avatarUrl:          data.avatarUrl || null,
        emailVerified:      true,
        isActive:           true,
        mustChangePassword: false,
      },
    });
  }

  async update(id: string, data: { name?: string; avatarUrl?: string }) {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        updatedAt: new Date(),
      },
    });
    return user;
  }

  async toggleActive(id: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive, updatedAt: new Date() },
    });

    // Invalida el cache authId→User para que el toggle sea inmediato (fail-open).
    await invalidateAuthUser(this.redis, user.authId);

    return updated;
  }

  /**
   * Listado de usuarios. Solo lo expone el controller a SUPERADMIN; para
   * cualquier otro llamador pasar SIEMPRE `universityId` — sin él devuelve
   * usuarios de TODAS las instituciones.
   */
  async findAll(filters: { universityId?: string; role?: Role; search?: string }) {
    return this.prisma.user.findMany({
      where: {
        ...(filters.universityId && { universityId: filters.universityId }),
        ...(filters.role && { role: filters.role }),
        ...(filters.search && {
          OR: [
            { name:  { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
          ],
        }),
      },
      select: {
        id: true, name: true, email: true, role: true,
        isActive: true, emailVerified: true, lastLogin: true,
        createdAt: true,
        university: { select: { id: true, name: true, shortName: true } },
      },
      orderBy: { name: 'asc' },
    });
  }
}
