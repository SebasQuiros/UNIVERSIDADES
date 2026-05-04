import {
  Injectable, BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, MovementType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export type LotSource = 'PURCHASE' | 'INITIAL' | 'ADJUSTMENT';

/**
 * Tipo del cliente Prisma usado dentro de transacciones. Evita acoplar las
 * firmas del service a `prisma.$transaction(async (tx) => ...)` directamente.
 */
type Tx = Prisma.TransactionClient | PrismaService;

/**
 * Resultado del consumo FIFO. `consumed` describe los lotes tocados
 * (útil para auditoría / línea de movimiento por lote) y `totalCost` es la
 * suma que debe registrarse contra COGS.
 */
export interface ConsumeFifoResult {
  productId: string;
  quantity: Decimal;
  totalCost: Decimal;
  consumed: Array<{
    lotId: string;
    qty: Decimal;
    unitCost: Decimal;
    cost: Decimal;
  }>;
  newBalance: Decimal;
}

/**
 * InventoryService — Fase 2.
 *
 * Encapsula todas las operaciones de inventario FIFO:
 *   - addLot: registra un nuevo lote (compra / stock inicial / ajuste).
 *   - consumeFIFO: consume X unidades del producto tomando lotes más viejos
 *     primero, devolviendo los lotes consumidos y el costo total.
 *   - valuation: valor total del inventario por compañía/producto al costo.
 *
 * Diseño:
 *   - Todos los métodos aceptan un `tx` opcional. Si no lo recibís, hacen su
 *     propia transacción. Esto permite encadenarlos dentro de la transacción
 *     que abre el `BusinessEventsService` al emitir factura.
 *   - El campo `Product.stock` se mantiene en sync por compatibilidad con
 *     reportes legados, pero la verdad la tienen los lotes.
 *   - Los movimientos por lote se persisten 1 por lote consumido (cuando
 *     una venta toca 3 lotes, hay 3 InventoryMovement de tipo SALE) — eso
 *     da kardex perfecto sin queries adicionales.
 */
@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ────────────────────────────────────────────────────────────
  //  ADD LOT
  // ────────────────────────────────────────────────────────────

  /**
   * Crea un lote nuevo y deja un InventoryMovement de IN tipo PURCHASE
   * (o INITIAL_STOCK / ADJUSTMENT según `source`). Suma al `Product.stock`.
   */
  async addLot(
    args: {
      companyId: string;
      productId: string;
      qty: number | Decimal;
      unitCost: number | Decimal;
      source: LotSource;
      sourceId?: string | null;
      receivedAt?: Date;
      createdById: string;
    },
    tx?: Tx,
  ) {
    const client = (tx ?? this.prisma) as Prisma.TransactionClient;
    const qty      = new Decimal(args.qty);
    const unitCost = new Decimal(args.unitCost);

    if (qty.lte(0)) {
      throw new BadRequestException('La cantidad del lote debe ser positiva');
    }
    if (unitCost.lt(0)) {
      throw new BadRequestException('El costo unitario no puede ser negativo');
    }

    const product = await client.product.findUnique({
      where: { id: args.productId },
      select: { id: true, companyId: true, isService: true, trackInventory: true, stock: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    if (product.companyId !== args.companyId) {
      throw new BadRequestException('El producto no pertenece a esta empresa');
    }
    if (product.isService || !product.trackInventory) {
      throw new BadRequestException('Este producto no maneja inventario');
    }

    const lot = await client.inventoryLot.create({
      data: {
        productId:    args.productId,
        companyId:    args.companyId,
        qtyOriginal:  qty,
        qtyRemaining: qty,
        unitCost,
        source:       args.source,
        sourceId:     args.sourceId ?? null,
        receivedAt:   args.receivedAt ?? new Date(),
      },
    });

    // Increment atómico en Product.stock para evitar lost update concurrente.
    // El balanceAfter del movement queda como aproximación basada en el read;
    // bajo carga, otro decremento concurrente puede dejar el balanceAfter
    // ligeramente fuera de sync, pero el stock real (`Product.stock`) y los
    // lots son fuente de verdad y siempre consistentes con SUM(qty_remaining).
    await client.product.update({
      where: { id: args.productId },
      data:  { stock: { increment: qty } },
    });
    const newStock = product.stock.plus(qty);

    await client.inventoryMovement.create({
      data: {
        productId:     args.productId,
        companyId:     args.companyId,
        type:          this._sourceToMovementType(args.source),
        quantity:      qty,
        unitCost,
        totalCost:     qty.times(unitCost),
        lotId:         lot.id,
        referenceId:   args.sourceId ?? null,
        referenceType: args.source,
        balanceAfter:  newStock,
        createdById:   args.createdById,
      },
    });

    return lot;
  }

  // ────────────────────────────────────────────────────────────
  //  CONSUME FIFO
  // ────────────────────────────────────────────────────────────

  /**
   * Consume `qty` unidades del producto desde los lotes más antiguos primero.
   * Devuelve el desglose por lote y el `totalCost` (para usarlo en COGS).
   *
   * Errores:
   *   - InsufficientStock: si la suma de qty_remaining es menor a qty.
   *   - BadRequest: si producto es servicio/no trackeado.
   */
  async consumeFIFO(
    args: {
      companyId: string;
      productId: string;
      qty: number | Decimal;
      referenceId?: string | null;
      referenceType?: string | null;
      createdById: string;
    },
    tx?: Tx,
  ): Promise<ConsumeFifoResult> {
    const client = (tx ?? this.prisma) as Prisma.TransactionClient;
    const qty = new Decimal(args.qty);
    if (qty.lte(0)) {
      throw new BadRequestException('La cantidad a consumir debe ser positiva');
    }

    const product = await client.product.findUnique({
      where: { id: args.productId },
      select: { id: true, companyId: true, name: true, isService: true, trackInventory: true, stock: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    if (product.companyId !== args.companyId) {
      throw new BadRequestException('El producto no pertenece a esta empresa');
    }
    if (product.isService || !product.trackInventory) {
      throw new BadRequestException(
        `El producto "${product.name}" no maneja inventario y no puede consumirse FIFO`,
      );
    }

    // Traemos lotes con qty_remaining > 0 ordenados FIFO. Limitamos por
    // performance: con miles de lotes podríamos paginar, pero en este flujo
    // raramente superan 50 por producto.
    const lots = await client.inventoryLot.findMany({
      where:   { productId: args.productId, qtyRemaining: { gt: 0 } },
      orderBy: [{ receivedAt: 'asc' }, { createdAt: 'asc' }],
    });

    const totalAvailable = lots.reduce(
      (sum, l) => sum.plus(l.qtyRemaining), new Decimal(0),
    );
    if (totalAvailable.lt(qty)) {
      throw new BadRequestException(
        `Stock insuficiente para "${product.name}": disponible ${totalAvailable.toFixed(3)}, ` +
        `solicitado ${qty.toFixed(3)}`,
      );
    }

    // Iteramos lotes consumiendo hasta cumplir qty.
    let pending = qty;
    let totalCost = new Decimal(0);
    const consumed: ConsumeFifoResult['consumed'] = [];
    let runningStock = product.stock;

    for (const lot of lots) {
      if (pending.lte(0)) break;
      const take = Decimal.min(pending, lot.qtyRemaining);
      const cost = take.times(lot.unitCost);

      // Concurrency guard ATÓMICO: usamos `decrement` (UPDATE ... SET col=col-X)
      // en lugar de SET con valor calculado en JS. Esto evita el "lost update"
      // donde dos tx leen qty_remaining=94, ambas escriben 93 y se pierde un
      // decremento. El WHERE qty_remaining>=take rechaza si otra tx ya consumió.
      const updated = await client.inventoryLot.updateMany({
        where: { id: lot.id, qtyRemaining: { gte: take } },
        data:  { qtyRemaining: { decrement: take } },
      });
      if (updated.count !== 1) {
        throw new BadRequestException(
          `Conflicto de concurrencia consumiendo el lote ${lot.id}. ` +
          `Otra venta consumió el stock antes. Volvé a intentar la operación.`,
        );
      }

      runningStock = runningStock.minus(take);

      // Registrar movimiento por lote (kardex perfecto)
      await client.inventoryMovement.create({
        data: {
          productId:     args.productId,
          companyId:     args.companyId,
          type:          MovementType.SALE,
          quantity:      take.negated(),       // OUT → negativo
          unitCost:      lot.unitCost,
          totalCost:     cost,
          lotId:         lot.id,
          referenceId:   args.referenceId ?? null,
          referenceType: args.referenceType ?? 'INVOICE',
          balanceAfter:  runningStock,
          createdById:   args.createdById,
        },
      });

      consumed.push({
        lotId:    lot.id,
        qty:      take,
        unitCost: lot.unitCost,
        cost,
      });
      totalCost = totalCost.plus(cost);
      pending   = pending.minus(take);
    }

    // Actualizar Product.stock con decrement atómico (mismo razonamiento que
    // los lotes — evita lost update bajo concurrencia).
    await client.product.update({
      where: { id: args.productId },
      data:  { stock: { decrement: qty } },
    });

    return {
      productId:  args.productId,
      quantity:   qty,
      totalCost,
      consumed,
      newBalance: runningStock,
    };
  }

  // ────────────────────────────────────────────────────────────
  //  VALUATION
  // ────────────────────────────────────────────────────────────

  /**
   * Valor total del inventario por compañía. Equivale a sum(qty_remaining * unit_cost).
   * Usado para reconciliar contra el saldo de la cuenta 1.1.03.01.
   */
  async valuation(companyId: string) {
    const lots = await this.prisma.inventoryLot.findMany({
      where:  { companyId, qtyRemaining: { gt: 0 } },
      select: {
        productId:    true,
        qtyRemaining: true,
        unitCost:     true,
        product: { select: { id: true, name: true, sku: true, unit: true } },
      },
    });

    // Group by product en memoria — más simple que un raw groupBy.
    const byProduct = new Map<string, {
      productId: string;
      productName: string;
      sku: string | null;
      unit: string;
      qty: Decimal;
      cost: Decimal;
    }>();
    for (const l of lots) {
      const acc = byProduct.get(l.productId) ?? {
        productId:   l.productId,
        productName: l.product.name,
        sku:         l.product.sku ?? null,
        unit:        l.product.unit,
        qty:         new Decimal(0),
        cost:        new Decimal(0),
      };
      acc.qty  = acc.qty.plus(l.qtyRemaining);
      acc.cost = acc.cost.plus(l.qtyRemaining.times(l.unitCost));
      byProduct.set(l.productId, acc);
    }

    const items = Array.from(byProduct.values()).map(p => ({
      ...p,
      qty:           p.qty.toNumber(),
      cost:          p.cost.toNumber(),
      avgUnitCost:   p.qty.gt(0) ? p.cost.div(p.qty).toDecimalPlaces(2).toNumber() : 0,
    }));
    const total = items.reduce((s, i) => s + i.cost, 0);
    return { items, total };
  }

  /** Lotes activos de un producto (kardex de lotes). */
  async lotsForProduct(companyId: string, productId: string) {
    return this.prisma.inventoryLot.findMany({
      where:   { companyId, productId },
      orderBy: { receivedAt: 'asc' },
    });
  }

  /** Movimientos del producto (kardex). */
  async movements(companyId: string, productId: string, opts: { from?: Date; to?: Date } = {}) {
    return this.prisma.inventoryMovement.findMany({
      where: {
        companyId, productId,
        ...(opts.from || opts.to
          ? { createdAt: { gte: opts.from, lte: opts.to } }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: { lot: { select: { id: true, source: true, sourceId: true, receivedAt: true } } },
    });
  }

  // ────────────────────────────────────────────────────────────
  //  Helpers
  // ────────────────────────────────────────────────────────────

  private _sourceToMovementType(source: LotSource): MovementType {
    switch (source) {
      case 'PURCHASE':   return MovementType.PURCHASE;
      case 'INITIAL':    return MovementType.INITIAL_STOCK;
      case 'ADJUSTMENT': return MovementType.ADJUSTMENT;
    }
  }
}
