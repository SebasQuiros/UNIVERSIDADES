import { Module } from '@nestjs/common';
import { TaxDeclarationsService } from './tax-declarations.service';
import { TaxDeclarationsController } from './tax-declarations.controller';
import { TaxDeclarationsPdfService } from './tax-declarations-pdf.service';
import { RentaService } from './renta.service';
import { RentaController } from './renta.controller';

@Module({
  providers:   [TaxDeclarationsService, TaxDeclarationsPdfService, RentaService],
  controllers: [TaxDeclarationsController, RentaController],
  exports:     [TaxDeclarationsService, RentaService],
})
export class TaxDeclarationsModule {}
