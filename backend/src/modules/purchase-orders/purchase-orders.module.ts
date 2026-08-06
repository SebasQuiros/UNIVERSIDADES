import { Module } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { JournalModule } from '../journal/journal.module';

/**
 * ────────────────────────────────────────────────────────────────
 *  PurchaseOrdersModule (Phase 19)
 *
 *  Órdenes de compra a proveedor externo + recepción de mercancía.
 *  Sin impacto contable (no dispatcha business event) — el asiento nace
 *  cuando el estudiante registra la PurchaseInvoice real (módulo existente
 *  `purchase-invoices`). Solo necesita InventoryModule para `addLot` en
 *  el paso `receive`.
 * ────────────────────────────────────────────────────────────────
 */
@Module({
  imports:     [InventoryModule, JournalModule],
  providers:   [PurchaseOrdersService],
  controllers: [PurchaseOrdersController],
  exports:     [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
