import { Injectable, Logger, Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '../../redis/redis.module';

/**
 * El catalogo CABYS no respondio.
 *
 * Existe para separar dos cosas que antes se veian iguales: "Hacienda no
 * contesta" y "no hay resultados". Devolver [] en ambos casos hacia que la
 * pantalla dijera "Sin resultados para arroz" cuando el servicio estaba
 * caido, y el estudiante se quedaba sin la casilla para escribir el codigo
 * a mano, que es justo lo que necesita en ese momento.
 */
export class CabysNoDisponibleError extends Error {
  constructor(causa: string) {
    super(`El catálogo CABYS de Hacienda no está disponible: ${causa}`);
    this.name = 'CabysNoDisponibleError';
  }
}

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface CabysItem {
  codigo: string;
  descripcion: string;
  impuesto: number; // IVA rate as percentage (0, 1, 2, 4, 8, 13)
}

export interface ExchangeRate {
  venta: number;
  compra: number;
  fecha: string;
}

// ── In-memory fallback cache ──────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class HaciendaService {
  private readonly logger = new Logger(HaciendaService.name);
  private readonly HACIENDA_API = 'https://api.hacienda.go.cr';

  // In-memory fallback when Redis is unavailable
  private readonly memCache = new Map<string, CacheEntry<any>>();

  // Last known exchange rate for graceful degradation
  private lastKnownRate: ExchangeRate | null = null;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: any,
  ) {}

  // ── Lectura de la respuesta de Hacienda ─────────────────────────────────

  /**
   * Saca la lista de items venga como venga.
   *
   * api.hacienda.go.cr NO responde igual en los dos casos:
   *   /fe/cabys?q=arroz     -> { total, cantidad, cabys: [...] }
   *   /fe/cabys?codigo=231  -> [ ... ]            (arreglo pelado)
   *
   * El codigo viejo leia siempre `data.cabys`, asi que la consulta por
   * codigo devolvia undefined -> null SIEMPRE, incluso con codigos que
   * existen. Se acepta cualquiera de las dos formas.
   */
  private listaDeItems(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.cabys)) return data.cabys;
    return [];
  }

  private aItem(raw: any): CabysItem {
    return {
      codigo:      String(raw?.codigo ?? ''),
      descripcion: String(raw?.descripcion ?? ''),
      impuesto:    Number(raw?.impuesto ?? 0),
    };
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Search CABYS catalog by keyword.
   * Results cached for 24 hours (they rarely change).
   */
  async searchCabys(query: string, top = 10): Promise<CabysItem[]> {
    if (!query || query.trim().length < 2) return [];

    const cacheKey = `cabys:search:${query.toLowerCase().trim()}:${top}`;
    const cached = await this.getCache<CabysItem[]>(cacheKey);
    if (cached) return cached;

    const url = `${this.HACIENDA_API}/fe/cabys?q=${encodeURIComponent(query.trim())}&top=${top}`;

    try {
      const data = await this.fetchWithRetry<any>(url);
      const items = this.listaDeItems(data).map((item) => this.aItem(item));

      await this.setCache(cacheKey, items, 24 * 60 * 60); // 24 h
      return items;
    } catch (err: any) {
      this.logger.warn(`CABYS search failed for "${query}": ${err.message}`);
      // Se avisa de la caida en vez de devolver [] como si no hubiera nada:
      // la pantalla necesita saber la diferencia para ofrecer el ingreso
      // manual del codigo.
      throw new CabysNoDisponibleError(err.message ?? 'sin detalle');
    }
  }

  /**
   * Get a single CABYS item by exact 13-digit code.
   * Cached for 24 hours.
   */
  async getCabysByCode(codigo: string): Promise<CabysItem | null> {
    if (!codigo || !/^\d{13}$/.test(codigo)) return null;

    const cacheKey = `cabys:code:${codigo}`;
    const cached = await this.getCache<CabysItem>(cacheKey);
    if (cached) return cached;

    const url = `${this.HACIENDA_API}/fe/cabys?codigo=${codigo}`;

    try {
      const data = await this.fetchWithRetry<any>(url);
      // Hacienda busca por PREFIJO. Como aqui siempre entran 13 digitos -y los
      // codigos CABYS tienen 13- solo puede coincidir el exacto, pero se
      // confirma igual antes de darlo por bueno.
      const raw = this.listaDeItems(data).find((x) => String(x?.codigo ?? '') === codigo);
      if (!raw) return null;

      const item = this.aItem(raw);
      await this.setCache(cacheKey, item, 24 * 60 * 60); // 24 h
      return item;
    } catch (err: any) {
      this.logger.warn(`CABYS lookup failed for code "${codigo}": ${err.message}`);
      throw new CabysNoDisponibleError(err.message ?? 'sin detalle');
    }
  }

  /**
   * Get current USD/CRC exchange rate from BCCR via Hacienda API.
   * Cached for 1 hour; falls back to last known rate on error.
   */
  async getExchangeRate(): Promise<ExchangeRate> {
    const cacheKey = 'hacienda:exchange-rate:usd';
    const cached = await this.getCache<ExchangeRate>(cacheKey);
    if (cached) return cached;

    const url = `${this.HACIENDA_API}/indicadores/tc/dolar`;

    try {
      const data = await this.fetchWithRetry<any>(url);

      const rate: ExchangeRate = {
        venta:  Number(data?.venta?.valor ?? data?.venta ?? 0),
        compra: Number(data?.compra?.valor ?? data?.compra ?? 0),
        fecha:  String(data?.fecha ?? new Date().toISOString().split('T')[0]),
      };

      this.lastKnownRate = rate;
      await this.setCache(cacheKey, rate, 60 * 60); // 1 h
      return rate;
    } catch (err: any) {
      this.logger.warn(`Exchange rate fetch failed: ${err.message}`);
      if (this.lastKnownRate) {
        return this.lastKnownRate;
      }
      // Hard fallback: return approximate rate with today's date
      return {
        venta:  530.00,
        compra: 525.00,
        fecha:  new Date().toISOString().split('T')[0],
      };
    }
  }

  /**
   * Validate a cédula format based on type.
   *  01 — Cédula Física (9 digits)
   *  02 — Cédula Jurídica (10 digits)
   *  03 — DIMEX (11–12 digits)
   *  04 — NITE (10 digits)
   */
  validateCedula(cedula: string, tipo: '01' | '02' | '03' | '04'): boolean {
    const digits = cedula.replace(/\D/g, '');
    switch (tipo) {
      case '01': return /^\d{9}$/.test(digits);
      case '02': return /^\d{10}$/.test(digits);
      case '03': return /^\d{11,12}$/.test(digits);
      case '04': return /^\d{10}$/.test(digits);
      default:   return false;
    }
  }

  // ── HTTP helper with retry + timeout ─────────────────────────────────────────

  private async fetchWithRetry<T>(url: string, maxRetries = 2, timeoutMs = 5000): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json() as T;
      } catch (err: any) {
        lastError = err;
        if (attempt < maxRetries) {
          // Brief exponential backoff: 500ms, 1000ms
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
    }

    throw lastError ?? new Error('Request failed');
  }

  // ── Cache helpers (Redis with in-memory fallback) ─────────────────────────

  private async getCache<T>(key: string): Promise<T | null> {
    // Try Redis first
    try {
      if (this.redis?.isOpen || this.redis?.isReady) {
        const raw = await this.redis.get(key);
        if (raw) return JSON.parse(raw) as T;
      }
    } catch {
      // Redis unavailable — fall through to memory cache
    }

    // In-memory fallback
    const entry = this.memCache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data as T;
    }
    if (entry) this.memCache.delete(key); // Stale entry
    return null;
  }

  private async setCache<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
    // Try Redis first
    try {
      if (this.redis?.isOpen || this.redis?.isReady) {
        await this.redis.setEx(key, ttlSeconds, JSON.stringify(data));
        return;
      }
    } catch {
      // Redis unavailable — fall through to memory cache
    }

    // In-memory fallback
    this.memCache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    // Prevent unbounded growth: evict if over 500 entries
    if (this.memCache.size > 500) {
      const now = Date.now();
      for (const [k, v] of this.memCache.entries()) {
        if (v.expiresAt <= now) this.memCache.delete(k);
        if (this.memCache.size <= 400) break;
      }
    }
  }
}
