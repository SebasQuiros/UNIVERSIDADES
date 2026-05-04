import {
  Injectable, BadRequestException,
  NotFoundException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  CreateBankAccountDto,
  CreateBankTransactionDto,
  BankTransactionFilterDto,
} from './dto/bank-reconciliation.dto';
import * as ExcelJS from 'exceljs';

// ── Types ────────────────────────────────────────────────────────

export interface MatchSuggestion {
  statementLineId: string;
  bankTransactionId: string;
  score: number;
  reason: string;
}

export interface MatchResult {
  matched: number;
  unmatched: number;
  suggestions: MatchSuggestion[];
}

export interface BankStatementLineWithMatch {
  id: string;
  date: Date;
  description: string;
  reference: string | null;
  debit: Decimal;
  credit: Decimal;
  balance: Decimal | null;
  status: string;
  matchedTxId: string | null;
  matchedTransaction?: {
    id: string;
    description: string;
    amount: Decimal;
    type: string;
    source: string;
  } | null;
}

// ── Service ──────────────────────────────────────────────────────

@Injectable()
export class BankReconciliationService {
  private readonly logger = new Logger(BankReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Bank Account CRUD ─────────────────────────────────────────

  async createBankAccount(companyId: string, dto: CreateBankAccountDto) {
    return this.prisma.bankAccount.create({
      data: {
        companyId,
        name:          dto.name,
        bankName:      dto.bankName,
        accountNumber: dto.accountNumber ?? null,
        currency:      dto.currency ?? 'CRC',
      },
    });
  }

  async getBankAccounts(companyId: string) {
    return this.prisma.bankAccount.findMany({
      where:   { companyId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBankAccount(id: string, companyId: string) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id, companyId },
    });
    if (!account) throw new NotFoundException('Cuenta bancaria no encontrada');
    return account;
  }

  // ── Statements ────────────────────────────────────────────────

  async getStatements(companyId: string, bankAccountId: string) {
    await this.getBankAccount(bankAccountId, companyId); // ownership check
    return this.prisma.bankStatement.findMany({
      where:   { bankAccountId, companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStatement(statementId: string, companyId: string) {
    const stmt = await this.prisma.bankStatement.findFirst({
      where: { id: statementId, companyId },
    });
    if (!stmt) throw new NotFoundException('Estado de cuenta no encontrado');
    return stmt;
  }

  // ── Upload & Parse Statement ─────────────────────────────────

  async uploadStatement(
    companyId: string,
    bankAccountId: string,
    file: Express.Multer.File,
  ) {
    await this.getBankAccount(bankAccountId, companyId); // ownership check

    const ext = file.originalname.split('.').pop()?.toLowerCase();
    let rows: Record<string, string>[] = [];

    if (ext === 'csv') {
      rows = this.parseCsv(file.buffer);
    } else if (ext === 'xlsx' || ext === 'xls') {
      rows = await this.parseXlsx(file.buffer);
    } else {
      throw new BadRequestException(
        'Formato no soportado. Use .csv o .xlsx',
      );
    }

    if (rows.length === 0) {
      throw new BadRequestException('El archivo no contiene datos');
    }

    // Map rows to statement lines
    const lines = rows.map(row => this.mapRowToLine(row)).filter(Boolean) as {
      date: Date;
      description: string;
      reference: string | null;
      debit: Decimal;
      credit: Decimal;
      balance: Decimal | null;
    }[];

    if (lines.length === 0) {
      throw new BadRequestException(
        'No se pudieron extraer líneas del archivo. Verifique el formato.',
      );
    }

    // Calculate totals
    const totalDebits  = lines.reduce((s, l) => s.plus(l.debit),  new Decimal(0));
    const totalCredits = lines.reduce((s, l) => s.plus(l.credit), new Decimal(0));

    // Period: min and max date in the file
    const dates = lines.map(l => l.date).sort((a, b) => a.getTime() - b.getTime());
    const periodStart = dates[0];
    const periodEnd   = dates[dates.length - 1];

    // Last balance value from file (if provided), else 0
    const lastBalance = lines[lines.length - 1].balance ?? new Decimal(0);

    return this.prisma.$transaction(async (tx) => {
      const statement = await tx.bankStatement.create({
        data: {
          bankAccountId,
          companyId,
          fileName:       file.originalname,
          periodStart,
          periodEnd,
          totalCredits,
          totalDebits,
          closingBalance: lastBalance,
          status:         'PENDING',
        },
      });

      await tx.bankStatementLine.createMany({
        data: lines.map(l => ({
          statementId: statement.id,
          date:        l.date,
          description: l.description,
          reference:   l.reference,
          debit:       l.debit,
          credit:      l.credit,
          balance:     l.balance,
          status:      'UNMATCHED',
        })),
      });

      return tx.bankStatement.findUnique({
        where:   { id: statement.id },
        include: { lines: true },
      });
    });
  }

  // ── CSV Parser ───────────────────────────────────────────────

  private parseCsv(buffer: Buffer): Record<string, string>[] {
    const text  = buffer.toString('utf-8');
    const rawLines = text.split(/\r?\n/).filter(l => l.trim());
    if (rawLines.length < 2) return [];

    const headers = rawLines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < rawLines.length; i++) {
      const cells = this.splitCsvLine(rawLines[i]);
      if (cells.length === 0) continue;
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = (cells[idx] ?? '').trim().replace(/^"|"$/g, ''); });
      rows.push(row);
    }
    return rows;
  }

  private splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  // ── XLSX Parser ──────────────────────────────────────────────

  private async parseXlsx(buffer: Buffer): Promise<Record<string, string>[]> {
    // Dynamic import so xlsx is optional at module load time
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require('xlsx') as typeof import('xlsx');
    const wb   = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const raw  = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1 }) as unknown as unknown[][];

    if (raw.length < 2) return [];

    const headers = (raw[0] as string[]).map(h => String(h ?? '').trim().toLowerCase());
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < raw.length; i++) {
      const cells = raw[i] as unknown[];
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = String(cells[idx] ?? '').trim(); });
      rows.push(row);
    }
    return rows;
  }

  // ── Row → Line mapper ────────────────────────────────────────

  private mapRowToLine(row: Record<string, string>) {
    // Detect column names flexibly
    const dateVal   = this.findCol(row, ['fecha', 'date', 'fecha_transaccion', 'transaction_date', 'fecha movimiento']);
    const descVal   = this.findCol(row, ['descripcion', 'description', 'concepto', 'detalle', 'detail', 'narration']);
    const debitVal  = this.findCol(row, ['debito', 'debit', 'cargo', 'egreso', 'salida', 'débito', 'withdrawals']);
    const creditVal = this.findCol(row, ['credito', 'credit', 'abono', 'ingreso', 'entrada', 'crédito', 'deposits']);
    const refVal    = this.findCol(row, ['referencia', 'reference', 'ref', 'numero', 'number', 'doc']);
    const balVal    = this.findCol(row, ['saldo', 'balance', 'saldo_final', 'closing_balance', 'balance_after']);

    if (!dateVal || !descVal) return null;

    const date = this.parseDate(dateVal);
    if (!date) return null;

    const debit  = this.parseDecimal(debitVal);
    const credit = this.parseDecimal(creditVal);
    const balance = balVal ? this.parseDecimal(balVal) : null;

    // Skip rows with no movement
    if (debit.equals(0) && credit.equals(0)) return null;

    return {
      date,
      description: descVal,
      reference:   refVal || null,
      debit,
      credit,
      balance,
    };
  }

  private findCol(row: Record<string, string>, keys: string[]): string {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== '') return row[key];
    }
    return '';
  }

  private parseDate(val: string): Date | null {
    if (!val) return null;
    // Try ISO
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
    // Try DD/MM/YYYY or DD-MM-YYYY
    const m = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const year = m[3].length === 2 ? '20' + m[3] : m[3];
      return new Date(`${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
    }
    return null;
  }

  private parseDecimal(val: string | undefined): Decimal {
    if (!val) return new Decimal(0);
    const clean = val.replace(/[^\d.\-,]/g, '').replace(',', '.');
    try { return new Decimal(clean); } catch { return new Decimal(0); }
  }

  // ── Auto Match ───────────────────────────────────────────────

  async autoMatch(statementId: string, companyId: string): Promise<MatchResult> {
    const statement = await this.getStatement(statementId, companyId);

    const unmatchedLines = await this.prisma.bankStatementLine.findMany({
      where: { statementId, status: 'UNMATCHED' },
    });

    if (unmatchedLines.length === 0) {
      return { matched: 0, unmatched: 0, suggestions: [] };
    }

    // Get all unreconciled transactions for this bank account
    const txs = await this.prisma.bankTransaction.findMany({
      where: {
        companyId,
        bankAccountId: statement.bankAccountId,
        isReconciled:  false,
      },
    });

    let matched   = 0;
    let unmatched = 0;
    const suggestions: MatchSuggestion[] = [];

    for (const line of unmatchedLines) {
      const lineAmount = Number(line.debit) > 0 ? Number(line.debit) : Number(line.credit);
      const lineType   = Number(line.debit) > 0 ? 'DEBIT' : 'CREDIT';

      // Score each transaction
      let bestScore  = 0;
      let bestTx: typeof txs[0] | null = null;
      let bestReason = '';

      for (const tx of txs) {
        if (tx.type !== lineType) continue;

        const txAmount = Math.abs(Number(tx.amount));
        let score      = 0;
        let reason     = '';

        // Amount match (exact = 60 points)
        if (Math.abs(txAmount - lineAmount) < 0.01) {
          score  += 60;
          reason += 'monto exacto';
        } else {
          continue; // require amount match for auto matching
        }

        // Date proximity (±2 days = up to 30 points)
        const dayDiff = Math.abs(
          (new Date(line.date).getTime() - new Date(tx.date).getTime()) / (1000 * 60 * 60 * 24),
        );
        if (dayDiff <= 2) {
          const datePts = Math.round(30 - dayDiff * 10);
          score  += datePts;
          reason += `, fecha ±${Math.round(dayDiff)} día(s)`;
        } else {
          // Only suggest, not auto match, if date differs more than 2 days
          score -= 10;
        }

        // Description similarity (simple word overlap, up to 10 points)
        const descSim = this.descriptionSimilarity(line.description, tx.description);
        score  += Math.round(descSim * 10);
        if (descSim > 0.3) reason += ', descripción similar';

        if (score > bestScore) {
          bestScore  = score;
          bestTx     = tx;
          bestReason = reason.replace(/^,\s*/, '');
        }
      }

      if (bestTx && bestScore >= 70 && Math.abs(
        (new Date(line.date).getTime() - new Date(bestTx.date).getTime()) / (1000 * 60 * 60 * 24),
      ) <= 2) {
        // Auto-match
        await this.prisma.$transaction([
          this.prisma.bankStatementLine.update({
            where: { id: line.id },
            data:  { status: 'MATCHED', matchedTxId: bestTx.id },
          }),
          this.prisma.bankTransaction.update({
            where: { id: bestTx.id },
            data:  {
              isReconciled:    true,
              reconciledAt:    new Date(),
              statementLineId: line.id,
            },
          }),
        ]);
        matched++;
        // Remove from pool
        const idx = txs.findIndex(t => t.id === bestTx!.id);
        if (idx !== -1) txs.splice(idx, 1);
      } else if (bestTx && bestScore >= 50) {
        // Suggest
        suggestions.push({
          statementLineId:   line.id,
          bankTransactionId: bestTx.id,
          score:             bestScore,
          reason:            bestReason,
        });
        unmatched++;
      } else {
        unmatched++;
      }
    }

    return { matched, unmatched, suggestions };
  }

  // ── Manual Match ─────────────────────────────────────────────

  async matchTransaction(
    statementLineId: string,
    bankTransactionId: string,
    companyId: string,
  ): Promise<void> {
    const line = await this.prisma.bankStatementLine.findFirst({
      where: { id: statementLineId, statement: { companyId } },
    });
    if (!line) throw new NotFoundException('Línea de estado de cuenta no encontrada');

    const tx = await this.prisma.bankTransaction.findFirst({
      where: { id: bankTransactionId, companyId },
    });
    if (!tx) throw new NotFoundException('Transacción bancaria no encontrada');

    await this.prisma.$transaction([
      this.prisma.bankStatementLine.update({
        where: { id: statementLineId },
        data:  { status: 'MATCHED', matchedTxId: bankTransactionId },
      }),
      this.prisma.bankTransaction.update({
        where: { id: bankTransactionId },
        data:  {
          isReconciled:    true,
          reconciledAt:    new Date(),
          statementLineId: statementLineId,
        },
      }),
    ]);
  }

  // ── Unmatch ──────────────────────────────────────────────────

  async unmatchTransaction(statementLineId: string, companyId: string): Promise<void> {
    const line = await this.prisma.bankStatementLine.findFirst({
      where: { id: statementLineId, statement: { companyId } },
    });
    if (!line) throw new NotFoundException('Línea de estado de cuenta no encontrada');

    const ops: any[] = [
      this.prisma.bankStatementLine.update({
        where: { id: statementLineId },
        data:  { status: 'UNMATCHED', matchedTxId: null },
      }),
    ];

    if (line.matchedTxId) {
      ops.push(
        this.prisma.bankTransaction.update({
          where: { id: line.matchedTxId },
          data:  { isReconciled: false, reconciledAt: null, statementLineId: null },
        }),
      );
    }

    await this.prisma.$transaction(ops);
  }

  // ── Ignore Line ──────────────────────────────────────────────

  async ignoreLine(statementLineId: string, companyId: string): Promise<void> {
    const line = await this.prisma.bankStatementLine.findFirst({
      where: { id: statementLineId, statement: { companyId } },
    });
    if (!line) throw new NotFoundException('Línea de estado de cuenta no encontrada');

    await this.prisma.bankStatementLine.update({
      where: { id: statementLineId },
      data:  { status: 'IGNORED' },
    });
  }

  // ── Reconciliation Status ─────────────────────────────────────

  async getReconciliationStatus(statementId: string, companyId: string) {
    const statement = await this.getStatement(statementId, companyId);

    const lines = await this.prisma.bankStatementLine.findMany({
      where:   { statementId },
      orderBy: { date: 'asc' },
    });

    // Fase 5 — fix N+1: una sola findMany para TODAS las matched txs.
    const matchedTxIds = lines.map(l => l.matchedTxId).filter(Boolean) as string[];
    const matchedTxs = matchedTxIds.length === 0 ? [] : await this.prisma.bankTransaction.findMany({
      where:  { id: { in: matchedTxIds } },
      select: { id: true, description: true, amount: true, type: true, source: true },
    });
    const txMap = new Map(matchedTxs.map(t => [t.id, t]));
    const enrichedLines: BankStatementLineWithMatch[] = lines.map(line => ({
      ...line,
      matchedTransaction: line.matchedTxId ? (txMap.get(line.matchedTxId) ?? null) : null,
    }));

    const totalLines = lines.length;
    const matched    = lines.filter(l => l.status === 'MATCHED').length;
    const ignored    = lines.filter(l => l.status === 'IGNORED').length;
    const unmatched  = lines.filter(l => l.status === 'UNMATCHED').length;

    const matchedAmount   = lines
      .filter(l => l.status === 'MATCHED')
      .reduce((s, l) => s + Number(l.debit) + Number(l.credit), 0);

    const unmatchedAmount = lines
      .filter(l => l.status === 'UNMATCHED')
      .reduce((s, l) => s + Number(l.debit) + Number(l.credit), 0);

    // System balance: sum of reconciled transactions for this bank account
    const reconciledTxs = await this.prisma.bankTransaction.findMany({
      where: { companyId, bankAccountId: statement.bankAccountId, isReconciled: true },
      select: { amount: true, type: true },
    });

    const systemBalance = reconciledTxs.reduce((s, tx) => {
      return s + (tx.type === 'CREDIT' ? Number(tx.amount) : -Number(tx.amount));
    }, 0);

    const bankBalance  = Number(statement.closingBalance);
    const difference   = bankBalance - systemBalance;
    const isReconciled = unmatched === 0 && totalLines > 0;

    return {
      statement,
      lines: enrichedLines,
      summary: {
        totalLines,
        matched,
        unmatched,
        ignored,
        matchedAmount,
        unmatchedAmount,
        systemBalance,
        bankBalance,
        difference,
        isReconciled,
      },
    };
  }

  // ── Complete Reconciliation ───────────────────────────────────

  async completeReconciliation(statementId: string, companyId: string) {
    const statement = await this.getStatement(statementId, companyId);

    if (statement.status === 'COMPLETED') {
      throw new BadRequestException('Este estado de cuenta ya está conciliado');
    }

    const unmatchedCount = await this.prisma.bankStatementLine.count({
      where: { statementId, status: 'UNMATCHED' },
    });

    if (unmatchedCount > 0) {
      throw new BadRequestException(
        `Aún hay ${unmatchedCount} línea(s) sin conciliar. Concílielas o ignórelas antes de completar.`,
      );
    }

    return this.prisma.bankStatement.update({
      where: { id: statementId },
      data:  { status: 'COMPLETED', reconciledAt: new Date() },
    });
  }

  // ── Unreconciled System Transactions ─────────────────────────

  async getUnreconciledTransactions(bankAccountId: string, companyId: string) {
    await this.getBankAccount(bankAccountId, companyId); // ownership check
    return this.prisma.bankTransaction.findMany({
      where:   { bankAccountId, companyId, isReconciled: false },
      orderBy: { date: 'desc' },
    });
  }

  // ── Create Manual Bank Transaction ────────────────────────────

  async createBankTransaction(companyId: string, dto: CreateBankTransactionDto) {
    await this.getBankAccount(dto.bankAccountId, companyId); // ownership check

    return this.prisma.bankTransaction.create({
      data: {
        companyId,
        bankAccountId: dto.bankAccountId,
        date:          new Date(dto.date),
        description:   dto.description,
        reference:     dto.reference ?? null,
        amount:        new Decimal(dto.amount),
        type:          dto.type,
        source:        dto.source ?? 'MANUAL',
        sourceId:      dto.sourceId ?? null,
      },
    });
  }

  // ── List Transactions ─────────────────────────────────────────

  async getTransactions(companyId: string, filter: BankTransactionFilterDto) {
    const where: any = { companyId };
    if (filter.bankAccountId) where.bankAccountId = filter.bankAccountId;
    if (filter.unreconciled)  where.isReconciled  = false;

    return this.prisma.bankTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  // ── Export to Excel ───────────────────────────────────────────

  async exportReconciliation(statementId: string, companyId: string): Promise<Buffer> {
    const { statement, lines, summary } = await this.getReconciliationStatus(statementId, companyId);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ContaFácil SQ';
    wb.created = new Date();

    // ── Sheet 1: Matched ─────────────────────────────────────
    const matchedSheet = wb.addWorksheet('Conciliadas');
    matchedSheet.columns = [
      { header: 'Fecha',       key: 'date',        width: 14 },
      { header: 'Descripción', key: 'description', width: 40 },
      { header: 'Referencia',  key: 'reference',   width: 20 },
      { header: 'Débito',      key: 'debit',       width: 16 },
      { header: 'Crédito',     key: 'credit',      width: 16 },
      { header: 'Estado',      key: 'status',      width: 14 },
    ];
    this.styleHeader(matchedSheet);

    for (const l of lines.filter(l => l.status === 'MATCHED')) {
      matchedSheet.addRow({
        date:        l.date.toISOString().split('T')[0],
        description: l.description,
        reference:   l.reference ?? '',
        debit:       Number(l.debit),
        credit:      Number(l.credit),
        status:      'Conciliada',
      });
    }

    // ── Sheet 2: Unmatched ───────────────────────────────────
    const unmatchedSheet = wb.addWorksheet('Sin Conciliar');
    unmatchedSheet.columns = [
      { header: 'Fecha',       key: 'date',        width: 14 },
      { header: 'Descripción', key: 'description', width: 40 },
      { header: 'Referencia',  key: 'reference',   width: 20 },
      { header: 'Débito',      key: 'debit',       width: 16 },
      { header: 'Crédito',     key: 'credit',      width: 16 },
      { header: 'Estado',      key: 'status',      width: 14 },
    ];
    this.styleHeader(unmatchedSheet);

    for (const l of lines.filter(l => l.status === 'UNMATCHED')) {
      unmatchedSheet.addRow({
        date:        l.date.toISOString().split('T')[0],
        description: l.description,
        reference:   l.reference ?? '',
        debit:       Number(l.debit),
        credit:      Number(l.credit),
        status:      'Sin conciliar',
      });
    }

    // ── Sheet 3: Summary ──────────────────────────────────────
    const summarySheet = wb.addWorksheet('Resumen');
    summarySheet.columns = [
      { header: 'Concepto', key: 'label', width: 35 },
      { header: 'Valor',    key: 'value', width: 20 },
    ];
    this.styleHeader(summarySheet);

    summarySheet.addRows([
      { label: 'Estado de cuenta',                value: statement.fileName },
      { label: 'Período inicio',                  value: statement.periodStart.toISOString().split('T')[0] },
      { label: 'Período fin',                     value: statement.periodEnd.toISOString().split('T')[0] },
      { label: 'Total líneas',                    value: summary.totalLines },
      { label: 'Conciliadas',                     value: summary.matched },
      { label: 'Sin conciliar',                   value: summary.unmatched },
      { label: 'Ignoradas',                       value: summary.ignored },
      { label: 'Monto conciliado',                value: summary.matchedAmount },
      { label: 'Monto sin conciliar',             value: summary.unmatchedAmount },
      { label: 'Saldo banco (estado de cuenta)',  value: summary.bankBalance },
      { label: 'Saldo sistema (transacciones)',   value: summary.systemBalance },
      { label: 'Diferencia',                      value: summary.difference },
      { label: 'Estado conciliación',             value: summary.isReconciled ? 'COMPLETA' : 'PENDIENTE' },
    ]);

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ── Helpers ───────────────────────────────────────────────────

  private styleHeader(sheet: ExcelJS.Worksheet) {
    const headerRow = sheet.getRow(1);
    headerRow.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  }

  private descriptionSimilarity(a: string, b: string): number {
    const wordsA = a.toLowerCase().split(/\s+/);
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const common = wordsA.filter(w => w.length > 3 && wordsB.has(w));
    return common.length / Math.max(wordsA.length, 1);
  }
}
