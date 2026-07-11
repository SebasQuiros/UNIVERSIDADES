import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AccountingModeResolver } from '../accounting/accounting-mode.resolver';
import { BusinessEventsService } from '../business/business-events.service';
import { InventoryService } from '../inventory/inventory.service';

export interface InterCompanyMirrorInput {
  /** Company A — vendedora. */
  sellerCompanyId: string;
  /** Usuario que disparó la venta. */
  userId: string;
  /** Factura recién emitida en A. */
  invoiceId: string;
  /** Cliente de A (puede coincidir con otra Company B del mismo exercise). */
  customerId: string | null;
}

/**
 * InterCompanyService — Fase 4.
 *
 * Cuando `ExerciseConfig.autoTransactionsBetweenCompanies = true` y una Company A
 * emite una factura a un cliente cuyo `identification` coincide con el `legalId`
 * de otra Company B del MISMO `exercise_id`, se crea automáticamente la
 * contrapartida en B:
 *   - PurchaseInvoice (con A como proveedor)
 *   - addLot por cada línea con producto trackeable en B (matched por cabysCode o name)
 *   - Asiento contable + AccountPayable vía BusinessEventsService.recordPurchase
 *
 * Si NO hay match (cliente externo a la simulación), no hace nada — silencioso.
 *
 * Diseño:
 *   - Recibe `tx` para correr DENTRO de la transacción que ya abrió el flujo
 *     de venta (InvoicesService.issue). Si algo falla, rollback de TODO.
 *   - No falla el flujo principal de venta si la mirror falla; loguea warning
 *     y propaga (decisión: si la simulación es estricta, queremos saber).
 */
@Injectable()
export class InterCompanyService {
  private readonly logger = new Logger(InterCompanyService.name);

  constructor(
    private readonly prisma:        PrismaService,
    private readonly modeResolver:  AccountingModeResolver,
    private readonly businessEvents: BusinessEventsService,
    private readonly inventory:     InventoryService,
  ) {}

  /**
   * Disparado al emitir factura. Si la config lo permite y el cliente es una
   * Company del mismo exercise, replica como compra en la otra.
   *
   * Devuelve `{ mirrored: true, buyerCompanyId, purchaseInvoiceId }` cuando
   * efectivamente generó contrapartida, o `{ mirrored: false, reason }` cuando
   * no aplica.
   */
  async mirrorSaleToBuyer(
    input: InterCompanyMirrorInput,
    tx: Prisma.TransactionClient,
  ): Promise<{ mirrored: boolean; reason?: string; buyerCompanyId?: string; purchaseInvoiceId?: string }> {
    // 1. Config del seller — solo procedemos si está activado el toggle.
    const { config } = await this.modeResolver.resolveConfig(input.sellerCompanyId);
    if (!config?.autoTransactionsBetweenCompanies) {
      return { mirrored: false, reason: 'auto_inter_company_off' };
    }

    // Motor de Simulación Comercial (F2).
    //   CONTABLE     → compra espejo inmediata (efectos ahora).
    //   EMPRESARIAL  → propuesta de compra pendiente que B acepta/rechaza (F2.2).
    //   ERP_COMPLETO → cotización→OC→recepción→factura→pago (F2.3, aún no acá).
    const commercialMode = (config as any).commercialMode ?? 'CONTABLE';
    if (commercialMode === 'ERP_COMPLETO') {
      return { mirrored: false, reason: 'commercial_mode_erp_completo_awaiting_flow' };
    }
    const isContable = commercialMode === 'CONTABLE';
    if (!input.customerId) {
      return { mirrored: false, reason: 'no_customer' };
    }

    // 2. Cargamos seller + client en paralelo.
    // Importante: el `findFirst` del cliente está SCOPEADO a sellerCompanyId.
    // Defensivo contra IDOR — si en algún flujo futuro se invoca con un
    // customerId de otra company, no retornará nada y se aborta el mirror.
    const [seller, client] = await Promise.all([
      tx.company.findUnique({
        where:  { id: input.sellerCompanyId },
        select: { id: true, name: true, legalId: true, exerciseId: true },
      }),
      tx.client.findFirst({
        where:  { id: input.customerId, companyId: input.sellerCompanyId },
        select: { id: true, name: true, identification: true },
      }),
    ]);
    if (!seller?.exerciseId) {
      return { mirrored: false, reason: 'seller_without_exercise' };
    }
    if (!client?.identification) {
      return { mirrored: false, reason: 'client_without_identification_or_not_owned' };
    }

    // 3. Match por legalId dentro del MISMO exercise.
    const buyer = await tx.company.findFirst({
      where: {
        exerciseId: seller.exerciseId,
        legalId:    client.identification,
        NOT:        { id: seller.id },
        isCompanyEnabled: true,
      },
      select: {
        id: true, name: true, legalId: true, attemptId: true, mode: true,
      },
    });
    if (!buyer) {
      return { mirrored: false, reason: 'no_matching_company' };
    }

    // 4. Cargar la factura recién emitida con sus líneas.
    const invoice = await tx.invoice.findUnique({
      where:  { id: input.invoiceId },
      include: { items: true },
    });
    if (!invoice) {
      return { mirrored: false, reason: 'invoice_not_found' };
    }

    // 5. Crear PurchaseInvoice en el buyer.
    // taxRate del invoice está como Decimal con valor "13", "0.13", o porcentaje;
    // mantenemos el ratio que usa el módulo de purchase-invoices (Decimal entre 0 y 1).
    const subtotal = new Decimal(invoice.subtotal.toString());
    const tax      = new Decimal(invoice.tax.toString());
    const total    = new Decimal(invoice.total.toString());
    const taxRate  = subtotal.gt(0)
      ? tax.div(subtotal).toDecimalPlaces(4)
      : new Decimal(0);

    const purchaseInvoice = await tx.purchaseInvoice.create({
      data: {
        companyId:      buyer.id,
        // attemptId puede ser null para GROUP — preserva nullable del schema.
        attemptId:      buyer.attemptId ?? null,
        supplierName:   seller.name,
        supplierCedula: seller.legalId,
        invoiceNumber:  `FE-${invoice.consecutiveNumber}`,
        date:           invoice.issueDate,
        subtotal:       subtotal,
        taxRate:        taxRate,
        taxAmount:      tax,
        total:          total,
        description:    isContable
          ? `Inter-company: compra automática a ${seller.name}`
          : `Propuesta de compra de ${seller.name} — pendiente de aceptación`,
        isAccepted:      isContable,
        sourceInvoiceId: invoice.id,
      },
    });

    // EMPRESARIAL: la propuesta queda pendiente; los efectos (inventario, asiento,
    // CxP) se aplican cuando la empresa compradora ACEPTA (acceptProposal).
    if (!isContable) {
      this.logger.log(
        `Inter-company: propuesta de compra ${seller.name} → ${buyer.name} ` +
        `(pendiente, PI ${purchaseInvoice.id})`,
      );
      return { mirrored: false, reason: 'proposal_created', buyerCompanyId: buyer.id, purchaseInvoiceId: purchaseInvoice.id };
    }

    // 6-7. Modo Contable: efectos de la compra (inventario + asiento + CxP) ahora.
    await this._applyPurchaseEffects(tx, {
      buyerId:        buyer.id,
      sellerName:     seller.name,
      sellerLegalId:  seller.legalId,
      purchaseInvoice,
      sellerItems:    invoice.items,
      userId:         input.userId,
    });

    this.logger.log(
      `Inter-company mirror: venta de ${seller.name} → compra en ${buyer.name} (${purchaseInvoice.id})`,
    );
    return {
      mirrored: true,
      buyerCompanyId:    buyer.id,
      purchaseInvoiceId: purchaseInvoice.id,
    };
  }

  // ── F2.2 · Modo Empresarial: propuestas de compra ────────────────────────

  /** Propuestas de compra pendientes de aceptación de una empresa compradora. */
  async listPendingProposals(companyId: string) {
    return this.prisma.purchaseInvoice.findMany({
      where:   { companyId, isAccepted: false, sourceInvoiceId: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Acepta una propuesta: aplica los efectos (inventario + asiento + CxP) y la
   * marca aceptada. Todo en una transacción atómica.
   */
  async acceptProposal(companyId: string, purchaseInvoiceId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const pi = await tx.purchaseInvoice.findFirst({
        where: { id: purchaseInvoiceId, companyId, isAccepted: false },
      });
      if (!pi) throw new NotFoundException('Propuesta de compra no encontrada o ya procesada.');

      let sellerItems: Array<{ cabysCode: string | null; quantity: any; unitPrice: any }> = [];
      if (pi.sourceInvoiceId) {
        const sellerInvoice = await tx.invoice.findUnique({
          where:   { id: pi.sourceInvoiceId },
          include: { items: true },
        });
        if (sellerInvoice) sellerItems = sellerInvoice.items as any;
      }

      await this._applyPurchaseEffects(tx, {
        buyerId:         companyId,
        sellerName:      pi.supplierName,
        sellerLegalId:   pi.supplierCedula,
        purchaseInvoice: pi,
        sellerItems,
        userId,
      });

      await tx.purchaseInvoice.update({ where: { id: pi.id }, data: { isAccepted: true } });
      this.logger.log(`Propuesta de compra ${pi.id} aceptada por empresa ${companyId}.`);
      return { accepted: true, purchaseInvoiceId: pi.id };
    });
  }

  /** Rechaza (elimina) una propuesta pendiente. Aún no tuvo efectos contables. */
  async rejectProposal(companyId: string, purchaseInvoiceId: string) {
    const pi = await this.prisma.purchaseInvoice.findFirst({
      where: { id: purchaseInvoiceId, companyId, isAccepted: false },
    });
    if (!pi) throw new NotFoundException('Propuesta de compra no encontrada o ya procesada.');
    await this.prisma.purchaseInvoice.delete({ where: { id: pi.id } });
    this.logger.log(`Propuesta de compra ${pi.id} rechazada por empresa ${companyId}.`);
    return { rejected: true, purchaseInvoiceId };
  }

  // ── Efectos de compra reusables (Contable inmediato / aceptación Empresarial) ──
  private async _applyPurchaseEffects(
    tx: Prisma.TransactionClient,
    p: {
      buyerId: string;
      sellerName: string;
      sellerLegalId: string | null;
      purchaseInvoice: { id: string; invoiceNumber: string; subtotal: any; taxAmount: any; total: any; date: Date };
      sellerItems: Array<{ cabysCode: string | null; quantity: any; unitPrice: any }>;
      userId: string;
    },
  ) {
    // Inventario (si el comprador tiene autoInventory): match estricto por cabysCode.
    const buyerCfg = await this.modeResolver.resolveConfig(p.buyerId);
    if (buyerCfg.config?.autoInventory) {
      for (const item of p.sellerItems) {
        if (!item.cabysCode) continue;
        const buyerProduct = await tx.product.findFirst({
          where:  { companyId: p.buyerId, cabysCode: item.cabysCode, isActive: true, isService: false, trackInventory: true },
          select: { id: true },
        });
        if (!buyerProduct) continue;
        await this.inventory.addLot(
          {
            companyId:   p.buyerId,
            productId:   buyerProduct.id,
            qty:         item.quantity,
            unitCost:    item.unitPrice,
            source:      'PURCHASE',
            sourceId:    p.purchaseInvoice.id,
            receivedAt:  p.purchaseInvoice.date,
            createdById: p.userId,
          },
          tx,
        );
      }
    }

    // Asiento contable + AccountPayable (recordPurchase respeta el modo de la empresa).
    await this.businessEvents.recordPurchase({
      companyId:         p.buyerId,
      userId:            p.userId,
      tx,
      purchaseInvoiceId: p.purchaseInvoice.id,
      invoiceNumber:     p.purchaseInvoice.invoiceNumber,
      supplierName:      p.sellerName,
      supplierCedula:    p.sellerLegalId,
      subtotal:          Number(p.purchaseInvoice.subtotal),
      taxAmount:         Number(p.purchaseInvoice.taxAmount),
      total:             Number(p.purchaseInvoice.total),
      paymentType:       'CREDIT',
      date:              p.purchaseInvoice.date,
    });
  }
}
