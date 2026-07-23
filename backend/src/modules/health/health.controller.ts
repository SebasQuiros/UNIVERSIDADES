import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../auth/decorators/auth.decorators';

/**
 * Health check PÚBLICO (sin guards de auth).
 *
 * Hace un `SELECT 1` a la base para servir de "keep-warm": un pinger externo
 * gratuito (UptimeRobot, cron-job.org) que golpee esta ruta cada pocos minutos
 * mantiene despierta a Neon (Postgres serverless que suspende al ocio) y al
 * servicio de Railway, evitando el cold-start de ~2-3s en la primera request
 * real de un usuario. También sirve como healthcheck de despliegue.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()        // exime del JwtAuthGuard global (auth.module APP_GUARD)
  @SkipThrottle()
  async check() {
    let db: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }
    return { status: db === 'up' ? 'ok' : 'degraded', db, ts: new Date().toISOString() };
  }
}
