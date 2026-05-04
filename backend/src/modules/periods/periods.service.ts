import {
  Injectable, BadRequestException, Logger,
  NotFoundException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalSource, Prisma, PeriodStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CreatePeriodDto, ClosePeriodDto } from './dto/periods.dto';

@Injectable()
export class PeriodsService {
  private readonly logger = new Logger(PeriodsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── List all periods for a company ───────────────────────────
  async findAll(companyId: string) {
    return this.prisma.accountingPeriod.findMany({
      where:   { companyId },
      orderBy: { startDate: 'desc' },
    });
  }

  // ── Get active (OPEN) period ──────────────────────────────────
  async findActive(companyId: string) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where:   { companyId, status: PeriodStatus.OPEN },
      orderBy: { startDate: 'asc' },
    });
    if (!period) {
      throw new NotFoundException(
        'No existe un período contable abierto para esta empresa.',
      );
    }
    return period;
  }

  // ── Create a new period ───────────────────────────────────────
  async create(companyId: string, dto: CreatePeriodDto, userId: string) {
    const start = new Date(dto.startDate);
    const end   = new Date(dto.endDate);

    if (start >= end) {
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior a la fecha de cierre.',
      );
    }

    // Check for overlapping OPEN periods
    const overlap = await this.prisma.accountingPeriod.findFirst({
      where: {
        companyId,
        status: PeriodStatus.OPEN,
        OR: [
          { startDate: { lte: end },   endDate: { gte: start } },
        ],
      },
    });

    if (overlap) {
      throw new ConflictException(
        `Las fechas se solapan con el período abierto "${overlap.name}" ` +
        `(${overlap.startDate.toLocaleDateString('es-CR')} — ${overlap.endDate.toLocaleDateString('es-CR')}).`,
      );
    }

    const period = await this.prisma.accountingPeriod.create({
      data: {
        companyId,
        name:      dto.name,
        type:      dto.type,
        startDate: start,
        endDate:   end,
        status:    PeriodStatus.OPEN,
        notes:     dto.notes,
      },
    });

    // Initialize journal_sequences if not present
    await this.prisma.journalSequence.upsert({
      where:  { companyId },
      update: {},
      create: { companyId, lastNumber: 0 },
    });

    return period;
  }

  // ── Close a period ────────────────────────────────────────────
  async close(companyId: string, periodId: string, dto: ClosePeriodDto, userId: string) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: periodId, companyId },
    });

    if (!period) {
      throw new NotFoundException('Período contable no encontrado.');
    }

    if (period.status === PeriodStatus.CLOSED) {
      throw new BadRequestException('El período ya está cerrado.');
    }

    if (period.status === PeriodStatus.LOCKED) {
      throw new BadRequestException('El período está bloqueado y no puede modificarse.');
    }

    // Run everything inside a single transaction so closing entries and
    // status update are atomic — either all succeed or all roll back.
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {

      // ── Guard: skip if closing entries already exist ─────────
      const alreadyHasClosingEntries = await tx.journalEntry.findFirst({
        where: { companyId, source: JournalSource.PERIOD_CLOSING },
        select: { id: true },
      });

      let closingEntryIds: string[] = [];

      if (!alreadyHasClosingEntries) {
        closingEntryIds = await this._generateClosingEntries(
          tx, companyId, period, userId,
        );
      } else {
        this.logger.warn(
          `Period ${periodId}: closing entries already exist — skipping generation.`,
        );
      }

      // ── Update period status AFTER entries are created ───────
      const closed = await tx.accountingPeriod.update({
        where: { id: periodId },
        data: {
          status:   PeriodStatus.CLOSED,
          closedAt: new Date(),
          closedBy: userId,
          notes:    dto.notes ?? period.notes,
        },
      });

      return {
        ...closed,
        closingEntryIds,
      };
    });
  }

  // ── Private helper: build and persist the 2 closing entries ──
  private async _generateClosingEntries(
    tx: Prisma.TransactionClient,
    companyId: string,
    period: { id: string; startDate: Date; endDate: Date; name: string },
    userId: string,
  ): Promise<string[]> {

    // ── 1. Aggregate INCOME accounts for this period ───────────
    const incomeLines = await tx.journalLine.groupBy({
      by:    ['accountId'],
      where: {
        companyId,
        entry: {
          companyId,
          entryDate:  { gte: period.startDate, lte: period.endDate },
          isReversed: false,
          status:     'CONFIRMED',
          source:     { not: JournalSource.PERIOD_CLOSING },
        },
        account: { type: 'INCOME', isHeader: false },
      },
      _sum: { debit: true, credit: true },
    });

    // ── 2. Aggregate EXPENSE accounts for this period ──────────
    const expenseLines = await tx.journalLine.groupBy({
      by:    ['accountId'],
      where: {
        companyId,
        entry: {
          companyId,
          entryDate:  { gte: period.startDate, lte: period.endDate },
          isReversed: false,
          status:     'CONFIRMED',
          source:     { not: JournalSource.PERIOD_CLOSING },
        },
        account: { type: 'EXPENSE', isHeader: false },
      },
      _sum: { debit: true, credit: true },
    });

    // ── No transactions at all — skip closing entries ──────────
    if (incomeLines.length === 0 && expenseLines.length === 0) {
      this.logger.log(
        `Period "${period.name}": no income/expense movements found — closing without entries.`,
      );
      return [];
    }

    // ── 3. Resolve the two special equity accounts ─────────────
    const [utilidadAccount, retenidaAccount] = await Promise.all([
      tx.account.findFirst({
        where: { companyId, code: '3.2.02.01', isActive: true },
      }),
      tx.account.findFirst({
        where: { companyId, code: '3.2.01.01', isActive: true },
      }),
    ]);

    if (!utilidadAccount || !retenidaAccount) {
      this.logger.warn(
        `Period "${period.name}": special accounts 3.2.02.01 or 3.2.01.01 not found — ` +
        `closing without automated closing entries.`,
      );
      return [];
    }

    // ── 4. Calculate net balances using Decimal.js ─────────────

    // INCOME net balance = credits − debits (normal balance is CREDIT)
    // A positive value means the account has a credit (income) balance.
    let totalIncome  = new Decimal(0);
    const incomeAccountLines: Array<{ accountId: string; netBalance: Decimal }> = [];

    for (const row of incomeLines) {
      const d = new Decimal((row._sum.debit  ?? 0).toString());
      const c = new Decimal((row._sum.credit ?? 0).toString());
      const net = c.minus(d); // net credit balance
      if (!net.isZero()) {
        incomeAccountLines.push({ accountId: row.accountId, netBalance: net });
        totalIncome = totalIncome.plus(net);
      }
    }

    // EXPENSE net balance = debits − credits (normal balance is DEBIT)
    // A positive value means the account has a debit (expense) balance.
    let totalExpenses = new Decimal(0);
    const expenseAccountLines: Array<{ accountId: string; netBalance: Decimal }> = [];

    for (const row of expenseLines) {
      const d = new Decimal((row._sum.debit  ?? 0).toString());
      const c = new Decimal((row._sum.credit ?? 0).toString());
      const net = d.minus(c); // net debit balance
      if (!net.isZero()) {
        expenseAccountLines.push({ accountId: row.accountId, netBalance: net });
        totalExpenses = totalExpenses.plus(net);
      }
    }

    // After filtering zeros, check again
    if (incomeAccountLines.length === 0 && expenseAccountLines.length === 0) {
      this.logger.log(
        `Period "${period.name}": all income/expense balances are zero — closing without entries.`,
      );
      return [];
    }

    const netResult = totalIncome.minus(totalExpenses); // positive = net income, negative = net loss
    const createdEntryIds: string[] = [];
    const entryDate = period.endDate;

    // ══════════════════════════════════════════════════════════════
    // ENTRY 1 — Close income and expenses to 3.2.02.01
    // ══════════════════════════════════════════════════════════════
    //
    // totalDebits  = totalIncome  (income accounts debited to zero) + utilidad_debit
    // totalCredits = totalExpenses (expense accounts credited to zero) + utilidad_credit
    //
    // Balance constraint: totalIncome + utilidad_debit = totalExpenses + utilidad_credit
    //
    // Case A — net income (totalIncome > totalExpenses):
    //   utilidad_debit = 0, utilidad_credit = totalIncome − totalExpenses
    //
    // Case B — net loss (totalExpenses > totalIncome):
    //   utilidad_credit = 0, utilidad_debit = totalExpenses − totalIncome
    //
    // Case C — break-even: no utilidad line needed.

    const entry1LinesFinal: Array<{
      accountId: string;
      debit:     Decimal;
      credit:    Decimal;
      description?: string;
    }> = [];

    for (const { accountId, netBalance } of incomeAccountLines) {
      entry1LinesFinal.push({
        accountId,
        debit:  netBalance,
        credit: new Decimal(0),
        description: 'Cierre de período — ingreso',
      });
    }

    for (const { accountId, netBalance } of expenseAccountLines) {
      entry1LinesFinal.push({
        accountId,
        debit:  new Decimal(0),
        credit: netBalance,
        description: 'Cierre de período — gasto',
      });
    }

    const absNetResult = netResult.abs();

    if (!absNetResult.isZero()) {
      if (netResult.greaterThan(0)) {
        // Net income: utilidad gets credit
        entry1LinesFinal.push({
          accountId:   utilidadAccount.id,
          debit:       new Decimal(0),
          credit:      absNetResult,
          description: 'Cierre de período — utilidad del período',
        });
      } else {
        // Net loss: utilidad gets debit
        entry1LinesFinal.push({
          accountId:   utilidadAccount.id,
          debit:       absNetResult,
          credit:      new Decimal(0),
          description: 'Cierre de período — pérdida del período',
        });
      }
    }
    // Break-even: no utilidad line needed — totalIncome debits = totalExpenses credits already balance

    if (entry1LinesFinal.length >= 2) {
      const entry1Id = await this._createClosingJournalEntry(
        tx, companyId, userId, entryDate,
        `Cierre del período "${period.name}" — Traslado a Utilidad/Pérdida del Período`,
        entry1LinesFinal,
      );
      createdEntryIds.push(entry1Id);
    }

    // ══════════════════════════════════════════════════════════════
    // ENTRY 2 — Transfer net result from 3.2.02.01 to 3.2.01.01
    // Only needed when there is a non-zero net result
    // ══════════════════════════════════════════════════════════════

    if (!absNetResult.isZero()) {
      const entry2Lines: Array<{
        accountId: string;
        debit:     Decimal;
        credit:    Decimal;
        description?: string;
      }> = [];

      if (netResult.greaterThan(0)) {
        // Net income → transfer credit from 3.2.02.01 to 3.2.01.01
        entry2Lines.push({
          accountId:   utilidadAccount.id,
          debit:       absNetResult,
          credit:      new Decimal(0),
          description: 'Cierre de período — traslado utilidad a retenidas',
        });
        entry2Lines.push({
          accountId:   retenidaAccount.id,
          debit:       new Decimal(0),
          credit:      absNetResult,
          description: 'Cierre de período — traslado utilidad a retenidas',
        });
      } else {
        // Net loss → transfer debit from 3.2.02.01 to 3.2.01.01
        entry2Lines.push({
          accountId:   retenidaAccount.id,
          debit:       absNetResult,
          credit:      new Decimal(0),
          description: 'Cierre de período — traslado pérdida a retenidas',
        });
        entry2Lines.push({
          accountId:   utilidadAccount.id,
          debit:       new Decimal(0),
          credit:      absNetResult,
          description: 'Cierre de período — traslado pérdida a retenidas',
        });
      }

      const entry2Id = await this._createClosingJournalEntry(
        tx, companyId, userId, entryDate,
        `Cierre del período "${period.name}" — Traslado a Utilidades Retenidas`,
        entry2Lines,
      );
      createdEntryIds.push(entry2Id);
    }

    this.logger.log(
      `Period "${period.name}" closed. ` +
      `Income: ${totalIncome.toFixed(2)}, Expenses: ${totalExpenses.toFixed(2)}, ` +
      `Net: ${netResult.toFixed(2)}. Entries created: ${createdEntryIds.join(', ')}`,
    );

    return createdEntryIds;
  }

  // ── Private helper: persist one closing journal entry ─────────
  private async _createClosingJournalEntry(
    tx: Prisma.TransactionClient,
    companyId: string,
    userId: string,
    entryDate: Date,
    description: string,
    lines: Array<{ accountId: string; debit: Decimal; credit: Decimal; description?: string }>,
  ): Promise<string> {

    // Validate balance
    const sumDebit  = lines.reduce((s, l) => s.plus(l.debit),  new Decimal(0));
    const sumCredit = lines.reduce((s, l) => s.plus(l.credit), new Decimal(0));
    const diff      = sumDebit.minus(sumCredit).abs();
    if (diff.greaterThan(new Decimal('0.001'))) {
      throw new Error(
        `Closing entry unbalanced: D=${sumDebit.toFixed(2)} C=${sumCredit.toFixed(2)} diff=${diff.toFixed(2)}`,
      );
    }

    // Get next sequence number atomically
    await tx.$executeRaw`
      INSERT INTO journal_sequences (company_id, last_number)
      VALUES (${companyId}::uuid, 1)
      ON CONFLICT (company_id) DO UPDATE SET last_number = journal_sequences.last_number + 1
    `;
    const seqResult = await tx.$queryRaw<[{ last_number: number }]>`
      SELECT last_number FROM journal_sequences WHERE company_id = ${companyId}::uuid
    `;
    const entryNumber = Number(seqResult[0].last_number);

    // Create journal entry
    const entry = await tx.journalEntry.create({
      data: {
        companyId,
        entryNumber,
        description,
        entryDate,
        source:      JournalSource.PERIOD_CLOSING,
        isReversed:  false,
        createdById: userId,
      },
    });

    // Create journal lines
    await tx.journalLine.createMany({
      data: lines.map(line => ({
        entryId:     entry.id,
        accountId:   line.accountId,
        companyId,
        debit:       line.debit,
        credit:      line.credit,
        description: line.description ?? null,
      })),
    });

    return entry.id;
  }

  // ── Internal — validate period is open for a given date ───────
  async validatePeriodOpen(companyId: string, entryDate: Date): Promise<void> {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        companyId,
        startDate: { lte: entryDate },
        endDate:   { gte: entryDate },
      },
    });

    if (!period) {
      throw new BadRequestException(
        `No existe un período contable que cubra la fecha ${entryDate.toLocaleDateString('es-CR')}. ` +
        `Cree un período contable antes de registrar asientos.`,
      );
    }

    if (period.status === PeriodStatus.CLOSED) {
      throw new BadRequestException(
        `El período contable "${period.name}" está cerrado. ` +
        `No se pueden registrar movimientos en períodos cerrados.`,
      );
    }

    if (period.status === PeriodStatus.LOCKED) {
      throw new BadRequestException(
        `El período contable "${period.name}" está bloqueado. ` +
        `Contacta al administrador para desbloquearlo.`,
      );
    }

    // period.status === OPEN → OK
  }
}
