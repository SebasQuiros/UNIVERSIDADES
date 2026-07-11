import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EconomicSimulationService,
  MarketConditions,
} from './economic-simulation.service';
import { AnalyzeCompanyDto } from './dto/simulator.dto';

/* eslint-disable @typescript-eslint/no-var-requires */
// @ts-ignore — carga defensiva: si el SDK no está instalado, seguimos con fallback.
const AnthropicPkg = (() => {
  try {
    return require('@anthropic-ai/sdk');
  } catch {
    return null;
  }
})();

export interface Projection {
  demand: number;
  revenue: number;
  variableCost: number;
  grossMargin: number;
  grossMarginPct: number;
  contributionPerUnit: number;
  monthlyFixedCosts: number;
  monthlyProfit: number;
  breakEvenUnits: number | null;
  paybackMonths: number | null;
  annualROI: number | null;
}

export interface Scenario extends Projection {
  label: 'base' | 'optimista' | 'pesimista';
}

export interface Analysis {
  riesgos: string[];
  oportunidades: string[];
  recomendaciones: string[];
  source: 'ai' | 'deterministic';
}

export interface AnalyzeResult {
  inputs: AnalyzeCompanyDto;
  market: {
    sector: string;
    demandIndex: number;
    exchangeRate: number;
    inflation: number;
    interestRate: number;
    macroSource: string;
    note: string;
  };
  projection: Projection;
  successProbability: number;
  scenarios: {
    base: Scenario;
    optimista: Scenario;
    pesimista: Scenario;
  };
  analysis: Analysis;
}

/**
 * Simulador financiero DETERMINÍSTICO. Proyecta demanda/ingresos/costos/margen/
 * punto de equilibrio/ROI para una empresa ficticia y produce un score de
 * probabilidad de éxito con escenarios optimista/base/pesimista. El LLM solo
 * NARRA (riesgos/oportunidades/recomendaciones) sobre números ya calculados; si
 * no hay API key o falla, se usa un análisis templado igualmente determinístico.
 *
 * ── Factores de demanda ───────────────────────────────────────────────────────
 *  innovationFactor(level) = 0.90 + 0.05 × level      → 0.95 (1) … 1.15 (5)
 *  competitionFactor(level) = 1.15 − 0.05 × level      → 1.10 (1) … 0.90 (5)
 *
 *  demand = estimatedMarketSizeUnits × demandIndex(sector)
 *                                    × innovationFactor(innovationLevel)
 *                                    × competitionFactor(competitionLevel)
 *  (clamp ≥ 0, redondeado a entero)
 *
 * ── Fórmulas financieras ──────────────────────────────────────────────────────
 *  revenue             = demand × unitPrice
 *  variableCost        = demand × unitCost
 *  grossMargin         = revenue − variableCost
 *  grossMarginPct      = revenue > 0 ? grossMargin / revenue × 100 : 0
 *  contributionPerUnit = unitPrice − unitCost
 *  monthlyProfit       = grossMargin − monthlyFixedCosts
 *  breakEvenUnits      = contributionPerUnit > 0
 *                          ? monthlyFixedCosts / contributionPerUnit : null
 *  paybackMonths       = monthlyProfit > 0
 *                          ? initialInvestment / monthlyProfit : null ('no recupera')
 *  annualROI           = initialInvestment > 0
 *                          ? monthlyProfit × 12 / initialInvestment × 100 : null
 *
 * ── successProbability (0–100), score ponderado documentado ───────────────────
 *  Combina 5 señales, cada una normalizada a 0–1 y ponderada:
 *    · margin  (peso 25): grossMarginPct escalado — 0% → 0, ≥50% → 1
 *    · profit  (peso 25): monthlyProfit relativo a costos fijos — ≥1× fijos → 1
 *    · payback (peso 20): 1 si ≤12m, decae linealmente hasta 0 a 36m; null → 0
 *    · demand  (peso 15): demandIndex mapeado de [0.7,1.3] → [0,1]
 *    · edge    (peso 15): balance innovación-vs-competencia
 *                         (innovationLevel − competitionLevel + 4) / 8
 *  successProbability = clamp(round(Σ pesoᵢ × señalᵢ), 0, 100)
 *
 * ── Escenarios ────────────────────────────────────────────────────────────────
 *  base      : tal cual se calculó.
 *  optimista : demanda ×1.15, precio ×1.05.
 *  pesimista : demanda ×0.80, unitCost ×(1 + max(inflación,0)/100 + 0.10).
 */
@Injectable()
export class FinancialSimulatorService {
  private readonly logger = new Logger('FinancialSimulatorService');

  // Pesos del score de probabilidad de éxito (suman 100).
  private readonly W_MARGIN = 25;
  private readonly W_PROFIT = 25;
  private readonly W_PAYBACK = 20;
  private readonly W_DEMAND = 15;
  private readonly W_EDGE = 15;

  constructor(
    private readonly config: ConfigService,
    private readonly economic: EconomicSimulationService,
  ) {}

  // ── Factores de demanda (documentados en el encabezado) ─────────────────────
  private innovationFactor(level: number): number {
    return 0.9 + 0.05 * level;
  }
  private competitionFactor(level: number): number {
    return 1.15 - 0.05 * level;
  }

  /**
   * Núcleo determinístico: proyección + escenarios + probabilidad de éxito.
   */
  async analyze(dto: AnalyzeCompanyDto): Promise<Omit<AnalyzeResult, 'analysis'>> {
    const market = await this.economic.getMarketConditions();
    const outlook = market.sectorOutlook[dto.sector];
    const demandIndex = outlook?.demandIndex ?? 1.0;

    // Demanda mensual estimada (determinística).
    const demand = Math.max(
      0,
      Math.round(
        dto.estimatedMarketSizeUnits *
          demandIndex *
          this.innovationFactor(dto.innovationLevel) *
          this.competitionFactor(dto.competitionLevel),
      ),
    );

    const base = this.project(
      demand,
      dto.unitPrice,
      dto.unitCost,
      dto.monthlyFixedCosts,
      dto.initialInvestment,
      'base',
    );

    // Escenario optimista: +15% demanda, +5% precio.
    const optimista = this.project(
      Math.round(demand * 1.15),
      this.round(dto.unitPrice * 1.05, 2),
      dto.unitCost,
      dto.monthlyFixedCosts,
      dto.initialInvestment,
      'optimista',
    );

    // Escenario pesimista: −20% demanda, +costo unitario por inflación real +10%.
    const inflationShock = Math.max(market.inflation, 0) / 100 + 0.1;
    const pesimista = this.project(
      Math.round(demand * 0.8),
      dto.unitPrice,
      this.round(dto.unitCost * (1 + inflationShock), 2),
      dto.monthlyFixedCosts,
      dto.initialInvestment,
      'pesimista',
    );

    const successProbability = this.successProbability(dto, base, demandIndex);

    return {
      inputs: dto,
      market: {
        sector: dto.sector,
        demandIndex,
        exchangeRate: market.exchangeRate,
        inflation: market.inflation,
        interestRate: market.interestRate,
        macroSource: market.macroSource,
        note: outlook?.note ?? '',
      },
      projection: base,
      successProbability,
      scenarios: { base, optimista, pesimista },
    };
  }

  /** analyze + narrativa (IA o fallback determinístico). */
  async analyzeWithNarrative(dto: AnalyzeCompanyDto): Promise<AnalyzeResult> {
    const result = await this.analyze(dto);
    const market = await this.economic.getMarketConditions();
    const analysis = await this.narrate(dto, result, market);
    return { ...result, analysis };
  }

  // ── Proyección de una configuración (base/optimista/pesimista) ──────────────
  private project(
    demand: number,
    unitPrice: number,
    unitCost: number,
    monthlyFixedCosts: number,
    initialInvestment: number,
    label: Scenario['label'],
  ): Scenario {
    const safeDemand = Math.max(0, demand);
    const revenue = safeDemand * unitPrice;
    const variableCost = safeDemand * unitCost;
    const grossMargin = revenue - variableCost;
    const grossMarginPct = revenue > 0 ? (grossMargin / revenue) * 100 : 0;
    const contributionPerUnit = unitPrice - unitCost;
    const monthlyProfit = grossMargin - monthlyFixedCosts;

    const breakEvenUnits =
      contributionPerUnit > 0
        ? Math.ceil(monthlyFixedCosts / contributionPerUnit)
        : null;
    const paybackMonths =
      monthlyProfit > 0 ? this.round(initialInvestment / monthlyProfit, 1) : null;
    const annualROI =
      initialInvestment > 0
        ? this.round(((monthlyProfit * 12) / initialInvestment) * 100, 1)
        : null;

    return {
      label,
      demand: safeDemand,
      revenue: this.round(revenue, 2),
      variableCost: this.round(variableCost, 2),
      grossMargin: this.round(grossMargin, 2),
      grossMarginPct: this.round(grossMarginPct, 1),
      contributionPerUnit: this.round(contributionPerUnit, 2),
      monthlyFixedCosts: this.round(monthlyFixedCosts, 2),
      monthlyProfit: this.round(monthlyProfit, 2),
      breakEvenUnits,
      paybackMonths,
      annualROI,
    };
  }

  // ── Score de probabilidad de éxito (0–100) ──────────────────────────────────
  private successProbability(
    dto: AnalyzeCompanyDto,
    base: Projection,
    demandIndex: number,
  ): number {
    // margin: 0% → 0, ≥50% → 1
    const marginSignal = this.clamp(base.grossMarginPct / 50, 0, 1);

    // profit: relativo a los costos fijos; ≥1× fijos → 1, ≤0 → 0
    const profitSignal =
      dto.monthlyFixedCosts > 0
        ? this.clamp(base.monthlyProfit / dto.monthlyFixedCosts, 0, 1)
        : base.monthlyProfit > 0
          ? 1
          : 0;

    // payback: ≤12m → 1, ≥36m → 0, lineal en medio; sin recuperación → 0
    const paybackSignal =
      base.paybackMonths == null
        ? 0
        : this.clamp((36 - base.paybackMonths) / (36 - 12), 0, 1);

    // demand: [0.7,1.3] → [0,1]
    const demandSignal = this.clamp((demandIndex - 0.7) / (1.3 - 0.7), 0, 1);

    // edge: innovación vs competencia, (inn − comp + 4) / 8 → [0,1]
    const edgeSignal = this.clamp(
      (dto.innovationLevel - dto.competitionLevel + 4) / 8,
      0,
      1,
    );

    const score =
      this.W_MARGIN * marginSignal +
      this.W_PROFIT * profitSignal +
      this.W_PAYBACK * paybackSignal +
      this.W_DEMAND * demandSignal +
      this.W_EDGE * edgeSignal;

    return Math.round(this.clamp(score, 0, 100));
  }

  // ── Narrativa: IA con fallback determinístico ───────────────────────────────
  private async narrate(
    dto: AnalyzeCompanyDto,
    result: Omit<AnalyzeResult, 'analysis'>,
    market: MarketConditions,
  ): Promise<Analysis> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');

    if (apiKey && AnthropicPkg) {
      try {
        const ai = await this.narrateWithAi(apiKey, dto, result, market);
        if (ai) return ai;
      } catch (e) {
        this.logger.warn(`Narrativa IA falló, usando fallback: ${(e as Error).message}`);
      }
    }
    return this.deterministicNarrative(dto, result, market);
  }

  private async narrateWithAi(
    apiKey: string,
    dto: AnalyzeCompanyDto,
    result: Omit<AnalyzeResult, 'analysis'>,
    market: MarketConditions,
  ): Promise<Analysis | null> {
    const AnthropicClass = AnthropicPkg.default ?? AnthropicPkg;
    const client = new AnthropicClass({ apiKey });

    const p = result.projection;
    const prompt = [
      'Eres un analista financiero costarricense. Analiza esta idea de empresa ficticia',
      'de un estudiante, usando SOLO los números provistos (ya calculados). No inventes',
      'cifras nuevas. Contexto macro real de Costa Rica:',
      `- Tipo de cambio USD→CRC: ${market.exchangeRate}`,
      `- Inflación interanual: ${market.inflation}%`,
      `- Tasa de interés (TBP): ${market.interestRate}%`,
      `- Fuente macro: ${market.macroSource}`,
      '',
      `Perfil de la empresa (sector ${dto.sector}):`,
      `- Precio unitario ₡${dto.unitPrice} | Costo unitario ₡${dto.unitCost}`,
      `- Costos fijos mensuales ₡${dto.monthlyFixedCosts}`,
      `- Inversión inicial ₡${dto.initialInvestment}`,
      `- Innovación ${dto.innovationLevel}/5 | Competencia ${dto.competitionLevel}/5`,
      `- Índice de demanda del sector: ${result.market.demandIndex}`,
      '',
      'Proyección mensual calculada:',
      `- Demanda ${p.demand} u | Ingresos ₡${p.revenue}`,
      `- Margen bruto ₡${p.grossMargin} (${p.grossMarginPct}%)`,
      `- Utilidad mensual ₡${p.monthlyProfit}`,
      `- Punto de equilibrio: ${p.breakEvenUnits ?? 'no alcanzable'} u`,
      `- Payback: ${p.paybackMonths == null ? 'no recupera' : p.paybackMonths + ' meses'}`,
      `- ROI anual: ${p.annualROI == null ? 'n/d' : p.annualROI + '%'}`,
      `- Probabilidad de éxito estimada: ${result.successProbability}/100`,
      '',
      'Responde ÚNICAMENTE con un JSON válido, sin texto adicional, con esta forma exacta:',
      '{"riesgos":["...","..."],"oportunidades":["...","..."],"recomendaciones":["...","..."]}',
      'Cada arreglo con 2-4 puntos cortos en español (máx ~20 palabras cada uno).',
    ].join('\n');

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (!content || content.type !== 'text') return null;

    const parsed = this.parseAiJson(content.text);
    if (!parsed) return null;

    return {
      riesgos: parsed.riesgos,
      oportunidades: parsed.oportunidades,
      recomendaciones: parsed.recomendaciones,
      source: 'ai',
    };
  }

  /** Extrae y valida el JSON de la respuesta del modelo. Null si no es usable. */
  private parseAiJson(
    text: string,
  ): { riesgos: string[]; oportunidades: string[]; recomendaciones: string[] } | null {
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start < 0 || end <= start) return null;
      const obj = JSON.parse(text.slice(start, end + 1));
      const clean = (arr: unknown): string[] =>
        Array.isArray(arr)
          ? arr.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, 4)
          : [];
      const riesgos = clean(obj.riesgos);
      const oportunidades = clean(obj.oportunidades);
      const recomendaciones = clean(obj.recomendaciones);
      if (!riesgos.length && !oportunidades.length && !recomendaciones.length) return null;
      return { riesgos, oportunidades, recomendaciones };
    } catch {
      return null;
    }
  }

  /**
   * Análisis templado 100% determinístico derivado de los números. Nunca falla.
   */
  private deterministicNarrative(
    dto: AnalyzeCompanyDto,
    result: Omit<AnalyzeResult, 'analysis'>,
    market: MarketConditions,
  ): Analysis {
    const p = result.projection;
    const riesgos: string[] = [];
    const oportunidades: string[] = [];
    const recomendaciones: string[] = [];

    // Riesgos
    if (p.grossMarginPct < 20) {
      riesgos.push(
        `Margen bruto ajustado (${p.grossMarginPct}%): poco colchón ante subidas de costos.`,
      );
      recomendaciones.push('Subir precio o negociar mejor el costo unitario para ampliar el margen.');
    }
    if (p.monthlyProfit <= 0) {
      riesgos.push('La operación proyecta pérdida mensual con la demanda estimada.');
      recomendaciones.push('Reducir costos fijos o aumentar demanda antes de invertir.');
    }
    if (p.paybackMonths == null) {
      riesgos.push('Con estos números la inversión inicial no se recupera (payback nulo).');
    } else if (p.paybackMonths > 24) {
      riesgos.push(`Recuperación lenta: ~${p.paybackMonths} meses de payback.`);
    }
    if (dto.competitionLevel >= 4) {
      riesgos.push('Mercado muy competido: presión a la baja sobre precios y demanda.');
    }
    if (market.inflation > market.interestRate) {
      riesgos.push(
        `Inflación (${market.inflation}%) presiona costos; vigila el poder adquisitivo del cliente.`,
      );
    }

    // Oportunidades
    if (p.grossMarginPct >= 40) {
      oportunidades.push(`Margen bruto sólido (${p.grossMarginPct}%): buen apalancamiento operativo.`);
    }
    if (result.market.demandIndex >= 1.05) {
      oportunidades.push(
        `El sector ${dto.sector} muestra demanda favorable (índice ${result.market.demandIndex}).`,
      );
    }
    if (dto.innovationLevel >= 4) {
      oportunidades.push('Alta innovación: espacio para diferenciarte y defender precio.');
    }
    if (p.paybackMonths != null && p.paybackMonths <= 12) {
      oportunidades.push(`Recuperación rápida de la inversión (~${p.paybackMonths} meses).`);
    }
    if (p.annualROI != null && p.annualROI >= 30) {
      oportunidades.push(`ROI anual atractivo (${p.annualROI}%) frente a la TBP de ${market.interestRate}%.`);
    }

    // Recomendaciones base
    if (p.breakEvenUnits != null) {
      recomendaciones.push(
        `Apunta a superar el punto de equilibrio de ${p.breakEvenUnits} u/mes lo antes posible.`,
      );
    }
    recomendaciones.push(
      `Contrasta el escenario pesimista (utilidad ₡${result.scenarios.pesimista.monthlyProfit}) antes de comprometer capital.`,
    );

    // Garantiza al menos un punto en cada lista.
    if (!riesgos.length) riesgos.push('Sin riesgos financieros críticos con los supuestos actuales.');
    if (!oportunidades.length)
      oportunidades.push('Oportunidad moderada: revisa palancas de precio y demanda para mejorar.');
    if (!recomendaciones.length)
      recomendaciones.push('Valida los supuestos de demanda con datos reales del mercado.');

    return {
      riesgos,
      oportunidades,
      recomendaciones,
      source: 'deterministic',
    };
  }

  // ── Utilidades ───────────────────────────────────────────────────────────────
  private clamp(v: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, v));
  }
  private round(v: number, decimals: number): number {
    const f = Math.pow(10, decimals);
    return Math.round(v * f) / f;
  }
}
