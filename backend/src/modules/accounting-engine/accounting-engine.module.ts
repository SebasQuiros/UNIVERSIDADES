import { Module } from '@nestjs/common';
import { BusinessModule } from '../business/business.module';
import { FinancialStatementEngine } from './financial-statement.engine';
import { AccountingEngine } from './accounting.engine';
import { ProjectionEngine } from './projection.engine';
import { AccountingHealthController } from './accounting-health.controller';

/**
 * ────────────────────────────────────────────────────────────────
 *  AccountingEngineModule  (Accounting Manifest §3, §5)
 *
 *  Núcleo de derivación y consistencia del motor contable:
 *    · FinancialStatementEngine — lado lectura derivado del Diario (asOfDate)
 *    · AccountingEngine         — invariantes verificables (V-1, V-2, V-5, V-6)
 *    · ProjectionEngine         — reconciliación (V-3/V-4) + rebuild (V-7)
 *
 *  Importa BusinessModule para reusar AR/APRecordsService como
 *  primitivas de reconstrucción de proyecciones.
 * ────────────────────────────────────────────────────────────────
 */
@Module({
  imports: [BusinessModule],
  providers: [FinancialStatementEngine, AccountingEngine, ProjectionEngine],
  controllers: [AccountingHealthController],
  exports: [FinancialStatementEngine, AccountingEngine, ProjectionEngine],
})
export class AccountingEngineModule {}
