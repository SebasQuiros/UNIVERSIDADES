import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { ReportFilterDto } from './dto/reports.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Resolve date range from filter ────────────────────────────
  private async resolveDates(companyId: string, filter: ReportFilterDto) {
    if (filter.periodId) {
      const period = await this.prisma.accountingPeriod.findFirst({
        where: { id: filter.periodId, companyId },
      });
      if (!period) throw new NotFoundException('Período no encontrado');
      return { startDate: period.startDate, endDate: period.endDate, period };
    }

    return {
      startDate: filter.startDate ? new Date(filter.startDate) : new Date('2000-01-01'),
      endDate:   filter.endDate   ? new Date(filter.endDate)   : new Date(),
      period:    null,
    };
  }

  // ── Get account balances (internal helper) ────────────────────
  private async getAccountBalances(
    companyId: string,
    startDate: Date,
    endDate: Date,
    types?: string[],
  ) {
    const accounts = await this.prisma.account.findMany({
      where: {
        companyId,
        isActive: true,
        ...(types ? { type: { in: types as any[] } } : {}),
      },
      orderBy: { code: 'asc' },
    });

    // Fase 5 — fix N+1: antes era 1 aggregate por cuenta. Reemplazamos por
    // UNA sola groupBy sobre todas las cuentas a la vez. Pasa de N round-trips
    // a 1, sin importar si la empresa tiene 10 o 1000 cuentas.
    const accountIds = accounts.map(a => a.id);
    const agg = accountIds.length === 0 ? [] : await this.prisma.journalLine.groupBy({
      by:    ['accountId'],
      where: {
        companyId,
        accountId: { in: accountIds },
        entry: {
          isReversed: false,
          status:     'CONFIRMED',  // excluye PENDING/REJECTED
          entryDate:  { gte: startDate, lte: endDate },
        },
      },
      _sum: { debit: true, credit: true },
    });
    const aggMap = new Map(
      agg.map(row => [row.accountId, {
        debit:  new Decimal((row._sum.debit  ?? 0).toString()),
        credit: new Decimal((row._sum.credit ?? 0).toString()),
      }]),
    );

    return accounts.map(account => {
      const totalDebit  = aggMap.get(account.id)?.debit  ?? new Decimal(0);
      const totalCredit = aggMap.get(account.id)?.credit ?? new Decimal(0);

      const balance = account.normalBalance === 'DEBIT'
        ? totalDebit.minus(totalCredit)
        : totalCredit.minus(totalDebit);

      return {
        id:            account.id,
        code:          account.code,
        name:          account.name,
        type:          account.type,
        level:         account.level,
        isHeader:      account.isHeader,
        normalBalance: account.normalBalance,
        totalDebit:    totalDebit.toFixed(2),
        totalCredit:   totalCredit.toFixed(2),
        balance:       balance.toFixed(2),
        balanceNum:    balance,
      };
    });
  }

  // ── 1. TRIAL BALANCE — Balance de Comprobación ────────────────
  // Shows ALL accounts (including those with zero balance)
  // Uses LEFT JOIN semantics by fetching all accounts then their movements
  async getTrialBalance(companyId: string, filter: ReportFilterDto) {
    const { startDate, endDate, period } = await this.resolveDates(companyId, filter);
    const accounts = await this.getAccountBalances(companyId, startDate, endDate);

    // Include all accounts (even zero balance) — that's what trial balance requires
    const rows = accounts.filter(a => !a.isHeader);

    const totalDebit  = rows.reduce((s, a) => s.plus(new Decimal(a.totalDebit)),  new Decimal(0));
    const totalCredit = rows.reduce((s, a) => s.plus(new Decimal(a.totalCredit)), new Decimal(0));
    const isBalanced  = totalDebit.minus(totalCredit).abs().lessThanOrEqualTo(new Decimal('0.01'));

    return {
      reportType: 'TRIAL_BALANCE',
      company:    await this.getCompanyInfo(companyId),
      period:     period ?? { startDate, endDate },
      generatedAt: new Date(),
      rows,
      totals: {
        totalDebit:  totalDebit.toFixed(2),
        totalCredit: totalCredit.toFixed(2),
        difference:  totalDebit.minus(totalCredit).toFixed(2),
        isBalanced,
      },
    };
  }

  // ── 2. BALANCE SHEET — Balance General ────────────────────────
  // Assets = Liabilities + Equity
  // Uses ALL history up to endDate (balance sheet is cumulative)
  async getBalanceSheet(companyId: string, filter: ReportFilterDto) {
    const { endDate, period } = await this.resolveDates(companyId, filter);

    // Balance sheet is cumulative — start from the beginning of time
    const startDate = new Date('2000-01-01');
    const allAccounts = await this.getAccountBalances(companyId, startDate, endDate);

    const assets      = allAccounts.filter(a => a.type === 'ASSET');
    const liabilities = allAccounts.filter(a => a.type === 'LIABILITY');
    const equity      = allAccounts.filter(a => a.type === 'EQUITY');

    const totalAssets      = assets.reduce((s, a) => s.plus(a.balanceNum), new Decimal(0));
    const totalLiabilities = liabilities.reduce((s, a) => s.plus(a.balanceNum), new Decimal(0));
    const totalEquity      = equity.reduce((s, a) => s.plus(a.balanceNum), new Decimal(0));

    // Calculate current period net income to include in equity (for mid-period balance)
    const { startDate: filterStart } = await this.resolveDates(companyId, filter);
    const incomeAccounts  = await this.getAccountBalances(companyId, filterStart, endDate, ['INCOME']);
    const expenseAccounts = await this.getAccountBalances(companyId, filterStart, endDate, ['EXPENSE']);
    const totalIncome     = incomeAccounts.reduce((s, a) => s.plus(a.balanceNum), new Decimal(0));
    const totalExpenses   = expenseAccounts.reduce((s, a) => s.plus(a.balanceNum), new Decimal(0));
    const currentNetIncome = totalIncome.minus(totalExpenses);

    // Total equity including current period net income
    const adjustedEquity  = totalEquity.plus(currentNetIncome);
    const totalLiabEquity = totalLiabilities.plus(adjustedEquity);
    const isBalanced      = totalAssets.minus(totalLiabEquity).abs().lessThanOrEqualTo(new Decimal('0.01'));

    return {
      reportType:  'BALANCE_SHEET',
      company:     await this.getCompanyInfo(companyId),
      asOfDate:    endDate,
      generatedAt: new Date(),
      assets: {
        accounts:    assets.filter(a => a.balanceNum.abs().greaterThan(0)),
        total:       totalAssets.toFixed(2),
      },
      liabilities: {
        accounts:    liabilities.filter(a => a.balanceNum.abs().greaterThan(0)),
        total:       totalLiabilities.toFixed(2),
      },
      equity: {
        accounts:    equity.filter(a => a.balanceNum.abs().greaterThan(0)),
        total:       totalEquity.toFixed(2),
      },
      totals: {
        totalAssets:       totalAssets.toFixed(2),
        totalLiabilities:  totalLiabilities.toFixed(2),
        totalEquity:       totalEquity.toFixed(2),
        currentNetIncome:  currentNetIncome.toFixed(2),
        adjustedEquity:    adjustedEquity.toFixed(2),
        totalLiabEquity:   totalLiabEquity.toFixed(2),
        isBalanced,
        difference:        totalAssets.minus(totalLiabEquity).toFixed(2),
      },
    };
  }

  // ── 3. INCOME STATEMENT — Estado de Resultados ───────────────
  // Only covers the specified period (not cumulative)
  async getIncomeStatement(companyId: string, filter: ReportFilterDto) {
    const { startDate, endDate, period } = await this.resolveDates(companyId, filter);
    const accounts = await this.getAccountBalances(companyId, startDate, endDate, ['INCOME', 'EXPENSE']);

    const incomeAccounts  = accounts.filter(a => a.type === 'INCOME');
    const expenseAccounts = accounts.filter(a => a.type === 'EXPENSE');

    const totalIncome   = incomeAccounts.reduce((s, a) => s.plus(a.balanceNum), new Decimal(0));
    const totalExpenses = expenseAccounts.reduce((s, a) => s.plus(a.balanceNum), new Decimal(0));
    const netIncome     = totalIncome.minus(totalExpenses);

    return {
      reportType:  'INCOME_STATEMENT',
      company:     await this.getCompanyInfo(companyId),
      period:      period ?? { startDate, endDate },
      generatedAt: new Date(),
      income: {
        accounts: incomeAccounts.filter(a => !a.isHeader && a.balanceNum.abs().greaterThan(0)),
        headers:  incomeAccounts.filter(a => a.isHeader),
        total:    totalIncome.toFixed(2),
      },
      expenses: {
        accounts: expenseAccounts.filter(a => !a.isHeader && a.balanceNum.abs().greaterThan(0)),
        headers:  expenseAccounts.filter(a => a.isHeader),
        total:    totalExpenses.toFixed(2),
      },
      totals: {
        totalIncome:    totalIncome.toFixed(2),
        totalExpenses:  totalExpenses.toFixed(2),
        netIncome:      netIncome.toFixed(2),
        isProfit:       netIncome.greaterThanOrEqualTo(0),
      },
    };
  }

  // ── 4. JOURNAL BOOK — Libro Diario ────────────────────────────
  async getJournalBook(companyId: string, filter: ReportFilterDto) {
    const { startDate, endDate, period } = await this.resolveDates(companyId, filter);

    const entries = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        isReversed: false,
        entryDate: { gte: startDate, lte: endDate },
      },
      orderBy: [{ entryDate: 'asc' }, { entryNumber: 'asc' }],
      include: {
        lines: {
          include: {
            account: { select: { code: true, name: true, type: true } },
          },
          orderBy: { debit: 'desc' },
        },
        createdBy: { select: { name: true } },
      },
    });

    const totalDebit  = entries.reduce((s, e) =>
      s.plus(e.lines.reduce((ls, l) => ls.plus(new Decimal(l.debit.toString())), new Decimal(0))),
      new Decimal(0));

    const totalCredit = entries.reduce((s, e) =>
      s.plus(e.lines.reduce((ls, l) => ls.plus(new Decimal(l.credit.toString())), new Decimal(0))),
      new Decimal(0));

    return {
      reportType:  'JOURNAL_BOOK',
      company:     await this.getCompanyInfo(companyId),
      period:      period ?? { startDate, endDate },
      generatedAt: new Date(),
      entries,
      totals: {
        entryCount:  entries.length,
        totalDebit:  totalDebit.toFixed(2),
        totalCredit: totalCredit.toFixed(2),
      },
    };
  }

  // ── 5. T-ACCOUNTS — Cuentas en T ─────────────────────────────
  async getTAccounts(
    companyId: string,
    filters?: {
      periodId?:   string;
      startDate?:  string;
      endDate?:    string;
      accountIds?: string[];
      type?:       'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
    },
  ) {
    // Resolve date range
    let startDate: Date;
    let endDate:   Date;

    if (filters?.periodId) {
      const period = await this.prisma.accountingPeriod.findFirst({
        where: { id: filters.periodId, companyId },
      });
      if (!period) throw new NotFoundException('Período no encontrado');
      startDate = period.startDate;
      endDate   = period.endDate;
    } else {
      startDate = filters?.startDate ? new Date(filters.startDate) : new Date('2000-01-01');
      endDate   = filters?.endDate   ? new Date(filters.endDate)   : new Date();
    }

    // Fetch matching accounts
    const accounts = await this.prisma.account.findMany({
      where: {
        companyId,
        isActive: true,
        isHeader: false,
        ...(filters?.type       && { type: filters.type as any }),
        ...(filters?.accountIds && filters.accountIds.length > 0
          ? { id: { in: filters.accountIds } }
          : {}),
      },
      orderBy: { code: 'asc' },
    });

    const result = await Promise.all(
      accounts.map(async account => {
        // Fetch all journal lines for this account within the date range
        const lines = await this.prisma.journalLine.findMany({
          where: {
            accountId: account.id,
            companyId,
            entry: {
              isReversed: false,
              status:     'CONFIRMED',  // excluye PENDING/REJECTED
              entryDate:  { gte: startDate, lte: endDate },
            },
          },
          include: {
            entry: {
              select: {
                entryNumber: true,
                description: true,
                entryDate:   true,
              },
            },
          },
          orderBy: { entry: { entryDate: 'asc' } },
        });

        const debitEntries = lines
          .filter(l => new Decimal(l.debit.toString()).greaterThan(0))
          .map(l => ({
            date:        l.entry.entryDate.toISOString().split('T')[0],
            description: l.entry.description,
            amount:      Number(new Decimal(l.debit.toString()).toFixed(2)),
            entryNumber: String(l.entry.entryNumber),
          }));

        const creditEntries = lines
          .filter(l => new Decimal(l.credit.toString()).greaterThan(0))
          .map(l => ({
            date:        l.entry.entryDate.toISOString().split('T')[0],
            description: l.entry.description,
            amount:      Number(new Decimal(l.credit.toString()).toFixed(2)),
            entryNumber: String(l.entry.entryNumber),
          }));

        const totalDebit  = debitEntries.reduce((s, e) => s.plus(new Decimal(e.amount.toString())), new Decimal(0));
        const totalCredit = creditEntries.reduce((s, e) => s.plus(new Decimal(e.amount.toString())), new Decimal(0));

        const balance = account.normalBalance === 'DEBIT'
          ? Number(totalDebit.minus(totalCredit).toFixed(2))
          : Number(totalCredit.minus(totalDebit).toFixed(2));

        return {
          account: {
            id:            account.id,
            code:          account.code,
            name:          account.name,
            type:          account.type,
            normalBalance: account.normalBalance,
          },
          leftSide: {    // DEBIT side
            entries: debitEntries,
            total:   Number(totalDebit.toFixed(2)),
          },
          rightSide: {   // CREDIT side
            entries: creditEntries,
            total:   Number(totalCredit.toFixed(2)),
          },
          balance,
          normalBalance: account.normalBalance,
        };
      }),
    );

    // Only return accounts that have at least one movement
    return result.filter(
      r => r.leftSide.entries.length > 0 || r.rightSide.entries.length > 0,
    );
  }

  // ── Helper — get company info for report header ───────────────
  private async getCompanyInfo(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where:  { id: companyId },
      select: { id: true, name: true, legalId: true, email: true },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    return company;
  }
}
