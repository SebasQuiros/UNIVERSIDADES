import { Module } from '@nestjs/common';
import { InterCompanyService } from './inter-company.service';
import { PurchaseProposalsController } from './purchase-proposals.controller';
import { AccountingModule } from '../accounting/accounting.module';
import { BusinessModule }   from '../business/business.module';
import { InventoryModule }  from '../inventory/inventory.module';

/**
 * InterCompanyModule (Fase 4 + F2). Exporta el service para que `InvoicesService`
 * pueda invocar `mirrorSaleToBuyer` dentro de su transacción de emisión, y expone
 * la bandeja de propuestas de compra (Modo Empresarial, F2.2).
 */
@Module({
  imports:     [AccountingModule, BusinessModule, InventoryModule],
  controllers: [PurchaseProposalsController],
  providers:   [InterCompanyService],
  exports:     [InterCompanyService],
})
export class InterCompanyModule {}
