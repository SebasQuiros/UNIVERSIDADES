import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
  OnModuleInit,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { EmailService } from '../notifications/email.service';
import * as totp from './totp';
import { toDataURL as qrToDataUrl } from 'qrcode';
import {
  LoginDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from './dto/auth.dto';
import { AuthResponse, AuthTokens, JwtPayload } from './interfaces/auth.interfaces';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    @Inject(REDIS_CLIENT) private readonly redis: any,
    private readonly email: EmailService,
  ) {}

  onModuleInit() {
    // Validate critical secrets at startup
    const jwtSecret = this.config.get<string>('JWT_SECRET') || '';
    const refreshSecret = this.config.get<string>('REFRESH_SECRET') || '';

    if (jwtSecret.length < 32) {
      this.logger.error('JWT_SECRET debe tener al menos 32 caracteres. Cambia el valor en .env');
    }
    if (refreshSecret.length < 32) {
      this.logger.error('REFRESH_SECRET debe tener al menos 32 caracteres. Cambia el valor en .env');
    }
  }

  // ── Account lockout (Redis-backed) ────────────────────────────
  // Tras 5 intentos fallidos en 15 min, la cuenta queda bloqueada por 15 min.
  // El contador se resetea en login exitoso.
  private readonly LOCKOUT_MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_WINDOW_SECS  = 15 * 60;
  private readonly LOCKOUT_DURATION_SECS = 15 * 60;

  private _failKey(email: string)   { return `auth:fails:${email.toLowerCase().trim()}`; }
  private _lockKey(email: string)   { return `auth:lock:${email.toLowerCase().trim()}`;  }

  private async _checkLockout(email: string): Promise<void> {
    try {
      const locked = await this.redis.get(this._lockKey(email));
      if (locked) {
        throw new UnauthorizedException(
          'Cuenta bloqueada por demasiados intentos fallidos. Intenta de nuevo en unos minutos.',
        );
      }
    } catch (e: any) {
      if (e instanceof UnauthorizedException) throw e;
      // Si Redis está caído, no bloqueamos el login (fail-open por disponibilidad)
    }
  }

  private async _recordFailedLogin(email: string, ipAddress?: string): Promise<number> {
    try {
      const key = this._failKey(email);
      const count: number = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, this.LOCKOUT_WINDOW_SECS);
      }
      if (count >= this.LOCKOUT_MAX_ATTEMPTS) {
        // node-redis v4 usa camelCase. setEx(key, ttl, value)
        await this.redis.setEx(this._lockKey(email), this.LOCKOUT_DURATION_SECS, '1');
        await this.redis.del(key);
        this.logger.warn(`[lockout] Cuenta bloqueada por brute-force: ${email} (IP: ${ipAddress || 'n/a'})`);
        // Audit log
        try {
          const u = await this.usersService.findByEmail(email);
          if (u) {
            await this.prisma.activityLog.create({
              data: {
                userId:   u.id,
                action:   'AUTH_LOCKOUT',
                entity:   'User',
                entityId: u.id,
                ipAddress: ipAddress ?? null,
                details:  { email, attempts: count } as any,
              },
            });
          }
        } catch { /* audit best-effort */ }
      }
      return count;
    } catch {
      return 0;
    }
  }

  private async _clearFailedLogins(email: string): Promise<void> {
    try {
      await this.redis.del(this._failKey(email));
      await this.redis.del(this._lockKey(email));
    } catch { /* ignore */ }
  }

  // ── Login ─────────────────────────────────────────────────────
  async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<AuthResponse> {
    // Always use a generic error to prevent user enumeration
    const INVALID_CREDENTIALS = 'Credenciales inválidas';

    // 1. Check lockout BEFORE expensive work — protege contra brute force.
    await this._checkLockout(dto.email);

    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      // Still run bcrypt to prevent timing attacks even when user doesn't exist
      await bcrypt.hash('dummy_password_to_prevent_timing_attack', 10);
      await this._recordFailedLogin(dto.email, ipAddress);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Cuenta desactivada. Contacta al administrador.');
    }

    // ── Bloqueo por email no verificado ──────────────────────────
    // Solo permite el login si el correo está verificado. Si no lo está,
    // re-enviamos automáticamente el email de verificación (best-effort)
    // para que el usuario pueda completar el flujo sin asistencia.
    if (!user.emailVerified) {
      this.sendEmailVerification(user.id).catch(() => { /* best-effort */ });
      throw new UnauthorizedException(
        'Tu correo no está verificado. Te enviamos un nuevo enlace de verificación — revisa tu bandeja de entrada (y spam).',
      );
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      const attempts = await this._recordFailedLogin(dto.email, ipAddress);
      // Audit log de intento fallido
      try {
        await this.prisma.activityLog.create({
          data: {
            userId:    user.id,
            action:    'AUTH_FAILED_LOGIN',
            entity:    'User',
            entityId:  user.id,
            ipAddress: ipAddress ?? null,
            details:   { attempts } as any,
          },
        });
      } catch { /* best effort */ }
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // ── 2FA TOTP check ───────────────────────────────────────────
    // Política: ADMIN y SUPERADMIN están OBLIGADOS a tener 2FA. Si todavía
    // no lo configuraron, el login emite tokens marcados con
    // `requireTotpSetup` y el frontend los redirige al wizard de setup
    // antes de permitir cualquier otra acción.
    //
    // El resto de roles (TEACHER, STUDENT) pueden usar 2FA opcional.
    const isPrivilegedRole = user.role === 'ADMIN' || user.role === 'SUPERADMIN';

    if (isPrivilegedRole && !user.totpEnabled) {
      // No emitimos error aquí — dejamos que el usuario entre con un flag
      // que el frontend usa para redirigir a /perfil/seguridad/2fa-setup.
      // Esto permite el flujo de setup mismo sin romper login.
      // El backend puede rechazar acciones sensibles vía guard si se requiere
      // TOTP estricto antes de cualquier operación.
      this.logger.warn(`[2FA-required] Usuario ${user.email} (${user.role}) entró sin 2FA — debe configurarlo.`);
    }

    // Si el usuario tiene 2FA habilitado, exigimos el código antes de emitir
    // tokens. El frontend debe re-postear con `totpCode` en el body.
    if (user.totpEnabled && user.totpSecret) {
      const inputCode = (dto as any).totpCode as string | undefined;
      if (!inputCode) {
        // El password fue correcto pero falta TOTP: 401 con código distintivo.
        throw new UnauthorizedException({
          message: 'Se requiere código de verificación 2FA.',
          code:    'TOTP_REQUIRED',
        });
      }
      if (!totp.verify(user.totpSecret, inputCode)) {
        await this._recordFailedLogin(dto.email, ipAddress);
        throw new UnauthorizedException({
          message: 'Código 2FA incorrecto.',
          code:    'TOTP_INVALID',
        });
      }
    }

    // Login OK — limpiamos el contador de fallos
    await this._clearFailedLogins(dto.email);

    // Update last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    this.logger.log(`Login exitoso: ${user.email} desde ${ipAddress || 'IP desconocida'}`);

    // Audit log de login exitoso
    try {
      await this.prisma.activityLog.create({
        data: {
          userId:    user.id,
          action:    'AUTH_LOGIN',
          entity:    'User',
          entityId:  user.id,
          ipAddress: ipAddress ?? null,
          details:   {} as any,
        },
      });
    } catch { /* best effort */ }

    const response = await this.generateAuthResponse(user, ipAddress, userAgent);
    // Inject flags que el frontend usa para redirección inmediata.
    (response as any).mustChangePassword = !!(user as any).mustChangePassword;
    // Roles privilegiados que aún no configuraron 2FA → frontend muestra wizard.
    (response as any).requireTotpSetup = isPrivilegedRole && !user.totpEnabled;
    return response;
  }

  // ── Refresh Token ─────────────────────────────────────────────
  async refreshTokens(refreshToken: string, ipAddress?: string, userAgent?: string): Promise<AuthTokens> {
    // Verify JWT signature first
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>('REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // Use a transaction to atomically check and rotate the token
    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const session = await tx.session.findUnique({
        where: { refreshToken },
        include: { user: true },
      });

      if (!session || !session.isActive) {
        // Possible token reuse attack — revoke ALL sessions for this user
        if (session?.userId) {
          await tx.session.updateMany({
            where: { userId: session.userId },
            data: { isActive: false, revokedAt: new Date() },
          });
          this.logger.warn(`Posible reutilización de refresh token para usuario ${session.userId}. Todas las sesiones revocadas.`);
        }
        throw new UnauthorizedException('Refresh token inválido');
      }

      if (session.expiresAt < new Date()) {
        await tx.session.update({
          where: { id: session.id },
          data: { isActive: false },
        });
        throw new UnauthorizedException('Refresh token expirado');
      }

      // Revoke current session (token rotation)
      await tx.session.update({
        where: { id: session.id },
        data: { isActive: false, revokedAt: new Date() },
      });

      return session.user;
    });

    // Generate new tokens outside transaction
    return this.generateTokens(result, ipAddress, userAgent);
  }

  // ── Logout ────────────────────────────────────────────────────
  async logout(userId: string, sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { token: sessionId, userId },
      data: { isActive: false, revokedAt: new Date() },
    });
    // Invalidar caché Redis
    try { await this.redis.del(`session:${sessionId}`); } catch {}
    this.logger.log(`Logout: usuario ${userId}`);
  }

  // ── Logout all sessions ───────────────────────────────────────
  async logoutAll(userId: string): Promise<void> {
    const { count } = await this.prisma.session.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false, revokedAt: new Date() },
    });
    this.logger.log(`Logout completo: ${count} sesiones revocadas para usuario ${userId}`);
  }

  // ── Change Password ───────────────────────────────────────────
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      throw new BadRequestException('Esta cuenta usa inicio de sesión con OAuth. No tiene contraseña local.');
    }

    const currentMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentMatch) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    const samePassword = await bcrypt.compare(dto.newPassword, user.passwordHash);
    if (samePassword) {
      throw new BadRequestException('La nueva contraseña no puede ser igual a la actual');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, mustChangePassword: false, updatedAt: new Date() },
    });

    // Revoke all other sessions for security
    await this.prisma.session.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false, revokedAt: new Date() },
    });

    // Audit log
    try {
      await this.prisma.activityLog.create({
        data: {
          userId,
          action:   'AUTH_PASSWORD_CHANGED',
          entity:   'User',
          entityId: userId,
          details:  {} as any,
        },
      });
    } catch { /* best-effort */ }

    this.logger.log(`Contraseña cambiada para usuario ${userId}`);
  }

  // ── Forgot Password ───────────────────────────────────────────
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(dto.email);

    // Always return the same message to prevent email enumeration
    const message = 'Si el correo existe, recibirás un enlace de recuperación.';

    if (!user) return { message };

    const resetToken = uuidv4();
    const resetTokenHash = createHash('sha256').update(resetToken).digest('hex');
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // 1 hour expiry

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken: resetTokenHash, resetTokenExpires: expires },
    });

    this.logger.log(`Token de reset generado para: ${user.email}`);

    // Envía el email con el link (raw token, no el hash). Si SMTP no está
    // configurado, EmailService.send es no-op silencioso (logueado).
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/auth/reset-password?token=${resetToken}`;
    this.email.send(
      user.email,
      'Restablecer tu contraseña — SJQA GROUP',
      this.email.passwordResetHtml(user.name ?? 'usuario', resetUrl),
    ).catch(() => { /* best-effort */ });

    // Audit log
    try {
      await this.prisma.activityLog.create({
        data: {
          userId:   user.id,
          action:   'AUTH_PASSWORD_RESET_REQUESTED',
          entity:   'User',
          entityId: user.id,
          details:  { email: user.email } as any,
        },
      });
    } catch { /* best-effort */ }

    return { message };
  }

  // ── Reset Password ────────────────────────────────────────────
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: tokenHash,
        resetTokenExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Token de recuperación inválido o expirado');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        resetToken: null,
        resetTokenExpires: null,
        updatedAt: new Date(),
      },
    });

    // Revoke all sessions
    await this.prisma.session.updateMany({
      where: { userId: user.id, isActive: true },
      data: { isActive: false, revokedAt: new Date() },
    });

    // Audit log
    try {
      await this.prisma.activityLog.create({
        data: {
          userId:   user.id,
          action:   'AUTH_PASSWORD_RESET_COMPLETED',
          entity:   'User',
          entityId: user.id,
          details:  {} as any,
        },
      });
    } catch { /* best-effort */ }

    // Limpiar contadores de lockout (por si fueron rebasados antes del reset)
    await this._clearFailedLogins(user.email);

    this.logger.log(`Contraseña restablecida para: ${user.email}`);
  }

  // ── 2FA / TOTP ────────────────────────────────────────────────
  // Flujo de setup:
  //   1. POST /auth/2fa/setup   → genera secret nuevo, devuelve QR (no habilita aún)
  //   2. Usuario escanea QR en Google Authenticator
  //   3. POST /auth/2fa/verify-setup { code } → si verifica, habilita 2FA
  //
  // Disable: POST /auth/2fa/disable { code } — requiere código actual.

  async setupTwoFactor(userId: string): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.totpEnabled) {
      throw new BadRequestException('2FA ya está habilitado. Deshabilítalo primero para regenerar el secret.');
    }

    const secret     = totp.generateSecret();
    const otpauthUrl = totp.buildOtpauthUrl({
      secret,
      accountName: user.email,
      issuer:      'SJQA GROUP',
    });
    const qrCodeDataUrl = await qrToDataUrl(otpauthUrl);

    // Guardamos el secret pero `totpEnabled` queda en false hasta que verifique.
    await this.prisma.user.update({
      where: { id: userId },
      data:  { totpSecret: secret, totpEnabled: false },
    });

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  async verifyTwoFactorSetup(userId: string, code: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecret) {
      throw new BadRequestException('Primero ejecuta /auth/2fa/setup.');
    }
    if (!totp.verify(user.totpSecret, code)) {
      throw new UnauthorizedException('Código 2FA incorrecto.');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data:  { totpEnabled: true },
    });
    try {
      await this.prisma.activityLog.create({
        data: {
          userId,
          action:   'AUTH_2FA_ENABLED',
          entity:   'User',
          entityId: userId,
          details:  {} as any,
        },
      });
    } catch { /* best-effort */ }

    this.logger.log(`2FA habilitado para usuario ${userId}`);
    return { message: '2FA habilitado correctamente.' };
  }

  async disableTwoFactor(userId: string, code: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('2FA no está habilitado en esta cuenta.');
    }
    if (!totp.verify(user.totpSecret, code)) {
      throw new UnauthorizedException('Código 2FA incorrecto.');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data:  { totpEnabled: false, totpSecret: null },
    });
    try {
      await this.prisma.activityLog.create({
        data: {
          userId,
          action:   'AUTH_2FA_DISABLED',
          entity:   'User',
          entityId: userId,
          details:  {} as any,
        },
      });
    } catch { /* best-effort */ }

    this.logger.log(`2FA deshabilitado para usuario ${userId}`);
    return { message: '2FA deshabilitado.' };
  }

  // ── GDPR: anonimización de cuenta ─────────────────────────────
  // Política: NO hard-delete porque rompería integridad contable y audit
  // trail. En cambio, anonimizamos PII (nombre, email, password), revocamos
  // sesiones, dejamos el row con marca `_DELETED_<timestamp>`.
  //
  // Resultado para el ex-usuario:
  //   · No puede loguearse (password hash limpiado)
  //   · Su email queda anonimizado (no aparece en búsquedas)
  //   · Sus registros contables siguen referidos por id pero sin PII
  //
  // Requiere reautenticación (password actual) para confirmar identidad.
  async deleteAccount(userId: string, currentPassword: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new BadRequestException('No se puede eliminar esta cuenta.');
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('La contraseña actual es incorrecta.');
    }

    if (user.role === 'SUPERADMIN') {
      throw new BadRequestException(
        'Las cuentas SUPERADMIN no pueden auto-eliminarse. Contacta a otro superadmin.',
      );
    }

    const ts = Date.now();
    const anonEmail = `deleted_${ts}_${user.id.slice(0, 8)}@anonymized.local`;

    await this.prisma.$transaction(async (tx) => {
      // 1. Revocar sesiones
      await tx.session.updateMany({
        where: { userId, isActive: true },
        data:  { isActive: false, revokedAt: new Date() },
      });

      // 2. Anonimizar PII (User no tiene phone — solo name, email, avatar, oauthId)
      await tx.user.update({
        where: { id: userId },
        data: {
          name:                     'Usuario eliminado',
          email:                    anonEmail,
          passwordHash:             null,
          avatarUrl:                null,
          isActive:                 false,
          emailVerified:            false,
          mustChangePassword:       false,
          resetToken:               null,
          resetTokenExpires:        null,
          emailVerifyToken:         null,
          emailVerifyTokenExpires:  null,
          oauthId:                  null,
        },
      });

      // 3. Audit log con la razón
      await tx.activityLog.create({
        data: {
          userId,
          action:   'AUTH_ACCOUNT_DELETED',
          entity:   'User',
          entityId: userId,
          details:  { previousEmail: user.email } as any,
        },
      });
    });

    // 4. Limpiar lockout counters
    await this._clearFailedLogins(user.email);

    this.logger.log(`Cuenta anonimizada: ${user.email} → ${anonEmail}`);
    return { message: 'Tu cuenta fue eliminada. Los registros contables se conservan anonimizados por requisitos legales.' };
  }

  // ── Email verification ────────────────────────────────────────
  // Genera un token, lo guarda hasheado en DB, envía email con el link.
  // El raw token solo viaja al email del usuario; en BD queda solo el SHA-256.
  async sendEmailVerification(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.emailVerified) {
      return { message: 'Tu correo ya está verificado.' };
    }

    const rawToken  = uuidv4();
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expires   = new Date();
    expires.setHours(expires.getHours() + 24); // 24h validez

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken:        tokenHash,
        emailVerifyTokenExpires: expires,
      },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const verifyUrl = `${frontendUrl}/auth/verify-email?token=${rawToken}`;
    this.email.send(
      user.email,
      'Verifica tu correo — SJQA GROUP',
      this.email.emailVerificationHtml(user.name ?? 'usuario', verifyUrl),
    ).catch(() => { /* best-effort */ });

    this.logger.log(`Verification email enviado a: ${user.email}`);
    return { message: 'Te enviamos un correo para verificar tu cuenta.' };
  }

  async verifyEmail(rawToken: string): Promise<{ message: string }> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerifyToken: tokenHash,
        emailVerifyTokenExpires: { gt: new Date() },
      },
    });
    if (!user) {
      throw new BadRequestException('Token de verificación inválido o expirado.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified:           true,
        emailVerifyToken:        null,
        emailVerifyTokenExpires: null,
      },
    });

    try {
      await this.prisma.activityLog.create({
        data: {
          userId:   user.id,
          action:   'AUTH_EMAIL_VERIFIED',
          entity:   'User',
          entityId: user.id,
          details:  { email: user.email } as any,
        },
      });
    } catch { /* best-effort */ }

    this.logger.log(`Email verificado: ${user.email}`);
    return { message: '¡Correo verificado correctamente!' };
  }

  // ── Get Active Sessions ───────────────────────────────────────
  async getSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        deviceInfo: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  // ── Revoke Session ────────────────────────────────────────────
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Sesión no encontrada');
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false, revokedAt: new Date(), revokedBy: userId },
    });
  }

  // ── PRIVATE: Generate tokens and create session ───────────────
  private async generateAuthResponse(
    user: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    const tokens = await this.generateTokens(user, ipAddress, userAgent);

    return {
      ...tokens,
      user: {
        id:           user.id,
        name:         user.name,
        email:        user.email,
        role:         user.role,
        universityId: user.universityId || null,
        avatarUrl:    user.avatarUrl || null,
      },
    };
  }

  private async generateTokens(
    user: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthTokens> {
    const jti = uuidv4(); // Unique JWT ID — stored in Session table
    const expiresInSeconds = this.parseExpiry(
      this.config.get<string>('JWT_EXPIRES') || '15m',
    );
    const refreshExpiresInSeconds = this.parseExpiry(
      this.config.get<string>('REFRESH_EXPIRES') || '7d',
    );

    const payload: JwtPayload = {
      sub:          user.id,
      email:        user.email,
      role:         user.role,
      universityId: user.universityId || null,
      jti,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret:    this.config.get<string>('JWT_SECRET'),
        expiresIn: expiresInSeconds,
      }),
      this.jwtService.signAsync(
        { sub: user.id, jti },
        {
          secret:    this.config.get<string>('REFRESH_SECRET'),
          expiresIn: refreshExpiresInSeconds,
        },
      ),
    ]);

    // Persist session in database
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + refreshExpiresInSeconds);

    await this.prisma.session.create({
      data: {
        userId:       user.id,
        token:        jti,
        refreshToken,
        ipAddress:    ipAddress || null,
        userAgent:    userAgent || null,
        deviceInfo:   this.parseDevice(userAgent),
        isActive:     true,
        expiresAt,
        lastUsedAt:   new Date(),
      },
    });

    return {
      access_token:  accessToken,
      refresh_token: refreshToken,
      token_type:    'Bearer',
      expires_in:    expiresInSeconds,
    };
  }

  private parseExpiry(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1), 10);
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default:  return 900; // 15 minutes fallback
    }
  }

  private parseDevice(userAgent?: string): string | null {
    if (!userAgent) return null;
    if (userAgent.includes('Mobile')) return 'Mobile';
    if (userAgent.includes('Chrome'))  return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari'))  return 'Safari';
    return 'Unknown';
  }

  private async findUniversityByEmailDomain(domain: string) {
    const universities = await this.prisma.university.findMany({
      where:  { isActive: true },
      select: { id: true, name: true, settings: true },
    });
    const d = domain.toLowerCase();
    for (const uni of universities) {
      const domains: string[] = (uni.settings as any)?.emailDomains ?? [];
      if (domains.map((x: string) => x.toLowerCase()).includes(d)) {
        return { id: uni.id, name: uni.name };
      }
    }
    return null;
  }
}
