import { Module } from '@nestjs/common';
import { BusinessEventsService } from './business-events.service';
import { JournalModule } from '../journal/journal.module';
import { AccountingModule } from '../accounting/accounting.module';
import { ARRecordsService } from '../accounts-receivable/ar-records.service';
import { APRecordsService } from '../accounts-payable/ap-records.service';

/**
 * ────────────────────────────────────────────────────────────────
 *  BusinessModule
 *
 *  Punto único de entrada para que el resto del backend dispare
 *  eventos contables. Cualquier service que cree/actualice una
 *  factura, cobro, pago, etc. inyecta `BusinessEventsService` y
 *  llama el método correspondiente.
 *
 *  AR/APRecordsService se proveen aquí (no como módulos propios)
 *  para evitar circular deps con accounts-receivable/payable
 *  modules existentes que tienen sus propios controllers.
 * ────────────────────────────────────────────────────────────────
 */
@Module({
  imports:   [JournalModule, AccountingModule],
  providers: [BusinessEventsService, ARRecordsService, APRecordsService],
  exports:   [BusinessEventsService, ARRecordsService, APRecordsService],
})
export class BusinessModule {}
