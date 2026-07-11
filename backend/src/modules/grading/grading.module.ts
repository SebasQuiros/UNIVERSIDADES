import { Module } from '@nestjs/common';
import { GradingService } from './grading.service';
import { AutoGradingService } from './auto-grading.service';
import { GradingController } from './grading.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { PedagogyModule } from '../pedagogy/pedagogy.module';

@Module({
  // grading → pedagogy es one-way (pedagogy NO importa grading): sin ciclos.
  imports:     [NotificationsModule, PedagogyModule],
  providers:   [GradingService, AutoGradingService],
  controllers: [GradingController],
  exports:     [GradingService, AutoGradingService],
})
export class GradingModule {}
