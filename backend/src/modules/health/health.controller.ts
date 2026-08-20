import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../auth/decorators/auth.decorators';
import { REDIS_CLIENT } from '../../redis/redis.constants';

/**
 * Health check PÚBLICO (sin guards de auth).
 *
 * Hace un `SELECT 1` a la base para servir de "keep-warm": un pinger externo
 * gratuito (UptimeRobot, cron-job.org) que golpee esta ruta cada pocos minutos
 * mantiene despierta a Neon (Postgres serverless que suspende al ocio) y al
 * servicio de Railway, evitando el cold-start de ~2-3s en la primera request
 * real de un usuario. También sirve como healthcheck de despliegue.
 *
 * Reporta además el estado de REDIS y el tamaño del pool de conexiones.
 * Motivo concreto: los estados financieros se cachean en Redis, y si Redis no
 * está el sistema sigue funcionando —cae al camino sin caché— pero recalcula
 * cada balance contra la base. Es decir: sin Redis todo se ve bien y la
 * capacidad cae varias veces, sin un solo error en los logs. Tenerlo acá
 * convierte esa diferencia invisible en algo que se mira en cinco segundos.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: any,
  ) {}

  @Get()
  @Public()        // exime del JwtAuthGuard global (auth.module APP_GUARD)
  // Los throttlers configurados se llaman 'short' y 'medium'. `@SkipThrottle()`
  // sin argumentos marca uno llamado 'default', que no existe acá: el
  // decorador estaba puesto, se veia correcto, y no eximia de nada. Medido:
  // /health devolvia 429 bajo concurrencia. Hay que nombrarlos.
  @SkipThrottle({ short: true, medium: true })
  async check() {
    let db: 'up' | 'down' = 'down';
    let dbMs: number | null = null;
    try {
      const t0 = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbMs = Date.now() - t0;
      db = 'up';
    } catch {
      db = 'down';
    }

    // Se prueba con una escritura+lectura real, no con `client.isOpen`: un
    // cliente "abierto" contra un Redis que no responde diría que todo está
    // bien, que es justo el caso que hay que detectar.
    let cache: 'up' | 'down' | 'no-configurado' = 'down';
    let cacheMs: number | null = null;
    try {
      if (!process.env.REDIS_URL) {
        cache = 'no-configurado';
      } else {
        const t0 = Date.now();
        await this.redis.setEx('health:ping', 10, String(Date.now()));
        const v = await this.redis.get('health:ping');
        cacheMs = Date.now() - t0;
        cache = v ? 'up' : 'down';
      }
    } catch {
      cache = 'down';
    }

    return {
      // "degraded" solo si la base está caída: sin Redis el sistema responde
      // correcto, solo que más lento. Mentir con "ok" a secas escondería
      // exactamente lo que hay que ver.
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      dbMs,
      cache,
      cacheMs,
      // Sin esto no hay forma de saber con cuántas conexiones está corriendo:
      // Prisma toma (núcleos × 2 + 1) si nadie se lo dice, y con ese número
      // un grupo entero mirando reportes agota el pool.
      poolLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 30),
      ts: new Date().toISOString(),
    };
  }
}
