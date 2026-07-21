import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { isCrossCheckEligible } from '../inter-company/mirror-status';
import {
  Discrepancy,
  DiscrepancyCategory,
  FindingMatchStatus,
  Severity,
  computeAccountingScore,
  computeAuditScore,
  computeMateriality,
  computeTotalScore,
  evaluateDiscrepancy,
  matchFinding,
} from './class-sessions-oracle.logic';

/** Pesos por defecto del score mixto (mismo default que ClassSessionsService). */
const DEFAULT_WEIGHTS = { accountingWeight: 0.6, auditWeight: 0.4 };

/**
 * ClassSessionsOracleService — el ORÁCULO de auditoría inter-empresas.
 *
 * La plataforma generó las dos puntas de cada transacción B2B (outbox
 * `InterCompanyMirror` de Fase 2a). Este servicio calcula las discrepancias
 * REALES entre lo que la plataforma sabe (espejos DONE + facturas fuente) y lo
 * que cada empresa congeló en su snapshot, y con eso califica contabilidad +
 * auditoría.
 *
 * TODO el criterio numérico vive en `class-sessions-oracle.logic.ts` (funciones
 * puras testeables). Este service es solo I/O: lee Prisma, arma los `Decimal`,
 * delega a la lógica pura, persiste.
 *
 * REGLAS INVARIANTES (Fase 1/2a):
 *  - Solo se cruzan facturas cuyo espejo esté DONE (`isCrossCheckEligible`).
 *    NUNCA se genera un hallazgo sobre PENDING/FAILED (sería culpar al
 *    estudiante por una falla de plataforma).
 *  - Se comparan BASES (Decimal exacto), no impuestos redondeados por línea.
 *  - Materialidad explícita: por debajo del umbral NO es hallazgo.
 *  - Mensajes deterministas, en español, que NUNCA afirman "fraude"/"trampa":
 *    el oráculo detecta *diferencias*; el juicio es del profesor (NIA 240).
 */
@Injectable()
export class ClassSessionsOracleService {
  private readonly logger = new Logger(ClassSessionsOracleService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers de lectura defensiva de JSON ───────────────────────────

  /** Convierte number|string|Decimal|null a Decimal (0 si no es parseable). */
  private toDecimal(value: unknown): Decimal {
    if (value === null || value === undefined) return new Decimal(0);
    try {
      return new Decimal(value as any);
    } catch {
      return new Decimal(0);
    }
  }

  private fmt(d: Decimal): string {
    return `₡${d.toDecimalPlaces(2).toFixed(2)}`;
  }

  // ── 1. CÁLCULO DE DISCREPANCIAS ────────────────────────────────────

  /**
   * Calcula y persiste `ClassSessionCompany.oracleDiscrepancies` (Json) por
   * cada empresa de la sesión. Detecta, con materialidad aplicada:
   *   - ingresos_omitidos: ventas B2B con espejo DONE (como vendedor) vs los
   *     ingresos reflejados en el estado de resultados congelado.
   *   - iva_subdeclarado:  débito fiscal esperado (canónico, desde las BASES
   *     de las ventas DONE) vs `cas301_debitoFiscal` de la D-104 congelada.
   *   - cxp_no_registrada: compras con espejo DONE (como comprador) cuya
   *     compra espejo ya no existe en los libros del comprador (rechazada,
   *     borrada o nunca registrada) → circularización automática (NIA 505).
   *
   * Idempotente/re-invocable: sobrescribe `oracleDiscrepancies` cada corrida.
   */
  async computeDiscrepancies(classSessionId: string): Promise<void> {
    const companies = await this.prisma.classSessionCompany.findMany({
      where: { classSessionId },
      select: {
        id: true,
        companyId: true,
        snapshotIncomeStatement: true,
        snapshotTaxDeclarations: true,
      },
    });

    if (companies.length === 0) {
      this.logger.warn(`computeDiscrepancies(${classSessionId}): sesión sin empresas.`);
      return;
    }

    for (const company of companies) {
      const discrepancies = await this.computeCompanyDiscrepancies(
        company.companyId,
        company.snapshotIncomeStatement,
        company.snapshotTaxDeclarations,
      );
      await this.prisma.classSessionCompany.update({
        where: { id: company.id },
        data: { oracleDiscrepancies: discrepancies as any },
      });
    }
  }

  /** Núcleo del cruce para UNA empresa. Devuelve el array de discrepancias. */
  private async computeCompanyDiscrepancies(
    companyId: string,
    snapshotIncomeStatement: unknown,
    snapshotTaxDeclarations: unknown,
  ): Promise<Discrepancy[]> {
    // ── (A) Ventas B2B con espejo DONE (esta empresa como VENDEDORA) ──
    const sellerMirrors = await this.prisma.interCompanyMirror.findMany({
      where: { sellerCompanyId: companyId },
      select: { sourceInvoiceId: true, status: true },
    });
    const doneSaleInvoiceIds = sellerMirrors
      .filter((m) => isCrossCheckEligible(m.status)) // DONE-only, regla invariante
      .map((m) => m.sourceInvoiceId);

    let expectedSalesBase = new Decimal(0); // Σ base (subtotal) de ventas DONE
    let saleItemCount = 0;
    // débito fiscal esperado, canónico: por bucket de tasa, base exacta × tasa,
    // redondeado UNA vez por bucket (mismo método que calcD104 — NO se suman
    // impuestos por línea).
    const baseByRate = new Map<string, Decimal>();

    if (doneSaleInvoiceIds.length > 0) {
      const saleInvoices = await this.prisma.invoice.findMany({
        where: { id: { in: doneSaleInvoiceIds }, companyId },
        select: { items: { select: { subtotal: true, taxRate: true } } },
      });
      for (const inv of saleInvoices) {
        for (const item of inv.items) {
          const base = this.toDecimal(item.subtotal);
          expectedSalesBase = expectedSalesBase.plus(base);
          saleItemCount += 1;
          // taxRate en InvoiceItem está en PORCENTAJE (13 = 13%), confirmado en
          // invoices.service.ts:109 (taxAmount = subtotal × taxRate / 100).
          const rateKey = this.toDecimal(item.taxRate).toFixed(2);
          baseByRate.set(rateKey, (baseByRate.get(rateKey) ?? new Decimal(0)).plus(base));
        }
      }
    }

    let expectedDebito = new Decimal(0);
    for (const [rateKey, base] of baseByRate.entries()) {
      const rate = new Decimal(rateKey).div(100); // 13 → 0.13
      // redondeo canónico medio-hacia-arriba, una vez por bucket de tasa.
      expectedDebito = expectedDebito.plus(
        base.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      );
    }

    // ── (B) Lo reflejado en el snapshot congelado ──
    const reportedIncome = this.readReportedIncome(snapshotIncomeStatement);
    const reportedDebito = this.readReportedDebito(snapshotTaxDeclarations);

    // ── (C) Compras con espejo DONE (esta empresa como COMPRADORA) que ya no
    //        están en sus libros → CxP no registrada / compra espejo ausente ──
    const { expectedAbsentPurchaseBase, absentCount } =
      await this.computeAbsentPurchases(companyId);

    // ── Materialidad de la empresa: ingresos = mejor estimación real ──
    const totalRevenue = Decimal.max(reportedIncome, expectedSalesBase);
    const materiality = computeMateriality(totalRevenue);

    const discrepancies: Discrepancy[] = [];

    // Ingresos omitidos (comparación de BASES, exacta).
    const dIngresos = evaluateDiscrepancy({
      category: 'ingresos_omitidos',
      expected: expectedSalesBase,
      reported: reportedIncome,
      itemCount: saleItemCount,
      materiality,
      buildMessage: ({ expected, reported, delta }) =>
        `Diferencia de ${this.fmt(delta)} entre las ventas B2B con comprobante ` +
        `electrónico confirmado (${this.fmt(expected)}) y los ingresos reflejados ` +
        `en el estado de resultados (${this.fmt(reported)}). Discrepancia detectada; ` +
        `requiere explicación del contribuyente.`,
    });
    if (dIngresos) discrepancies.push(dIngresos);

    // IVA subdeclarado (débito fiscal canónico desde bases vs D-104 declarada).
    const dIva = evaluateDiscrepancy({
      category: 'iva_subdeclarado',
      expected: expectedDebito,
      reported: reportedDebito,
      itemCount: baseByRate.size, // N = buckets de tasa
      materiality,
      buildMessage: ({ expected, reported, delta }) =>
        `Débito fiscal de IVA esperado ${this.fmt(expected)} según las ventas ` +
        `gravadas con comprobante electrónico confirmado, contra ${this.fmt(reported)} ` +
        `reflejado en la D-104. Diferencia de ${this.fmt(delta)} sin explicar.`,
    });
    if (dIva) discrepancies.push(dIva);

    // CxP no registrada (compra espejo ausente en los libros del comprador).
    const dCxp = evaluateDiscrepancy({
      category: 'cxp_no_registrada',
      expected: expectedAbsentPurchaseBase,
      reported: new Decimal(0), // por definición: ausente
      itemCount: absentCount,
      materiality,
      buildMessage: ({ expected, delta }) =>
        `Compras con comprobante electrónico confirmado por ${this.fmt(expected)} ` +
        `no reflejadas como cuenta por pagar / compra registrada en los libros. ` +
        `Diferencia de ${this.fmt(delta)}. Discrepancia detectada; requiere confirmación.`,
    });
    if (dCxp) discrepancies.push(dCxp);

    return discrepancies;
  }

  /**
   * Suma la base de las compras cuyo espejo quedó DONE (esta empresa como
   * compradora) pero cuya `PurchaseInvoice` ya no existe en sus libros. La base
   * se toma de las líneas de la factura FUENTE del vendedor (verdad de campo).
   */
  private async computeAbsentPurchases(
    companyId: string,
  ): Promise<{ expectedAbsentPurchaseBase: Decimal; absentCount: number }> {
    const buyerMirrors = await this.prisma.interCompanyMirror.findMany({
      where: { buyerCompanyId: companyId },
      select: { sourceInvoiceId: true, status: true },
    });
    const doneBuyerMirrors = buyerMirrors.filter((m) => isCrossCheckEligible(m.status));

    let expectedAbsentPurchaseBase = new Decimal(0);
    let absentCount = 0;

    for (const m of doneBuyerMirrors) {
      // ¿Sigue existiendo la compra espejo en los libros del comprador?
      const purchase = await this.prisma.purchaseInvoice.findFirst({
        where: { companyId, sourceInvoiceId: m.sourceInvoiceId },
        select: { id: true },
      });
      if (purchase) continue; // registrada → no hay omisión

      // Ausente: cuantifico la base desde la factura fuente del vendedor.
      const sourceInvoice = await this.prisma.invoice.findUnique({
        where: { id: m.sourceInvoiceId },
        select: { items: { select: { subtotal: true } } },
      });
      if (!sourceInvoice) {
        // Sin factura fuente no puedo cuantificar la omisión: lo dejo como
        // hallazgo de datos (log) y NO invento un monto.
        this.logger.warn(
          `computeAbsentPurchases: espejo DONE ${m.sourceInvoiceId} sin factura fuente legible.`,
        );
        continue;
      }
      const base = sourceInvoice.items.reduce(
        (s, it) => s.plus(this.toDecimal(it.subtotal)),
        new Decimal(0),
      );
      expectedAbsentPurchaseBase = expectedAbsentPurchaseBase.plus(base);
      absentCount += 1;
    }

    return { expectedAbsentPurchaseBase, absentCount };
  }

  /** Ingresos reflejados = `totals.totalIncome` del estado de resultados. */
  private readReportedIncome(snapshotIncomeStatement: unknown): Decimal {
    const snap = snapshotIncomeStatement as any;
    const raw = snap?.totals?.totalIncome;
    if (raw === undefined || raw === null) {
      this.logger.warn(
        'readReportedIncome: snapshotIncomeStatement sin totals.totalIncome; se asume 0.',
      );
      return new Decimal(0);
    }
    return this.toDecimal(raw);
  }

  /** Débito fiscal declarado = `cas301_debitoFiscal` de la D-104 SUBMITTED. */
  private readReportedDebito(snapshotTaxDeclarations: unknown): Decimal {
    const snap = snapshotTaxDeclarations as any;
    const declaraciones: any[] = Array.isArray(snap?.declaraciones) ? snap.declaraciones : [];
    const d104 = declaraciones.find((d) => d?.type === 'D104_IVA' && d?.presentada);
    if (!d104) return new Decimal(0); // no presentó D-104 → 0 declarado
    const raw = d104?.result?.cas301_debitoFiscal;
    return this.toDecimal(raw);
  }

  // ── 2. CALIFICACIÓN ────────────────────────────────────────────────

  /**
   * Corre `computeDiscrepancies` y luego:
   *  1. Empareja cada `ClassSessionAuditFinding` contra las discrepancias
   *     reales del auditado → setea `matched` + `matchDetail`.
   *  2. accountingScore por empresa (calidad propia).
   *  3. auditScore por empresa (calidad de SU auditoría).
   *  4. Persiste ambos en `ClassSessionCompany` y propaga el totalScore al
   *     `ExerciseAttempt` de cada miembro del grupo (status GRADED).
   *
   * Idempotente/re-invocable (la transición `grade` puede repetirse).
   */
  async gradeSession(classSessionId: string): Promise<{
    companies: {
      companyId: string;
      accountingScore: string;
      auditScore: string | null;
      totalScore: string;
    }[];
  }> {
    await this.computeDiscrepancies(classSessionId);

    const session = await this.prisma.classSession.findUnique({
      where: { id: classSessionId },
      select: { exerciseId: true, settings: true },
    });
    const weights = this.readWeights(session?.settings);

    const companies = await this.prisma.classSessionCompany.findMany({
      where: { classSessionId },
      select: { id: true, companyId: true, oracleDiscrepancies: true },
    });
    const discrepanciesByCompany = new Map<string, Discrepancy[]>(
      companies.map((c) => [c.companyId, this.readDiscrepancies(c.oracleDiscrepancies)]),
    );

    const assignments = await this.prisma.classSessionAuditAssignment.findMany({
      where: { classSessionId },
      select: {
        id: true,
        auditorCompanyId: true,
        auditeeCompanyId: true,
        findings: {
          select: { id: true, section: true, claimedAmount: true },
        },
      },
    });

    // auditScore por empresa auditora (null si no audita a nadie).
    const auditScoreByCompany = new Map<string, Decimal>();
    for (const a of assignments) {
      const auditeeDiscrepancies = discrepanciesByCompany.get(a.auditeeCompanyId) ?? [];
      const findingResults: {
        status: FindingMatchStatus;
        category?: DiscrepancyCategory;
      }[] = [];

      for (const f of a.findings) {
        const claimed =
          f.claimedAmount === null || f.claimedAmount === undefined
            ? null
            : this.toDecimal(f.claimedAmount);
        const result = matchFinding({
          section: f.section,
          claimedAmount: claimed,
          discrepancies: auditeeDiscrepancies,
        });
        findingResults.push({ status: result.status, category: result.category });
        await this.prisma.classSessionAuditFinding.update({
          where: { id: f.id },
          data: {
            matched: result.status === 'MATCH',
            matchDetail: result.detail,
          },
        });
      }

      const auditScore = computeAuditScore({
        auditeeDiscrepancies: auditeeDiscrepancies.map((d) => ({
          category: d.category,
          severity: d.severity as Severity,
        })),
        findingResults,
      });
      auditScoreByCompany.set(a.auditorCompanyId, auditScore);
    }

    // accountingScore + persistencia + propagación.
    const summary: {
      companyId: string;
      accountingScore: string;
      auditScore: string | null;
      totalScore: string;
    }[] = [];

    for (const c of companies) {
      const own = discrepanciesByCompany.get(c.companyId) ?? [];
      const accountingScore = computeAccountingScore(
        own.map((d) => ({ severity: d.severity as Severity })),
      );
      const auditScore = auditScoreByCompany.get(c.companyId) ?? null;
      const totalScore = computeTotalScore(accountingScore, auditScore, weights);

      await this.prisma.classSessionCompany.update({
        where: { id: c.id },
        data: {
          accountingScore,
          auditScore: auditScore ?? null,
        },
      });

      await this.propagateToAttempts(
        session?.exerciseId,
        c.companyId,
        totalScore,
        accountingScore,
        auditScore,
      );

      summary.push({
        companyId: c.companyId,
        accountingScore: accountingScore.toFixed(2),
        auditScore: auditScore ? auditScore.toFixed(2) : null,
        totalScore: totalScore.toFixed(2),
      });
    }

    return { companies: summary };
  }

  /**
   * Propaga el `totalScore` al `ExerciseAttempt` de cada miembro del grupo.
   *
   * Criterio (documentado): el grado del estudiante en la sesión es el score
   * MIXTO (contabilidad + auditoría), no solo la contabilidad. Todos los
   * miembros del grupo comparten el resultado de SU empresa (contabilidad
   * colectiva) y de la auditoría que su empresa realizó. Las empresas GROUP no
   * cuelgan de un `ExerciseAttempt` (attemptId NULL), así que se hace `upsert`
   * por (exerciseId, studentId) — clave única del modelo — creando el registro
   * de calificación si no existía.
   */
  private async propagateToAttempts(
    exerciseId: string | undefined,
    companyId: string,
    totalScore: Decimal,
    accountingScore: Decimal,
    auditScore: Decimal | null,
  ): Promise<void> {
    if (!exerciseId) return;
    const members = await this.prisma.companyMembership.findMany({
      where: { companyId },
      select: { userId: true },
    });
    if (members.length === 0) return;

    const feedback =
      `Sesión de aula — contabilidad ${accountingScore.toFixed(2)}/100` +
      (auditScore ? `, auditoría ${auditScore.toFixed(2)}/100` : '') +
      `, total ${totalScore.toFixed(2)}/100.`;
    const score = totalScore.toDecimalPlaces(2);
    const now = new Date();

    for (const m of members) {
      await this.prisma.exerciseAttempt.upsert({
        where: { exerciseId_studentId: { exerciseId, studentId: m.userId } },
        update: { score, status: 'GRADED', gradedAt: now, feedback },
        create: {
          exerciseId,
          studentId: m.userId,
          score,
          maxScore: new Decimal(100),
          status: 'GRADED',
          gradedAt: now,
          feedback,
        },
      });
    }
  }

  // ── Helpers de lectura ─────────────────────────────────────────────

  private readWeights(settings: unknown): { accountingWeight: number; auditWeight: number } {
    const s = settings as any;
    const accountingWeight =
      typeof s?.accountingWeight === 'number' ? s.accountingWeight : DEFAULT_WEIGHTS.accountingWeight;
    const auditWeight =
      typeof s?.auditWeight === 'number' ? s.auditWeight : DEFAULT_WEIGHTS.auditWeight;
    return { accountingWeight, auditWeight };
  }

  private readDiscrepancies(value: unknown): Discrepancy[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (d): d is Discrepancy =>
        !!d && typeof d.category === 'string' && typeof d.severity === 'string',
    );
  }
}
