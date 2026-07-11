import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MacroModule } from '../macro/macro.module';
import { EconomicSimulationService } from './economic-simulation.service';
import { FinancialSimulatorService } from './financial-simulator.service';
import { SimulatorController } from './simulator.controller';

/**
 * F5 — Economía simulada + Simulador financiero (Principios #7/#8).
 * Reutiliza MacroService (datos macro REALES de CR) como baseline. Stateless:
 * no toca la base de datos, computa bajo demanda.
 */
@Module({
  imports: [
    // MacroModule exporta MacroService (indicadores reales CR).
    MacroModule,
    // ConfigModule es global (app.module), pero lo importamos explícitamente
    // para el ANTHROPIC_API_KEY de la narrativa.
    ConfigModule,
  ],
  providers: [EconomicSimulationService, FinancialSimulatorService],
  controllers: [SimulatorController],
  exports: [EconomicSimulationService, FinancialSimulatorService],
})
export class SimulatorModule {}
