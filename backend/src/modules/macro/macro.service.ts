import { Injectable, Logger } from '@nestjs/common';

interface RatePoint { compra: number; venta: number; fecha: string | null; }
interface MacroIndicators {
  dolar:      RatePoint;
  euro:       RatePoint;
  tbp:        { valor: number | null; fecha: string | null };   // tasa básica pasiva (%)
  inflacion:  { valor: number | null; fecha: string | null };   // interanual (%)
  source:     'live' | 'cache' | 'fallback';
  updatedAt:  string;
}

/**
 * Indicadores económicos de Costa Rica.
 *  · Tipo de cambio (dólar/euro): API pública de Hacienda — sin token.
 *  · TBP e inflación: BCCR (requiere token). Si no hay token configurado,
 *    se devuelven valores de referencia recientes marcados como 'fallback'.
 * Cache en memoria (6 h) para no golpear las fuentes ni romper si están caídas.
 */
@Injectable()
export class MacroService {
  private readonly logger = new Logger('MacroService');
  private cache: MacroIndicators | null = null;
  private cachedAt = 0;
  private readonly TTL = 6 * 60 * 60 * 1000; // 6 h

  // Valores de referencia (actualizables) por si las fuentes externas fallan.
  private readonly FALLBACK = {
    dolar:     { compra: 505, venta: 515 },
    euro:      { compra: 560, venta: 575 },
    tbp:       4.0,    // %
    inflacion: 0.8,    // % interanual
  };

  async getIndicators(): Promise<MacroIndicators> {
    const now = Date.now();
    if (this.cache && now - this.cachedAt < this.TTL) {
      return { ...this.cache, source: 'cache' };
    }

    const [dolar, euro] = await Promise.all([
      this.fetchHaciendaTC('dolar'),
      this.fetchHaciendaTC('euro'),
    ]);

    const live = !!(dolar || euro);
    const result: MacroIndicators = {
      dolar: dolar ?? { ...this.FALLBACK.dolar, fecha: null },
      euro:  euro  ?? { ...this.FALLBACK.euro,  fecha: null },
      tbp:        { valor: this.FALLBACK.tbp,       fecha: null },
      inflacion:  { valor: this.FALLBACK.inflacion, fecha: null },
      source:     live ? 'live' : 'fallback',
      updatedAt:  new Date().toISOString(),
    };

    if (live) { this.cache = result; this.cachedAt = now; }
    return result;
  }

  /** API pública de Hacienda: https://api.hacienda.go.cr/indicadores/tc/{dolar|euro} */
  private async fetchHaciendaTC(tipo: 'dolar' | 'euro'): Promise<RatePoint | null> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(`https://api.hacienda.go.cr/indicadores/tc/${tipo}`, {
        signal: ctrl.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(t);
      if (!res.ok) return null;
      const json: any = await res.json();
      const node = json?.[tipo] ?? json;
      const compra = Number(node?.compra?.valor);
      const venta  = Number(node?.venta?.valor);
      if (!compra || !venta) return null;
      return { compra, venta, fecha: node?.venta?.fecha ?? node?.compra?.fecha ?? null };
    } catch (e) {
      this.logger.warn(`No se pudo obtener TC ${tipo}: ${(e as Error).message}`);
      return null;
    }
  }
}
