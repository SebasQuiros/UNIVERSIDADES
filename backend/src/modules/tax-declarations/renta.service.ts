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
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  SchedulePartialPaymentsDto,
  CreateRetencionDto,
} from './dto/tax-declarations.dto';

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
  constructor(private readonly prisma: PrismaService) {}

  // ── Resolve company + verify ownership ───────────────────────────────────
  // Fase 1: este service solo soporta companies modo INDIVIDUAL — los flujos
  // de partialPayment / retencion guardan attemptId no-null. Para GROUP se
  // implementará en una fase posterior. La autorización ya respeta GROUP en
  // los endpoints HTTP via CompanyOwnerGuard; acá lanzamos un error claro.
  private async resolveCompany(
    companyId: string,
    studentId: string,
  ): Promise<{ id: string; attemptId: string; studentId: string }> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    if (company.mode === 'GROUP') {
      throw new ForbiddenException(
        'Renta service: aún no soportado en companies modo GROUP',
      );
    }
    if (company.studentId !== studentId) throw new ForbiddenException();
    if (!company.attemptId || !company.studentId) {
      throw new ForbiddenException(
        'Renta service: empresa INDIVIDUAL sin attemptId/studentId',
      );
    }
    return {
      id:        company.id,
      attemptId: company.attemptId,
      studentId: company.studentId,
    };
  }

  // ── Calculate D-101 from journal lines ───────────────────────────────────
  async calculateD101(companyId: string, fiscalYear: number, studentId: string) {
    await this.resolveCompany(companyId, studentId);

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

    const retenciones = await this.getRetenciones(companyId, fiscalYear);
    const withholdingsReceived = retenciones.reduce(
      (s, r) => s + Number(r.retentionAmount), 0,
    );

    const taxAfterCredits = totalTax - totalPartialPaid - withholdingsReceived;

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
      retencionesRecibidas: round(withholdingsReceived),
      // Result
      impuestoAPagar:       round(Math.max(0, taxAfterCredits)),
      saldoAFavor:          round(Math.max(0, -taxAfterCredits)),
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
    studentId: string,
    dto: SchedulePartialPaymentsDto,
  ) {
    const company = await this.resolveCompany(companyId, studentId);
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
            attemptId:  company.attemptId,
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
    studentId: string,
    paidDate: Date,
  ) {
    await this.resolveCompany(companyId, studentId);

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
    studentId: string,
    dto: CreateRetencionDto,
  ) {
    const company = await this.resolveCompany(companyId, studentId);

    const rate = RETENTION_RATES[dto.type];
    if (rate === undefined) {
      throw new BadRequestException(`Tipo de retención inválido: ${dto.type}`);
    }

    const grossAmount     = new Decimal(dto.grossAmount);
    const retentionAmount = grossAmount.times(rate);
    const netPaid         = grossAmount.minus(retentionAmount);
    const date            = new Date(dto.date);

    const retencion = await this.prisma.retencion.create({
      data: {
        companyId,
        attemptId:       company.attemptId,
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

    // ── Auto journal entry ────────────────────────────────────────────────
    // D: Gasto de Servicios / Alquiler / etc = grossAmount
    // C: Caja/Banco                          = netPaid
    // C: Retenciones por Pagar               = retentionAmount
    //
    // We look up accounts by type; if not found we skip (company may not
    // have seeded the chart yet).
    try {
      const [expenseAcc, retencionesAcc, cajaAcc] = await Promise.all([
        this.prisma.account.findFirst({
          where: { companyId, type: 'EXPENSE', isHeader: false, isActive: true },
          orderBy: { code: 'asc' },
        }),
        this.prisma.account.findFirst({
          where: { companyId, code: '2.1.02.02' },   // Retenciones por Pagar
        }),
        this.prisma.account.findFirst({
          where: { companyId, type: 'ASSET', isHeader: false, isActive: true },
          orderBy: { code: 'asc' },
        }),
      ]);

      if (expenseAcc && retencionesAcc && cajaAcc) {
        // Get/create journal sequence
        const seq = await this.prisma.journalSequence.upsert({
          where:  { companyId },
          update: { lastNumber: { increment: 1 } },
          create: { companyId, lastNumber: 1 },
        });

        await this.prisma.journalEntry.create({
          data: {
            companyId,
            createdById: studentId,
            entryNumber: seq.lastNumber,
            entryDate:   date,
            source:      'MANUAL',
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
      }
    } catch {
      // Journal entry creation is best-effort; don't fail the main operation
    }

    return retencion;
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
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtCR(n: number): string {
  return n.toLocaleString('es-CR');
}
