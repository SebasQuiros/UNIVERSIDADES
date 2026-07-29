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
    // asOfDate (I-DV-2) fija el corte superior; tiene prioridad sobre endDate.
    const endDate   = filter.asOfDate ? new Date(filter.asOfDate)
                    : filter.endDate  ? new Date(filter.endDate)
                    : undefined;

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
    const endDate   = filter.asOfDate ? new Date(filter.asOfDate)
                    : filter.endDate  ? new Date(filter.endDate)
                    : undefined;

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

    // Saldo anterior: cuando se filtra desde una fecha, el mayor de ese período
    // NO empieza en cero — arrastra lo acumulado antes del corte. Sin esto el
    // saldo corriente queda mal y el mayor deja de cuadrar contra el balance
    // de comprobación.
    let openingBalance = new Decimal(0);
    if (startDate) {
      const prev = await this.prisma.journalLine.aggregate({
        where: {
          accountId,
          companyId,
          entry: {
            isReversed: false,
            status:     'CONFIRMED',
            entryDate:  { lt: startDate },
          },
        },
        _sum: { debit: true, credit: true },
      });
      const pd = new Decimal((prev._sum.debit  ?? 0).toString());
      const pc = new Decimal((prev._sum.credit ?? 0).toString());
      openingBalance = account.normalBalance === 'DEBIT' ? pd.minus(pc) : pc.minus(pd);
    }

    // Calculate running balance
    let runningBalance = openingBalance;
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
      openingBalance: openingBalance.toFixed(2),
      totals: {
        debit:   totalDebit.toFixed(2),
        credit:  totalCredit.toFixed(2),
        // Saldo final del período = saldo anterior + movimiento del período.
        balance: openingBalance.plus(
          account.normalBalance === 'DEBIT'
            ? totalDebit.minus(totalCredit)
            : totalCredit.minus(totalDebit),
        ).toFixed(2),
      },
    };
  }

  /**
   * Cuentas T (mayorización): para CADA cuenta con movimientos devuelve sus
   * cargos (débitos) y abonos (créditos) individuales, listos para pintar la
   * "T" clásica (débitos a la izquierda, créditos a la derecha). Una sola
   * consulta agrupada en memoria (no N+1).
   */
  async getTAccounts(companyId: string) {
    const lines = await this.prisma.journalLine.findMany({
      where: {
        companyId,
        entry: { isReversed: false, status: 'CONFIRMED' },
      },
      include: {
        account: { select: { id: true, code: true, name: true, type: true, normalBalance: true } },
        entry:   { select: { entryNumber: true, entryDate: true, description: true, reference: true } },
      },
      orderBy: [
        { account: { code: 'asc' } },
        { entry: { entryDate: 'asc' } },
        { entry: { entryNumber: 'asc' } },
      ],
    });

    const byAccount = new Map<string, any>();
    for (const l of lines) {
      const a = l.account;
      let acc = byAccount.get(a.id);
      if (!acc) {
        acc = {
          id: a.id, code: a.code, name: a.name, type: a.type, normalBalance: a.normalBalance,
          debits:  [] as any[],  // cargos (izquierda)
          credits: [] as any[],  // abonos (derecha)
          _td: new Decimal(0), _tc: new Decimal(0),
        };
        byAccount.set(a.id, acc);
      }
      const debit  = new Decimal(l.debit.toString());
      const credit = new Decimal(l.credit.toString());
      const mv = {
        entryNumber: l.entry.entryNumber,
        entryDate:   l.entry.entryDate,
        description: l.description || l.entry.description,
        reference:   l.entry.reference,
      };
      if (debit.greaterThan(0))  { acc.debits.push({ ...mv,  amount: debit.toFixed(2)  }); acc._td = acc._td.plus(debit); }
      if (credit.greaterThan(0)) { acc.credits.push({ ...mv, amount: credit.toFixed(2) }); acc._tc = acc._tc.plus(credit); }
    }

    return Array.from(byAccount.values()).map((acc) => {
      const balance = acc.normalBalance === 'DEBIT'
        ? acc._td.minus(acc._tc) : acc._tc.minus(acc._td);
      return {
        id: acc.id, code: acc.code, name: acc.name, type: acc.type, normalBalance: acc.normalBalance,
        debits: acc.debits, credits: acc.credits,
        totalDebit:  acc._td.toFixed(2),
        totalCredit: acc._tc.toFixed(2),
        balance:     balance.toFixed(2),
        balanceSide: balance.greaterThanOrEqualTo(0) ? acc.normalBalance : (acc.normalBalance === 'DEBIT' ? 'CREDIT' : 'DEBIT'),
      };
    });
  }
}
