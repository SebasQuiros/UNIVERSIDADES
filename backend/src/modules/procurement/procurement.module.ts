import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BusinessModule } from '../business/business.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AccountsPayableModule } from '../accounts-payable/accounts-payable.module';
import { ProcurementService } from './procurement.service';
import { ProcurementController } from './procurement.controller';

/**
 * ProcurementModule — F2.3 "Modo ERP Completo".
 *
 * Máquina de estados de órdenes de aprovisionamiento entre empresas del mismo
 * exercise. Reutiliza:
 *   - BusinessModule        → recordPurchase (factura → asiento + CxP)
 *   - InventoryModule       → addLot (recepción → inventario FIFO)
 *   - AccountsPayableModule → registerPayment (pago a proveedor)
 *
 * REDIS_CLIENT viene de RedisModule (@Global), disponible por @Inject.
 */
@Module({
  imports:     [PrismaModule, BusinessModule, InventoryModule, AccountsPayableModule],
  providers:   [ProcurementService],
  controllers: [ProcurementController],
  exports:     [ProcurementService],
})
export class ProcurementModule {}
