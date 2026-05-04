import {
  Controller, Post, Get, Patch, Delete,
  Body, Param, Query, Request, HttpCode, HttpStatus,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import {
  LoginDto, RefreshTokenDto,
  ChangePasswordDto, ForgotPasswordDto,
  ResetPasswordDto, UpdateProfileDto,
} from './dto/auth.dto';
import { Public, CurrentUser, SkipMustChangePassword } from './decorators/auth.decorators';
import { ConfigService } from '@nestjs/config';

// ── Cookie helpers ────────────────────────────────────────────
const COOKIE_NAME = 'cf_refresh_server';

function setCookie(res: Response, token: string, config: ConfigService) {
  const isProd = config.get('NODE_ENV') === 'production';
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path:     '/api/v1/auth',
    maxAge,
  });
}

function clearCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: '/api/v1/auth' });
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  // ── Login ─────────────────────────────────────────────────────
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { ttl: 60000, limit: 10 } })
  async login(
    @Body() dto: LoginDto,
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      dto,
      req.ip || req.headers['x-forwarded-for'],
      req.headers['user-agent'],
    );
    // Move refresh token to httpOnly cookie — never exposed to JS
    setCookie(res, result.refresh_token, this.config);
    const { refresh_token, ...body } = result;
    return body;
  }

  // ── Refresh Token ─────────────────────────────────────────────
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      res.status(HttpStatus.UNAUTHORIZED);
      return { message: 'No refresh token' };
    }
    const result = await this.authService.refreshTokens(
      token,
      req.ip || req.headers['x-forwarded-for'],
      req.headers['user-agent'],
    );
    setCookie(res, result.refresh_token, this.config);
    const { refresh_token, ...body } = result;
    return body;
  }

  // ── Logout ────────────────────────────────────────────────────
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @SkipMustChangePassword()
  async logout(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.id, user.sessionId);
    clearCookie(res);
    return { message: 'Sesión cerrada' };
  }

  // ── Logout all ────────────────────────────────────────────────
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @SkipMustChangePassword()
  async logoutAll(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logoutAll(user.id);
    clearCookie(res);
    return { message: 'Todas las sesiones cerradas' };
  }

  // ── Get current user ──────────────────────────────────────────
  @Get('me')
  me(@CurrentUser() user: any) {
    return {
      id:           user.id,
      name:         user.name,
      email:        user.email,
      role:         user.role,
      universityId: user.universityId,
    };
  }

  // ── Update profile ────────────────────────────────────────────
  @Patch('me')
  updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.update(user.id, dto);
  }

  // ── Change Password ───────────────────────────────────────────
  // Throttle estricto: si un access token fue robado, limita los intentos
  // de cambiar la contraseña antes de que la víctima pueda invalidar la sesión.
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @SkipMustChangePassword()
  @Throttle({ medium: { ttl: 60_000, limit: 5 } })
  changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }

  // ── Forgot Password ───────────────────────────────────────────
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { ttl: 60000, limit: 5 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  // ── Reset Password ────────────────────────────────────────────
  @Public()
  @Throttle({ medium: { ttl: 60_000, limit: 5 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ── Email verification ────────────────────────────────────────
  // Logueado: dispara el envío del email de verificación al correo del user.
  @Post('send-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { ttl: 60_000, limit: 3 } })
  sendVerification(@CurrentUser() user: any) {
    return this.authService.sendEmailVerification(user.id);
  }

  // Público: confirma el token recibido por email. Endpoint GET para que el
  // link del correo funcione sin JS y se pueda redirigir al frontend.
  @Public()
  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  // ── Sessions ──────────────────────────────────────────────────
  @Get('sessions')
  getSessions(@CurrentUser() user: any) {
    return this.authService.getSessions(user.id);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  revokeSession(@CurrentUser() user: any, @Param('id') sessionId: string) {
    return this.authService.revokeSession(user.id, sessionId);
  }

  // ── 2FA / TOTP ────────────────────────────────────────────────
  // Setup: genera secret nuevo + QR. NO habilita aún — esperamos verify-setup.
  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { ttl: 60_000, limit: 5 } })
  setupTwoFactor(@CurrentUser() user: any) {
    return this.authService.setupTwoFactor(user.id);
  }

  // Verify setup: confirma el primer código y habilita 2FA permanentemente.
  @Post('2fa/verify-setup')
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { ttl: 60_000, limit: 5 } })
  verifyTwoFactorSetup(
    @CurrentUser() user: any,
    @Body() body: { code: string },
  ) {
    return this.authService.verifyTwoFactorSetup(user.id, body?.code);
  }

  // Disable: desactiva 2FA. Requiere código TOTP actual para confirmar identidad.
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { ttl: 60_000, limit: 5 } })
  disableTwoFactor(
    @CurrentUser() user: any,
    @Body() body: { code: string },
  ) {
    return this.authService.disableTwoFactor(user.id, body?.code);
  }

  // ── GDPR: borrar / anonimizar la propia cuenta ────────────────
  // Requiere reautenticar con la contraseña actual. Anonimiza PII pero
  // conserva el row para integridad de registros contables y audit trail.
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { ttl: 60_000, limit: 3 } })
  deleteAccount(
    @CurrentUser() user: any,
    @Body() body: { currentPassword: string },
  ) {
    return this.authService.deleteAccount(user.id, body?.currentPassword);
  }
}
