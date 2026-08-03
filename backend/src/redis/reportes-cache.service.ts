import { Injectable, Inject } from '@nestjs/common';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Versión contable de una empresa.
 *
 * Los estados financieros se cachean por empresa y la clave lleva esta
 * versión adentro (ver ReportsService.cacheado). Subirla es lo que hace que
 * el próximo balance se recalcule.
 *
 * Está acá, en el módulo global de Redis, y no dentro de ReportsService, por
 * una razón concreta: hay SEIS lugares que escriben en el diario (asientos
 * manuales, automáticos, reversiones, aprobación de asientos pendientes,
 * cierre de período, ajustes de inventario y el asiento de renta). Si cada
 * uno tuviera que importar el módulo de reportes, tarde o temprano uno nuevo
 * no lo haría, y el síntoma sería el peor posible: el estudiante asienta, el
 * balance no se mueve, y nadie sabe por qué.
 *
 * Si Redis no está, no pasa nada: no hay caché que invalidar.
 */
@Injectable()
export class ReportesCache {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: any) {}

  async marcarCambio(companyId: string): Promise<void> {
    if (!companyId) return;
    try { await this.redis?.incr?.(`reportes:ver:${companyId}`); } catch { /* el TTL cubre */ }
  }
}
