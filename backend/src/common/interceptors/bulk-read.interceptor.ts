import {
  CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';

/**
 * BulkReadInterceptor
 *
 * Detecta exfiltración de datos en endpoints de listado (GET).
 *
 * Estrategia:
 *   · Por usuario, contamos la cantidad TOTAL de records devueltos por el
 *     backend en la última hora (ventana deslizante en Redis).
 *   · Si supera el umbral, escribimos en `activity_logs` con action
 *     'BULK_READ_DETECTED' para que el SUPERADMIN lo vea en /superadmin/actividad.
 *   · No bloqueamos el request — esto es alerta, no enforcement
 *     (un teacher revisando todo su curso es legítimo).
 *
 * Umbral: 5000 records/h por usuario. Ajustable.
 */
const THRESHOLD       = 5000;
const WINDOW_SECONDS  = 60 * 60;

@Injectable()
export class BulkReadInterceptor implements NestInterceptor {
  private readonly logger = new Logger(BulkReadInterceptor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: any,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req     = context.switchToHttp().getRequest();
    const method  = req.method;
    const userId  = req.user?.id;

    // Solo medimos GET de usuarios autenticados.
    if (method !== 'GET' || !userId) return next.handle();

    return next.handle().pipe(
      tap(async (data: any) => {
        const count = this._countRecords(data);
        if (count <= 0) return;

        try {
          const key = `bulkread:${userId}`;
          const total: number = await this.redis.incrBy(key, count);
          if (total === count) {
            await this.redis.expire(key, WINDOW_SECONDS);
          }
          if (total >= THRESHOLD && total - count < THRESHOLD) {
            // Cruzó el umbral en este request — alerta una sola vez por ventana.
            this.logger.warn(
              `[bulk-read] Usuario ${userId} leyó ${total} records en la última hora.`,
            );
            await this.prisma.activityLog.create({
              data: {
                userId,
                action:    'BULK_READ_DETECTED',
                entity:    'Request',
                entityId:  null,
                ipAddress: req.ip ?? null,
                details:   {
                  recordsInWindow: total,
                  threshold:       THRESHOLD,
                  windowSeconds:   WINDOW_SECONDS,
                  triggerEndpoint: req.url,
                } as any,
              },
            }).catch(() => { /* best-effort */ });
          }
        } catch {
          // Redis caído: no bloqueamos la respuesta del usuario.
        }
      }),
    );
  }

  /**
   * Heurística para contar "records" en respuestas variadas:
   *   - Array directo → length
   *   - Objeto paginado { invoices: [...], total } → length del array más grande
   *   - Otra cosa → 1 (no escala)
   */
  private _countRecords(data: any): number {
    if (Array.isArray(data)) return data.length;
    if (data && typeof data === 'object') {
      let max = 0;
      for (const v of Object.values(data)) {
        if (Array.isArray(v) && v.length > max) max = v.length;
      }
      return max || 1;
    }
    return 0;
  }
}
