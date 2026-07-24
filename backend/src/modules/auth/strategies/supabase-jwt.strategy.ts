import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from 'jwks-rsa';
import { PrismaService } from '../../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../../redis/redis.module';
import { authUserCacheKey } from '../../../common/auth/auth-cache';

/**
 * Estrategia 'jwt' (mantiene el nombre para que `JwtAuthGuard = AuthGuard('jwt')`
 * y toda la cadena de guards siga funcionando sin cambios).
 *
 * Valida el ACCESS TOKEN emitido por **Supabase Auth**:
 *  - Firma ES256 verificada contra el JWKS público del proyecto (sin secreto).
 *  - `aud = authenticated`, `iss = <SUPABASE_URL>/auth/v1`.
 *
 * Luego resuelve el `User` de la app por `authId` (= `sub` del token). El rol,
 * la universidad y la empresa viven en NUESTRA base — Supabase solo da identidad.
 * En el primer login enlaza por email (usuarios creados por admin/seed).
 */
@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: any,
  ) {
    const supabaseUrl = (config.get<string>('SUPABASE_URL') || '').replace(/\/$/, '');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['ES256'],
      audience: 'authenticated',
      issuer: `${supabaseUrl}/auth/v1`,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri:
          config.get<string>('SUPABASE_JWKS_URL') ||
          `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      }),
    });
  }

  // Cache corto de la resolución authId→User (solo camino feliz). TTL bajo a
  // propósito: desactivar un usuario o cambiarle el rol tarda hasta este tiempo
  // en propagarse. Es un trade-off aceptado (staleness acotada) a cambio de
  // sacar 1 query a la DB de TODO request autenticado.
  private static readonly AUTH_USER_TTL_SECONDS = 30;

  // "Single-flight": cuando el usuario recién cambia de cuenta, el layout del
  // frontend dispara 3-4 requests casi simultáneas (auth/me, attempts x2,
  // notificaciones...) — TODAS llegan antes de que la primera termine de
  // escribir el cache Redis, así que sin esto cada una repetiría su propia
  // consulta a Postgres para el MISMO authId ("cache stampede"). Este Map
  // hace que las requests concurrentes para el mismo authId compartan una
  // sola promesa en vuelo en vez de multiplicar la consulta a la DB.
  private static readonly inFlight = new Map<string, Promise<any>>();

  private redisUsable(): boolean {
    return !!this.redis && (this.redis.isOpen === true || this.redis.isReady === true);
  }

  async validate(payload: any) {
    const authId: string | undefined = payload?.sub;
    const email: string | undefined = payload?.email;
    if (!authId) throw new UnauthorizedException('Token sin sujeto');

    const cacheKey = authUserCacheKey(authId);

    // 0 — Cache hit (fail-open). Solo cacheamos usuarios ACTIVOS resueltos por
    //     authId, así que un hit siempre es un usuario activo válido. Ante miss,
    //     error o Redis caído → seguimos al camino normal contra la DB.
    try {
      if (this.redisUsable()) {
        const raw = await this.redis.get(cacheKey);
        if (raw) return JSON.parse(raw);
      }
    } catch {
      // Redis no disponible → resolvemos contra la DB (comportamiento actual).
    }

    // Cache miss — si ya hay una resolución en vuelo para este mismo authId
    // (otra request concurrente llegó primero), esperamos esa en vez de
    // lanzar otra consulta idéntica a la DB.
    const existing = SupabaseJwtStrategy.inFlight.get(authId);
    if (existing) return existing;

    const resolution = this.resolveFromDb(authId, email, payload, cacheKey)
      .finally(() => SupabaseJwtStrategy.inFlight.delete(authId));
    SupabaseJwtStrategy.inFlight.set(authId, resolution);
    return resolution;
  }

  private async resolveFromDb(authId: string, email: string | undefined, payload: any, cacheKey: string) {
    // 1 — Usuario ya enlazado por authId
    let user = await this.prisma.user.findUnique({ where: { authId } });
    // Solo el camino feliz (encontrado por authId) es cacheable; el primer-login
    // por email NO se cachea (la próxima request ya vendrá por authId).
    const foundByAuthId = !!user;

    // 2 — Primer login: enlazar por email de forma SEGURA.
    //   · Solo si el email viene verificado en el token (evita enlazar con un
    //     correo no confirmado).
    //   · NUNCA auto-enlaza cuentas privilegiadas (SUPERADMIN/ADMIN): esas deben
    //     vincularse explícitamente al crearse (el flujo de creación ya setea
    //     `authId`), para cerrar el vector de secuestro por colisión de email.
    //   ⚠️ Requisito de despliegue: el sign-up público de Supabase debe estar
    //     DESHABILITADO (solo se crean usuarios vía admin/seed).
    if (!user && email && payload?.email_verified === true) {
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      const privileged =
        byEmail?.role === 'SUPERADMIN' || byEmail?.role === 'ADMIN';
      if (byEmail && !byEmail.authId && !privileged) {
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { authId },
        });
      }
    }

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no habilitado en la plataforma');
    }

    // Mismo shape que consumían los guards (RolesGuard, CompanyOwnerGuard, etc.)
    const result = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      universityId: user.universityId,
      mustChangePassword: user.mustChangePassword,
    };

    // Cache SOLO el camino feliz (usuario activo encontrado por authId). Nunca
    // cacheamos negativos ni el path de primer-login por email. Fail-open.
    if (foundByAuthId) {
      try {
        if (this.redisUsable()) {
          await this.redis.setEx(
            cacheKey,
            SupabaseJwtStrategy.AUTH_USER_TTL_SECONDS,
            JSON.stringify(result),
          );
        }
      } catch {
        // best-effort; sin cache seguimos igual.
      }
    }

    return result;
  }
}
