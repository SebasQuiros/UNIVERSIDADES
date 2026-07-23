import {
  Injectable, BadRequestException,
  NotFoundException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { InvoicesService } from '../invoices/invoices.service';
import { CreateQuoteDto, UpdateQuoteDto, CreateQuoteLineDto } from './dto/quotes.dto';

/**
 * ────────────────────────────────────────────────────────────────
 *  QuotesService
 *
 *  Cotizaciones / presupuestos: propuesta de venta a un cliente ANTES de
 *  facturar. NO afecta el Diario ni el inventario — es puramente pre-venta.
 *  Solo al `convert()` nace una Invoice real (DRAFT) vía InvoicesService,
 *  que el estudiante emite después desde el módulo de Facturas.
 *
 *  Ciclo de vida: DRAFT → SENT → ACCEPTED/REJECTED/EXPIRED
 *                              → CONVERTED (desde SENT o ACCEPTED)
 *
 *  Multi-tenant: TODO scoped por companyId, mismo patrón que CreditNotesService.
 * ────────────────────────────────────────────────────────────────
 */
@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private readonly prisma:   PrismaService,
    private readonly invoices: InvoicesService,
  ) {}

  // ════════════════════════════════════════════════════════════════
  //  Helpers
  // ════════════════════════════════════════════════════════════════

  private computeLines(lines: CreateQuoteLineDto[]) {
    let subtotal = new Decimal(0);
    let tax      = new Decimal(0);

    const computed = lines.map((line, i) => {
      const qty       = new Decimal(line.quantity.toString());
      const unitPrice = new Decimal(line.unitPrice.toString());
      const taxRate    = new Decimal(line.taxRate.toString());

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

  private async loadQuote(companyId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where:   { id, companyId },
      include: { lines: true },
    });
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    return quote;
  }

  // ════════════════════════════════════════════════════════════════
  //  CRUD
  // ════════════════════════════════════════════════════════════════

  async list(companyId: string) {
    return this.prisma.quote.findMany({
      where:   { companyId },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(companyId: string, id: string) {
    return this.loadQuote(companyId, id);
  }

  async create(companyId: string, userId: string, dto: CreateQuoteDto) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, companyId, isActive: true },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado en esta empresa');

    const { computed, subtotal, tax, total } = this.computeLines(dto.lines);

    return this.prisma.$transaction(async (tx) => {
      // Consecutivo atómico por empresa — mismo patrón que invoice_sequences.
      await tx.$executeRaw`
        INSERT INTO quote_sequences (company_id, last_number)
        VALUES (${companyId}::uuid, 1)
        ON CONFLICT (company_id) DO UPDATE
          SET last_number = quote_sequences.last_number + 1
      `;
      const [{ last_number }] = await tx.$queryRaw<[{ last_number: number }]>`
        SELECT last_number FROM quote_sequences WHERE company_id = ${companyId}::uuid
      `;
      const quoteNumber = Number(last_number);

      const quote = await tx.quote.create({
        data: {
          companyId,
          clientId:      client.id,
          quoteNumber,
          issueDate:     new Date(dto.issueDate),
          validUntil:    new Date(dto.validUntil),
          status:        'DRAFT',
          currency:      dto.currency     ?? 'CRC',
          exchangeRate:  dto.exchangeRate ?? 1,
          subtotal,
          taxTotal:      tax,
          total,
          notes:         dto.notes ?? null,
          createdById:   userId,
        },
      });

      await tx.quoteLine.createMany({
        data: computed.map(l => ({
          quoteId:     quote.id,
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

      return tx.quote.findUnique({ where: { id: quote.id }, include: { lines: true } });
    });
  }

  /** Edita una cotización mientras esté en DRAFT (recalcula totales si cambian líneas). */
  async update(companyId: string, id: string, dto: UpdateQuoteDto) {
    const quote = await this.loadQuote(companyId, id);
    if (quote.status !== 'DRAFT') {
      throw new BadRequestException('Solo se puede editar una cotización en estado DRAFT.');
    }

    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, companyId, isActive: true },
      });
      if (!client) throw new NotFoundException('Cliente no encontrado en esta empresa');
    }

    return this.prisma.$transaction(async (tx) => {
      const data: any = {};
      if (dto.clientId)   data.clientId   = dto.clientId;
      if (dto.issueDate)  data.issueDate  = new Date(dto.issueDate);
      if (dto.validUntil) data.validUntil = new Date(dto.validUntil);
      if (dto.notes !== undefined) data.notes = dto.notes ?? null;
      if (dto.currency)   data.currency   = dto.currency;
      if (dto.exchangeRate !== undefined) data.exchangeRate = dto.exchangeRate;

      if (dto.lines) {
        const { computed, subtotal, tax, total } = this.computeLines(dto.lines);
        data.subtotal = subtotal;
        data.taxTotal  = tax;
        data.total     = total;

        await tx.quoteLine.deleteMany({ where: { quoteId: id } });
        await tx.quoteLine.createMany({
          data: computed.map(l => ({
            quoteId:     id,
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
      }

      await tx.quote.update({ where: { id }, data });
      return tx.quote.findUnique({ where: { id }, include: { lines: true } });
    });
  }

  // ════════════════════════════════════════════════════════════════
  //  Transiciones de estado
  // ════════════════════════════════════════════════════════════════

  async send(companyId: string, id: string) {
    const quote = await this.loadQuote(companyId, id);
    if (quote.status !== 'DRAFT') {
      throw new BadRequestException('Solo se puede enviar una cotización en estado DRAFT.');
    }
    await this.prisma.quote.update({ where: { id }, data: { status: 'SENT' } });
    return this.get(companyId, id);
  }

  async accept(companyId: string, id: string) {
    const quote = await this.loadQuote(companyId, id);
    if (quote.status !== 'SENT') {
      throw new BadRequestException('Solo se puede aceptar una cotización en estado SENT.');
    }
    await this.prisma.quote.update({ where: { id }, data: { status: 'ACCEPTED' } });
    return this.get(companyId, id);
  }

  async reject(companyId: string, id: string) {
    const quote = await this.loadQuote(companyId, id);
    if (!['SENT', 'DRAFT'].includes(quote.status)) {
      throw new BadRequestException('Solo se puede rechazar una cotización en DRAFT o SENT.');
    }
    await this.prisma.quote.update({ where: { id }, data: { status: 'REJECTED' } });
    return this.get(companyId, id);
  }

  /**
   * Convierte la cotización (SENT o ACCEPTED) en una Invoice real DRAFT, vía
   * InvoicesService.create (misma factura que el estudiante emite luego a
   * mano desde Facturas). Marca la cotización CONVERTED y guarda
   * convertedInvoiceId. Devuelve la invoice creada.
   */
  async convert(companyId: string, id: string, userId: string) {
    const quote = await this.loadQuote(companyId, id);
    if (!['SENT', 'ACCEPTED'].includes(quote.status)) {
      throw new BadRequestException(
        'Solo se puede convertir una cotización en estado SENT o ACCEPTED.',
      );
    }

    const invoice = await this.invoices.create(companyId, userId, {
      clientId:     quote.clientId,
      issueDate:    new Date().toISOString().split('T')[0],
      notes:        quote.notes ?? undefined,
      currency:     quote.currency,
      exchangeRate: Number(quote.exchangeRate),
      lines: quote.lines.map(l => ({
        productId:   l.productId ?? undefined,
        description: l.description,
        quantity:    Number(l.quantity),
        unit:        l.unit,
        unitPrice:   Number(l.unitPrice),
        taxRate:     Number(l.taxRate),
        cabysCode:   l.cabysCode ?? '',
      })),
    });

    await this.prisma.quote.update({
      where: { id },
      data:  { status: 'CONVERTED', convertedInvoiceId: invoice!.id },
    });

    this.logger.log(`✓ Cotización COT-${quote.quoteNumber} convertida a factura DRAFT ${invoice!.id}`);
    return invoice;
  }
}
