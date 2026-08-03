/**
 * renta.service.ts
 * D-101 Income Tax — company-linked service
 *
 * Covers:
 *  - calculateD101(companyId, fiscalYear) — full D-101 computation from journal lines
 *  - schedulePartialPayments(...)          — create 4 quarterly payment records
 *  - getPartialPayments(...)               — list for a fiscal year
 *  - markPartialPaymentPaid(...)           — mark a quarter as paid
 *  - createRetencion(...)                  — register a withholding + auto journal entry
 *  - getRetenciones(...)                   — list retenciones
 */

import {
  Injectable, Inject, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportesCache } from '../../redis/reportes-cache.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  SchedulePartialPaymentsDto,
  CreateRetencionDto,
} from './dto/tax-declarations.dto';
import { assertCompanyAccess } from '../../common/auth/company-access.helper';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { resolveAttemptId, computeTaxAfterCredits, round } from './renta-authz';

// ── Costa Rica 2026 official tax brackets for PYME ────────────────────────────
// Source: Decreto Ejecutivo N° 44.xxx Ministerio de Hacienda, período fiscal 2025-2026
const TAX_BRACKETS_2026 = [
  { upTo: 5_665_000,  rate: 0.05 },
  { upTo: 8_485_000,  rate: 0.10 },
  { upTo: 11_313_000, rate: 0.15 },
  { upTo: 22_627_000, rate: 0.20 },
  { upTo: Infinity,   rate: 0.25 },
] as const;

const PYME_THRESHOLD    = 119_024_000;   // ₡119.024.000 ingresos brutos
const LARGE_COMPANY_RATE = 0.30;

// Retention rates per type
const RETENTION_RATES: Record<string, number> = {
  SERVICIOS_PROFESIONALES: 0.02,
  ALQUILER:                0.15,
  DIVIDENDOS:              0.15,
  TRANSPORTE:              0.01,
};

// Quarterly due dates (month is 0-indexed)
const QUARTER_DATES = [
  { quarter: 1, month: 2,  day: 31 }, // March 31
  { quarter: 2, month: 5,  day: 30 }, // June 30
  { quarter: 3, month: 8,  day: 30 }, // September 30
  { quarter: 4, month: 11, day: 15 }, // December 15
] as const;

@Injectable()
export class RentaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: any,
    private readonly reportesCache: ReportesCache,
  ) {}

  // ── Resolve company + verify access ──────────────────────────────────────
  // Fase 2a — Cimiento B: se delega la autorización al helper canónico
  // `assertCompanyAccess` (el mismo que usa `tax-declarations.service.ts` y
  // que respeta `CompanyOwnerGuard`), en vez de la comparación a medida que
  // lanzaba en modo GROUP. Regla: INDIVIDUAL → estudiante dueño; GROUP →
  // estudiante miembro (`CompanyMembership`, resuelta siempre fresca de DB —
  // ver `company-access.helper.ts`). El anclaje fiscal de Retencion/Partial-
  // Payment es `companyId`; `attemptId` se conserva solo para INDIVIDUAL.
  private async resolveCompany(
    companyId: string,
    userId: string,
  ): Promise<{ id: string; attemptId: string | null; mode: 'INDIVIDUAL' | 'GROUP' }> {
    const access = await assertCompanyAccess(this.prisma, companyId, userId, {
      redis: this.redis,
    });

    // `attemptId` no forma parte del "core" cacheado (no lo necesitan los
    // guards); se lee aparte, ya sobre una empresa cuyo acceso fue verificado.
    const company = await this.prisma.company.findUnique({
      where:  { id: companyId },
      select: { attemptId: true },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');

    return {
      id:        access.id,
      attemptId: company.attemptId,
      mode:      access.mode,
    };
  }

  // ── Calculate D-101 from journal lines ───────────────────────────────────
  async calculateD101(companyId: string, fiscalYear: number, userId: string) {
    await this.resolveCompany(companyId, userId);

    const startDate = new Date(fiscalYear, 0, 1);   // Jan 1
    const endDate   = new Date(fiscalYear, 11, 31);  // Dec 31

    // Aggregate INCOME accounts (solo CONFIRMED)
    const incomeAgg = await this.prisma.journalLine.findMany({
      where: {
        companyId,
        entry: {
          isReversed: false,
          status:     'CONFIRMED',
          entryDate:  { gte: startDate, lte: endDate },
        },
        account: { type: 'INCOME' },
      },
      select: { credit: true, debit: true },
    });

    // Aggregate EXPENSE accounts (solo CONFIRMED)
    const expenseAgg = await this.prisma.journalLine.findMany({
      where: {
        companyId,
        entry: {
          isReversed: false,
          status:     'CONFIRMED',
          entryDate:  { gte: startDate, lte: endDate },
        },
        account: { type: 'EXPENSE' },
      },
      select: { credit: true, debit: true },
    });

    // Income accounts have CREDIT normal balance: balance = credit - debit
    const grossIncome = incomeAgg.reduce((sum, l) => {
      return sum.plus(new Decimal(l.credit.toString())).minus(new Decimal(l.debit.toString()));
    }, new Decimal(0));

    // Expense accounts have DEBIT normal balance: balance = debit - credit
    const totalExpenses = expenseAgg.reduce((sum, l) => {
      return sum.plus(new Decimal(l.debit.toString())).minus(new Decimal(l.credit.toString()));
    }, new Decimal(0));

    const netIncome = grossIncome.minus(totalExpenses);
    const netIncomeNum = Math.max(0, netIncome.toNumber());
    const grossIncomeNum = Math.max(0, grossIncome.toNumber());

    const isSmallCompany = grossIncomeNum <= PYME_THRESHOLD;

    // ── Progressive tax calculation ──────────────────────────────────────
    let totalTax = 0;
    const taxBreakdown: Array<{
      from: number; to: number; rate: number;
      taxableAmount: number; tax: number; label: string;
    }> = [];

    if (netIncomeNum > 0) {
      if (isSmallCompany) {
        let remaining = netIncomeNum;
        let previousBracket = 0;

        for (const bracket of TAX_BRACKETS_2026) {
          if (remaining <= 0) break;

          const bracketSize   = bracket.upTo === Infinity ? remaining : bracket.upTo - previousBracket;
          const taxableAmount = Math.min(remaining, bracketSize);
          const tax           = round(taxableAmount * bracket.rate);

          taxBreakdown.push({
            from:          previousBracket,
            to:            previousBracket + taxableAmount,
            rate:          bracket.rate,
            taxableAmount: round(taxableAmount),
            tax,
            label: bracket.upTo === Infinity
              ? `Más de ₡${fmtCR(previousBracket)}`
              : `₡${fmtCR(previousBracket + 1)} a ₡${fmtCR(bracket.upTo)}`,
          });

          totalTax        += tax;
          remaining       -= taxableAmount;
          previousBracket  = bracket.upTo === Infinity ? previousBracket + taxableAmount : bracket.upTo;
        }
        totalTax = round(totalTax);
      } else {
        // Large company: flat 30%
        totalTax = round(netIncomeNum * LARGE_COMPANY_RATE);
        taxBreakdown.push({
          from:          0,
          to:            netIncomeNum,
          rate:          LARGE_COMPANY_RATE,
          taxableAmount: round(netIncomeNum),
          tax:           totalTax,
          label:         'Tarifa única empresa grande (30%)',
        });
      }
    }

    // ── Credits ──────────────────────────────────────────────────────────
    const partialPayments = await this.getPartialPayments(companyId, fiscalYear);
    const totalPartialPaid = partialPayments
      .filter(p => p.isPaid)
      .reduce((s, p) => s + Number(p.amount), 0);

    // NOTA (Fase 2a — Cimiento B4, fix de criterio fiscal): las retenciones
    // listadas acá son las que la empresa PRACTICÓ a terceros (agente
    // retenedor) — son pasivo a enterar en el D-103, NUNCA crédito de la
    // renta propia. Se listan como informativas pero YA NO se restan del
    // impuesto (antes se restaban por error y subdeclaraban el D-101).
    const retenciones = await this.getRetenciones(companyId, fiscalYear);

    const { impuestoAPagar, saldoAFavor } = computeTaxAfterCredits({
      totalTax,
      totalPartialPaid,
    });

    return {
      fiscalYear,
      startDate: startDate.toISOString().split('T')[0],
      endDate:   endDate.toISOString().split('T')[0],
      // Ingresos / gastos
      ingresosGravables:    round(grossIncomeNum),
      gastosDeducibles:     round(Math.max(0, totalExpenses.toNumber())),
      rentaNetaImponible:   round(netIncomeNum),
      // Tax calculation
      taxBrackets:          taxBreakdown,
      impuestoDeterminado:  totalTax,
      // Credits
      pagosParciales:       round(totalPartialPaid),
      // Se mantiene por retrocompatibilidad de UI: "retenciones soportadas
      // acreditables". Esa ruta (retenciones que OTROS le practicaron a la
      // empresa) aún no está modelada en el cálculo automático, así que el
      // crédito queda en 0 — no se acredita el lado equivocado (ver B4).
      retencionesRecibidas: 0,
      // Result
      impuestoAPagar:       impuestoAPagar,
      saldoAFavor:          saldoAFavor,
      // Meta
      isSmallCompany,
      tipoEmpresa:          isSmallCompany ? 'PYME' : 'GRANDE',
      effectiveRate:        netIncomeNum > 0
        ? (totalTax / netIncomeNum * 100).toFixed(2)
        : '0.00',
      // Detail
      partialPayments,
      retenciones,
      // Flag: no journal data yet
      hasJournalData: incomeAgg.length > 0 || expenseAgg.length > 0,
    };
  }

  // ── Schedule 4 quarterly partial payments ────────────────────────────────
  async schedulePartialPayments(
    companyId: string,
    userId: string,
    dto: SchedulePartialPaymentsDto,
  ) {
    const company = await this.resolveCompany(companyId, userId);
    const quarterAmount = round(dto.estimatedTax / 4);

    // Delete existing unplanned records for this year (idempotent)
    await this.prisma.partialPayment.deleteMany({
      where: { companyId, fiscalYear: dto.fiscalYear, isPaid: false },
    });

    const records = await Promise.all(
      QUARTER_DATES.map(q => {
        const dueDate = new Date(dto.fiscalYear, q.month, q.day);
        return this.prisma.partialPayment.create({
          data: {
            companyId,
            // GROUP no tiene un único intento dueño: el anclaje fiscal real
            // es companyId; attemptId queda NULL (ver renta-authz.ts).
            attemptId:  resolveAttemptId({ mode: company.mode, companyAttemptId: company.attemptId }),
            fiscalYear: dto.fiscalYear,
            quarter:    q.quarter,
            dueDate,
            amount:     quarterAmount,
            isPaid:     false,
          },
        });
      }),
    );

    return records;
  }

  // ── List partial payments for a fiscal year ──────────────────────────────
  async getPartialPayments(companyId: string, fiscalYear: number) {
    return this.prisma.partialPayment.findMany({
      where:   { companyId, fiscalYear },
      orderBy: { quarter: 'asc' },
    });
  }

  // ── Mark a partial payment as paid ───────────────────────────────────────
  async markPartialPaymentPaid(
    paymentId: string,
    companyId: string,
    userId: string,
    paidDate: Date,
  ) {
    await this.resolveCompany(companyId, userId);

    const payment = await this.prisma.partialPayment.findFirst({
      where: { id: paymentId, companyId },
    });
    if (!payment) throw new NotFoundException('Pago parcial no encontrado');

    return this.prisma.partialPayment.update({
      where: { id: paymentId },
      data:  { isPaid: true, paidDate },
    });
  }

  // ── Create a retencion + auto journal entry ──────────────────────────────
  async createRetencion(
    companyId: string,
    userId: string,
    dto: CreateRetencionDto,
  ) {
    const company = await this.resolveCompany(companyId, userId);

    const rate = RETENTION_RATES[dto.type];
    if (rate === undefined) {
      throw new BadRequestException(`Tipo de retención inválido: ${dto.type}`);
    }

    const grossAmount     = new Decimal(dto.grossAmount);
    const retentionAmount = grossAmount.times(rate);
    const netPaid         = grossAmount.minus(retentionAmount);
    const date            = new Date(dto.date);

    // I-AT-1 (Accounting Manifest): la retención y su asiento se crean como UNA
    // unidad atómica. Antes el asiento era "best-effort" fuera de transacción con
    // un catch que tragaba el error → retención sin asiento (dato inconsistente).
    // Ahora: o ambos se confirman, o ninguno. Exigimos el catálogo de cuentas
    // (todo evento financiero debe producir su asiento; el Diario es la verdad).
    //
    // Asiento:  D Gasto (bruto) · C Caja/Banco (neto) · C Retenciones por Pagar.
    // NOTA: el enrutado por BusinessEventsService (escritor único, RulesEngine,
    // AccountingMode) es parte de F4 (ver I-AT-2 en el manifiesto). Aquí solo se
    // corrige la atomicidad y se agrega trazabilidad source/sourceType/sourceId.
    const creada = await this.prisma.$transaction(async (tx) => {
      const retencion = await tx.retencion.create({
        data: {
          companyId,
          // GROUP no tiene un único intento dueño: el anclaje fiscal real es
          // companyId; attemptId queda NULL (ver renta-authz.ts).
          attemptId:       resolveAttemptId({ mode: company.mode, companyAttemptId: company.attemptId }),
          type:            dto.type,
          supplierName:    dto.supplierName,
          supplierCedula:  dto.supplierCedula ?? null,
          grossAmount,
          retentionRate:   rate,
          retentionAmount,
          netPaid,
          date,
          description:     dto.description ?? null,
        },
      });

      const [expenseAcc, retencionesAcc, cajaAcc] = await Promise.all([
        tx.account.findFirst({
          where: { companyId, type: 'EXPENSE', isHeader: false, isActive: true },
          orderBy: { code: 'asc' },
        }),
        tx.account.findFirst({
          where: { companyId, code: '2.1.02.02' },   // Retenciones por Pagar
        }),
        tx.account.findFirst({
          where: { companyId, type: 'ASSET', isHeader: false, isActive: true },
          orderBy: { code: 'asc' },
        }),
      ]);

      if (!expenseAcc || !retencionesAcc || !cajaAcc) {
        throw new BadRequestException(
          'La empresa no tiene el catálogo de cuentas necesario para registrar la ' +
          'retención (se requieren una cuenta de gasto, una de activo/caja y la cuenta ' +
          '"Retenciones por Pagar" 2.1.02.02). Verificá el plan de cuentas.',
        );
      }

      const seq = await tx.journalSequence.upsert({
        where:  { companyId },
        update: { lastNumber: { increment: 1 } },
        create: { companyId, lastNumber: 1 },
      });

      await tx.journalEntry.create({
        data: {
          companyId,
          createdById: userId,
          entryNumber: seq.lastNumber,
          entryDate:   date,
          source:      'MANUAL',
          sourceType:  'withholding',   // I-TR-1: trazabilidad del evento
          sourceId:    retencion.id,
          description: `Retención en fuente — ${dto.supplierName} (${dto.type})`,
          lines: {
            create: [
              {
                companyId,
                accountId: expenseAcc.id,
                debit:     grossAmount,
                credit:    new Decimal(0),
                description: `Gasto bruto: ${dto.supplierName}`,
              },
              {
                companyId,
                accountId: cajaAcc.id,
                debit:     new Decimal(0),
                credit:    netPaid,
                description: `Pago neto: ${dto.supplierName}`,
              },
              {
                companyId,
                accountId: retencionesAcc.id,
                debit:     new Decimal(0),
                credit:    retentionAmount,
                description: `Retención ${(rate * 100).toFixed(0)}%: ${dto.supplierName}`,
              },
            ],
          },
        },
      });

      return retencion;
    });

    await this.reportesCache.marcarCambio(companyId);
    return creada;
  }

  // ── List retenciones (optionally filter by year) ─────────────────────────
  async getRetenciones(companyId: string, year?: number) {
    const where: any = { companyId };

    if (year) {
      where.date = {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31),
      };
    }

    return this.prisma.retencion.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
// `round()` vive en `renta-authz.ts` (compartido con las funciones puras de
// autorización/créditos) y se importa arriba; acá solo queda el formateador.
function fmtCR(n: number): string {
  return n.toLocaleString('es-CR');
}
