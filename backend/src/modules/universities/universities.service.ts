import { Injectable, Inject, Logger, NotFoundException, ConflictException, ForbiddenException , BadRequestException } from '@nestjs/common';
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

/** Quien llama, tal como lo entrega `@CurrentUser()`. */
export type Caller = { id?: string; role?: string; universityId?: string | null };

@Injectable()
export class UniversitiesService {
  private readonly logger = new Logger(UniversitiesService.name);

  /**
   * Toda operación sobre `/universities/:id/*` debe probar que ese `:id` es la
   * institución de quien llama. ADMIN es el rol que se le vende a CADA
   * institución cliente, no un superusuario global: sin esta comprobación, el
   * administrador de un colegio podía leer y modificar otra institución entera
   * con solo cambiar el id de la URL.
   *
   * Falla CERRADO: si no se sabe quién llama, o no tiene institución asignada,
   * se deniega. Solo SUPERADMIN (rol global) queda exento.
   */
  private assertMismaInstitucion(universityId: string, caller?: Caller): void {
    if (caller?.role === 'SUPERADMIN') return;

    if (!caller?.universityId || !universityId) {
      throw new ForbiddenException(
        'No se pudo verificar tu institución. Acceso denegado.',
      );
    }
    if (caller.universityId !== universityId) {
      throw new ForbiddenException(
        'No tenés acceso a los datos de otra institución.',
      );
    }
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly supabaseAdmin: SupabaseAdminService,
    @Inject(REDIS_CLIENT) private readonly redis: any,
  ) {}

  async findAll(user?: { role: string; universityId: string | null }) {
    // SUPERADMIN ve todas; ADMIN solo la suya (evita enumerar tenants ajenos).
    // Si un ADMIN no tiene universidad asignada, no ve ninguna.
    const scope =
      !user || user.role === 'SUPERADMIN'
        ? {}
        : { id: user.universityId ?? '00000000-0000-0000-0000-000000000000' };
    return this.prisma.university.findMany({
      where:   { isActive: true, ...scope },
      include: {
        plan:   { select: { id: true, name: true } },
        _count: { select: { users: true, courses: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Consulta cruda, SIN control de acceso. Solo para uso interno del service,
   * donde el permiso ya se comprobó antes. No exponer por HTTP.
   */
  private async _findOneRaw(id: string) {
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

  async findOne(id: string, caller?: Caller) {
    this.assertMismaInstitucion(id, caller);
    return this._findOneRaw(id);
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

  async findUsers(id: string, callerRole = 'ADMIN', caller?: Caller) {
    this.assertMismaInstitucion(id, caller);
    await this._findOneRaw(id);
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
  }, caller?: Caller) {
    this.assertMismaInstitucion(universityId, caller);
    await this._findOneRaw(universityId);
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

    // El correo va sin bloquear: la cuenta ya existe y la contraseña se
    // devuelve abajo, así que un fallo de SMTP no debe impedir el alta.
    //
    // Pero SÍ se registra. Antes se descartaba en silencio, y con la carga
    // masiva eso se vuelve peligroso: el panel dice "se enviaron las
    // credenciales por correo", el profesor confía y no descarga el archivo,
    // y si los envíos venían fallando nadie se entera hasta que 500
    // estudiantes no pueden entrar — sin una sola línea en los registros que
    // explique por qué.
    this.email.send(
      email,
      'Bienvenido a SJQA GROUP — Credenciales de acceso',
      this.email.newUserCredentialsHtml(data.name, email, tempPassword),
    ).catch((err) => {
      this.logger.warn(
        `No se pudo enviar las credenciales a ${email}: ${(err as Error).message}. ` +
        'La contraseña temporal solo queda en la respuesta de esta petición.',
      );
    });

    // Return the plaintext temp password only at creation time
    return { ...user, temporaryPassword: tempPassword };
  }

  /**
   * Alta MASIVA de usuarios.
   *
   * Una clase no se carga de a uno. Con 500 estudiantes, crear las cuentas a
   * mano no es "incomodo": es imposible en la practica, y era el unico camino
   * que existia.
   *
   * Decisiones que importan:
   *
   * - NO es transaccional a proposito. Cada usuario se crea o falla por su
   *   cuenta y el resultado dice cual fue cual. Abortar 499 altas buenas
   *   porque un correo venia repetido seria peor: el profesor no sabria
   *   cuales quedaron y tendria que empezar de nuevo.
   *
   * - Va en serie, no en paralelo. Cada alta toca Supabase Auth, y 500
   *   llamadas simultaneas contra su API terminan en limite de peticiones —
   *   con una parte de la clase creada y otra no, que es el peor estado
   *   posible.
   *
   * - Las contrasenas temporales se devuelven UNA vez, aca. No quedan
   *   guardadas en ningun lado: Supabase solo tiene el hash. Si se pierde
   *   esta respuesta, hay que restablecerlas.
   */
  async createUsersBulk(
    universityId: string,
    usuarios: Array<{ name: string; email: string; role?: string }>,
    caller?: Caller,
  ) {
    this.assertMismaInstitucion(universityId, caller);
    await this._findOneRaw(universityId);

    if (!Array.isArray(usuarios) || usuarios.length === 0) {
      throw new BadRequestException('No se recibio ningun usuario.');
    }
    // Tope por llamada: mantiene la peticion dentro de un tiempo razonable y
    // evita que un archivo equivocado dispare miles de altas.
    if (usuarios.length > 500) {
      throw new BadRequestException(
        `Maximo 500 usuarios por carga (se recibieron ${usuarios.length}). Dividi la lista.`,
      );
    }

    // Correos repetidos DENTRO del archivo: se detectan antes de tocar nada,
    // porque si no el primero se crea y el segundo falla con "ya existe" y
    // parece un error del sistema en vez de un error del archivo.
    const vistos = new Set<string>();
    const creados: any[] = [];
    const fallidos: Array<{ fila: number; email: string; motivo: string }> = [];

    for (let i = 0; i < usuarios.length; i++) {
      const fila = i + 1;
      const u = usuarios[i] ?? ({} as any);
      const email = String(u.email ?? '').toLowerCase().trim();
      const name  = String(u.name ?? '').trim();
      const role  = String(u.role ?? 'STUDENT').toUpperCase();

      if (!email || !name) {
        fallidos.push({ fila, email, motivo: 'Falta el nombre o el correo.' });
        continue;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        fallidos.push({ fila, email, motivo: 'El correo no tiene un formato valido.' });
        continue;
      }
      if (vistos.has(email)) {
        fallidos.push({ fila, email, motivo: 'Repetido dentro de la misma lista.' });
        continue;
      }
      // Un ADMIN no puede fabricarse un SUPERADMIN por la puerta de atras.
      if (!['STUDENT', 'TEACHER', 'ADMIN'].includes(role)) {
        fallidos.push({ fila, email, motivo: `Rol no permitido: ${role}` });
        continue;
      }
      vistos.add(email);

      try {
        const creado = await this.createUser(universityId, { name, email, role }, caller);
        creados.push({
          fila,
          nombre:             creado.name,
          email:              creado.email,
          rol:                creado.role,
          contrasenaTemporal: creado.temporaryPassword,
        });
      } catch (e: any) {
        fallidos.push({ fila, email, motivo: e?.message ?? 'Error desconocido' });
      }
    }

    return {
      creados,
      fallidos,
      resumen: {
        recibidos: usuarios.length,
        creados:   creados.length,
        fallidos:  fallidos.length,
      },
      // Que el llamador sepa si el correo salio de verdad: si no hay SMTP, la
      // unica copia de estas contrasenas es esta respuesta.
      correoEnviado: this.email.isConfigured(),
      aviso: this.email.isConfigured()
        ? 'Las credenciales tambien se enviaron por correo a cada persona.'
        : 'NO hay correo configurado: esta respuesta es la UNICA copia de las contrasenas. Descargala antes de cerrar.',
    };
  }

  /**
   * Change the role of a user within the university (ADMIN cannot promote to SUPERADMIN).
   */
  async updateUserRole(universityId: string, userId: string, role: string, caller?: Caller) {
    this.assertMismaInstitucion(universityId, caller);
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
  async toggleUserActive(universityId: string, userId: string, caller?: Caller) {
    this.assertMismaInstitucion(universityId, caller);
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

  async update(id: string, dto: UpdateUniversityDto, caller?: Caller) {
    this.assertMismaInstitucion(id, caller);
    await this._findOneRaw(id);
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
  async getStats(universityId: string, caller?: Caller) {
    this.assertMismaInstitucion(universityId, caller);
    await this._findOneRaw(universityId);

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
