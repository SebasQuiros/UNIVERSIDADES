import { Module } from '@nestjs/common';
import { RulesEngineService } from './rules-engine.service';
import { AccountingModeResolver } from './accounting-mode.resolver';

/**
 * ────────────────────────────────────────────────────────────────
 *  AccountingModule
 *
 *  Exporta:
 *    · RulesEngineService     — funciones puras evento → líneas contables
 *    · AccountingModeResolver — lee el modo (MANUAL/AUTOMATIC/HYBRID) por empresa
 *
 *  Quien crea los asientos efectivamente sigue siendo JournalService
 *  (ya existente). BusinessEventsService orquesta los tres.
 * ────────────────────────────────────────────────────────────────
 */
@Module({
  providers: [RulesEngineService, AccountingModeResolver],
  exports:   [RulesEngineService, AccountingModeResolver],
})
export class AccountingModule {}
