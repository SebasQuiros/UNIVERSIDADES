import {
  Injectable, BadRequestException,
  NotFoundException, ForbiddenException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PeriodsService } from '../periods/periods.service';
import { JournalSource, JournalEntryStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  CreateJournalEntryDto,
  ReverseJournalEntryDto,
  JournalFilterDto,
} from './dto/journal.dto';

@Injectable()
export class JournalService {
  private readonly logger = new Logger(JournalService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly periods: PeriodsService,
  ) {}

  // ── List journal entries ──────────────────────────────────────
  async findAll(companyId: string, filter: JournalFilterDto) {
    const page  = filter.page  ?? 1;
    const limit = filter.limit ?? 50;
    const skip  = (page - 1) * limit;

    const where: Prisma.JournalEntryWhereInput = {
      companyId,
      ...(filter.startDate && { entryDate: { gte: new Date(filter.startDate) } }),
      ...(filter.endDate   && { entryDate: { lte: new Date(filter.endDate) } }),
      ...(filter.search    && {
        description: { contains: filter.search, mode: 'insensitive' },
      }),
    };

    const [entries, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        orderBy: [{ entryDate: 'desc' }, { entryNumber: 'desc' }],
        skip,
        take: limit,
        include: {
          lines: {
            include: {
              account: { select: { code: true, name: true, type: true } },
            },
          },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return { entries, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ── Get one entry with lines ──────────────────────────────────
  async findOne(companyId: string, entryId: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id: entryId, companyId },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true, type: true, normalBalance: true } },
          },
          orderBy: { debit: 'desc' },
        },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!entry) throw new NotFoundException('Asiento contable no encontrado');
    return entry;
  }

  // ── CREATE ENTRY — the full 7-step flow ───────────────────────
  async createEntry(
    companyId: string,
    dto: CreateJournalEntryDto,
    userId: string,
    source: JournalSource = JournalSource.MANUAL,
    invoiceId?: string,
    paymentId?: string,
  ) {
    const entryDate = new Date(dto.entryDate);

    // ══ STEP 1 — Validate period is OPEN (BEFORE transaction) ═══
    await this.periods.validatePeriodOpen(companyId, entryDate);

    // ══ STEP 2 — Validate lines (BEFORE transaction) ════════════

    // 2a. Minimum 2 lines
    if (dto.lines.length < 2) {
      throw new BadRequestException('Un asiento contable requiere al menos 2 líneas.');
    }

    // 2b. No duplicate accounts in the same entry
    const accountIds = dto.lines.map(l => l.accountId);
    const uniqueIds  = new Set(accountIds);
    if (uniqueIds.size < accountIds.length) {
      const dup = accountIds.find((id, i) => accountIds.indexOf(id) !== i);
      const acct = await this.prisma.account.findUnique({
        where: { id: dup },
        select: { code: true, name: true },
      });
      throw new BadRequestException(
        `La cuenta "${acct?.code} — ${acct?.name}" aparece más de una vez en el asiento. ` +
        `Cada cuenta debe aparecer solo una vez.`,
      );
    }

    // 2c. Validate each account: must be level 4, active, belong to company
    for (const line of dto.lines) {
      const account = await this.prisma.account.findFirst({
        where: { id: line.accountId, companyId },
      });

      if (!account) {
        throw new BadRequestException(`Cuenta ${line.accountId} no encontrada en esta empresa.`);
      }
      if (account.level !== 4) {
        throw new BadRequestException(
          `La cuenta "${account.code} — ${account.name}" es de nivel ${account.level}. ` +
          `Solo las subcuentas de nivel 4 pueden recibir movimientos.`,
        );
      }
      if (account.isHeader) {
        throw new BadRequestException(
          `La cuenta "${account.name}" es una cuenta de cabecera y no acepta movimientos.`,
        );
      }
      if (!account.isActive) {
        throw new BadRequestException(`La cuenta "${account.name}" está inactiva.`);
      }

      // 2d. Each line must have debit OR credit, not both, not neither
      const d = new Decimal(line.debit.toString());
      const c = new Decimal(line.credit.toString());
      if (d.greaterThan(0) && c.greaterThan(0)) {
        throw new BadRequestException(
          `La línea de la cuenta "${account.code}" tiene débito y crédito simultáneamente. ` +
          `Solo se permite uno de los dos.`,
        );
      }
      if (d.equals(0) && c.equals(0)) {
        throw new BadRequestException(
          `La línea de la cuenta "${account.code}" tiene monto cero. Elimínela del asiento.`,
        );
      }
    }

    // 2e. Pre-validate balance with Decimal.js (fail fast before transaction)
    const sumDebit  = dto.lines.reduce((acc, l) => acc.plus(new Decimal(l.debit.toString())),  new Decimal(0));
    const sumCredit = dto.lines.reduce((acc, l) => acc.plus(new Decimal(l.credit.toString())), new Decimal(0));
    const diff      = sumDebit.minus(sumCredit).abs();

    if (diff.greaterThan(new Decimal('0.001'))) {
      throw new BadRequestException(
        `El asiento no está balanceado. ` +
        `Débitos: ₡${sumDebit.toFixed(2)} | Créditos: ₡${sumCredit.toFixed(2)} | ` +
        `Diferencia: ₡${diff.toFixed(2)}`,
      );
    }

    // ══ STEPS 3-7 — Atomic transaction ══════════════════════════
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {

      // Step 3a — Re-validate period inside transaction (close the time window)
      const period = await tx.accountingPeriod.findFirst({
        where: {
          companyId,
          startDate: { lte: entryDate },
          endDate:   { gte: entryDate },
        },
      });
      if (!period || period.status !== 'OPEN') {
        throw new BadRequestException(
          'El período contable fue cerrado mientras se procesaba la solicitud.',
        );
      }

      // Step 3b — Generate atomic consecutive entry number
      const sequence = await tx.$executeRaw`
        UPDATE journal_sequences
        SET last_number = last_number + 1
        WHERE company_id = ${companyId}::uuid
      `;
      if (sequence === 0) {
        // Sequence row not found — create it and retry
        await tx.$executeRaw`
          INSERT INTO journal_sequences (company_id, last_number)
          VALUES (${companyId}::uuid, 1)
          ON CONFLICT (company_id) DO UPDATE SET last_number = journal_sequences.last_number + 1
        `;
      }

      const seqResult = await tx.$queryRaw<[{ last_number: number }]>`
        SELECT last_number FROM journal_sequences WHERE company_id = ${companyId}::uuid
      `;
      const entryNumber = Number(seqResult[0].last_number);

      // Step 4 — Create JournalEntry
      const entry = await tx.journalEntry.create({
        data: {
          companyId,
          entryNumber,
          description: dto.description,
          entryDate,
          reference:   dto.reference ?? null,
          source,
          invoiceId:   invoiceId ?? null,
          paymentId:   paymentId ?? null,
          isReversed:  false,
          createdById: userId,
        },
      });

      // Step 5 — Create JournalLines (with companyId denormalized)
      await tx.journalLine.createMany({
        data: dto.lines.map(line => ({
          entryId:     entry.id,
          accountId:   line.accountId,
          companyId,                          // denormalized for fast ledger queries
          debit:       new Decimal(line.debit.toString()),
          credit:      new Decimal(line.credit.toString()),
          description: line.description ?? null,
        })),
      });

      // Step 6 — Verify balance INSIDE transaction (final safety check)
      const saved = await tx.journalLine.aggregate({
        where: { entryId: entry.id },
        _sum:  { debit: true, credit: true },
      });

      const savedDebit  = new Decimal((saved._sum.debit  ?? 0).toString());
      const savedCredit = new Decimal((saved._sum.credit ?? 0).toString());
      const savedDiff   = savedDebit.minus(savedCredit).abs();

      if (savedDiff.greaterThan(new Decimal('0.001'))) {
        // This should never happen if step 2e passed — but if it does, rollback
        throw new Error(
          `Fallo de integridad contable. El asiento no fue grabado. ` +
          `D=${savedDebit} C=${savedCredit}`,
        );
      }

      // Step 7 — COMMIT (implicit at end of transaction callback)
      return tx.journalEntry.findUnique({
        where: { id: entry.id },
        include: {
          lines: {
            include: {
              account: { select: { code: true, name: true } },
            },
          },
        },
      });
    });
  }

  // ── REVERSE ENTRY — creates inverse entry, marks original ────
  async reverseEntry(
    companyId: string,
    entryId: string,
    dto: ReverseJournalEntryDto,
    userId: string,
  ) {
    const original = await this.prisma.journalEntry.findFirst({
      where:   { id: entryId, companyId },
      include: { lines: true },
    });

    if (!original) throw new NotFoundException('Asiento contable no encontrado');

    if (original.isReversed) {
      throw new BadRequestException(
        `El asiento #${original.entryNumber} ya fue revertido anteriormente.`,
      );
    }

    if (original.source === JournalSource.REVERSAL) {
      throw new BadRequestException(
        'No se puede revertir un asiento que ya es una reversa.',
      );
    }

    const reverseDate = dto.reverseDate
      ? new Date(dto.reverseDate)
      : new Date(); // today if not specified

    // Validate the reverse date period is also open
    await this.periods.validatePeriodOpen(companyId, reverseDate);

    // Build reversed lines (swap debit ↔ credit)
    const reversedLines = original.lines.map(line => ({
      accountId:   line.accountId,
      debit:       Number(line.credit),  // swap
      credit:      Number(line.debit),   // swap
      description: line.description ?? undefined,
    }));

    const reverseEntry = await this.createEntry(
      companyId,
      {
        description: dto.reason
          ? `REVERSA: ${dto.reason} (Ref. asiento #${original.entryNumber} — ${original.description})`
          : `REVERSA del asiento #${original.entryNumber} — ${original.description}`,
        entryDate:   reverseDate.toISOString().split('T')[0],
        lines:       reversedLines,
      },
      userId,
      JournalSource.REVERSAL,
    );

    // Mark original as reversed
    await this.prisma.journalEntry.update({
      where: { id: entryId },
      data:  { isReversed: true, reversedById: (reverseEntry as any)?.id },
    });

    return {
      original:  { id: original.id, entryNumber: original.entryNumber },
      reversal:  reverseEntry,
      message:   `Asiento #${original.entryNumber} revertido correctamente.`,
    };
  }

  // ── Internal create — called by invoices/payments modules ────
  // ── Auto-entry called from InvoicesService with tx ──────────
  // tx is REQUIRED when called from within a transaction (invoices, payments)
  // This ensures the journal entry rolls back if the parent transaction fails
  async createAutoEntry(
    companyId: string,
    description: string,
    entryDate: Date,
    lines: Array<{ accountCode: string; debit: number; credit: number; description?: string }>,
    userId: string,
    source: JournalSource,
    tx: Prisma.TransactionClient,
    invoiceId?: string,
    paymentId?: string,
    /** Generic source link (extends invoiceId/paymentId for any business event). */
    sourceType?: string,
    sourceId?: string,
    /** HYBRID accounting mode: pre-generate entry but mark as pending confirmation. */
    isPending?: boolean,
  ) {
    try {
      // ── Idempotencia: si ya existe un asiento para esta misma fuente
      //    (sourceType, sourceId), NO creamos un duplicado. Devolvemos el
      //    existente. La unique constraint en BD es la red de seguridad
      //    final, esta verificación es la primera línea de defensa con un
      //    log claro para debug.
      if (sourceType && sourceId) {
        const existing = await tx.journalEntry.findFirst({
          where: { sourceType, sourceId },
        });
        if (existing) {
          this.logger.warn(
            `[dup-prevent] Asiento ya existe para ${sourceType}=${sourceId} ` +
            `(entry #${existing.entryNumber}). Skip creación.`,
          );
          return existing;
        }
      }

      // Fase 5 — fix N+1: antes era 1 findFirst por línea (10 líneas = 10 queries
      // serializadas). Ahora hacemos 1 findMany con `code: { in: [...] }`.
      const codes = Array.from(new Set(lines.map(l => l.accountCode)));
      const accounts = await tx.account.findMany({
        where:  { companyId, code: { in: codes } },
        select: { id: true, code: true, name: true, level: true },
      });
      const byCode = new Map(accounts.map(a => [a.code, a]));

      const resolvedLines = lines.map(line => {
        const account = byCode.get(line.accountCode);
        if (!account) {
          throw new BadRequestException(
            `No se pudo generar el asiento contable automático. ` +
            `La cuenta "${line.accountCode}" no existe en el plan de cuentas de esta empresa. ` +
            `Verifique que el plan de cuentas esté correctamente configurado.`,
          );
        }
        if (account.level !== 4) {
          throw new BadRequestException(
            `No se pudo generar el asiento contable automático. ` +
            `La cuenta "${line.accountCode} — ${account.name}" es de nivel ${account.level}. ` +
            `Solo subcuentas de nivel 4 pueden recibir movimientos.`,
          );
        }
        return {
          accountId:   account.id,
          debit:       line.debit,
          credit:      line.credit,
          description: line.description,
        };
      });

      // Validate balance before creating entry
      const sumDebit  = resolvedLines.reduce((s, l) => s.plus(new Decimal(l.debit.toString())),  new Decimal(0));
      const sumCredit = resolvedLines.reduce((s, l) => s.plus(new Decimal(l.credit.toString())), new Decimal(0));
      if (sumDebit.minus(sumCredit).abs().greaterThan(new Decimal('0.001'))) {
        throw new Error(
          `Asiento automático desbalanceado: D=${sumDebit.toFixed(2)} C=${sumCredit.toFixed(2)}`,
        );
      }

      // Get next entry number atomically
      await tx.$executeRaw`
        INSERT INTO journal_sequences (company_id, last_number)
        VALUES (${companyId}::uuid, 1)
        ON CONFLICT (company_id) DO UPDATE SET last_number = journal_sequences.last_number + 1
      `;
      const seqResult = await tx.$queryRaw<[{ last_number: number }]>`
        SELECT last_number FROM journal_sequences WHERE company_id = ${companyId}::uuid
      `;
      const entryNumber = Number(seqResult[0].last_number);

      // Validate period is open
      const period = await tx.accountingPeriod.findFirst({
        where: {
          companyId,
          startDate: { lte: entryDate },
          endDate:   { gte: entryDate },
          status:    'OPEN',
        },
      });
      if (!period) {
        throw new BadRequestException(
          `No se pudo generar el asiento contable. ` +
          `No existe un período contable abierto para la fecha ${entryDate.toLocaleDateString('es-CR')}.`,
        );
      }

      // Create entry using tx
      // status: PENDING si isPending=true (HYBRID mode), CONFIRMED si no.
      // Mantenemos ambos campos sincronizados (isPending == status==PENDING).
      const isPendingFlag = isPending ?? false;
      const entry = await tx.journalEntry.create({
        data: {
          companyId,
          entryNumber,
          description,
          entryDate,
          source,
          invoiceId:   invoiceId ?? null,
          paymentId:   paymentId ?? null,
          sourceType:  sourceType ?? null,
          sourceId:    sourceId   ?? null,
          isPending:   isPendingFlag,
          status:      isPendingFlag ? JournalEntryStatus.PENDING : JournalEntryStatus.CONFIRMED,
          isReversed:  false,
          createdById: userId,
        },
      });

      // Create lines using tx
      await tx.journalLine.createMany({
        data: resolvedLines.map(line => ({
          entryId:     entry.id,
          accountId:   line.accountId,
          companyId,
          debit:       new Decimal(line.debit.toString()),
          credit:      new Decimal(line.credit.toString()),
          description: line.description ?? null,
        })),
      });

      return entry;

    } catch (error) {
      // Re-throw with clear context if it is not already a HttpException
      if (error?.status) throw error;
      throw new Error(
        `No se pudo generar el asiento contable automático. ${error.message}`,
      );
    }
  }
}
