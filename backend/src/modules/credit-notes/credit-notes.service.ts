import {
  Injectable, BadRequestException,
  NotFoundException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/activity/activity-log.service';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { BusinessEventsService } from '../business/business-events.service';
import { CreateCreditNoteDto, CreateDebitNoteDto, CreateNoteLineDto } from './dto/credit-notes.dto';

/**
 * ────────────────────────────────────────────────────────────────
 *  CreditNotesService
 *
 *  Gestiona NOTAS DE CRÉDITO y NOTAS DE DÉBITO sobre facturas ya emitidas.
 *  Sigue el mismo ciclo que las facturas:
 *    · create → documento DRAFT (valida factura origen, calcula montos con
 *      Decimal.js, asigna consecutivo atómico por empresa)
 *    · issue  → dispara el Business Event (CREDIT_NOTE_ISSUED /
 *      DEBIT_NOTE_ISSUED) que genera el asiento y ajusta AR (patrón
 *      event-driven canónico, idéntico a InvoicesService.issue).
 *
 *  Multi-tenant: TODO scoped por companyId. La factura origen SIEMPRE se
 *  valida contra la misma empresa antes de tocar nada.
 * ────────────────────────────────────────────────────────────────
 */
@Injectable()
export class CreditNotesService {
  private readonly logger = new Logger(CreditNotesService.name);

  constructor(
    private readonly prisma:         PrismaService,
    private readonly businessEvents: BusinessEventsService,
    private readonly activityLog: ActivityLogService,
  ) {}

  // ════════════════════════════════════════════════════════════════
  //  Helpers compartidos
  // ════════════════════════════════════════════════════════════════

  /** Calcula subtotal/tax/total de cada línea con Decimal.js (2 decimales). */
  private computeLines(lines: CreateNoteLineDto[]) {
    let subtotal = new Decimal(0);
    let tax      = new Decimal(0);

    const computed = lines.map((line, i) => {
      const qty       = new Decimal(line.quantity.toString());
      const unitPrice = new Decimal(line.unitPrice.toString());
      const taxRate   = new Decimal(line.taxRate.toString());

      const lineSubtotal = qty.times(unitPrice).toDecimalPlaces(2);
      const taxAmount    = lineSubtotal.times(taxRate).dividedBy(100).toDecimalPlaces(2);
      const lineTotal    = lineSubtotal.plus(taxAmount);

      subtotal = subtotal.plus(lineSubtotal);
      tax      = tax.plus(taxAmount);

      return {
        lineNo:      i + 1,
        productId:   line.productId ?? null,
        description: line.description,
        quantity:    qty,
        unit:        line.unit ?? 'Unid',
        unitPrice,
        taxRate,
        taxAmount,
        subtotal:    lineSubtotal,
        total:       lineTotal,
        cabysCode:   line.cabysCode,
      };
    });

    return { computed, subtotal, tax, total: subtotal.plus(tax) };
  }

  /**
   * Carga la factura origen validando pertenencia a la empresa y que esté
   * emitida. Devuelve los campos que necesitan create/issue.
   */
  private async loadOriginInvoice(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where:  { id: invoiceId, companyId },
      select: {
        id: true, companyId: true, clientId: true, clientName: true,
        consecutiveNumber: true, status: true, saleCondition: true,
        subtotal: true, tax: true, total: true, balanceDue: true,
      },
    });
    if (!invoice) {
      throw new NotFoundException('Factura de origen no encontrada en esta empresa');
    }
    if (invoice.status !== 'ISSUED') {
      throw new BadRequestException(
        'Solo se puede emitir una nota sobre una factura ya emitida (ISSUED).',
      );
    }
    return invoice;
  }

  // ════════════════════════════════════════════════════════════════
  //  NOTA DE CRÉDITO
  // ════════════════════════════════════════════════════════════════

  async listCreditNotes(companyId: string) {
    return this.prisma.creditNote.findMany({
      where:   { companyId },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCreditNote(companyId: string, id: string) {
    const note = await this.prisma.creditNote.findFirst({
      where:   { id, companyId },
      include: { lines: true },
    });
    if (!note) throw new NotFoundException('Nota de crédito no encontrada');
    return note;
  }

  /** Crea una nota de crédito DRAFT (aún sin asiento). */
  async createCreditNote(companyId: string, userId: string, dto: CreateCreditNoteDto) {
    const invoice = await this.loadOriginInvoice(companyId, dto.invoiceId);
    const { computed, subtotal, tax, total } = this.computeLines(dto.lines);

    // La nota de crédito no puede exceder el total de la factura origen —
    // no se puede acreditar (devolver) más de lo facturado.
    if (total.greaterThan(new Decimal(invoice.total.toString()))) {
      throw new BadRequestException(
        `El total de la nota de crédito (${total.toFixed(2)}) excede el total de la ` +
        `factura origen (${new Decimal(invoice.total.toString()).toFixed(2)}).`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Consecutivo atómico por empresa (mismo patrón que invoice_sequences).
      await tx.$executeRaw`
        INSERT INTO credit_note_sequences (company_id, last_number)
        VALUES (${companyId}::uuid, 1)
        ON CONFLICT (company_id) DO UPDATE
          SET last_number = credit_note_sequences.last_number + 1
      `;
      const [{ last_number }] = await tx.$queryRaw<[{ last_number: number }]>`
        SELECT last_number FROM credit_note_sequences WHERE company_id = ${companyId}::uuid
      `;
      const number = Number(last_number);

      const note = await tx.creditNote.create({
        data: {
          companyId,
          invoiceId:        invoice.id,
          number,
          issueDate:        new Date(dto.issueDate),
          reason:           dto.reason ?? null,
          subtotal,
          tax,
          total,
          status:           'DRAFT',
          restoreInventory: dto.restoreInventory ?? false,
          createdById:      userId,
        },
      });

      await tx.creditNoteLine.createMany({
        data: computed.map(l => ({
          creditNoteId: note.id,
          productId:    l.productId,
          lineNo:       l.lineNo,
          description:  l.description,
          quantity:     l.quantity,
          unit:         l.unit,
          unitPrice:    l.unitPrice,
          taxRate:      l.taxRate,
          taxAmount:    l.taxAmount,
          subtotal:     l.subtotal,
          total:        l.total,
          cabysCode:    l.cabysCode,
        })),
      });

      return tx.creditNote.findUnique({
        where:   { id: note.id },
        include: { lines: true },
      });
    });
  }

  /**
   * Emite la nota de crédito: marca ISSUED y dispara el Business Event que
   * genera el asiento (reversa de venta) + ajusta inventario/AR. Idempotente
   * por (source_type='credit_note', source_id=note.id) en journal_entries.
   */
  async issueCreditNote(companyId: string, id: string, userId: string) {
    const note = await this.prisma.creditNote.findFirst({
      where:   { id, companyId },
      include: { lines: true },
    });
    if (!note) throw new NotFoundException('Nota de crédito no encontrada');
    if (note.status === 'ISSUED') {
      throw new BadRequestException('Esta nota de crédito ya fue emitida.');
    }

    const invoice = await this.loadOriginInvoice(companyId, note.invoiceId);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.creditNote.update({
        where: { id: note.id },
        data:  { status: 'ISSUED' },
      });

      await this.businessEvents.dispatch({
        type:             'CREDIT_NOTE_ISSUED',
        companyId,
        userId,
        tx,
        creditNoteId:     note.id,
        invoiceId:        invoice.id,
        customerId:       invoice.clientId,
        noteNumber:       note.number,
        invoiceReference: invoice.consecutiveNumber,
        customerName:     invoice.clientName,
        subtotal:         Number(note.subtotal),
        taxAmount:        Number(note.tax),
        total:            Number(note.total),
        paymentType:      invoice.saleCondition === 'CASH' ? 'CASH' : 'CREDIT',
        restoreInventory: note.restoreInventory,
        lines: note.lines.map(l => ({
          productId:   l.productId,
          description: l.description,
          quantity:    Number(l.quantity),
          subtotal:    Number(l.subtotal),
          taxAmount:   Number(l.taxAmount),
          total:       Number(l.total),
        })),
        date: note.issueDate,
      });
    });

    this.logger.log(`✓ Nota de crédito NC-${note.number} emitida (factura ${invoice.consecutiveNumber})`);

    // Bitácora (best-effort)
    void this.activityLog.log({
      userId, companyId,
      action:   'CREDIT_NOTE_ISSUED',
      entity:   'CreditNote',
      entityId: id,
      details:  {
        numero:  note.number,
        factura: invoice.consecutiveNumber,
        total:   note.total?.toString(),
      },
    });

    return this.getCreditNote(companyId, id);
  }

  // ════════════════════════════════════════════════════════════════
  //  NOTA DE DÉBITO
  // ════════════════════════════════════════════════════════════════

  async listDebitNotes(companyId: string) {
    return this.prisma.debitNote.findMany({
      where:   { companyId },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDebitNote(companyId: string, id: string) {
    const note = await this.prisma.debitNote.findFirst({
      where:   { id, companyId },
      include: { lines: true },
    });
    if (!note) throw new NotFoundException('Nota de débito no encontrada');
    return note;
  }

  /** Crea una nota de débito DRAFT. */
  async createDebitNote(companyId: string, userId: string, dto: CreateDebitNoteDto) {
    const invoice = await this.loadOriginInvoice(companyId, dto.invoiceId);
    const { computed, subtotal, tax, total } = this.computeLines(dto.lines);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO debit_note_sequences (company_id, last_number)
        VALUES (${companyId}::uuid, 1)
        ON CONFLICT (company_id) DO UPDATE
          SET last_number = debit_note_sequences.last_number + 1
      `;
      const [{ last_number }] = await tx.$queryRaw<[{ last_number: number }]>`
        SELECT last_number FROM debit_note_sequences WHERE company_id = ${companyId}::uuid
      `;
      const number = Number(last_number);

      const note = await tx.debitNote.create({
        data: {
          companyId,
          invoiceId:   invoice.id,
          number,
          issueDate:   new Date(dto.issueDate),
          reason:      dto.reason ?? null,
          subtotal,
          tax,
          total,
          status:      'DRAFT',
          createdById: userId,
        },
      });

      await tx.debitNoteLine.createMany({
        data: computed.map(l => ({
          debitNoteId: note.id,
          productId:   l.productId,
          lineNo:      l.lineNo,
          description: l.description,
          quantity:    l.quantity,
          unit:        l.unit,
          unitPrice:   l.unitPrice,
          taxRate:     l.taxRate,
          taxAmount:   l.taxAmount,
          subtotal:    l.subtotal,
          total:       l.total,
          cabysCode:   l.cabysCode,
        })),
      });

      return tx.debitNote.findUnique({
        where:   { id: note.id },
        include: { lines: true },
      });
    });
  }

  /**
   * Emite la nota de débito: marca ISSUED y dispara el Business Event que
   * genera el asiento (cargo adicional) + aumenta AR. Idempotente por
   * (source_type='debit_note', source_id=note.id).
   */
  async issueDebitNote(companyId: string, id: string, userId: string) {
    const note = await this.prisma.debitNote.findFirst({
      where:   { id, companyId },
      include: { lines: true },
    });
    if (!note) throw new NotFoundException('Nota de débito no encontrada');
    if (note.status === 'ISSUED') {
      throw new BadRequestException('Esta nota de débito ya fue emitida.');
    }

    const invoice = await this.loadOriginInvoice(companyId, note.invoiceId);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.debitNote.update({
        where: { id: note.id },
        data:  { status: 'ISSUED' },
      });

      await this.businessEvents.dispatch({
        type:             'DEBIT_NOTE_ISSUED',
        companyId,
        userId,
        tx,
        debitNoteId:      note.id,
        invoiceId:        invoice.id,
        customerId:       invoice.clientId,
        noteNumber:       note.number,
        invoiceReference: invoice.consecutiveNumber,
        customerName:     invoice.clientName,
        subtotal:         Number(note.subtotal),
        taxAmount:        Number(note.tax),
        total:            Number(note.total),
        paymentType:      invoice.saleCondition === 'CASH' ? 'CASH' : 'CREDIT',
        date:             note.issueDate,
      });
    });

    this.logger.log(`✓ Nota de débito ND-${note.number} emitida (factura ${invoice.consecutiveNumber})`);
    return this.getDebitNote(companyId, id);
  }
}
