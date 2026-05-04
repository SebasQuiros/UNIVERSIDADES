import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

/**
 * InventoryModule (Fase 2). Exporta el service para que `InvoicesService`
 * y `PurchaseInvoicesService` puedan llamar `consumeFIFO` y `addLot`
 * dentro de sus propias transacciones (al emitir factura / aceptar compra).
 */
@Module({
  providers:   [InventoryService],
  controllers: [InventoryController],
  exports:     [InventoryService],
})
export class InventoryModule {}
