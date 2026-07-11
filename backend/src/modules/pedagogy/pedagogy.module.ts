import { Module } from '@nestjs/common';
import { PedagogyService } from './pedagogy.service';
import { PedagogyAiService } from './pedagogy-ai.service';
import { PedagogyController } from './pedagogy.controller';

// PrismaModule es @Global(), así que PrismaService está disponible sin import.
// El verbalizador (PedagogyAiService) replica el setup Anthropic de AiService
// directamente (require defensivo + ConfigService), por lo que NO necesita
// importar AiModule. Este módulo es one-way: exporta PedagogyService para que
// GradingModule pueda emitir eventos; NUNCA importa GradingModule (sin ciclos).
@Module({
  providers:   [PedagogyService, PedagogyAiService],
  controllers: [PedagogyController],
  exports:     [PedagogyService],
})
export class PedagogyModule {}
