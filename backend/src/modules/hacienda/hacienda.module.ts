import { Module } from '@nestjs/common';
import { HaciendaService }    from './hacienda.service';
import { HaciendaController } from './hacienda.controller';

@Module({
  controllers: [HaciendaController],
  providers:   [HaciendaService],
  exports:     [HaciendaService],
})
export class HaciendaModule {}
