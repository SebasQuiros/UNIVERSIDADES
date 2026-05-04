import { Module } from '@nestjs/common';
import { PurchaseInvoicesService }    from './purchase-invoices.service';
import { PurchaseInvoicesController } from './purchase-invoices.controller';
import { JournalModule }              from '../journal/journal.module';
import { PrismaModule }               from '../../prisma/prisma.module';
import { BusinessModule }             from '../business/business.module';
import { InventoryModule }            from '../inventory/inventory.module';
import { AccountingModule }           from '../accounting/accounting.module';

@Module({
  imports:     [PrismaModule, JournalModule, BusinessModule, InventoryModule, AccountingModule],
  providers:   [PurchaseInvoicesService],
  controllers: [PurchaseInvoicesController],
  exports:     [PurchaseInvoicesService],
})
export class PurchaseInvoicesModule {}
