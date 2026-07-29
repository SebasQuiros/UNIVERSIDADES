import {
  Injectable, BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/activity/activity-log.service';
import { Decimal } from '@prisma/client/runtime/library';
import { InventoryService } from '../inventory/inventory.service';
import { BusinessEventsService } from '../business/business-events.service';
import { CreateInventoryAdjustmentDto } from './dto/inventory-adjustments.dto';

/**
 * ────────────────────────────────────────────────────────────────
 *  InventoryAdjustmentsService
 *
 *  Ajustes MANUALES de inventario (merma, conteo físico, daño, sobrante,
 *  corrección al alza). A diferencia de cotizaciones/órdenes de compra, SÍ
 *  cambia el valor del inventario y por lo tanto SIEMPRE dispara el
 *  business event correspondiente (D/C según ACCOUNT_CODES.INVENTORY_*),
 *  con trazabilidad sourceType='inventory_adjustment' (V-5).
 *
 *    DECREASE (merma/daño/faltante) → consume lotes FIFO existentes
 *      (mismo mecanismo que una venta) por `quantity`; el costo real
 *      consumido es el que se postea contra el asiento.
 *    INCREASE (sobrante/corrección) → requiere `unitCost`; crea un lote
 *      FIFO nuevo con ese costo.
 *
 *  Todo corre en una única transacción: movimiento físico (lote) + asiento
 *  (vía BusinessEventsService.recordInventoryAdjustment) + fila de historial
 *  InventoryAdjustment.
 * ────────────────────────────────────────────────────────────────
 */
@Injectable()
export class InventoryAdjustmentsService {
  private readonly logger = new Logger(InventoryAdjustmentsService.name);

  constructor(
    private readonly prisma:         PrismaService,
    private readonly inventory:      InventoryService,
    private readonly businessEvents: BusinessEventsService,
    private readonly activityLog:    ActivityLogService,
  ) {}

  async list(companyId: string) {
    return this.prisma.inventoryAdjustment.findMany({
      where:   { companyId },
      include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(companyId: string, userId: string, dto: CreateInventoryAdjustmentDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, companyId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado en esta empresa');
    if (product.isService || !product.trackInventory) {
      throw new BadRequestException(
        `El producto "${product.name}" no maneja inventario y no puede ajustarse.`,
      );
    }

    if (dto.type === 'INCREASE' && (dto.unitCost === undefined || dto.unitCost === null)) {
      throw new BadRequestException(
        'unitCost es requerido para un ajuste INCREASE (necesario para crear el lote FIFO).',
      );
    }

    const adjusted = await this.prisma.$transaction(async (tx) => {
      let unitCost:   Decimal;
      let totalValue: Decimal;

      if (dto.type === 'DECREASE') {
        // Consume FIFO — mismo mecanismo que una venta. El costo real
        // consumido (puede promediar varios lotes) es el que se postea.
        const result = await this.inventory.consumeFIFO(
          {
            companyId,
            productId:     dto.productId,
            qty:           dto.quantity,
            referenceId:   null,
            referenceType: 'INVENTORY_ADJUSTMENT',
            createdById:   userId,
          },
          tx,
        );
        totalValue = result.totalCost;
        unitCost   = result.quantity.gt(0) ? totalValue.dividedBy(result.quantity) : new Decimal(0);
      } else {
        // INCREASE — crea un lote nuevo con el costo indicado.
        unitCost   = new Decimal(dto.unitCost!.toString());
        totalValue = new Decimal(dto.quantity.toString()).times(unitCost).toDecimalPlaces(2);

        await this.inventory.addLot(
          {
            companyId,
            productId:   dto.productId,
            qty:         dto.quantity,
            unitCost,
            source:      'ADJUSTMENT',
            createdById: userId,
          },
          tx,
        );
      }

      const adjustment = await tx.inventoryAdjustment.create({
        data: {
          companyId,
          productId:   dto.productId,
          type:        dto.type,
          quantity:    new Decimal(dto.quantity.toString()),
          unitCost,
          totalValue,
          reason:      dto.reason,
          sourceType:  'inventory_adjustment',
          createdById: userId,
        },
      });

      // Enlazamos el sourceId ahora que ya tenemos el id del ajuste (trazabilidad V-5).
      await tx.inventoryAdjustment.update({
        where: { id: adjustment.id },
        data:  { sourceId: adjustment.id },
      });

      await this.businessEvents.dispatch({
        type:           'INVENTORY_ADJUSTED',
        companyId,
        userId,
        tx,
        adjustmentId:   adjustment.id,
        productId:      dto.productId,
        productName:    product.name,
        adjustmentType: dto.type,
        quantity:       dto.quantity,
        totalValue:     totalValue.toNumber(),
        reason:         dto.reason,
      });

      this.logger.log(
        `✓ Ajuste de inventario (${dto.type}) — ${product.name}: ${dto.quantity} unid, ` +
        `valor ${totalValue.toFixed(2)}`,
      );

      return tx.inventoryAdjustment.findUnique({ where: { id: adjustment.id } });
    });

    // Un ajuste cambia existencias y costo sin que medie una factura: es de los
    // movimientos que más se revisan en una auditoría.
    void this.activityLog.log({
      userId, companyId,
      action: 'INVENTORY_ADJUSTED', entity: 'InventoryAdjustment', entityId: adjusted?.id,
      details: {
        producto: product.name,
        tipo: dto.type === 'INCREASE' ? 'Aumento' : 'Disminución',
        cantidad: dto.quantity,
        motivo: dto.reason ?? undefined,
      },
    });

    return adjusted;
  }
}
