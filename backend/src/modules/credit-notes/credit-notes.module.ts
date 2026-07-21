import { Module } from '@nestjs/common';
import { CreditNotesService } from './credit-notes.service';
import { CreditNotesController } from './credit-notes.controller';
import { DebitNotesController } from './debit-notes.controller';
import { BusinessModule } from '../business/business.module';

/**
 * ────────────────────────────────────────────────────────────────
 *  CreditNotesModule (Phase 17)
 *
 *  Notas de crédito y débito sobre facturas emitidas. Reutiliza la puerta
 *  única de eventos de negocio (BusinessEventsService) para postear los
 *  asientos: la reversa de venta (NC) y el cargo adicional (ND). Un solo
 *  service atiende ambos documentos (comparten validaciones y patrón);
 *  dos controllers exponen rutas separadas (/credit-notes y /debit-notes).
 * ────────────────────────────────────────────────────────────────
 */
@Module({
  imports:     [BusinessModule],
  providers:   [CreditNotesService],
  controllers: [CreditNotesController, DebitNotesController],
  exports:     [CreditNotesService],
})
export class CreditNotesModule {}
