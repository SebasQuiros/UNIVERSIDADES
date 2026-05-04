import { Injectable, Logger } from '@nestjs/common';
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
        description:    `Inter-company: compra automática a ${seller.name}`,
        isAccepted:     true,
      },
    });

    // 6. Mirror de inventario: si buyer tiene autoInventory activo, intentamos
    // mapear cada línea con product de buyer (por cabysCode o por nombre).
    const buyerCfg = await this.modeResolver.resolveConfig(buyer.id);
    if (buyerCfg.config?.autoInventory) {
      for (const item of invoice.items) {
        // Match SOLO por cabysCode (estricto, 13 dígitos único por catálogo
        // CABYS de Hacienda CR). El match por `name`/descripción libre era
        // laxo y abría contaminación de inventario por colisión.
        if (!item.cabysCode) continue;
        const buyerProduct = await tx.product.findFirst({
          where: {
            companyId:      buyer.id,
            cabysCode:      item.cabysCode,
            isActive:       true,
            isService:      false,
            trackInventory: true,
          },
          select: { id: true },
        });
        if (!buyerProduct) continue; // sin match → solo asiento agregado

        await this.inventory.addLot(
          {
            companyId:   buyer.id,
            productId:   buyerProduct.id,
            qty:         item.quantity,
            unitCost:    item.unitPrice, // costo del comprador = precio cobrado por el vendedor
            source:      'PURCHASE',
            sourceId:    purchaseInvoice.id,
            receivedAt:  invoice.issueDate,
            createdById: input.userId,
          },
          tx,
        );
      }
    }

    // 7. Asiento contable + AccountPayable en buyer (recordPurchase respeta su propio modo).
    await this.businessEvents.recordPurchase({
      companyId:         buyer.id,
      userId:            input.userId,
      tx,
      purchaseInvoiceId: purchaseInvoice.id,
      invoiceNumber:     purchaseInvoice.invoiceNumber,
      supplierName:      seller.name,
      supplierCedula:    seller.legalId,
      subtotal:          Number(subtotal),
      taxAmount:         Number(tax),
      total:             Number(total),
      paymentType:       'CREDIT', // convención inter-company: a crédito
      date:              invoice.issueDate,
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
}
