import { Controller, Get, UseGuards } from '@nestjs/common';
import { MacroService } from './macro.service';
import { JwtAuthGuard } from '../auth/guards/auth.guards';

@Controller('macro')
@UseGuards(JwtAuthGuard)
export class MacroController {
  constructor(private readonly svc: MacroService) {}

  /** GET /macro/indicators — indicadores económicos de Costa Rica */
  @Get('indicators')
  getIndicators() {
    return this.svc.getIndicators();
  }
}
