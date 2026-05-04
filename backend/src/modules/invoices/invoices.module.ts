import { Module } from '@nestjs/common';
import { InvoicesService }          from './invoices.service';
import { InvoicesController }       from './invoices.controller';
import { HaciendaXmlService }       from './xml/hacienda-xml.service';
import { XmlGeneratorService }      from './xml/xml-generator.service';
import { PdfGeneratorService }      from './pdf/pdf-generator.service';
import { HaciendaSimulatorService } from './hacienda/hacienda-simulator.service';
import { JournalModule }            from '../journal/journal.module';
import { PeriodsModule }            from '../periods/periods.module';
import { BusinessModule }           from '../business/business.module';
import { AccountingModule }         from '../accounting/accounting.module';
import { InventoryModule }          from '../inventory/inventory.module';
import { InterCompanyModule }       from '../inter-company/inter-company.module';

@Module({
  imports: [
    JournalModule,
    PeriodsModule,
    BusinessModule,
    AccountingModule,
    InventoryModule,        // Fase 2 — inventario FIFO en sale flow
    InterCompanyModule,     // Fase 4 — mirror de venta → compra inter-company
  ],
  providers: [
    InvoicesService,
    HaciendaXmlService,      // core v4.4 XML generator — must be listed before XmlGeneratorService
    XmlGeneratorService,     // delegates to HaciendaXmlService
    PdfGeneratorService,
    HaciendaSimulatorService,
  ],
  controllers: [InvoicesController],
  exports:     [InvoicesService, HaciendaXmlService],
})
export class InvoicesModule {}
