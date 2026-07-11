import {
  Injectable, Inject, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { assertCompanyAccess } from '../../common/auth/company-access.helper';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { BusinessEventsService } from '../business/business-events.service';
import { InventoryService } from '../inventory/inventory.service';
import { AccountsPayableService } from '../accounts-payable/accounts-payable.service';
import { CreateProcurementOrderDto } from './dto/procurement.dto';

/**
 * ProcurementService — F2.3 "Modo ERP Completo".
 *
 * Máquina de estados de una orden de aprovisionamiento entre dos empresas del
 * MISMO exercise/curso:
 *
 *   PO_ISSUED  (comprador emite OC)
 *     → DISPATCHED  (vendedor despacha)
 *       → RECEIVED  (comprador recibe → inventario)
 *         → INVOICED (vendedor factura → CxP + asiento del comprador)
 *           → PAID   (comprador paga → ApPayment + asiento)
 *   {PO_ISSUED, DISPATCHED} → CANCELLED
 *
 * Reutiliza métodos probados; NO inventa lógica contable:
 *   - InventoryService.addLot        (recepción → lote de inventario)
 *   - BusinessEventsService.recordPurchase (factura → asiento + CxP)
 *   - AccountsPayableService.registerPayment (pago → ApPayment + asiento)
 */
@Injectable()
export class ProcurementService {
  private readonly logger = new Logger(ProcurementService.name);

  constructor(
    private readonly prisma:          PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: any,
    private readonly businessEvents:  BusinessEventsService,
    private readonly inventory:       InventoryService,
    private readonly accountsPayable: AccountsPayableService,
  ) {}

  // ── Ownership helper (INDIVIDUAL + GROUP, fail-open a DB) ─────────────────
  private async verifyOwner(companyId: string, userId: string) {
    await assertCompanyAccess(this.prisma, companyId, userId, { redis: this.redis });
  }

  private async getOrderOrThrow(orderId: string) {
    const order = await this.prisma.procurementOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Orden de aprovisionamiento no encontrada');
    return order;
  }

  // (Las transiciones de estado se hacen con updateMany atómico + guard de
  //  status, por lo que ya no se usa un assertStatus previo no-atómico.)

  // ─────────────────────────────────────────────────────────────────────────
  //  createOrder — el COMPRADOR emite una Orden de Compra (PO_ISSUED)
  // ─────────────────────────────────────────────────────────────────────────
  async createOrder(dto: CreateProcurementOrderDto, userId: string) {
    if (dto.buyerCompanyId === dto.sellerCompanyId) {
      throw new BadRequestException('El comprador y el vendedor no pueden ser la misma empresa.');
    }

    // Debe venir EXACTAMENTE un contexto: exercise (curso) o practiceGroup (práctica).
    const hasExercise      = !!dto.exerciseId;
    const hasPracticeGroup = !!dto.practiceGroupId;
    if (hasExercise === hasPracticeGroup) {
      throw new BadRequestException(
        'Debes indicar exactamente uno: exerciseId (ejercicio) o practiceGroupId (grupo de práctica).',
      );
    }

    // El usuario que actúa debe ser dueño de la empresa COMPRADORA.
    await this.verifyOwner(dto.buyerCompanyId, userId);

    if (hasPracticeGroup) {
      // ── Contexto PRÁCTICA: ambas empresas deben ser miembros del grupo. ──
      const membersInGroup = await this.prisma.practiceGroupMember.count({
        where: {
          groupId:   dto.practiceGroupId!,
          companyId: { in: [dto.buyerCompanyId, dto.sellerCompanyId] },
        },
      });
      if (membersInGroup !== 2) {
        throw new BadRequestException(
          'Ambas empresas deben pertenecer al grupo de práctica indicado.',
        );
      }
    } else {
      // ── Contexto EJERCICIO: ambas empresas deben pertenecer al mismo exercise. ──
      const [buyer, seller] = await Promise.all([
        this.prisma.company.findUnique({
          where:  { id: dto.buyerCompanyId },
          select: { id: true, exerciseId: true },
        }),
        this.prisma.company.findUnique({
          where:  { id: dto.sellerCompanyId },
          select: { id: true, exerciseId: true },
        }),
      ]);
      if (!buyer)  throw new NotFoundException('Empresa compradora no encontrada');
      if (!seller) throw new NotFoundException('Empresa vendedora no encontrada');
      if (buyer.exerciseId !== dto.exerciseId || seller.exerciseId !== dto.exerciseId) {
        throw new BadRequestException(
          'Ambas empresas deben pertenecer al exercise indicado.',
        );
      }
    }

    const taxRate = new Decimal(dto.taxRate ?? 0.13);

    let subtotal = new Decimal(0);
    const items = dto.items.map((it) => {
      const qty       = new Decimal(it.quantity);
      const unitPrice = new Decimal(it.unitPrice);
      subtotal = subtotal.plus(qty.mul(unitPrice));
      return {
        description: it.description,
        cabysCode:   it.cabysCode ?? null,
        quantity:    it.quantity,
        unitPrice:   it.unitPrice,
      };
    });

    const taxAmount = subtotal.mul(taxRate).toDecimalPlaces(2);
    subtotal        = subtotal.toDecimalPlaces(2);
    const total     = subtotal.plus(taxAmount).toDecimalPlaces(2);

    const order = await this.prisma.procurementOrder.create({
      data: {
        exerciseId:      dto.exerciseId ?? null,
        practiceGroupId: dto.practiceGroupId ?? null,
        buyerCompanyId:  dto.buyerCompanyId,
        sellerCompanyId: dto.sellerCompanyId,
        status:          'PO_ISSUED',
        items:           items as unknown as Prisma.InputJsonValue,
        subtotal,
        taxAmount,
        total,
        notes:           dto.notes ?? null,
        createdById:     userId,
      },
    });

    this.logger.log(
      `OC ${order.id} emitida: comprador ${dto.buyerCompanyId} → vendedor ${dto.sellerCompanyId} (total ${total}).`,
    );
    return order;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  dispatch — el VENDEDOR despacha (PO_ISSUED → DISPATCHED)
  // ─────────────────────────────────────────────────────────────────────────
  async dispatch(orderId: string, userId: string) {
    const order = await this.getOrderOrThrow(orderId);
    await this.verifyOwner(order.sellerCompanyId, userId);
    // Transición atómica (idempotente ante doble-click / carrera).
    const moved = await this.prisma.procurementOrder.updateMany({
      where: { id: orderId, status: 'PO_ISSUED' },
      data:  { status: 'DISPATCHED' },
    });
    if (moved.count === 0) {
      throw new BadRequestException('No se puede despachar: la orden no está en estado PO_ISSUED.');
    }
    return this.getOrderOrThrow(orderId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  receive — el COMPRADOR recibe la mercancía → inventario (DISPATCHED → RECEIVED)
  // ─────────────────────────────────────────────────────────────────────────
  async receive(orderId: string, userId: string) {
    const order = await this.getOrderOrThrow(orderId);
    await this.verifyOwner(order.buyerCompanyId, userId);

    const items = (order.items as unknown as Array<{
      description: string; cabysCode: string | null; quantity: number; unitPrice: number;
    }>) ?? [];

    return this.prisma.$transaction(async (tx) => {
      // Transición atómica PRIMERO: si otra llamada ya recibió, count=0 → aborta
      // (evita duplicar lotes de inventario).
      const moved = await tx.procurementOrder.updateMany({
        where: { id: orderId, status: 'DISPATCHED' },
        data:  { status: 'RECEIVED' },
      });
      if (moved.count === 0) {
        throw new BadRequestException('No se puede recibir: la orden no está en estado DISPATCHED (¿ya recibida?).');
      }
      for (const item of items) {
        if (!item.cabysCode) continue;
        const product = await tx.product.findFirst({
          where:  {
            companyId:      order.buyerCompanyId,
            cabysCode:      item.cabysCode,
            isActive:       true,
            isService:      false,
            trackInventory: true,
          },
          select: { id: true },
        });
        if (!product) continue; // sin producto trackeable → se omite la línea

        await this.inventory.addLot(
          {
            companyId:   order.buyerCompanyId,
            productId:   product.id,
            qty:         item.quantity,
            unitCost:    item.unitPrice,
            source:      'PURCHASE',
            sourceId:    order.id,
            receivedAt:  new Date(),
            createdById: userId,
          },
          tx,
        );
      }

      return tx.procurementOrder.findUnique({ where: { id: orderId } });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  invoice — el VENDEDOR factura → CxP + asiento del COMPRADOR (RECEIVED → INVOICED)
  // ─────────────────────────────────────────────────────────────────────────
  async invoice(orderId: string, userId: string) {
    const order = await this.getOrderOrThrow(orderId);
    await this.verifyOwner(order.sellerCompanyId, userId);

    const seller = await this.prisma.company.findUnique({
      where:  { id: order.sellerCompanyId },
      select: { name: true, legalId: true },
    });
    if (!seller) throw new NotFoundException('Empresa vendedora no encontrada');

    const buyer = await this.prisma.company.findUnique({
      where:  { id: order.buyerCompanyId },
      select: { attemptId: true },
    });

    const subtotal  = new Decimal(order.subtotal.toString());
    const taxAmount  = new Decimal(order.taxAmount.toString());
    const total      = new Decimal(order.total.toString());
    const taxRate    = subtotal.gt(0)
      ? taxAmount.div(subtotal).toDecimalPlaces(4)
      : new Decimal(0);
    const date       = new Date();
    const invoiceNumber = `PO-${order.id.slice(0, 8)}`;

    return this.prisma.$transaction(async (tx) => {
      // Transición atómica PRIMERO (status RECEIVED + sin factura previa): evita
      // doble facturación / doble asiento por doble-click o carrera.
      const moved = await tx.procurementOrder.updateMany({
        where: { id: orderId, status: 'RECEIVED', purchaseInvoiceId: null },
        data:  { status: 'INVOICED' },
      });
      if (moved.count === 0) {
        throw new BadRequestException('No se puede facturar: la orden no está en RECEIVED o ya fue facturada.');
      }

      // 1. PurchaseInvoice del COMPRADOR (proveedor = empresa vendedora).
      const purchaseInvoice = await tx.purchaseInvoice.create({
        data: {
          companyId:       order.buyerCompanyId,
          attemptId:       buyer?.attemptId ?? null,
          supplierName:    seller.name,
          supplierCedula:  seller.legalId,
          invoiceNumber,
          date,
          subtotal,
          taxRate,
          taxAmount,
          total,
          description:     `Compra ERP orden ${order.id}`,
          isAccepted:      true,
          sourceInvoiceId: null,
        },
      });

      // 2. Asiento contable + CxP del comprador vía la puerta única probada.
      await this.businessEvents.recordPurchase({
        companyId:         order.buyerCompanyId,
        userId,
        tx,
        purchaseInvoiceId: purchaseInvoice.id,
        invoiceNumber,
        supplierName:      seller.name,
        supplierCedula:    seller.legalId,
        subtotal:          subtotal.toNumber(),
        taxAmount:         taxAmount.toNumber(),
        total:             total.toNumber(),
        paymentType:       'CREDIT',
        date,
      });

      // 3. Enlazar el purchaseInvoiceId (el status ya se movió atómicamente).
      return tx.procurementOrder.update({
        where: { id: orderId },
        data:  { purchaseInvoiceId: purchaseInvoice.id },
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  pay — el COMPRADOR paga (INVOICED → PAID)
  // ─────────────────────────────────────────────────────────────────────────
  async pay(orderId: string, userId: string) {
    const order = await this.getOrderOrThrow(orderId);
    await this.verifyOwner(order.buyerCompanyId, userId);

    if (!order.purchaseInvoiceId) {
      throw new BadRequestException(
        'La orden no tiene una factura de compra asociada; no se puede pagar.',
      );
    }

    // Claim atómico de la transición (previene doble pago por doble-click).
    const moved = await this.prisma.procurementOrder.updateMany({
      where: { id: orderId, status: 'INVOICED' },
      data:  { status: 'PAID' },
    });
    if (moved.count === 0) {
      throw new BadRequestException('No se puede pagar: la orden no está en estado INVOICED (¿ya pagada?).');
    }

    // Path probado de pago a proveedor (ApPayment + paidAmount/isPaid + asiento,
    // atómico). Si falla, revertimos la transición para no dejar la orden PAID
    // sin pago registrado.
    try {
      await this.accountsPayable.registerPayment(
        order.buyerCompanyId,
        {
          purchaseInvoiceId: order.purchaseInvoiceId,
          amount:            new Decimal(order.total.toString()).toNumber(),
          paymentDate:       new Date().toISOString(),
          method:            'TRANSFER',
          reference:         `PO-${order.id.slice(0, 8)}`,
        },
        userId,
      );
    } catch (e) {
      await this.prisma.procurementOrder.updateMany({
        where: { id: orderId, status: 'PAID' },
        data:  { status: 'INVOICED' },
      });
      throw e;
    }

    return this.getOrderOrThrow(orderId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  cancel — comprador o vendedor cancela mientras ∈ {PO_ISSUED, DISPATCHED}
  // ─────────────────────────────────────────────────────────────────────────
  async cancel(orderId: string, userId: string) {
    const order = await this.getOrderOrThrow(orderId);

    // Cualquiera de las dos partes puede cancelar.
    let allowed = false;
    for (const companyId of [order.buyerCompanyId, order.sellerCompanyId]) {
      try {
        await this.verifyOwner(companyId, userId);
        allowed = true;
        break;
      } catch {
        // no es dueño de esta empresa; probar la contraparte
      }
    }
    if (!allowed) {
      throw new NotFoundException('Orden de aprovisionamiento no encontrada');
    }

    // Transición atómica (solo desde PO_ISSUED/DISPATCHED).
    const moved = await this.prisma.procurementOrder.updateMany({
      where: { id: orderId, status: { in: ['PO_ISSUED', 'DISPATCHED'] } },
      data:  { status: 'CANCELLED' },
    });
    if (moved.count === 0) {
      throw new BadRequestException(
        `No se puede cancelar: la orden está en estado "${order.status}" ` +
        `(solo se permite en PO_ISSUED o DISPATCHED).`,
      );
    }
    return this.getOrderOrThrow(orderId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  listForCompany — órdenes donde la empresa es comprador o vendedor
  // ─────────────────────────────────────────────────────────────────────────
  async listForCompany(companyId: string, userId: string) {
    await this.verifyOwner(companyId, userId);

    const orders = await this.prisma.procurementOrder.findMany({
      where:   {
        OR: [{ buyerCompanyId: companyId }, { sellerCompanyId: companyId }],
      },
      orderBy: { createdAt: 'desc' },
    });

    // Nombres de las contrapartes en un solo query.
    const counterpartyIds = Array.from(new Set(
      orders.map((o) => (o.buyerCompanyId === companyId ? o.sellerCompanyId : o.buyerCompanyId)),
    ));
    const companies = counterpartyIds.length
      ? await this.prisma.company.findMany({
          where:  { id: { in: counterpartyIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(companies.map((c) => [c.id, c.name]));

    return orders.map((o) => {
      const role: 'BUYER' | 'SELLER' = o.buyerCompanyId === companyId ? 'BUYER' : 'SELLER';
      const counterpartyId = role === 'BUYER' ? o.sellerCompanyId : o.buyerCompanyId;
      return {
        ...o,
        role,
        counterpartyName: nameById.get(counterpartyId) ?? null,
      };
    });
  }
}
