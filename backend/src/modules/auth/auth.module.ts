import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { SupabaseJwtStrategy } from './strategies/supabase-jwt.strategy';
import { JwtAuthGuard, RolesGuard } from './guards/auth.guards';
import { CompanyEnabledGuard } from '../../common/guards/company-enabled.guard';
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
    // ── Por qué CompanyEnabledGuard se registra ACÁ y no en AppModule ──
    //
    // El orden de los guards globales sigue el orden de registro, y los de
    // AppModule corren ANTES que los de los módulos importados. Estando allá,
    // este guard decidía sin que `req.user` existiera todavía, con tres
    // consecuencias medidas en producción:
    //
    //   · Su bypass de staff (`req.user?.role`) era código muerto: un
    //     profesor no podía entrar a una empresa deshabilitada — justo lo
    //     que ese bypass existe para permitir.
    //   · Una petición SIN autenticar a /companies/<uuid>/... respondía
    //     404 "Empresa no encontrada": revelaba si un id existe, antes de
    //     saber quién pregunta.
    //   · Los códigos mentían: 404 donde correspondía 401.
    //
    // Registrado acá el orden queda: límite de peticiones → JWT → roles →
    // empresa habilitada. Que es el orden que su propio comentario decía
    // tener y no tenía.
    { provide: APP_GUARD, useClass: CompanyEnabledGuard },
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
