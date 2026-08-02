import { Module } from '@nestjs/common';
import { RecurringInvoicesService } from './recurring-invoices.service';
import { RecurringInvoicesController } from './recurring-invoices.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  // InvoicesModule exporta InvoicesService: la generación reutiliza el flujo
  // real de facturación (asiento, IVA, consecutivo) en vez de reimplementarlo.
  imports: [PrismaModule, InvoicesModule],
  controllers: [RecurringInvoicesController],
  providers: [RecurringInvoicesService],
  exports: [RecurringInvoicesService],
})
export class RecurringInvoicesModule {}
