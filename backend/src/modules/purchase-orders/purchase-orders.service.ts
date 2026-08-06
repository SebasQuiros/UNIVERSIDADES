import {
  Injectable, BadRequestException,
  NotFoundException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { InventoryService } from '../inventory/inventory.service';
import { JournalService } from '../journal/journal.service';
import { JournalSource } from '@prisma/client';
import { ACCOUNT_CODES } from '../accounting/constants/account-codes';
import {
  CreatePurchaseOrderDto, UpdatePurchaseOrderDto, CreatePurchaseOrderLineDto,
} from './dto/purchase-orders.dto';

/**
 * ────────────────────────────────────────────────────────────────
 *  PurchaseOrdersService
 *
 *  Órdenes de compra a PROVEEDOR EXTERNO real + recepción de mercancía.
 *  Ciclo espejo del de ventas (cotización → factura), pero del lado de
 *  compras: DRAFT → ISSUED → RECEIVED (recepción: suma stock + crea lote
 *  FIFO, SIN asiento) → INVOICED (cuando el estudiante registra la
 *  PurchaseInvoice real que sí genera el asiento) / CANCELLED.
 *
 *  Distinto de `ProcurementOrder` (módulo `procurement`), que modela
 *  aprovisionamiento ENTRE EMPRESAS del mismo curso — no se reutiliza.
 *
 *  Multi-tenant: TODO scoped por companyId, mismo patrón que QuotesService.
 * ────────────────────────────────────────────────────────────────
 */
@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(
    private readonly prisma:    PrismaService,
    private readonly inventory: InventoryService,
    private readonly journal:   JournalService,
  ) {}

  // ════════════════════════════════════════════════════════════════
  //  Helpers
  // ════════════════════════════════════════════════════════════════

  private computeLines(lines: CreatePurchaseOrderLineDto[]) {
    let subtotal = new Decimal(0);
    let tax      = new Decimal(0);

    const computed = lines.map((line, i) => {
      const qty      = new Decimal(line.quantity.toString());
      const unitCost = new Decimal(line.unitCost.toString());
      const taxRate  = new Decimal(line.taxRate.toString());

      const lineSubtotal = qty.times(unitCost).toDecimalPlaces(2);
      const taxAmount    = lineSubtotal.times(taxRate).dividedBy(100).toDecimalPlaces(2);
      const lineTotal    = lineSubtotal.plus(taxAmount);

      subtotal = subtotal.plus(lineSubtotal);
      tax      = tax.plus(taxAmount);

      return {
        lineNo:      i + 1,
        productId:   line.productId ?? null,
        description: line.description,
        quantity:    qty,
        unitCost,
        taxRate,
        lineTotal,
      };
    });

    return { computed, subtotal, tax, total: subtotal.plus(tax) };
  }

  private async loadOrder(companyId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where:   { id, companyId },
      include: { lines: true },
    });
    if (!order) throw new NotFoundException('Orden de compra no encontrada');
    return order;
  }

  // ════════════════════════════════════════════════════════════════
  //  CRUD
  // ════════════════════════════════════════════════════════════════

  async list(companyId: string) {
    return this.prisma.purchaseOrder.findMany({
      where:   { companyId },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(companyId: string, id: string) {
    return this.loadOrder(companyId, id);
  }

  async create(companyId: string, userId: string, dto: CreatePurchaseOrderDto) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, companyId, isActive: true },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado en esta empresa');

    const { computed, subtotal, tax, total } = this.computeLines(dto.lines);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO purchase_order_sequences (company_id, last_number)
        VALUES (${companyId}::uuid, 1)
        ON CONFLICT (company_id) DO UPDATE
          SET last_number = purchase_order_sequences.last_number + 1
      `;
      const [{ last_number }] = await tx.$queryRaw<[{ last_number: number }]>`
        SELECT last_number FROM purchase_order_sequences WHERE company_id = ${companyId}::uuid
      `;
      const orderNumber = Number(last_number);

      const order = await tx.purchaseOrder.create({
        data: {
          companyId,
          supplierId:   supplier.id,
          orderNumber,
          issueDate:    new Date(dto.issueDate),
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
          status:       'DRAFT',
          currency:     dto.currency     ?? 'CRC',
          exchangeRate: dto.exchangeRate ?? 1,
          subtotal,
          taxTotal:     tax,
          total,
          notes:        dto.notes ?? null,
          createdById:  userId,
        },
      });

      await tx.purchaseOrderLine.createMany({
        data: computed.map(l => ({
          purchaseOrderId: order.id,
          productId:       l.productId,
          lineNo:          l.lineNo,
          description:     l.description,
          quantity:        l.quantity,
          unitCost:        l.unitCost,
          taxRate:         l.taxRate,
          lineTotal:       l.lineTotal,
        })),
      });

      return tx.purchaseOrder.findUnique({ where: { id: order.id }, include: { lines: true } });
    });
  }

  /** Edita la orden mientras esté en DRAFT (recalcula totales si cambian líneas). */
  async update(companyId: string, id: string, dto: UpdatePurchaseOrderDto) {
    const order = await this.loadOrder(companyId, id);
    if (order.status !== 'DRAFT') {
      throw new BadRequestException('Solo se puede editar una orden en estado DRAFT.');
    }

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, companyId, isActive: true },
      });
      if (!supplier) throw new NotFoundException('Proveedor no encontrado en esta empresa');
    }

    return this.prisma.$transaction(async (tx) => {
      const data: any = {};
      if (dto.supplierId)   data.supplierId   = dto.supplierId;
      if (dto.issueDate)    data.issueDate    = new Date(dto.issueDate);
      if (dto.expectedDate) data.expectedDate = new Date(dto.expectedDate);
      if (dto.notes !== undefined) data.notes = dto.notes ?? null;
      if (dto.currency)     data.currency     = dto.currency;
      if (dto.exchangeRate !== undefined) data.exchangeRate = dto.exchangeRate;

      if (dto.lines) {
        const { computed, subtotal, tax, total } = this.computeLines(dto.lines);
        data.subtotal = subtotal;
        data.taxTotal  = tax;
        data.total     = total;

        await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id } });
        await tx.purchaseOrderLine.createMany({
          data: computed.map(l => ({
            purchaseOrderId: id,
            productId:       l.productId,
            lineNo:          l.lineNo,
            description:     l.description,
            quantity:        l.quantity,
            unitCost:        l.unitCost,
            taxRate:         l.taxRate,
            lineTotal:       l.lineTotal,
          })),
        });
      }

      await tx.purchaseOrder.update({ where: { id }, data });
      return tx.purchaseOrder.findUnique({ where: { id }, include: { lines: true } });
    });
  }

  // ════════════════════════════════════════════════════════════════
  //  Transiciones de estado
  // ════════════════════════════════════════════════════════════════

  async issue(companyId: string, id: string) {
    const order = await this.loadOrder(companyId, id);
    if (order.status !== 'DRAFT') {
      throw new BadRequestException('Solo se puede emitir una orden en estado DRAFT.');
    }
    await this.prisma.purchaseOrder.update({ where: { id }, data: { status: 'ISSUED' } });
    return this.get(companyId, id);
  }

  /**
   * Recibe la mercancía (ISSUED → RECEIVED): suma stock del producto y crea
   * un lote FIFO por cada línea con producto — mismo mecanismo que usa
   * `procurement.receive` / `purchase-invoices.create`. NO toca el Diario:
   * es solo movimiento físico. El asiento nace cuando el estudiante registra
   * la PurchaseInvoice real contra el proveedor.
   */
  async receive(companyId: string, id: string, userId: string) {
    const order = await this.loadOrder(companyId, id);
    if (order.status !== 'ISSUED') {
      throw new BadRequestException('Solo se puede recibir una orden en estado ISSUED.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseOrder.updateMany({
        where: { id, status: 'ISSUED' },
        data:  { status: 'RECEIVED' },
      });
      if (updated.count !== 1) {
        throw new BadRequestException(
          'Conflicto de concurrencia: la orden ya cambió de estado. Volvé a intentar.',
        );
      }

      // Lo que de verdad entra al inventario, y cuánto vale. Ese mismo monto
      // es el que tiene que asentarse: si el kardex sube y los libros no, el
      // inventario físico y el contable se separan sin que nada avise.
      let valorRecibido = new Decimal(0);

      for (const line of order.lines) {
        if (!line.productId) continue; // línea sin producto (servicio) — no toca inventario
        const product = await tx.product.findUnique({
          where:  { id: line.productId },
          select: { isService: true, trackInventory: true },
        });
        if (!product || product.isService || !product.trackInventory) continue;

        await this.inventory.addLot(
          {
            companyId,
            productId:   line.productId,
            qty:         line.quantity,
            unitCost:    line.unitCost,
            source:      'PURCHASE',
            sourceId:    order.id,
            receivedAt:  new Date(),
            createdById: userId,
          },
          tx,
        );

        valorRecibido = valorRecibido.plus(
          new Decimal(line.quantity.toString()).times(line.unitCost.toString()),
        );
      }

      // ── Asiento de recepción ──────────────────────────────────────────
      //
      //   D Inventario de Mercadería
      //   C Mercadería Recibida por Facturar
      //
      // Todavía NO es una cuenta por pagar: el proveedor no ha facturado. Es
      // una obligación por mercadería que ya se tiene. Cuando llega la
      // factura, ese puente se cancela contra Cuentas por Pagar (ver
      // PurchaseInvoicesService).
      //
      // Sin IVA a propósito: el crédito fiscal nace con la factura, que es el
      // documento que lo respalda ante Hacienda.
      if (valorRecibido.greaterThan(0)) {
        await this.journal.createAutoEntry(
          companyId,
          `Recepción de mercadería — orden OC-${order.orderNumber}`,
          new Date(),
          [
            { accountCode: ACCOUNT_CODES.INVENTORY,      debit: valorRecibido.toNumber(), credit: 0,
              description: `Entrada por recepción OC-${order.orderNumber}` },
            { accountCode: ACCOUNT_CODES.GOODS_RECEIVED, debit: 0, credit: valorRecibido.toNumber(),
              description: `Pendiente de facturar — OC-${order.orderNumber}` },
          ],
          userId,
          JournalSource.AUTO_PURCHASE,
          tx,
          undefined,             // invoiceId — la factura todavía no existe
          undefined,             // paymentId
          // Trazabilidad (V-5) e idempotencia: recibir dos veces la misma
          // orden no puede generar dos asientos.
          'purchase_order_receipt',
          order.id,
        );
      }

      return tx.purchaseOrder.findUnique({ where: { id }, include: { lines: true } });
    });
  }

  async cancel(companyId: string, id: string) {
    const order = await this.loadOrder(companyId, id);
    if (!['DRAFT', 'ISSUED'].includes(order.status)) {
      throw new BadRequestException(
        `No se puede cancelar: la orden está en estado "${order.status}".`,
      );
    }
    await this.prisma.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
    return this.get(companyId, id);
  }
}
