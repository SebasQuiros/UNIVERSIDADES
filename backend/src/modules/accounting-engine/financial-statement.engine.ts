import { Injectable } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * ────────────────────────────────────────────────────────────────
 *  FinancialStatementEngine  (Accounting Manifest §3, I-DV-1/2)
 *
 *  Lado LECTURA del motor: deriva saldos y estados financieros
 *  100% desde el Diario General (JournalLine con entry CONFIRMED,
 *  no reversado). Nunca lee saldos persistidos.
 *
 *  Point-in-time (I-DV-2): todo cómputo acepta `asOfDate`. El estado
 *  a cualquier fecha se reconstruye filtrando `entry.entryDate <= asOfDate`.
 *  `fromDate` opcional acota el rango (para Estado de Resultados por
 *  período); si se omite, es acumulado desde el inicio.
 * ────────────────────────────────────────────────────────────────
 */

export interface AccountBalance {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: 'DEBIT' | 'CREDIT';
  isHeader: boolean;
  debit: Decimal;
  credit: Decimal;
  /** Saldo con signo natural de la cuenta (débito o crédito). */
  balance: Decimal;
}

export interface StatementTotals {
  assets: Decimal;
  liabilities: Decimal;
  equity: Decimal;
  income: Decimal;
  expense: Decimal;
  /** income - expense del rango considerado. */
  netIncome: Decimal;
}

@Injectable()
export class FinancialStatementEngine {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Saldos por cuenta derivados del Diario a una fecha de corte.
   * Una sola `groupBy` sobre todas las cuentas (sin N+1).
   */
  async accountBalances(
    companyId: string,
    opts: { asOfDate?: Date; fromDate?: Date; types?: AccountType[] } = {},
  ): Promise<AccountBalance[]> {
    const asOf = opts.asOfDate ?? new Date();

    const accounts = await this.prisma.account.findMany({
      where: {
        companyId,
        isActive: true,
        ...(opts.types ? { type: { in: opts.types } } : {}),
      },
      orderBy: { code: 'asc' },
    });

    const accountIds = accounts.map((a) => a.id);
    const agg = accountIds.length === 0 ? [] : await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        companyId,
        accountId: { in: accountIds },
        entry: {
          isReversed: false,
          status: 'CONFIRMED',
          entryDate: { lte: asOf, ...(opts.fromDate ? { gte: opts.fromDate } : {}) },
        },
      },
      _sum: { debit: true, credit: true },
    });

    const aggMap = new Map(
      agg.map((row) => [row.accountId, {
        debit: new Decimal((row._sum.debit ?? 0).toString()),
        credit: new Decimal((row._sum.credit ?? 0).toString()),
      }]),
    );

    return accounts.map((a) => {
      const debit = aggMap.get(a.id)?.debit ?? new Decimal(0);
      const credit = aggMap.get(a.id)?.credit ?? new Decimal(0);
      // Signo por TIPO (no por normalBalance): las contra-cuentas (p. ej.
      // Depreciación Acumulada, ASSET con saldo CREDIT) netean dentro de su tipo.
      const debitNormalType = a.type === 'ASSET' || a.type === 'EXPENSE';
      const balance = debitNormalType ? debit.minus(credit) : credit.minus(debit);
      return {
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        normalBalance: a.normalBalance as 'DEBIT' | 'CREDIT',
        isHeader: a.isHeader,
        debit,
        credit,
        balance,
      };
    });
  }

  /**
   * Totales agregados por tipo de cuenta a una fecha de corte.
   * Base del chequeo de la ecuación contable (V-2) y del Estado de Situación.
   *
   * IMPORTANTE: income/expense son ACUMULADOS desde el inicio de la empresa
   * (sin `fromDate`). Es lo correcto para la ecuación contable, porque el
   * netIncome acumulado cuadra Activo = Pasivo + Patrimonio + Resultado. Para
   * un Estado de Resultados de PERÍODO, usar `accountBalances(companyId,
   * { fromDate, asOfDate, types: ['INCOME','EXPENSE'] })`.
   */
  async totals(companyId: string, asOfDate?: Date): Promise<StatementTotals> {
    const balances = await this.accountBalances(companyId, { asOfDate });
    const sumOf = (type: AccountType) =>
      balances.filter((b) => b.type === type)
        .reduce((s, b) => s.plus(b.balance), new Decimal(0));

    const assets = sumOf('ASSET');
    const liabilities = sumOf('LIABILITY');
    const equity = sumOf('EQUITY');
    const income = sumOf('INCOME');
    const expense = sumOf('EXPENSE');
    return { assets, liabilities, equity, income, expense, netIncome: income.minus(expense) };
  }

  /**
   * Saldo (con signo natural) de UNA cuenta por código, a una fecha.
   * Usado por el ProjectionEngine para reconciliar cuentas de control.
   */
  async controlAccountBalance(companyId: string, code: string, asOfDate?: Date): Promise<Decimal | null> {
    const account = await this.prisma.account.findFirst({
      where: { companyId, code },
      select: { id: true, normalBalance: true },
    });
    if (!account) return null;

    const asOf = asOfDate ?? new Date();
    const agg = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        companyId,
        accountId: account.id,
        entry: { isReversed: false, status: 'CONFIRMED', entryDate: { lte: asOf } },
      },
      _sum: { debit: true, credit: true },
    });
    const row = agg.length > 0 ? agg[0] : null;
    const debit = new Decimal((row?._sum.debit ?? 0).toString());
    const credit = new Decimal((row?._sum.credit ?? 0).toString());
    return account.normalBalance === 'DEBIT' ? debit.minus(credit) : credit.minus(debit);
  }
}
