import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload } from '../interfaces/auth.interfaces';
import { REDIS_CLIENT } from '../../../redis/redis.module';

const SESSION_TTL = 60 * 14; // 14 min — igual al JWT expiry

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: any,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const cacheKey = `session:${payload.jti}`;

    // 1 — Intentar leer desde Redis
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Redis no disponible — continuar con DB
    }

    // 2 — Verificar sesión en DB
    const session = await this.prisma.session.findUnique({
      where: { token: payload.jti },
      select: { isActive: true, expiresAt: true },
    });

    if (!session || !session.isActive) {
      throw new UnauthorizedException('Sesión inválida o revocada');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Sesión expirada');
    }

    // 3 — Actualizar lastUsedAt (non-blocking)
    this.prisma.session
      .update({
        where: { token: payload.jti },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});

    const user = {
      id:           payload.sub,
      email:        payload.email,
      role:         payload.role,
      universityId: payload.universityId,
      sessionId:    payload.jti,
    };

    // 4 — Guardar en Redis para próximas requests
    try {
      await this.redis.setEx(cacheKey, SESSION_TTL, JSON.stringify(user));
    } catch {
      // Redis no disponible — no es crítico
    }

    return user;
  }
}
