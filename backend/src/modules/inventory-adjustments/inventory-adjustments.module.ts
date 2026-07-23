import { Module } from '@nestjs/common';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';
import { InventoryAdjustmentsController } from './inventory-adjustments.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { BusinessModule } from '../business/business.module';

/**
 * ────────────────────────────────────────────────────────────────
 *  InventoryAdjustmentsModule (Phase 19)
 *
 *  Ajustes manuales de inventario. A diferencia de InventoryModule (que es
 *  read-only + exporta InventoryService para que otros flujos consuman/
 *  agreguen lotes), este módulo SÍ expone un endpoint mutable y dispara el
 *  business event RecordInventoryAdjustmentInput (genera asiento).
 *
 *  Separado de InventoryModule (y no dentro de él) para evitar el ciclo
 *  InventoryModule → BusinessModule → InventoryModule (BusinessModule ya
 *  importa InventoryModule).
 * ────────────────────────────────────────────────────────────────
 */
@Module({
  imports:     [InventoryModule, BusinessModule],
  providers:   [InventoryAdjustmentsService],
  controllers: [InventoryAdjustmentsController],
  exports:     [InventoryAdjustmentsService],
})
export class InventoryAdjustmentsModule {}
