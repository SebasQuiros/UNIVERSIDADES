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
import { ACCOUNT_CODES } from '../accounting/constants/account-codes';
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
        let product = await tx.product.findFirst({
          where:  {
            companyId:      order.buyerCompanyId,
            cabysCode:      item.cabysCode,
            isActive:       true,
            isService:      false,
            trackInventory: true,
          },
          select: { id: true },
        });

        // Si el comprador no tiene ese producto en su catálogo, se da de alta
        // con los datos de la línea.
        //
        // Antes la línea se omitía en silencio, y eso dejaba los libros
        // peleados consigo mismos: la compra SIEMPRE debita Inventario, así
        // que el balance mostraba mercadería que el kardex no tenía. Para un
        // estudiante eso es inexplicable — y no es su error.
        if (!product) {
          product = await tx.product.create({
            data: {
              companyId:      order.buyerCompanyId,
              name:           item.description,
              sku:            `AUTO-${item.cabysCode.slice(-6)}`,
              cabysCode:      item.cabysCode,
              price:          new Decimal(item.unitPrice.toString()).mul(1.3).toDecimalPlaces(2),
              cost:           new Decimal(item.unitPrice.toString()),
              taxRate:        13,
              trackInventory: true,
              isService:      false,
              isActive:       true,
            },
            select: { id: true },
          });
          this.logger.log(
            `Orden ${orderId}: se dio de alta "${item.description}" en el catálogo del ` +
            `comprador para que la mercadería recibida entre a inventario.`,
          );
        }

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

    // Además del attemptId hacen falta nombre y cédula: el vendedor registra
    // al comprador como cliente en sus propios libros.
    const buyer = await this.prisma.company.findUnique({
      where:  { id: order.buyerCompanyId },
      select: { attemptId: true, name: true, legalId: true },
    });

    const subtotal  = new Decimal(order.subtotal.toString());
    const taxAmount  = new Decimal(order.taxAmount.toString());
    const total      = new Decimal(order.total.toString());
    // Se guarda como PORCENTAJE (13), la convención de purchase_invoices.
    const taxRate    = subtotal.gt(0)
      ? taxAmount.div(subtotal).times(100).toDecimalPlaces(2)
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
        // La mercadería YA entró al kardex del comprador en el paso `receive`
        // (ver addLot más arriba). Sin decirlo explícitamente, la compra iría
        // contra Compras y el inventario en libros quedaría en cero mientras
        // el kardex muestra existencias: el balance y el kardex diciendo cosas
        // distintas, que es exactamente lo que este flujo ya arregló una vez.
        debitAccountCode:  ACCOUNT_CODES.INVENTORY,
      });

      // 3. El OTRO lado: la empresa vendedora también vendió.
      //
      // Antes solo se contabilizaba la compra. En una economía simulada donde
      // los equipos se venden entre sí, eso dejaba los libros del vendedor
      // vacíos: sin ingresos y sin cuenta por cobrar. Su estado de resultados
      // salía en cero y el ranking —que puntúa por rentabilidad— lo castigaba
      // como si nunca hubiera vendido.
      //
      // El comprador ya registró la operación a CRÉDITO, así que el espejo
      // también es a crédito: el cobro llega cuando pague (ver `pay`).
      const nombreComprador = buyer?.name ?? 'Empresa compradora';
      const cedulaComprador = buyer?.legalId ?? '000000000';
      const cliente =
        (await tx.client.findFirst({
          where:  { companyId: order.sellerCompanyId, identification: cedulaComprador },
          select: { id: true, name: true, identification: true },
        })) ??
        (await tx.client.create({
          data: {
            companyId:      order.sellerCompanyId,
            name:           nombreComprador,
            identification: cedulaComprador,
            creditDays:     30,
          },
          select: { id: true, name: true, identification: true },
        }));

      const ventaEspejo = await tx.invoice.create({
        data: {
          companyId:            order.sellerCompanyId,
          clientId:             cliente.id,
          clientName:           cliente.name,
          clientIdentification: cliente.identification,
          consecutiveNumber:    `ERP-${order.id.slice(0, 8).toUpperCase()}`,
          issueDate:            date,
          createdById:          userId,
          status:               'ISSUED',
          saleCondition:        'CREDIT',
          subtotal,
          tax:                  taxAmount,
          total,
          balanceDue:           total,
        },
      });

      await this.businessEvents.recordSale({
        companyId:         order.sellerCompanyId,
        userId,
        tx,
        invoiceId:         ventaEspejo.id,
        customerId:        cliente.id,
        consecutiveNumber: ventaEspejo.consecutiveNumber,
        customerName:      cliente.name,
        subtotal:          subtotal.toNumber(),
        taxAmount:         taxAmount.toNumber(),
        total:             total.toNumber(),
        totalCost:         0, // el costo de la mercancía ya salió al despachar
        paymentType:       'CREDIT',
        date,
      });

      // 4. Enlazar el purchaseInvoiceId (el status ya se movió atómicamente).
      return tx.procurementOrder.update({
        where: { id: orderId },
        data:  { purchaseInvoiceId: purchaseInvoice.id, sellerInvoiceId: ventaEspejo.id },
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

    // El otro lado: el VENDEDOR cobra. Sin esto su cuenta por cobrar contra el
    // comprador quedaba abierta para siempre, aunque ya le hubieran pagado.
    //
    // Va aparte del pago del comprador a propósito: si el espejo fallara, el
    // pago —que es el que el usuario ejecutó— ya quedó firme. Se registra el
    // problema en vez de tumbar la operación.
    if (order.sellerInvoiceId) {
      try {
        const venta = await this.prisma.invoice.findUnique({
          where:  { id: order.sellerInvoiceId },
          select: { id: true, consecutiveNumber: true, clientName: true },
        });
        if (venta) {
          // El ORDEN importa: recordCollection reconcilia la cuenta por cobrar
          // CONTRA el saldo de la factura, que es su fuente de verdad. Si se
          // cancela el saldo después, la reconciliación ve la factura todavía
          // impaga y la CxC queda abierta pese al cobro.
          // No se toca `status`: InvoiceStatus no tiene PAID (es el estado del
          // comprobante ante Hacienda, no el de cobro). Lo que marca que ya se
          // pagó es `balanceDue` en cero, que es de donde lee el aging.
          await this.prisma.invoice.update({
            where: { id: venta.id },
            data:  { balanceDue: 0 },
          });
          await this.businessEvents.recordCollection({
            companyId:         order.sellerCompanyId,
            userId,
            invoiceId:         venta.id,
            consecutiveNumber: venta.consecutiveNumber,
            customerName:      venta.clientName,
            amount:            new Decimal(order.total.toString()).toNumber(),
          });
        }
      } catch (e: any) {
        this.logger?.warn?.(
          `Orden ${orderId}: el pago del comprador quedó registrado, pero falló el cobro ` +
          `del vendedor (${order.sellerCompanyId}): ${e?.message}`,
        );
      }
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
