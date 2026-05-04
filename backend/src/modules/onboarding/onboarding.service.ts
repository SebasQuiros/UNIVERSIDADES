import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { ConfigService } from '@nestjs/config';
import { CreateUniversityOnboardingDto } from './dto/onboarding.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
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
    const passwordHash = await bcrypt.hash(tempPassword, 12);

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
          name:               dto.adminName.trim(),
          email:              dto.adminEmail.toLowerCase().trim(),
          passwordHash,
          role:               'ADMIN',
          universityId:       university.id,
          isActive:           true,
          // El admin recibe la temp password por email — el hecho de poder
          // loguearse implica que tiene acceso al inbox, así que el correo
          // queda implícitamente verificado. Mismo criterio que en
          // superadmin.service.ts y universities.service.ts.
          emailVerified:      true,
          mustChangePassword: true,
          oauthProvider:      'LOCAL',
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

    return {
      success:      true,
      universityId: university.id,
      message:      'Solicitud procesada. Revise su correo para obtener sus credenciales de acceso.',
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
