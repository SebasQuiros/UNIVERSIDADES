import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseAdminService } from '../../common/supabase/supabase-admin.service';
import { EmailService } from '../notifications/email.service';
import { ConfigService } from '@nestjs/config';
import { CreateUniversityOnboardingDto } from './dto/onboarding.dto';
import * as crypto from 'crypto';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly supabaseAdmin: SupabaseAdminService,
  ) {}

  // ── GET /onboarding/plans ─────────────────────────────────────
  async getPlans() {
    const plans = await this.prisma.plan.findMany({
      where:   { isActive: true },
      select: {
        id:          true,
        name:        true,
        maxStudents: true,
        maxCourses:  true,
        priceUsd:    true,
        features:    true,
      },
      orderBy: { maxStudents: 'asc' },
    });
    return plans;
  }

  // ── POST /onboarding/university ───────────────────────────────
  async registerUniversity(dto: CreateUniversityOnboardingDto) {
    // 1. Validate terms accepted
    if (!dto.acceptedTerms) {
      throw new BadRequestException('Debe aceptar los términos y condiciones para continuar.');
    }

    // 2. Check email uniqueness
    const existingUser = await this.prisma.user.findUnique({
      where:  { email: dto.adminEmail.toLowerCase().trim() },
      select: { id: true },
    });
    if (existingUser) {
      throw new BadRequestException(
        'El correo electrónico ya está registrado en el sistema. Por favor utilice otro correo.',
      );
    }

    // 3. Resolve a default plan for schema compatibility (billing is now
    //    per-student at ₡5000/year; plan is kept only as a legacy FK).
    //    Pick any active plan, or fall back to the first one available.
    const plan = await this.prisma.plan.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    }) ?? await this.prisma.plan.findFirst({ orderBy: { createdAt: 'asc' } });

    // 4. Generate secure temporary password (12 chars, mixed)
    const tempPassword = this.generateTempPassword(12);
    const adminEmail = dto.adminEmail.toLowerCase().trim();

    // Crear la identidad en Supabase Auth (idempotente por email) ANTES de la
    // transacción de BD. La contraseña vive en Supabase; localmente solo el authId.
    const authId = await this.supabaseAdmin.createUser({
      email:    adminEmail,
      password: tempPassword,
      userMetadata: { name: dto.adminName.trim(), role: 'ADMIN' },
    });

    // 5. Create University + Admin in a transaction
    const { university, admin } = await this.prisma.$transaction(async (tx) => {
      const university = await tx.university.create({
        data: {
          name:        dto.universityName.trim(),
          shortName:   dto.universityShortName.trim().toUpperCase(),
          country:     dto.country.trim(),
          website:     dto.website?.trim() || null,
          planId:      plan?.id ?? null,
          maxStudents: plan?.maxStudents ?? 500,
          isActive:    true,
          settings:    {},
        },
      });

      const admin = await tx.user.create({
        data: {
          authId,
          name:               dto.adminName.trim(),
          email:              adminEmail,
          role:               'ADMIN',
          universityId:       university.id,
          isActive:           true,
          // El admin recibe la temp password por email — el hecho de poder
          // loguearse implica que tiene acceso al inbox, así que el correo
          // queda implícitamente verificado. Mismo criterio que en
          // superadmin.service.ts y universities.service.ts.
          emailVerified:      true,
          mustChangePassword: false,
        },
      });

      return { university, admin };
    });

    this.logger.log(
      `Nueva universidad registrada: ${university.name} (${university.id}) — Admin: ${admin.email}`,
    );

    // 6. Send welcome email (async — don't block response)
    this.sendWelcomeEmail({
      adminName:      dto.adminName.trim(),
      adminEmail:     dto.adminEmail.toLowerCase().trim(),
      universityName: dto.universityName.trim(),
      tempPassword,
      planName:       plan?.name ?? 'Licencia SJQA',
      maxStudents:    plan?.maxStudents ?? 500,
    }).catch((err) => {
      this.logger.error(`Error enviando email de bienvenida: ${err.message}`);
    });

    // ── Las credenciales se devuelven acá, no solo por correo ──────────
    //
    // Antes se mandaban UNICAMENTE por email. Si el SMTP no esta configurado
    // —y no lo esta, el servicio de correo avisa al arrancar— quien registra
    // su institucion no recibe nunca su contrasena y no puede entrar jamas.
    // El registro decia "revise su correo" y ese correo no existia.
    //
    // Se devuelve en la respuesta de la peticion que acaba de crear la
    // cuenta: viaja por HTTPS a quien la esta creando en ese mismo momento, y
    // es la unica vez que se puede ver. No queda guardada en ningun lado —
    // Supabase solo tiene el hash.
    return {
      success:      true,
      universityId: university.id,
      credenciales: {
        email:               dto.adminEmail.toLowerCase().trim(),
        contrasenaTemporal:  tempPassword,
        aviso: 'Anotala ahora: es la unica vez que se muestra. Cambiala al entrar.',
      },
      correoEnviado: this.emailService.isConfigured(),
      message: 'Institucion registrada. Guarda las credenciales que aparecen abajo.',
    };
  }

  // ── Private helpers ───────────────────────────────────────────

  private generateTempPassword(length: number): string {
    const chars = {
      upper:   'ABCDEFGHJKLMNPQRSTUVWXYZ',
      lower:   'abcdefghjkmnpqrstuvwxyz',
      digits:  '23456789',
      special: '#$@!%&*?',
    };
    const allChars = chars.upper + chars.lower + chars.digits + chars.special;

    // Ensure at least one of each type
    const mandatory = [
      chars.upper[crypto.randomInt(chars.upper.length)],
      chars.lower[crypto.randomInt(chars.lower.length)],
      chars.digits[crypto.randomInt(chars.digits.length)],
      chars.special[crypto.randomInt(chars.special.length)],
    ];

    const remaining = Array.from(
      { length: length - mandatory.length },
      () => allChars[crypto.randomInt(allChars.length)],
    );

    // Shuffle all chars
    const all = [...mandatory, ...remaining];
    for (let i = all.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all.join('');
  }

  private async sendWelcomeEmail(params: {
    adminName:      string;
    adminEmail:     string;
    universityName: string;
    tempPassword:   string;
    planName:       string;
    maxStudents:    number;
  }) {
    const { adminName, adminEmail, universityName, tempPassword, planName, maxStudents } = params;
    const appUrl = this.config.get<string>('APP_URL') || 'https://sjqagroup.com';
    const loginUrl = `${appUrl}/login`;

    const subject = 'Bienvenido a SJQA GROUP — Credenciales de acceso';
    const html    = this.emailService.universityWelcomeHtml({
      adminName,
      adminEmail,
      universityName,
      tempPassword,
      planName,
      maxStudents,
      loginUrl,
    });

    if (html) {
      await this.emailService.send(adminEmail, subject, html);
    } else {
      // Fallback: log to console
      this.logger.log(
        `\n========================================\n` +
        `CREDENCIALES DE ACCESO — ${universityName}\n` +
        `Email:    ${adminEmail}\n` +
        `Password: ${tempPassword}\n` +
        `Plan:     ${planName} (hasta ${maxStudents} estudiantes)\n` +
        `Login:    ${loginUrl}\n` +
        `========================================`,
      );
    }
  }
}
