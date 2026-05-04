import { Injectable, Logger } from '@nestjs/common';
import { Prisma, JournalSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalService } from '../journal/journal.service';
import { ARRecordsService } from '../accounts-receivable/ar-records.service';
import { APRecordsService } from '../accounts-payable/ap-records.service';
import {
  RulesEngineService,
  PaymentType,
  JournalEntrySpec,
} from '../accounting/rules-engine.service';
import { AccountingModeResolver, AccountingMode } from '../accounting/accounting-mode.resolver';

/**
 * ────────────────────────────────────────────────────────────────
 *  BusinessEventsService — capa unificada de eventos de negocio
 *
 *  Cualquier acción del usuario que tenga consecuencia contable
 *  (vender, comprar, cobrar, pagar, planilla) llama aquí. Este
 *  servicio decide:
 *    1. ¿En qué modo está la empresa?  → MANUAL: nada / AUTO: asiento
 *    2. ¿Qué cuentas tocar?            → delega al RulesEngine
 *    3. ¿Persistir cambio en AR/AP?    → delega a AR/APRecords
 *    4. Crear el asiento               → delega a JournalService
 *
 *  Todos los métodos aceptan un `tx` opcional para participar de la
 *  transacción del caller (idempotente con la transacción del invoice
 *  issue, payment register, etc.).
 *
 *  Mapping de modo:
 *    MANUAL    → no asiento, no AR/AP (estudiante hace todo a mano)
 *    AUTOMATIC → asiento + AR/AP normales
 *    HYBRID    → asiento marcado isPending=true + AR/AP normales
 *
 *  Mapping enum JournalSource (legacy):
 *    sale       → AUTO_INVOICE
 *    purchase   → AUTO_PURCHASE
 *    collection → AUTO_PAYMENT (cobro al cliente)
 *    payment    → AUTO_PAYMENT (pago a proveedor)
 *    payroll    → MANUAL (todavía no hay enum dedicado; ver TODO)
 * ────────────────────────────────────────────────────────────────
 */

interface BaseEventInput {
  companyId: string;
  userId:    string;
  /** Fecha contable del evento. Default: hoy. */
  date?:     Date;
  /** Si el caller ya está dentro de una transacción Prisma, pásala. */
  tx?:       Prisma.TransactionClient;
}

export interface RecordSaleInput extends BaseEventInput {
  invoiceId:         string;
  customerId:        string | null;
  consecutiveNumber: string;
  customerName:      string;
  subtotal:          number;
  taxAmount:         number;
  total:             number;
  totalCost:         number;
  paymentType:       PaymentType;
}

export interface RecordPurchaseInput extends BaseEventInput {
  purchaseInvoiceId: string;
  invoiceNumber:     string;
  supplierName:      string;
  supplierCedula?:   string | null;
  subtotal:          number;
  taxAmount:         number;
  total:             number;
  paymentType:       PaymentType;
}

export interface RecordCollectionInput extends BaseEventInput {
  invoiceId:         string;
  consecutiveNumber: string;
  customerName:      string;
  amount:            number;
}

export interface RecordPaymentInput extends BaseEventInput {
  purchaseInvoiceId: string;
  invoiceNumber:     string;
  supplierName:      string;
  amount:            number;
}

@Injectable()
export class BusinessEventsService {
  private readonly logger = new Logger(BusinessEventsService.name);

  constructor(
    private readonly prisma:        PrismaService,
    private readonly journal:       JournalService,
    private readonly rules:         RulesEngineService,
    private readonly modeResolver:  AccountingModeResolver,
    private readonly arRecords:     ARRecordsService,
    private readonly apRecords:     APRecordsService,
  ) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Evento "venta": una factura fue emitida.
   *
   *   AUTOMATIC  → genera asiento Venta + (opcional COGS) + AR record
   *   HYBRID     → igual pero asiento queda isPending=true
   *   MANUAL     → no hace nada (estudiante registra a mano)
   *
   * Se llama DESPUÉS de que la factura está creada/emitida en BD.
   */
  async recordSale(input: RecordSaleInput) {
    const mode = await this.modeResolver.forCompany(input.companyId);

    const spec = this.rules.forSale({
      subtotal:          input.subtotal,
      taxAmount:         input.taxAmount,
      total:             input.total,
      totalCost:         input.totalCost,
      paymentType:       input.paymentType,
      documentReference: `FE-${input.consecutiveNumber}`,
      counterpartyLabel: input.customerName,
    });

    return this._runEvent(
      mode,
      input,
      spec,
      JournalSource.AUTO_INVOICE,
      {
        invoiceId: input.invoiceId,
        sourceId:  input.invoiceId,
      },
      async (tx) => {
        // AR record solo si fue a crédito y existe customer
        if (input.paymentType === 'CREDIT' && mode !== 'MANUAL') {
          await this.arRecords.createFromInvoice(
            {
              companyId:  input.companyId,
              invoiceId:  input.invoiceId,
              customerId: input.customerId,
              total:      input.total,
            },
            tx,
          );
        }
      },
    );
  }

  /**
   * Evento "compra": una factura de proveedor fue registrada.
   *   AUTOMATIC → asiento Compra + AP record
   *   HYBRID    → asiento isPending + AP record
   *   MANUAL    → nada
   */
  async recordPurchase(input: RecordPurchaseInput) {
    const mode = await this.modeResolver.forCompany(input.companyId);

    const spec = this.rules.forPurchase({
      subtotal:          input.subtotal,
      taxAmount:         input.taxAmount,
      total:             input.total,
      paymentType:       input.paymentType,
      documentReference: input.invoiceNumber,
      counterpartyLabel: input.supplierName,
    });

    return this._runEvent(
      mode,
      input,
      spec,
      JournalSource.AUTO_PURCHASE,
      { sourceId: input.purchaseInvoiceId },
      async (tx) => {
        if (input.paymentType === 'CREDIT' && mode !== 'MANUAL') {
          await this.apRecords.createFromPurchaseInvoice(
            {
              companyId:         input.companyId,
              purchaseInvoiceId: input.purchaseInvoiceId,
              supplierName:      input.supplierName,
              supplierCedula:    input.supplierCedula,
              total:             input.total,
            },
            tx,
          );
        }
      },
    );
  }

  /**
   * Evento "cobro": el cliente pagó (parcial o total) una factura a crédito.
   *   AUTOMATIC → asiento Caja/AR + reduce balance AR
   *   HYBRID    → asiento isPending + reduce balance AR
   *   MANUAL    → nada
   */
  async recordCollection(input: RecordCollectionInput) {
    const mode = await this.modeResolver.forCompany(input.companyId);

    const spec = this.rules.forCollection({
      amount:            input.amount,
      documentReference: `FE-${input.consecutiveNumber}`,
      counterpartyLabel: input.customerName,
    });

    // sourceId único por cobro (no por factura) — un cliente puede pagar
    // una misma factura varias veces (parcial). Combinamos con timestamp
    // para evitar colisión del unique(sourceType, sourceId).
    const collectionSourceId = `${input.invoiceId}:${Date.now()}`;

    return this._runEvent(
      mode,
      input,
      spec,
      JournalSource.AUTO_PAYMENT,
      { sourceId: collectionSourceId, invoiceId: input.invoiceId },
      async (tx) => {
        if (mode !== 'MANUAL') {
          // Reconciliamos contra invoice.balanceDue (fuente de verdad)
          // en lugar de calcular sobre AR.balance (que podría desviarse).
          await this.arRecords.reconcileFromInvoice(input.invoiceId, tx);
        }
      },
    );
  }

  /**
   * Evento "pago": pagamos (parcial o total) una factura de proveedor.
   *   AUTOMATIC → asiento AP/Caja + reduce balance AP
   *   HYBRID    → asiento isPending + reduce balance AP
   *   MANUAL    → nada
   */
  async recordPayment(input: RecordPaymentInput) {
    const mode = await this.modeResolver.forCompany(input.companyId);

    const spec = this.rules.forPayment({
      amount:            input.amount,
      documentReference: input.invoiceNumber,
      counterpartyLabel: input.supplierName,
    });

    const paymentSourceId = `${input.purchaseInvoiceId}:${Date.now()}`;

    return this._runEvent(
      mode,
      input,
      spec,
      JournalSource.AUTO_PAYMENT,
      { sourceId: paymentSourceId },
      async (tx) => {
        if (mode !== 'MANUAL') {
          // Reconciliamos contra PurchaseInvoice (fuente de verdad).
          await this.apRecords.reconcileFromPurchaseInvoice(input.purchaseInvoiceId, tx);
        }
      },
    );
  }

  // ── Internals ────────────────────────────────────────────────────────────

  /**
   * Núcleo común a todos los eventos:
   *   1. Aplica side-effects (AR/AP, etc.)
   *   2. Si el modo no es MANUAL, crea el asiento
   *   3. Si el modo es HYBRID, lo marca como pendiente
   *
   * Si el caller pasa `tx`, todo corre en su transacción. Si no, abrimos una.
   */
  private async _runEvent(
    mode:        AccountingMode,
    input:       BaseEventInput,
    spec:        JournalEntrySpec,
    legacySource: JournalSource,
    refs:        { invoiceId?: string; paymentId?: string; sourceId: string },
    sideEffects: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    const date = input.date ?? new Date();

    const run = async (tx: Prisma.TransactionClient) => {
      this.logger.log(
        `[event=${spec.sourceType}] mode=${mode} company=${input.companyId} ` +
        `lines=${spec.lines.length} sourceId=${refs.sourceId}`,
      );

      // 1. Side effects (AR/AP, etc.) — siempre se ejecutan, mode los respeta internamente
      await sideEffects(tx);

      // 2. En modo MANUAL no creamos asiento
      if (mode === 'MANUAL') {
        this.logger.log(`[event=${spec.sourceType}] modo MANUAL → asiento omitido`);
        return null;
      }

      // 3. Crear asiento (auto, o pendiente si HYBRID)
      const entry = await this.journal.createAutoEntry(
        input.companyId,
        spec.description,
        date,
        spec.lines,
        input.userId,
        legacySource,
        tx,
        refs.invoiceId,
        refs.paymentId,
        spec.sourceType,
        refs.sourceId,
        mode === 'HYBRID',
      );

      this.logger.log(
        `[event=${spec.sourceType}] entry=#${(entry as any).entryNumber} ` +
        `status=${mode === 'HYBRID' ? 'PENDING' : 'CONFIRMED'} ` +
        `D/C=${spec.lines.reduce((s, l) => s + l.debit, 0).toFixed(2)}`,
      );
      return entry;
    };

    if (input.tx) {
      return run(input.tx);
    }
    return this.prisma.$transaction(run);
  }
}
