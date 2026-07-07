import {
  Controller, Get, Patch, Delete,
  Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UpdateProfileDto } from './dto/auth.dto';
import { CurrentUser } from './decorators/auth.decorators';

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
