import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { SupabaseJwtStrategy } from './strategies/supabase-jwt.strategy';
import { JwtAuthGuard, RolesGuard } from './guards/auth.guards';
import { UsersService } from '../users/users.service';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  providers: [
    AuthService,
    UsersService,
    // Valida el access token de Supabase (ES256/JWKS) y resuelve el User por authId.
    SupabaseJwtStrategy,
    // Guards registered as plain providers so they can be injected
    JwtAuthGuard,
    RolesGuard,
    // Cadena global de guards: JWT → Roles.
    // (MustChangePasswordGuard se retiró: Supabase gestiona el cambio de
    //  contraseña; ya no existe endpoint local para hacerlo, y dejarlo activo
    //  bloquearía a cualquier fila con must_change_password = true.)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
