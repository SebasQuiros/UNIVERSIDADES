import { Module } from '@nestjs/common';
import { RecurringPaymentsService } from './recurring-payments.service';
import { RecurringPaymentsController } from './recurring-payments.controller';
import { PrismaModule } from '../../prisma/prisma.module';
// Importamos el módulo de compras para reusar su servicio (lo exporta):
// la generación NO duplica lógica contable.
import { PurchaseInvoicesModule } from '../purchase-invoices/purchase-invoices.module';

@Module({
  imports: [PrismaModule, PurchaseInvoicesModule],
  controllers: [RecurringPaymentsController],
  providers: [RecurringPaymentsService],
  exports: [RecurringPaymentsService],
})
export class RecurringPaymentsModule {}
