/**
 * class-sessions-oracle.logic.ts — Lógica PURA del oráculo de auditoría.
 *
 * Sin dependencias de Prisma/Nest a propósito: son las funciones que
 * `qa-testing` prueba de forma aislada (patrón del núcleo fiscal del repo,
 * ej. `tax-declarations/d104-iva.spec.ts`, `renta.service.spec.ts`).
 *
 * Aquí vive TODO el criterio numérico del oráculo:
 *   - materialidad (NIA 320 / NIA 450) y tolerancia de redondeo,
 *   - clasificación de severidad por banda,
 *   - evaluación de una discrepancia (esperado vs reportado),
 *   - emparejamiento hallazgo-del-estudiante ↔ discrepancia-real,
 *   - scoring contable y de auditoría.
 *
 * REGLAS INVARIANTES (heredadas del diseño del oráculo, Fase 1 §4):
 *   - Todo monto es `Decimal`. Nunca `number` para dinero.
 *   - Se comparan BASES (Decimal exacto), no impuestos redondeados por línea.
 *   - Materialidad explícita: por debajo del umbral NO es hallazgo (evita
 *     reportar el redondeo legítimo como discrepancia).
 *   - Los mensajes NUNCA afirman "fraude"/"trampa": el oráculo detecta
 *     *diferencias*; el juicio lo pone el profesor (doctrina NIA 240).
 */
import { Decimal } from '@prisma/client/runtime/library';

// ── Tipos ────────────────────────────────────────────────────────────

/** Categorías de discrepancia que detecta esta primera versión del oráculo. */
export type DiscrepancyCategory =
  | 'ingresos_omitidos'
  | 'iva_subdeclarado'
  | 'cxp_no_registrada';

/** Severidad por banda de materialidad (NIA 450). */
export type Severity = 'MEDIO' | 'ALTO' | 'CRITICO';

/** Resultado del emparejamiento de un hallazgo del estudiante. */
export type FindingMatchStatus = 'MATCH' | 'WRONG_AMOUNT' | 'NO_DISCREPANCY';

/**
 * Discrepancia real persistida en `ClassSessionCompany.oracleDiscrepancies`.
 * Los montos van como string `toFixed(2)` para JSON estable y legible; el
 * cálculo se hace siempre en `Decimal`.
 */
export interface Discrepancy {
  category: DiscrepancyCategory;
  expectedAmount: string; // lo que la plataforma sabe (outbox DONE)
  reportedAmount: string; // lo reflejado en el snapshot congelado
  delta: string; // |expected - reported|
  severity: Severity;
  message: string; // determinista, en español, NUNCA "fraude"/"trampa"
}

/** Umbrales de materialidad de UNA empresa/periodo. Todo `Decimal`. */
export interface MaterialityThresholds {
  MG: Decimal; // materialidad global (NIA 320)
  PM: Decimal; // importancia de ejecución (performance materiality, NIA 320)
  CT: Decimal; // umbral "claramente insignificante" (NIA 450 §5)
}

// ── Constantes de materialidad ───────────────────────────────────────
// Fuente doctrinal: NIA 320 (materialidad) + NIA 450 §5 (claramente
// insignificante). Los PORCENTAJES son práctica profesional, NO texto de la
// norma (la norma dice "juicio profesional"); se documentan como juicio del
// agente fiscal-contable — ver diseño del oráculo §4.2. Parametrizables por el
// profesor en el futuro.

/** MG = max(1% × ingresos, ₡25.000). Base = ingresos (no utilidad): las
 *  empresas del aula tienen utilidad ≈ 0, usar utilidad haría MG ridícula. */
export const MG_REVENUE_RATE = new Decimal('0.01');
export const MG_FLOOR = new Decimal('25000');

/** PM = 75% × MG (práctica, parametrizable). */
export const PM_RATE = new Decimal('0.75');

/** CT = max(5% × PM, ₡100). Por debajo: ni se acumula ni se muestra. */
export const CT_RATE = new Decimal('0.05');
export const CT_FLOOR = new Decimal('100');

/** RT(N) = max(₡0.01, ₡0.005 × N): ruido aritmético al sumar N ítems ya
 *  redondeados. NO es materialidad; es la deriva de redondeo. */
export const RT_PER_ITEM = new Decimal('0.005');
export const RT_FLOOR = new Decimal('0.01');

/** Pesos de severidad para el scoring (diseño §5.3). Un crítico vale 4×. */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  MEDIO: 1,
  ALTO: 2,
  CRITICO: 4,
};

/** Penalización de accountingScore por unidad de peso de severidad propia. */
export const ACCOUNTING_PENALTY_PER_WEIGHT = 15;

/** Reparto del auditScore: 70% detección (recall) + 30% precisión. */
export const AUDIT_DETECTION_WEIGHT = new Decimal('0.7');
export const AUDIT_PRECISION_WEIGHT = new Decimal('0.3');

/** Tolerancias por defecto del emparejamiento hallazgo↔discrepancia. */
export const MATCH_ABSOLUTE_TOLERANCE = new Decimal('100'); // piso en colones
export const MATCH_RELATIVE_TOLERANCE = new Decimal('0.10'); // 10% de la Δ

// ── Materialidad y tolerancia ────────────────────────────────────────

/**
 * Tolerancia de redondeo agregada para una comparación que suma `itemCount`
 * ítems ya redondeados a 2 decimales. Cada ítem aporta hasta medio céntimo de
 * deriva → RT(N) = max(₡0.01, ₡0.005 × N).
 */
export function roundingTolerance(itemCount: number): Decimal {
  const n = Number.isFinite(itemCount) && itemCount > 0 ? Math.floor(itemCount) : 1;
  return Decimal.max(RT_FLOOR, RT_PER_ITEM.times(n));
}

/**
 * Umbrales de materialidad a partir de los ingresos del periodo.
 * `totalRevenue` es la MEJOR estimación de ingresos reales (máximo entre lo
 * reflejado y lo que el outbox prueba que se vendió): así una empresa que
 * ocultó ingresos NO obtiene una materialidad artificialmente baja.
 */
export function computeMateriality(totalRevenue: Decimal): MaterialityThresholds {
  const rev = totalRevenue.isNegative() ? new Decimal(0) : totalRevenue;
  const MG = Decimal.max(rev.times(MG_REVENUE_RATE), MG_FLOOR);
  const PM = MG.times(PM_RATE);
  const CT = Decimal.max(PM.times(CT_RATE), CT_FLOOR);
  return { MG, PM, CT };
}

/**
 * Banda de severidad por monto de la diferencia (NIA 450):
 *  diff ≤ PM → MEDIO · diff ≤ MG → ALTO · diff > MG → CRÍTICO.
 * Precondición: `diff` ya superó el piso (RT y CT). Ver `evaluateDiscrepancy`.
 */
export function classifySeverity(diff: Decimal, m: MaterialityThresholds): Severity {
  if (diff.lessThanOrEqualTo(m.PM)) return 'MEDIO';
  if (diff.lessThanOrEqualTo(m.MG)) return 'ALTO';
  return 'CRITICO';
}

/**
 * Evalúa una posible discrepancia de subdeclaración/omisión.
 *
 * Modela SIEMPRE "esperado ≥ reportado": solo la SUBdeclaración es hallazgo.
 * Si la empresa reportó MÁS de lo esperado (fue conservadora), no hay hallazgo
 * — `diff` sería negativa y cae por debajo del piso.
 *
 * Orden de corte (diseño §4.3): si `diff ≤ max(RT(N), CT)` → NO es hallazgo
 * (ruido aritmético o claramente insignificante). Devuelve `null`.
 */
export function evaluateDiscrepancy(input: {
  category: DiscrepancyCategory;
  expected: Decimal;
  reported: Decimal;
  itemCount: number;
  materiality: MaterialityThresholds;
  buildMessage: (ctx: {
    expected: Decimal;
    reported: Decimal;
    delta: Decimal;
    severity: Severity;
  }) => string;
}): Discrepancy | null {
  const diff = input.expected.minus(input.reported); // >0 = subdeclarado
  const floor = Decimal.max(roundingTolerance(input.itemCount), input.materiality.CT);
  if (diff.lessThanOrEqualTo(floor)) return null;

  const severity = classifySeverity(diff, input.materiality);
  return {
    category: input.category,
    expectedAmount: input.expected.toDecimalPlaces(2).toFixed(2),
    reportedAmount: input.reported.toDecimalPlaces(2).toFixed(2),
    delta: diff.toDecimalPlaces(2).toFixed(2),
    severity,
    message: input.buildMessage({
      expected: input.expected,
      reported: input.reported,
      delta: diff,
      severity,
    }),
  };
}

// ── Emparejamiento hallazgo ↔ discrepancia ───────────────────────────

/**
 * Mapea la `section` del hallazgo del estudiante a las categorías de
 * discrepancia que podría estar reportando. Una sección sin mapeo (OTHER,
 * TAX_D103, TAX_D115) no tiene candidatos → no puede ser verdadero positivo
 * en esta primera versión.
 */
export const SECTION_CATEGORY: Record<string, DiscrepancyCategory[]> = {
  INCOME_STATEMENT: ['ingresos_omitidos'],
  TAX_D101: ['ingresos_omitidos'], // el D-101 también refleja los ingresos
  TAX_D104: ['iva_subdeclarado'],
  BALANCE_SHEET: ['cxp_no_registrada'],
};

export function categoriesForSection(section: string): DiscrepancyCategory[] {
  return SECTION_CATEGORY[section] ?? [];
}

/**
 * Empareja UN hallazgo del auditor contra el set de discrepancias reales del
 * auditado. Determinista.
 *
 * - `MATCH`: la sección mapea a una categoría con discrepancia detectada y el
 *   monto declarado cae dentro de tolerancia de la Δ o del esperado (o el
 *   hallazgo no cuantifica → se premia la identificación del área, pero se
 *   deja constancia en `detail`).
 * - `WRONG_AMOUNT`: sección correcta, categoría con discrepancia, pero el monto
 *   declarado NO coincide. No es verdadero positivo, pero TAMPOCO se castiga
 *   como falso positivo (identificó el área correcta).
 * - `NO_DISCREPANCY`: la sección citada no tiene discrepancia detectada →
 *   falso positivo.
 *
 * Tolerancia por candidato: max(absoluta, Δ × relativa).
 */
export function matchFinding(input: {
  section: string;
  claimedAmount: Decimal | null;
  discrepancies: Discrepancy[];
  absoluteTolerance?: Decimal;
  relativeTolerance?: Decimal;
}): { status: FindingMatchStatus; category?: DiscrepancyCategory; detail: string } {
  const absTol = input.absoluteTolerance ?? MATCH_ABSOLUTE_TOLERANCE;
  const relTol = input.relativeTolerance ?? MATCH_RELATIVE_TOLERANCE;
  const cats = categoriesForSection(input.section);
  const candidates = input.discrepancies.filter((d) => cats.includes(d.category));

  if (candidates.length === 0) {
    return {
      status: 'NO_DISCREPANCY',
      detail: 'No se detectó discrepancia material en la sección citada.',
    };
  }

  if (input.claimedAmount === null) {
    // Sin monto: se reconoce la identificación del área como coincidencia débil.
    const d = candidates[0];
    return {
      status: 'MATCH',
      category: d.category,
      detail: `Coincide por sección con una discrepancia detectada (${d.category}); hallazgo sin monto declarado.`,
    };
  }

  for (const d of candidates) {
    const delta = new Decimal(d.delta);
    const expected = new Decimal(d.expectedAmount);
    const tol = Decimal.max(absTol, delta.times(relTol));
    if (
      input.claimedAmount.minus(delta).abs().lessThanOrEqualTo(tol) ||
      input.claimedAmount.minus(expected).abs().lessThanOrEqualTo(tol)
    ) {
      return {
        status: 'MATCH',
        category: d.category,
        detail: `Coincide con la discrepancia detectada (${d.category}, diferencia ₡${d.delta}).`,
      };
    }
  }

  return {
    status: 'WRONG_AMOUNT',
    category: candidates[0].category,
    detail: `Sección correcta pero el monto declarado no coincide con la diferencia detectada (₡${candidates[0].delta}).`,
  };
}

// ── Scoring ──────────────────────────────────────────────────────────

/**
 * accountingScore (0-100): calidad contable/tributaria PROPIA.
 * 100 − Σ (peso_severidad × penalización) por cada discrepancia MATERIAL
 * propia (las inmateriales ni llegan aquí: se filtran en `evaluateDiscrepancy`).
 * Acotado a [0,100].
 */
export function computeAccountingScore(
  ownDiscrepancies: { severity: Severity }[],
  penaltyPerWeight: number = ACCOUNTING_PENALTY_PER_WEIGHT,
): Decimal {
  const penalty = ownDiscrepancies.reduce(
    (s, d) => s + SEVERITY_WEIGHT[d.severity] * penaltyPerWeight,
    0,
  );
  const clamped = Math.max(0, Math.min(100, 100 - penalty));
  return new Decimal(clamped).toDecimalPlaces(2);
}

/**
 * auditScore (0-100): calidad de la auditoría que la empresa le hizo a OTRA.
 *
 * detección (recall, ponderado por severidad): Σw(discrepancias detectadas) /
 * Σw(todas las discrepancias del auditado). Si el auditado está limpio
 * (H = ∅), detección = 1 (no se puede reprochar no encontrar lo que no existe;
 * NIA 320 — la materialidad EXISTE para no exigir encontrarlo todo).
 *
 * precisión: TP / (TP + FP). Verdaderos positivos = categorías distintas
 * emparejadas; falsos positivos = hallazgos sobre secciones sin discrepancia.
 * Los `WRONG_AMOUNT` (área correcta, monto errado) NO cuentan como FP.
 *
 * Extremos (diseño §5.6):
 *  - auditado limpio + no reporta nada  → 100 (dictamen limpio correcto).
 *  - auditado limpio + falsos positivos → detección 1, precisión 0 → 70.
 *  - auditado sucio + no reporta nada   → detección 0, precisión 0 → 0.
 *  - auditado sucio + lo encuentra todo → 100.
 */
export function computeAuditScore(input: {
  auditeeDiscrepancies: { category: DiscrepancyCategory; severity: Severity }[];
  findingResults: { status: FindingMatchStatus; category?: DiscrepancyCategory }[];
  detectionWeight?: Decimal;
  precisionWeight?: Decimal;
}): Decimal {
  const dW = input.detectionWeight ?? AUDIT_DETECTION_WEIGHT;
  const pW = input.precisionWeight ?? AUDIT_PRECISION_WEIGHT;
  const H = input.auditeeDiscrepancies;

  const matchedCategories = new Set<DiscrepancyCategory>(
    input.findingResults
      .filter((f) => f.status === 'MATCH' && !!f.category)
      .map((f) => f.category as DiscrepancyCategory),
  );
  const TP = matchedCategories.size;
  const FP = input.findingResults.filter((f) => f.status === 'NO_DISCREPANCY').length;

  let deteccion: Decimal;
  let precision: Decimal;

  if (H.length === 0) {
    deteccion = new Decimal(1);
    precision = FP === 0 ? new Decimal(1) : new Decimal(0);
  } else {
    const totalWeight = H.reduce((s, h) => s + SEVERITY_WEIGHT[h.severity], 0);
    const detectedWeight = H.filter((h) => matchedCategories.has(h.category)).reduce(
      (s, h) => s + SEVERITY_WEIGHT[h.severity],
      0,
    );
    deteccion = totalWeight === 0 ? new Decimal(1) : new Decimal(detectedWeight).div(totalWeight);
    const reported = TP + FP;
    precision = reported === 0 ? new Decimal(0) : new Decimal(TP).div(reported);
  }

  const score = deteccion.times(dW).plus(precision.times(pW)).times(100);
  const clamped = Decimal.max(new Decimal(0), Decimal.min(new Decimal(100), score));
  return clamped.toDecimalPlaces(2);
}

/**
 * totalScore (0-100) = (accountingWeight·acc + auditWeight·audit) / Σpesos.
 * Si la empresa no auditó a nadie (auditScore null, p. ej. sesión de 1 empresa)
 * → totalScore = accountingScore.
 */
export function computeTotalScore(
  accounting: Decimal,
  audit: Decimal | null,
  weights: { accountingWeight: number; auditWeight: number },
): Decimal {
  if (audit === null) return accounting.toDecimalPlaces(2);
  const aw = new Decimal(weights.accountingWeight);
  const uw = new Decimal(weights.auditWeight);
  const denom = aw.plus(uw);
  if (denom.isZero()) return accounting.toDecimalPlaces(2);
  return accounting.times(aw).plus(audit.times(uw)).div(denom).toDecimalPlaces(2);
}
