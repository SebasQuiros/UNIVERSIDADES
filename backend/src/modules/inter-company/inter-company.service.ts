import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AccountingModeResolver } from '../accounting/accounting-mode.resolver';
import { BusinessEventsService } from '../business/business-events.service';
import { InventoryService } from '../inventory/inventory.service';
import { classifyMirrorOutcome, MirrorOutcome, MirrorStatus } from './mirror-status';

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
 * InterCompanyService — Fase 4 + Cimiento A (outbox del espejo, FASE 2a).
 *
 * Cuando `ExerciseConfig.autoTransactionsBetweenCompanies = true` y una Company A
 * emite una factura a un cliente cuyo `identification` coincide con el `legalId`
 * de otra Company B del MISMO `exercise_id`, se crea automáticamente la
 * contrapartida en B:
 *   - PurchaseInvoice (con A como proveedor)
 *   - addLot por cada línea con producto trackeable en B (matched por cabysCode o name)
 *   - Asiento contable + AccountPayable vía BusinessEventsService.recordPurchase
 *
 * Si NO hay match (cliente externo a la simulación), no hace nada — silencioso
 * a nivel contable, pero el resultado queda registrado como `NOT_APPLICABLE`
 * en el outbox (ver abajo).
 *
 * Diseño real (outbox observable + reintentable — NO "rollback de todo"):
 *   - La venta de A es un comprobante electrónico válido desde que Hacienda lo
 *     acepta, con independencia de lo que haga B. Por lo tanto la venta de A
 *     NUNCA se revierte por una falla del espejo en B (criterio fiscal, spec
 *     Cimiento A §A.1). `mirrorSaleToBuyer` corre en su PROPIA transacción,
 *     DESPUÉS del commit de la venta — nunca dentro de ella.
 *   - Lo que sí es atómico con la venta es la OBLIGACIÓN del espejo: al emitir,
 *     `InvoicesService.issue()` crea una fila `InterCompanyMirror` en estado
 *     `PENDING` para `sourceInvoiceId` dentro de la misma tx de la venta. Esa
 *     fila es el registro durable — si la venta commitea, la obligación existe
 *     aunque el intento de espejo de más abajo nunca llegue a correr.
 *   - El resultado de cada intento (`DONE` / `FAILED` / `NOT_APPLICABLE`) se
 *     persiste en esa fila vía `classifyMirrorOutcome` (mapeo puro, testeable
 *     sin Prisma — `mirror-status.ts`). Ya NO se traga el error con un
 *     `logger.warn` como único registro: el `warn` queda como telemetría, pero
 *     el outbox es la fuente de verdad.
 *   - `mirrorSaleToBuyer` es idempotente respecto de `PurchaseInvoice`
 *     (`@@unique(sourceInvoiceId)`): un reintento sobre un espejo ya aplicado
 *     es un no-op que devuelve el mismo resultado, nunca duplica la compra.
 *   - `retryMirror` / `reconcilePendingMirrors` permiten reintentar `PENDING`/
 *     `FAILED` on-demand (no hay cron ni colas en el repo — no se agregan acá).
 *   - Invariante para el oráculo de auditoría (fase siguiente):
 *     `isCrossCheckEligible(status)` es `true` SOLO para `DONE`. Nunca se
 *     genera un hallazgo contra el comprador sobre una factura fuente cuyo
 *     espejo esté `PENDING` o `FAILED` — evita confundir una falla de
 *     plataforma con una omisión del estudiante.
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

    // 5. Idempotencia: si ya existe una PurchaseInvoice para esta factura
    //    fuente (reintento de un intento previo que sí llegó a crearla pero
    //    falló después, o un reintento manual vía retryMirror), no duplicar —
    //    devolvemos el mismo resultado ya alcanzado. Apoyado en
    //    @@unique(PurchaseInvoice.sourceInvoiceId).
    const existingMirror = await tx.purchaseInvoice.findUnique({
      where:  { sourceInvoiceId: invoice.id },
      select: { id: true, companyId: true, isAccepted: true },
    });
    if (existingMirror) {
      return this._idempotentMirrorResult(existingMirror);
    }

    // 6. Crear PurchaseInvoice en el buyer.
    // taxRate del invoice está como Decimal con valor "13", "0.13", o porcentaje;
    // mantenemos el ratio que usa el módulo de purchase-invoices (Decimal entre 0 y 1).
    const subtotal = new Decimal(invoice.subtotal.toString());
    const tax      = new Decimal(invoice.tax.toString());
    const total    = new Decimal(invoice.total.toString());
    const taxRate  = subtotal.gt(0)
      ? tax.div(subtotal).toDecimalPlaces(4)
      : new Decimal(0);

    // NOTA (code-review): a propósito NO capturamos un posible P2002 acá. Si
    // dos intentos concurrentes (p. ej. `issue()` y un `retryMirror` casi
    // simultáneo) llegan a este `create` casi a la vez, el que pierde la
    // carrera del unique constraint deja esta transacción (`tx`) ABORTADA en
    // Postgres (25P02) — cualquier lectura posterior sobre ESTE MISMO `tx`
    // (p. ej. un `findUnique` de recuperación) fallaría con "current
    // transaction is aborted", degradando la recuperación idempotente a
    // FAILED. La recuperación se hace en `attemptMirrorAndRecordOutcome`,
    // FUERA de esta tx y con una conexión fresca (`this.prisma`).
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

    // 7-8. Modo Contable: efectos de la compra (inventario + asiento + CxP) ahora.
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

  /** Resultado idempotente cuando ya existe una PurchaseInvoice espejo para la factura fuente. */
  private _idempotentMirrorResult(pi: { id: string; companyId: string; isAccepted: boolean }) {
    return pi.isAccepted
      ? { mirrored: true,  buyerCompanyId: pi.companyId, purchaseInvoiceId: pi.id }
      : { mirrored: false, reason: 'proposal_created' as const, buyerCompanyId: pi.companyId, purchaseInvoiceId: pi.id };
  }

  // ── Outbox del espejo (Cimiento A, FASE 2a) ───────────────────────────────

  /**
   * Paso 1 del outbox (spec Cimiento A §A.2): abre la OBLIGACIÓN del espejo de
   * forma ATÓMICA con la venta. `InvoicesService.issue()` la llama DENTRO de
   * la misma transacción en la que se crea/confirma la venta — si la venta
   * commitea, esta fila existe (aunque el intento de espejo de más abajo
   * nunca llegue a correr); si la venta revierte, la fila revierte con ella.
   *
   * Upsert defensivo: si ya existiera una fila para este `sourceInvoiceId`
   * (no debería, por el guard de idempotencia de `issue()`), NO se pisa un
   * estado ya resuelto — se deja tal cual.
   */
  async openMirrorObligation(
    sourceInvoiceId: string,
    sellerCompanyId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.interCompanyMirror.upsert({
      where:  { sourceInvoiceId },
      create: { sourceInvoiceId, sellerCompanyId, status: 'PENDING' },
      update: {}, // ya existe: no reiniciar un estado ya resuelto (DONE/FAILED/NOT_APPLICABLE)
    });
  }

  /**
   * Paso 2 del outbox: intenta el espejo — SIEMPRE post-commit de la venta,
   * en su propia transacción; la venta ya está firme y NUNCA se revierte por
   * esto — y persiste el resultado clasificado (`classifyMirrorOutcome`, sin
   * duplicar la lógica de mapeo) en la fila outbox. `mirrorSaleToBuyer` es
   * idempotente respecto de `PurchaseInvoice`, así que reintentar sobre un
   * espejo ya `DONE` es un no-op que no duplica la compra.
   *
   * La usa `InvoicesService.issue()` justo después del commit de la venta, y
   * también `retryMirror`/`reconcilePendingMirrors` para los reintentos
   * on-demand.
   */
  async attemptMirrorAndRecordOutcome(
    input: InterCompanyMirrorInput,
  ): Promise<{ status: MirrorStatus; reason?: string }> {
    let outcome: MirrorOutcome & { buyerCompanyId?: string; purchaseInvoiceId?: string } = {};
    let lastError: string | undefined;

    try {
      outcome = await this.prisma.$transaction((tx) => this.mirrorSaleToBuyer(input, tx));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Carrera: otro intento concurrente ganó la creación de la
        // PurchaseInvoice entre el check de idempotencia y el `create` dentro
        // de `mirrorSaleToBuyer`. La tx que perdió la carrera ya quedó
        // ABORTADA en Postgres — no se puede leer sobre ella. Recuperamos el
        // registro ganador con una conexión FRESCA (`this.prisma`, fuera de
        // esa tx abortada) y devolvemos el mismo resultado idempotente en vez
        // de degradar a FAILED.
        const winner = await this.prisma.purchaseInvoice.findUnique({
          where:  { sourceInvoiceId: input.invoiceId },
          select: { id: true, companyId: true, isAccepted: true },
        });
        if (winner) {
          outcome = this._idempotentMirrorResult(winner);
          this.logger.log(
            `Inter-company mirror: conflicto de creación concurrente para invoice ` +
            `${input.invoiceId} resuelto como idempotente (PI ${winner.id}).`,
          );
        } else {
          // No debería pasar (el P2002 implica que la fila existe), pero si
          // desapareció entre el conflicto y esta lectura, no inventamos un
          // estado — se trata como falla reintentable.
          outcome   = { threw: true };
          lastError = (err as Error).message;
        }
      } else {
        outcome   = { threw: true };
        lastError = (err as Error).message;
        this.logger.warn(
          `Inter-company mirror falló para invoice ${input.invoiceId}: ${lastError}. ` +
          `La venta del seller ya está firme; queda outbox FAILED — reintentable.`,
        );
      }
    }

    const status = classifyMirrorOutcome(outcome);
    await this.prisma.interCompanyMirror.upsert({
      where: { sourceInvoiceId: input.invoiceId },
      create: {
        sourceInvoiceId:   input.invoiceId,
        sellerCompanyId:   input.sellerCompanyId,
        buyerCompanyId:    outcome.buyerCompanyId    ?? null,
        purchaseInvoiceId: outcome.purchaseInvoiceId ?? null,
        status,
        reason:            outcome.reason ?? null,
        attempts:          1,
        lastError:         lastError ?? null,
        lastAttemptAt:     new Date(),
      },
      update: {
        status,
        reason:            outcome.reason ?? null,
        ...(outcome.buyerCompanyId    ? { buyerCompanyId:    outcome.buyerCompanyId }    : {}),
        ...(outcome.purchaseInvoiceId ? { purchaseInvoiceId: outcome.purchaseInvoiceId } : {}),
        attempts:          { increment: 1 },
        lastError:         lastError ?? null,
        lastAttemptAt:     new Date(),
      },
    });

    return { status, reason: outcome.reason };
  }

  /**
   * Reintento idempotente y on-demand (no hay cron ni colas en el repo — no
   * se agrega ninguno) para UNA factura fuente. Solo actúa sobre outbox
   * `PENDING`/`FAILED`; sobre `DONE`/`NOT_APPLICABLE` es un no-op (estado ya
   * resuelto, no se vuelve a intentar).
   */
  async retryMirror(
    sourceInvoiceId: string,
  ): Promise<{ status: MirrorStatus; reason?: string; skipped?: boolean }> {
    const mirror = await this.prisma.interCompanyMirror.findUnique({ where: { sourceInvoiceId } });
    if (!mirror) {
      throw new NotFoundException('No existe registro de espejo (outbox) para esta factura.');
    }
    if (mirror.status !== 'PENDING' && mirror.status !== 'FAILED') {
      return { status: mirror.status as MirrorStatus, reason: mirror.reason ?? undefined, skipped: true };
    }

    const invoice = await this.prisma.invoice.findUnique({
      where:  { id: sourceInvoiceId },
      select: { id: true, clientId: true, createdById: true },
    });
    if (!invoice) {
      throw new NotFoundException('La factura fuente del espejo ya no existe.');
    }

    return this.attemptMirrorAndRecordOutcome({
      sellerCompanyId: mirror.sellerCompanyId,
      userId:          invoice.createdById,
      invoiceId:       invoice.id,
      customerId:      invoice.clientId,
    });
  }

  /**
   * Reintenta EN LOTE todos los espejos `PENDING`/`FAILED` de una empresa
   * vendedora. On-demand (p. ej. cuando el comprador carga su lista de
   * compras, al congelar el snapshot del oráculo, o vía una acción explícita
   * del profesor) — no hay cron ni colas en el repo, y no se agrega ninguno
   * acá. Cada fila se reintenta de forma independiente: un fallo en una no
   * aborta el resto del lote.
   */
  async reconcilePendingMirrors(
    companyId: string,
  ): Promise<Array<{ sourceInvoiceId: string; status: MirrorStatus; reason?: string }>> {
    const pending = await this.prisma.interCompanyMirror.findMany({
      where:  { sellerCompanyId: companyId, status: { in: ['PENDING', 'FAILED'] } },
      select: { sourceInvoiceId: true },
    });

    const results: Array<{ sourceInvoiceId: string; status: MirrorStatus; reason?: string }> = [];
    for (const { sourceInvoiceId } of pending) {
      try {
        const { status, reason } = await this.retryMirror(sourceInvoiceId);
        results.push({ sourceInvoiceId, status, reason });
      } catch (err) {
        // No abortamos el lote por una fila problemática (p. ej. la factura
        // fuente fue borrada) — la dejamos como estaba y seguimos con las demás.
        this.logger.warn(
          `reconcilePendingMirrors: no se pudo reintentar ${sourceInvoiceId}: ${(err as Error).message}`,
        );
      }
    }
    return results;
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
      // Claim ATÓMICO primero: marca aceptada solo si seguía pendiente. Evita
      // que dos llamadas concurrentes (doble-click) apliquen los efectos dos
      // veces (doble asiento/CxP/inventario). Si los efectos fallan luego, toda
      // la tx revierte (incluido este claim).
      const claimed = await tx.purchaseInvoice.updateMany({
        where: { id: purchaseInvoiceId, companyId, isAccepted: false, sourceInvoiceId: { not: null } },
        data:  { isAccepted: true },
      });
      if (claimed.count === 0) {
        throw new NotFoundException('Propuesta de compra no encontrada o ya procesada.');
      }

      const pi = await tx.purchaseInvoice.findUnique({ where: { id: purchaseInvoiceId } });
      if (!pi) throw new NotFoundException('Propuesta de compra no encontrada.');

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

      this.logger.log(`Propuesta de compra ${pi.id} aceptada por empresa ${companyId}.`);
      return { accepted: true, purchaseInvoiceId: pi.id };
    });
  }

  /** Rechaza (elimina) una propuesta pendiente. Aún no tuvo efectos contables. */
  async rejectProposal(companyId: string, purchaseInvoiceId: string) {
    // deleteMany ATÓMICO con guard isAccepted=false: solo borra si sigue
    // pendiente. Si una aceptación concurrente ya la procesó, count=0 → no la
    // borra (no destruye el rastro contable de una compra ya aceptada).
    const deleted = await this.prisma.purchaseInvoice.deleteMany({
      where: { id: purchaseInvoiceId, companyId, isAccepted: false, sourceInvoiceId: { not: null } },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Propuesta de compra no encontrada o ya procesada.');
    }
    this.logger.log(`Propuesta de compra ${purchaseInvoiceId} rechazada por empresa ${companyId}.`);
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
