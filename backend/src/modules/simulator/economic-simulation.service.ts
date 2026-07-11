import { Injectable } from '@nestjs/common';
import { MacroService } from '../macro/macro.service';
import { SIMULATOR_SECTORS, SimulatorSector } from './dto/simulator.dto';

export interface SectorOutlook {
  /** Índice de demanda relativo (≈0.7–1.3). 1.0 = neutro. */
  demandIndex: number;
  /** Nota corta explicando el índice. */
  note: string;
}

export interface MarketConditions {
  /** Tipo de cambio de venta USD→CRC (real, de MacroService). */
  exchangeRate: number;
  /** Inflación interanual (%) real de CR. */
  inflation: number;
  /** Tasa de interés de referencia (%) — usamos la TBP real. */
  interestRate: number;
  /** Fuente de los indicadores macro: 'live' | 'cache' | 'fallback'. */
  macroSource: 'live' | 'cache' | 'fallback';
  /** Momento de cálculo (ISO). */
  computedAt: string;
  /** Perspectiva por sector, derivada determinísticamente de la macro. */
  sectorOutlook: Record<SimulatorSector, SectorOutlook>;
}

/**
 * Condiciones de mercado SIMULADAS pero ancladas en datos macro REALES de CR.
 *
 * Todo es DETERMINÍSTICO: dados los mismos indicadores macro, siempre produce
 * el mismo resultado. No hay aleatoriedad. No usa precios de bolsa reales — la
 * macro real (inflación, tasa, tipo de cambio) es solo CONTEXTO para derivar un
 * `demandIndex` por sector.
 *
 * ── Modelo del demandIndex por sector ─────────────────────────────────────────
 * Partimos de un índice base 1.0 y lo ajustamos por dos presiones reales:
 *
 *   1) Presión inflacionaria (inflación por encima del ancla del BCCR ≈3%):
 *        inflationGap = inflacion − 3
 *      Sectores DISCRECIONALES (tecnología, construcción, transporte) pierden
 *      demanda cuando sube la inflación; los ESENCIALES (alimentos) casi no se
 *      mueven; el resto queda intermedio. Se pondera con una sensibilidad por
 *      sector `infSens`:
 *        adjInflation = −infSens × inflationGap × 0.03
 *
 *   2) Presión de tasa de interés (crédito más caro frena inversión/consumo a
 *      plazo). Referencia: TBP ancla ≈4%:
 *        rateGap = interestRate − 4
 *      Se pondera con `rateSens` por sector:
 *        adjRate = −rateSens × rateGap × 0.02
 *
 *   demandIndex = clamp(1.0 + adjInflation + adjRate, 0.7, 1.3)
 *
 * Las sensibilidades (0 = inmune, 1 = muy sensible) reflejan cuán discrecional /
 * intensivo-en-crédito es cada sector en CR.
 */
@Injectable()
export class EconomicSimulationService {
  // Anclas de referencia (documentadas). No son datos vivos: son los objetivos
  // de política / promedios históricos contra los que medimos la desviación.
  private readonly INFLATION_ANCHOR = 3; // % — centro del rango meta del BCCR
  private readonly RATE_ANCHOR = 4; // % — TBP de referencia
  private readonly FALLBACK_EXCHANGE = 515; // ₡ venta USD, si la macro no trae dólar

  /** Sensibilidad de cada sector a la inflación (0–1) y a la tasa (0–1). */
  private readonly SECTOR_SENSITIVITY: Record<
    SimulatorSector,
    { infSens: number; rateSens: number; label: string }
  > = {
    // Consumo básico: casi inmune a inflación, poco a tasa.
    alimentos: { infSens: 0.2, rateSens: 0.2, label: 'consumo esencial' },
    // Comercio general: sensibilidad media a ambas.
    comercio: { infSens: 0.6, rateSens: 0.5, label: 'consumo general' },
    // Servicios: sensibilidad media, algo menos a tasa.
    servicios: { infSens: 0.5, rateSens: 0.4, label: 'servicios' },
    // Manufactura: costos importados (tasa media) y demanda media.
    manufactura: { infSens: 0.6, rateSens: 0.6, label: 'producción' },
    // Tecnología: gasto discrecional, muy sensible a inflación.
    tecnologia: { infSens: 0.9, rateSens: 0.5, label: 'gasto discrecional' },
    // Construcción: intensiva en crédito → muy sensible a la tasa.
    construccion: { infSens: 0.7, rateSens: 0.9, label: 'intensivo en crédito' },
    // Transporte: combustibles + financiamiento de flota.
    transporte: { infSens: 0.7, rateSens: 0.6, label: 'logística y combustible' },
  };

  constructor(private readonly macro: MacroService) {}

  /**
   * Condiciones de mercado actuales. Toma los indicadores REALES de MacroService
   * y deriva el outlook por sector de forma determinística.
   */
  async getMarketConditions(): Promise<MarketConditions> {
    const ind = await this.macro.getIndicators();

    const exchangeRate = Number(ind.dolar?.venta) || this.FALLBACK_EXCHANGE;
    const inflation =
      ind.inflacion?.valor != null ? Number(ind.inflacion.valor) : this.INFLATION_ANCHOR;
    const interestRate = ind.tbp?.valor != null ? Number(ind.tbp.valor) : this.RATE_ANCHOR;

    const inflationGap = inflation - this.INFLATION_ANCHOR;
    const rateGap = interestRate - this.RATE_ANCHOR;

    const sectorOutlook = {} as Record<SimulatorSector, SectorOutlook>;
    for (const sector of SIMULATOR_SECTORS) {
      const { infSens, rateSens, label } = this.SECTOR_SENSITIVITY[sector];
      const adjInflation = -infSens * inflationGap * 0.03;
      const adjRate = -rateSens * rateGap * 0.02;
      const demandIndex = this.round(this.clamp(1.0 + adjInflation + adjRate, 0.7, 1.3), 3);
      sectorOutlook[sector] = {
        demandIndex,
        note: this.buildNote(demandIndex, label, inflationGap, rateGap),
      };
    }

    return {
      exchangeRate: this.round(exchangeRate, 2),
      inflation: this.round(inflation, 2),
      interestRate: this.round(interestRate, 2),
      macroSource: ind.source,
      computedAt: new Date().toISOString(),
      sectorOutlook,
    };
  }

  private buildNote(
    demandIndex: number,
    label: string,
    inflationGap: number,
    rateGap: number,
  ): string {
    const tone =
      demandIndex >= 1.08
        ? 'demanda favorable'
        : demandIndex <= 0.92
          ? 'demanda contraída'
          : 'demanda estable';
    const drivers: string[] = [];
    if (inflationGap > 0.5) drivers.push('inflación por encima de la meta');
    else if (inflationGap < -0.5) drivers.push('inflación baja');
    if (rateGap > 0.5) drivers.push('tasas de interés altas');
    else if (rateGap < -0.5) drivers.push('tasas de interés bajas');
    const driverTxt = drivers.length ? ` por ${drivers.join(' y ')}` : '';
    return `Sector ${label}: ${tone}${driverTxt}.`;
  }

  private clamp(v: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, v));
  }

  private round(v: number, decimals: number): number {
    const f = Math.pow(10, decimals);
    return Math.round(v * f) / f;
  }
}
