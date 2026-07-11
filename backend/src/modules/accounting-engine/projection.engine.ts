import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { ARRecordsService } from '../accounts-receivable/ar-records.service';
import { APRecordsService } from '../accounts-payable/ap-records.service';
import { ACCOUNT_CODES } from '../accounting/constants/account-codes';
import { FinancialStatementEngine } from './financial-statement.engine';
import { reconcileDiff, InvariantCheck } from './accounting.engine';

/**
 * ────────────────────────────────────────────────────────────────
 *  ProjectionEngine  (Accounting Manifest §3)
 *
 *  Las proyecciones (CxC, CxP, inventario, Product.stock) son vistas
 *  derivadas. Este engine:
 *
 *   · reconcile()          — verifica control (Diario) = Σ subledger
 *                            (V-3) y Product.stock = Σ lotes (V-4).
 *   · rebuildProjections() — reconstruye las proyecciones desde el
 *                            Diario + documentos fuente + metadatos
 *                            operativos (lotes FIFO). Idempotente (V-7).
 *
 *  Regla PJ-2: ante discrepancia, gana el Diario y se regenera la
 *  proyección.
 * ────────────────────────────────────────────────────────────────
 */

export interface ReconcileReport {
  companyId: string;
  checkedAt: string;
  ar: InvariantCheck;
  ap: InvariantCheck;
  inventory: InvariantCheck;
  stock: { ok: boolean; mismatches: { productId: string; name: string; stock: string; lots: string }[] };
  allOk: boolean;
}

/** Check omitido: no hay subledger materializado que reconciliar (modo MANUAL o sin operaciones). */
const NOT_APPLICABLE: InvariantCheck = {
  ok: true,
  difference: '0.00',
  detail: { note: 'sin subledger materializado (modo MANUAL o sin operaciones)' },
};

export interface RebuildReport {
  companyId: string;
  arReconciled: number;
  apReconciled: number;
  stockFixed: { productId: string; name: string; from: string; to: string }[];
}

@Injectable()
export class ProjectionEngine {
  private readonly logger = new Logger(ProjectionEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly statements: FinancialStatementEngine,
    private readonly arRecords: ARRecordsService,
    private readonly apRecords: APRecordsService,
  ) {}

  // ── Reconciliación (solo lectura, estado ACTUAL) ──────────────────────────
  // Verifica el estado PRESENTE: control del Diario vs subledger materializado.
  // NO es point-in-time: los subledgers (CxC/CxP/lotes) son espejos del estado
  // actual, no reconstruibles a una fecha pasada. Para history, ver el Diario.
  async reconcile(companyId: string): Promise<ReconcileReport> {
    const checkedAt = new Date();

    // Cuentas de control desde el Diario (estado actual).
    const [arControl, apControl, invControl] = await Promise.all([
      this.statements.controlAccountBalance(companyId, ACCOUNT_CODES.ACCOUNTS_RECEIVABLE),
      this.statements.controlAccountBalance(companyId, ACCOUNT_CODES.ACCOUNTS_PAYABLE),
      this.statements.controlAccountBalance(companyId, ACCOUNT_CODES.INVENTORY),
    ]);

    // Subledgers (proyecciones).
    const [arRows, apRows, lots, products] = await Promise.all([
      this.prisma.accountReceivable.findMany({
        where: { companyId, status: { not: 'CANCELLED' } },
        select: { balance: true },
      }),
      this.prisma.accountPayable.findMany({
        where: { companyId, status: { not: 'CANCELLED' } },
        select: { balance: true },
      }),
      this.prisma.inventoryLot.findMany({
        where: { companyId },
        select: { qtyRemaining: true, unitCost: true },
      }),
      this.prisma.product.findMany({
        where: { companyId, trackInventory: true },
        select: { id: true, name: true, stock: true },
      }),
    ]);

    const arSub = arRows.reduce((s, r) => s.plus(new Decimal(r.balance.toString())), new Decimal(0));
    const apSub = apRows.reduce((s, r) => s.plus(new Decimal(r.balance.toString())), new Decimal(0));
    const invSub = lots.reduce(
      (s, l) => s.plus(new Decimal(l.qtyRemaining.toString()).times(new Decimal(l.unitCost.toString()))),
      new Decimal(0),
    );

    // V-4 — Product.stock = Σ lotes.qtyRemaining por producto.
    const lotByProduct = await this.prisma.inventoryLot.groupBy({
      by: ['productId'],
      where: { companyId },
      _sum: { qtyRemaining: true },
    });
    const lotMap = new Map(lotByProduct.map((r) => [r.productId, new Decimal((r._sum.qtyRemaining ?? 0).toString())]));
    const mismatches = products.flatMap((p) => {
      const lotQty = lotMap.get(p.id) ?? new Decimal(0);
      const stock = new Decimal(p.stock.toString());
      return stock.minus(lotQty).abs().lessThanOrEqualTo(new Decimal('0.0001'))
        ? []
        : [{ productId: p.id, name: p.name, stock: stock.toString(), lots: lotQty.toString() }];
    });

    // Solo reconciliamos donde HAY subledger materializado: evita falsos
    // positivos en modo MANUAL, donde el estudiante no mantiene CxC/CxP/lotes
    // y el control del Diario puede tener saldo por asientos hechos a mano.
    const ar = arRows.length === 0 ? NOT_APPLICABLE : reconcileDiff(arControl ?? new Decimal(0), arSub);
    const ap = apRows.length === 0 ? NOT_APPLICABLE : reconcileDiff(apControl ?? new Decimal(0), apSub);
    const inventory = lots.length === 0 ? NOT_APPLICABLE : reconcileDiff(invControl ?? new Decimal(0), invSub);
    const stock = { ok: mismatches.length === 0, mismatches };

    return {
      companyId,
      checkedAt: checkedAt.toISOString(),
      ar,
      ap,
      inventory,
      stock,
      allOk: ar.ok && ap.ok && inventory.ok && stock.ok,
    };
  }

  // ── Reconstrucción (idempotente, PJ-4) ────────────────────────────────────
  /**
   * Regenera las proyecciones desde su fuente:
   *   · CxC/CxP: reconcilia cada registro contra su documento (Invoice.balanceDue,
   *              PurchaseInvoice.total-paidAmount).
   *   · Product.stock: recomputa = Σ lotes.qtyRemaining.
   * Idempotente: correrlo dos veces deja el mismo estado.
   */
  async rebuildProjections(companyId: string): Promise<RebuildReport> {
    return this.prisma.$transaction(async (tx) => {
      const [arRecords, apRecords, products] = await Promise.all([
        tx.accountReceivable.findMany({ where: { companyId }, select: { invoiceId: true } }),
        tx.accountPayable.findMany({ where: { companyId }, select: { purchaseInvoiceId: true } }),
        tx.product.findMany({ where: { companyId, trackInventory: true }, select: { id: true, name: true, stock: true } }),
      ]);

      for (const ar of arRecords) {
        const r = await this.arRecords.reconcileFromInvoice(ar.invoiceId, tx);
        if (!r) this.logger.warn(`rebuild AR: no se pudo reconciliar factura ${ar.invoiceId} (factura o registro AR inexistente).`);
      }
      for (const ap of apRecords) {
        const r = await this.apRecords.reconcileFromPurchaseInvoice(ap.purchaseInvoiceId, tx);
        if (!r) this.logger.warn(`rebuild AP: no se pudo reconciliar compra ${ap.purchaseInvoiceId} (compra o registro AP inexistente).`);
      }

      const stockFixed: RebuildReport['stockFixed'] = [];
      for (const p of products) {
        const agg = await tx.inventoryLot.aggregate({
          where: { companyId, productId: p.id },
          _sum: { qtyRemaining: true },
        });
        const lotQty = new Decimal((agg._sum.qtyRemaining ?? 0).toString());
        const stock = new Decimal(p.stock.toString());
        if (!stock.minus(lotQty).abs().lessThanOrEqualTo(new Decimal('0.0001'))) {
          await tx.product.update({ where: { id: p.id }, data: { stock: lotQty } });
          stockFixed.push({ productId: p.id, name: p.name, from: stock.toString(), to: lotQty.toString() });
        }
      }

      const report: RebuildReport = {
        companyId,
        arReconciled: arRecords.length,
        apReconciled: apRecords.length,
        stockFixed,
      };
      if (stockFixed.length > 0) {
        this.logger.warn(`rebuildProjections(${companyId}): corregidos ${stockFixed.length} stocks desfasados.`);
      }
      return report;
    });
  }
}
