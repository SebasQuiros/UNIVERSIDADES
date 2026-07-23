import { Module } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { InvoicesModule } from '../invoices/invoices.module';

/**
 * ────────────────────────────────────────────────────────────────
 *  QuotesModule (Phase 19)
 *
 *  Cotizaciones / presupuestos de venta. Sin impacto contable directo
 *  (no dispatcha business event) — es pre-venta. Al convertir, reutiliza
 *  InvoicesService.create para crear la factura real DRAFT.
 * ────────────────────────────────────────────────────────────────
 */
@Module({
  imports:     [InvoicesModule],
  providers:   [QuotesService],
  controllers: [QuotesController],
  exports:     [QuotesService],
})
export class QuotesModule {}
