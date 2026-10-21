import { Module } from '@nestjs/common';
import { HaciendaService }      from './hacienda.service';
import { CabysCatalogoService } from './cabys-catalogo.service';
import { HaciendaController } from './hacienda.controller';

@Module({
  controllers: [HaciendaController],
  providers:   [HaciendaService, CabysCatalogoService],
  exports:     [HaciendaService],
})
export class HaciendaModule {}
