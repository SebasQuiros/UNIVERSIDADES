import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { EconomicSimulationService } from './economic-simulation.service';
import { FinancialSimulatorService } from './financial-simulator.service';
import { AnalyzeCompanyDto } from './dto/simulator.dto';

/**
 * Simulador financiero + economía simulada (Principios #7/#8).
 * Herramienta de PROYECCIÓN separada de los libros contables.
 */
@UseGuards(JwtAuthGuard)
@Controller('simulator')
export class SimulatorController {
  constructor(
    private readonly economic: EconomicSimulationService,
    private readonly financial: FinancialSimulatorService,
  ) {}

  /**
   * GET /simulator/market
   * Condiciones de mercado simuladas ancladas en macro real de CR.
   */
  @Get('market')
  async market() {
    return this.economic.getMarketConditions();
  }

  /**
   * POST /simulator/analyze
   * Evalúa la idea de empresa ficticia: proyección + escenarios + score +
   * narrativa (IA con fallback determinístico). Rate-limited por el uso de IA.
   */
  @Post('analyze')
  @Throttle({ medium: { ttl: 60_000, limit: 15 } })
  async analyze(@Body() dto: AnalyzeCompanyDto) {
    return this.financial.analyzeWithNarrative(dto);
  }
}
