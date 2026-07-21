import { Injectable, Logger } from '@nestjs/common';
import { Prisma, JournalSource } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalService } from '../journal/journal.service';
import { ARRecordsService } from '../accounts-receivable/ar-records.service';
import { APRecordsService } from '../accounts-payable/ap-records.service';
import { InventoryService } from '../inventory/inventory.service';
import {
  RulesEngineService,
  PaymentType,
  JournalEntrySpec,
  JournalLineSpec,
} from '../accounting/rules-engine.service';
import { ACCOUNT_CODES } from '../accounting/constants/account-codes';
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

/** Línea de nota (crédito o débito) — subconjunto de InvoiceItem que la
 *  contabilidad necesita: monto y, si aplica, el producto para inventario. */
export interface NoteLineInput {
  productId:   string | null;
  description: string;
  /** Cantidad devuelta/ajustada (positiva). */
  quantity:    number;
  subtotal:    number;
  taxAmount:   number;
  total:       number;
}

export interface RecordCreditNoteInput extends BaseEventInput {
  /** Id de la nota de crédito (sourceId para idempotencia). */
  creditNoteId:      string;
  /** Factura origen que la nota reversa. */
  invoiceId:         string;
  customerId:        string | null;
  /** Consecutivo de la nota (para descripción del asiento). */
  noteNumber:        number;
  /** Consecutivo de la factura origen (referencia legible). */
  invoiceReference:  string;
  customerName:      string;
  subtotal:          number;
  taxAmount:         number;
  total:             number;
  /** CASH → se devuelve efectivo (C Caja). CREDIT → se reduce CxC. */
  paymentType:       PaymentType;
  /** true → devolución de mercadería: restaura stock + revierte COGS. */
  restoreInventory:  boolean;
  /** Líneas de la nota (solo se usan si restoreInventory=true). */
  lines:             NoteLineInput[];
}

export interface RecordDebitNoteInput extends BaseEventInput {
  /** Id de la nota de débito (sourceId para idempotencia). */
  debitNoteId:       string;
  /** Factura origen sobre la que se carga el débito. */
  invoiceId:         string;
  customerId:        string | null;
  noteNumber:        number;
  invoiceReference:  string;
  customerName:      string;
  subtotal:          number;
  taxAmount:         number;
  total:             number;
  /** CASH → se cobra de contado (D Caja). CREDIT → aumenta CxC. */
  paymentType:       PaymentType;
}

/**
 * Evento de negocio tipado (Accounting Manifest §6). `dispatch()` es la
 * puerta única de escritura contable automática; cada `type` mapea a su
 * handler de dominio. Los escritores directos (nómina/cierre/depreciación)
 * se migran a esta puerta en F4 (I-AT-2).
 */
export type BusinessEvent =
  | ({ type: 'SALE_CREATED' }        & RecordSaleInput)
  | ({ type: 'PURCHASE_CREATED' }    & RecordPurchaseInput)
  | ({ type: 'PAYMENT_RECEIVED' }    & RecordCollectionInput)
  | ({ type: 'PAYMENT_MADE' }        & RecordPaymentInput)
  | ({ type: 'CREDIT_NOTE_ISSUED' }  & RecordCreditNoteInput)
  | ({ type: 'DEBIT_NOTE_ISSUED' }   & RecordDebitNoteInput);

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
    private readonly inventory:     InventoryService,
  ) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Puerta única de eventos de negocio (Accounting Manifest §6, I-AT-2).
   * Mapea el evento tipado a su handler de dominio.
   */
  async dispatch(event: BusinessEvent) {
    switch (event.type) {
      case 'SALE_CREATED':       return this.recordSale(event);
      case 'PURCHASE_CREATED':   return this.recordPurchase(event);
      case 'PAYMENT_RECEIVED':   return this.recordCollection(event);
      case 'PAYMENT_MADE':       return this.recordPayment(event);
      case 'CREDIT_NOTE_ISSUED': return this.recordCreditNote(event);
      case 'DEBIT_NOTE_ISSUED':  return this.recordDebitNote(event);
      default: {
        const _exhaustive: never = event;
        throw new Error(`Evento de negocio no soportado: ${(_exhaustive as any)?.type}`);
      }
    }
  }

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

  /**
   * Evento "nota de crédito": REVERSA (parcial) de una venta ya emitida.
   * Devolución de mercadería, descuento posterior o anulación.
   *
   * Asiento (espejo del de venta):
   *   D Ventas (4.1.01.01)          por subtotal de la nota
   *   D IVA débito (2.1.02.01)      por el impuesto de la nota (si > 0)
   *     C Cuentas por cobrar (1.1.02.01)  si la factura origen fue CRÉDITO
   *     C Caja (1.1.01.01)                si la factura origen fue CONTADO (devolución de efectivo)
   *   ── si restoreInventory (devolución de bienes) y hay productos tracked ──
   *   D Inventario (1.1.03.01)      por el costo de la mercadería devuelta
   *     C Costo de ventas (5.1.01.01)     por el mismo costo
   *
   *   AUTOMATIC → crea el asiento; HYBRID → asiento isPending; MANUAL → nada
   *   (idéntico a recordSale: respeta el AccountingMode de la empresa).
   *
   * En CRÉDITO reduce el saldo de la factura origen (invoice.balanceDue) y
   * reconcilia su registro AR. Idempotente por sourceType='credit_note'.
   */
  async recordCreditNote(input: RecordCreditNoteInput) {
    const mode = await this.modeResolver.forCompany(input.companyId);
    const ref  = `NC-${input.noteNumber} (ref. ${input.invoiceReference})`;

    // ── Cuenta de crédito: CxC si la factura origen fue a crédito; Caja si
    //    fue de contado (se devuelve efectivo). Espejo exacto de recordSale. ──
    const creditAccount = input.paymentType === 'CASH'
      ? ACCOUNT_CODES.CASH
      : ACCOUNT_CODES.ACCOUNTS_RECEIVABLE;

    const lines: JournalLineSpec[] = [
      {
        accountCode: ACCOUNT_CODES.REVENUE_SALES,
        debit:       input.subtotal,
        credit:      0,
        description: `Reversa de venta ${ref}`,
      },
    ];
    if (input.taxAmount > 0) {
      lines.push({
        accountCode: ACCOUNT_CODES.IVA_PAYABLE,
        debit:       input.taxAmount,
        credit:      0,
        description: `Reversa IVA débito ${ref}`,
      });
    }
    lines.push({
      accountCode: creditAccount,
      debit:       0,
      credit:      input.total,
      description: input.paymentType === 'CASH'
        ? `Devolución de efectivo ${ref}`
        : `Reducción de cuenta por cobrar ${ref}`,
    });

    // ── Reversa de COGS (solo si es devolución de bienes con inventario). ──
    // Valuamos la mercadería devuelta al costo estándar del producto
    // (Product.cost), mismo criterio que la ruta legacy de recordSale
    // (product.cost * qty). El re-alta de lote usa ese mismo costo, de modo
    // que D Inventario == C Costo de ventas y el kardex queda consistente.
    const { config } = await this.modeResolver.resolveConfig(input.companyId);
    const autoInventory = config?.autoInventory ?? false;

    // Productos a restaurar + costo total a revertir (lo calculamos ANTES de
    // entrar a la transacción, igual que `issue` calcula totalCost antes de
    // llamar a recordSale).
    const restorePlan: Array<{ productId: string; qty: Decimal; unitCost: Decimal }> = [];
    let totalCostReversed = new Decimal(0);

    if (input.restoreInventory && mode !== 'MANUAL') {
      const client = input.tx ?? this.prisma;
      for (const line of input.lines) {
        if (!line.productId) continue;
        const product = await client.product.findUnique({
          where:  { id: line.productId },
          select: { id: true, companyId: true, isService: true, trackInventory: true, cost: true },
        });
        // Multi-tenant: ignoramos productos que no sean de la empresa.
        if (!product || product.companyId !== input.companyId) continue;
        if (product.isService || !product.trackInventory) continue;
        if (!autoInventory) continue; // sin FIFO activo, no tocamos lotes (legacy = manual)
        const qty      = new Decimal(line.quantity.toString());
        if (qty.lte(0)) continue;
        const unitCost = new Decimal(product.cost.toString());
        const cost     = qty.times(unitCost).toDecimalPlaces(2);
        restorePlan.push({ productId: product.id, qty, unitCost });
        totalCostReversed = totalCostReversed.plus(cost);
      }
    }

    if (totalCostReversed.greaterThan(0)) {
      lines.push({
        accountCode: ACCOUNT_CODES.INVENTORY,
        debit:       totalCostReversed.toNumber(),
        credit:      0,
        description: `Reingreso de inventario ${ref}`,
      });
      lines.push({
        accountCode: ACCOUNT_CODES.COGS,
        debit:       0,
        credit:      totalCostReversed.toNumber(),
        description: `Reversa costo de ventas ${ref}`,
      });
    }

    const spec: JournalEntrySpec = {
      sourceType:  'credit_note',
      description: `Nota de crédito ${ref} — ${input.customerName}`,
      lines,
    };

    return this._runEvent(
      mode,
      input,
      spec,
      JournalSource.ADJUSTMENT,
      { sourceId: input.creditNoteId, invoiceId: input.invoiceId },
      async (tx) => {
        // 1. Restaurar inventario (re-alta de lote por producto devuelto).
        //    Cada lote entra como ADJUSTMENT con costo = Product.cost, mismo
        //    valor con el que revertimos el COGS arriba.
        for (const r of restorePlan) {
          await this.inventory.addLot(
            {
              companyId:   input.companyId,
              productId:   r.productId,
              qty:         r.qty,
              unitCost:    r.unitCost,
              source:      'ADJUSTMENT',
              sourceId:    input.creditNoteId,
              createdById: input.userId,
            },
            tx,
          );
        }

        // 2. En CRÉDITO: reducir el saldo de la factura origen y reconciliar
        //    su AR. balanceDue es la fuente de verdad (igual que recordCollection).
        if (input.paymentType === 'CREDIT' && mode !== 'MANUAL') {
          const invoice = await tx.invoice.findUnique({
            where:  { id: input.invoiceId },
            select: { balanceDue: true },
          });
          if (invoice) {
            const newBalance = new Decimal(invoice.balanceDue.toString())
              .minus(new Decimal(input.total.toFixed(2)));
            const clean = newBalance.lessThan(0) ? new Decimal(0) : newBalance;
            await tx.invoice.update({
              where: { id: input.invoiceId },
              data:  { balanceDue: clean },
            });
            await this.arRecords.reconcileFromInvoice(input.invoiceId, tx);
          }
        }
      },
    );
  }

  /**
   * Evento "nota de débito": AUMENTA lo que el cliente debe sobre una factura
   * ya emitida (intereses, cargos, ajuste al alza). NUNCA toca inventario.
   *
   * Asiento (mismo sentido que una venta, sin COGS):
   *   D Cuentas por cobrar (1.1.02.01)  si la factura origen fue CRÉDITO
   *   D Caja (1.1.01.01)                si es un cargo cobrado de contado
   *     C Ventas / Otros ingresos (4.1.01.01)  por el subtotal
   *     C IVA débito (2.1.02.01)               por el impuesto (si > 0)
   *
   *   AUTOMATIC → crea el asiento; HYBRID → isPending; MANUAL → nada.
   *
   * En CRÉDITO aumenta el saldo de la factura origen (crea el AR si no existía)
   * y reconcilia. Idempotente por sourceType='debit_note'.
   */
  async recordDebitNote(input: RecordDebitNoteInput) {
    const mode = await this.modeResolver.forCompany(input.companyId);
    const ref  = `ND-${input.noteNumber} (ref. ${input.invoiceReference})`;

    const debitAccount = input.paymentType === 'CASH'
      ? ACCOUNT_CODES.CASH
      : ACCOUNT_CODES.ACCOUNTS_RECEIVABLE;

    const lines: JournalLineSpec[] = [
      {
        accountCode: debitAccount,
        debit:       input.total,
        credit:      0,
        description: input.paymentType === 'CASH'
          ? `Cargo cobrado ${ref}`
          : `Cargo a cuenta por cobrar ${ref}`,
      },
      {
        accountCode: ACCOUNT_CODES.REVENUE_SALES,
        debit:       0,
        credit:      input.subtotal,
        description: `Cargo por nota de débito ${ref}`,
      },
    ];
    if (input.taxAmount > 0) {
      lines.push({
        accountCode: ACCOUNT_CODES.IVA_PAYABLE,
        debit:       0,
        credit:      input.taxAmount,
        description: `IVA débito ${ref}`,
      });
    }

    const spec: JournalEntrySpec = {
      sourceType:  'debit_note',
      description: `Nota de débito ${ref} — ${input.customerName}`,
      lines,
    };

    return this._runEvent(
      mode,
      input,
      spec,
      JournalSource.ADJUSTMENT,
      { sourceId: input.debitNoteId, invoiceId: input.invoiceId },
      async (tx) => {
        // En CRÉDITO: aumentar el saldo de la factura origen y su AR.
        if (input.paymentType === 'CREDIT' && mode !== 'MANUAL') {
          const invoice = await tx.invoice.findUnique({
            where:  { id: input.invoiceId },
            select: { balanceDue: true, clientId: true },
          });
          if (invoice) {
            const newBalance = new Decimal(invoice.balanceDue.toString())
              .plus(new Decimal(input.total.toFixed(2)));
            await tx.invoice.update({
              where: { id: input.invoiceId },
              data:  { balanceDue: newBalance },
            });
            // Aseguramos que exista un registro AR para la factura (si la venta
            // original no lo creó, p. ej. era de contado y ahora se le carga a
            // crédito) y luego reconciliamos su saldo contra balanceDue.
            await this.arRecords.createFromInvoice(
              {
                companyId:  input.companyId,
                invoiceId:  input.invoiceId,
                customerId: input.customerId ?? invoice.clientId ?? null,
                total:      Number(newBalance),
              },
              tx,
            );
            await this.arRecords.reconcileFromInvoice(input.invoiceId, tx);
          }
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
