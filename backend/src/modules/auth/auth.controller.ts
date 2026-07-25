import {
  Controller, Get, Post, Patch, Delete,
  Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UpdateProfileDto, DemoLoginDto } from './dto/auth.dto';
import { CurrentUser, Public } from './decorators/auth.decorators';

/**
 * Auth mínimo tras la migración a Supabase Auth.
 *
 * El login / refresh / logout / verificación de email / reset de contraseña
 * y 2FA los gestiona Supabase directamente contra el frontend. El backend solo
 * valida el access token (JWKS ES256) y expone el perfil de la app.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  // ── Perfil del usuario autenticado ────────────────────────────
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

  // ── Acceso rápido a cuentas de prueba — deshabilitado por defecto ──
  // (rechaza siempre sin DEMO_LOGIN_TOKEN configurado en el entorno). El
  // token NUNCA vive en el frontend ni en el repo — solo como env var en
  // Railway. Sin él, ni con el body correcto responde nada distinto de 404.
  @Post('demo-login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  demoLogin(@Body() dto: DemoLoginDto) {
    return this.authService.demoLogin(dto.token, dto.as);
  }

  // ── Actualizar perfil ─────────────────────────────────────────
  @Patch('me')
  updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.update(user.id, dto);
  }

  // ── GDPR: borrar / anonimizar la propia cuenta ────────────────
  // La reautenticación la exige Supabase antes de emitir el token; aquí solo
  // anonimizamos PII conservando el row para integridad contable/audit.
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  deleteAccount(@CurrentUser() user: any) {
    return this.authService.deleteAccount(user.id);
  }
}
