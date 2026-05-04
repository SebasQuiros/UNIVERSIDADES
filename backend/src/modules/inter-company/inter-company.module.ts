import { Module } from '@nestjs/common';
import { InterCompanyService } from './inter-company.service';
import { AccountingModule } from '../accounting/accounting.module';
import { BusinessModule }   from '../business/business.module';
import { InventoryModule }  from '../inventory/inventory.module';

/**
 * InterCompanyModule (Fase 4). Exporta el service para que `InvoicesService`
 * pueda invocar `mirrorSaleToBuyer` dentro de su transacción de emisión.
 */
@Module({
  imports:   [AccountingModule, BusinessModule, InventoryModule],
  providers: [InterCompanyService],
  exports:   [InterCompanyService],
})
export class InterCompanyModule {}
