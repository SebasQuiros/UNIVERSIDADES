import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { LedgerFilterDto } from './dto/ledger.dto';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Ledger summary — all accounts with movements ─────────────
  async getLedger(companyId: string, filter: LedgerFilterDto) {
    const startDate = filter.startDate ? new Date(filter.startDate) : undefined;
    const endDate   = filter.endDate   ? new Date(filter.endDate)   : undefined;

    // Build date filter for journal_entries
    const entryDateFilter = {
      ...(startDate && { gte: startDate }),
      ...(endDate   && { lte: endDate   }),
    };
    const hasDateFilter = startDate || endDate;

    // Use INNER JOIN: only accounts that have actual movements
    // companyId is denormalized in journal_lines — no join needed for filtering
    const lines = await this.prisma.journalLine.groupBy({
      by:    ['accountId'],
      where: {
        companyId,
        // Solo entradas CONFIRMED + no reversadas afectan el libro mayor.
        // PENDING (HYBRID sin confirmar) y REJECTED quedan excluidos.
        entry: {
          isReversed: false,
          status:     'CONFIRMED',
          ...(hasDateFilter && { entryDate: entryDateFilter }),
        },
      },
      _sum: { debit: true, credit: true },
    });

    if (lines.length === 0) return [];

    // Fetch account details for each account with movements
    const accountIds = lines.map(l => l.accountId);
    const accounts   = await this.prisma.account.findMany({
      where:   { id: { in: accountIds } },
      orderBy: { code: 'asc' },
    });

    const accountMap = new Map(accounts.map(a => [a.id, a]));

    return lines
      .map(line => {
        const account    = accountMap.get(line.accountId);
        if (!account) return null;

        const totalDebit  = new Decimal((line._sum.debit  ?? 0).toString());
        const totalCredit = new Decimal((line._sum.credit ?? 0).toString());

        // Balance depends on the account's normal balance
        const balance = account.normalBalance === 'DEBIT'
          ? totalDebit.minus(totalCredit)
          : totalCredit.minus(totalDebit);

        return {
          accountId:     account.id,
          code:          account.code,
          name:          account.name,
          type:          account.type,
          normalBalance: account.normalBalance,
          totalDebit:    totalDebit.toFixed(2),
          totalCredit:   totalCredit.toFixed(2),
          balance:       balance.toFixed(2),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.code.localeCompare(b!.code));
  }

  // ── Account ledger (kardex) — all movements for one account ──
  async getAccountLedger(companyId: string, accountId: string, filter: LedgerFilterDto) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, companyId },
    });
    if (!account) throw new NotFoundException('Cuenta no encontrada');

    const startDate = filter.startDate ? new Date(filter.startDate) : undefined;
    const endDate   = filter.endDate   ? new Date(filter.endDate)   : undefined;

    // INNER JOIN journal_lines → journal_entries (no LEFT JOIN — no orphans)
    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId,
        companyId,
        entry: {
          isReversed: false,
          status:     'CONFIRMED',  // excluye PENDING/REJECTED
          ...(startDate || endDate ? {
            entryDate: {
              ...(startDate && { gte: startDate }),
              ...(endDate   && { lte: endDate   }),
            },
          } : {}),
        },
      },
      include: {
        entry: {
          select: {
            entryNumber: true,
            description: true,
            entryDate:   true,
            source:      true,
            reference:   true,
          },
        },
      },
      orderBy: [
        { entry: { entryDate: 'asc' } },
        { entry: { entryNumber: 'asc' } },
      ],
    });

    // Calculate running balance
    let runningBalance = new Decimal(0);
    const movements = lines.map(line => {
      const debit  = new Decimal(line.debit.toString());
      const credit = new Decimal(line.credit.toString());

      if (account.normalBalance === 'DEBIT') {
        runningBalance = runningBalance.plus(debit).minus(credit);
      } else {
        runningBalance = runningBalance.plus(credit).minus(debit);
      }

      return {
        entryNumber:  line.entry.entryNumber,
        entryDate:    line.entry.entryDate,
        description:  line.description || line.entry.description,
        reference:    line.entry.reference,
        source:       line.entry.source,
        debit:        debit.toFixed(2),
        credit:       credit.toFixed(2),
        balance:      runningBalance.toFixed(2),
      };
    });

    const totalDebit  = lines.reduce((s, l) => s.plus(new Decimal(l.debit.toString())),  new Decimal(0));
    const totalCredit = lines.reduce((s, l) => s.plus(new Decimal(l.credit.toString())), new Decimal(0));

    return {
      account: {
        id:            account.id,
        code:          account.code,
        name:          account.name,
        type:          account.type,
        normalBalance: account.normalBalance,
      },
      movements,
      totals: {
        debit:   totalDebit.toFixed(2),
        credit:  totalCredit.toFixed(2),
        balance: account.normalBalance === 'DEBIT'
          ? totalDebit.minus(totalCredit).toFixed(2)
          : totalCredit.minus(totalDebit).toFixed(2),
      },
    };
  }
}
