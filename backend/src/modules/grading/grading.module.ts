import { Module } from '@nestjs/common';
import { GradingService } from './grading.service';
import { AutoGradingService } from './auto-grading.service';
import { GradingController } from './grading.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports:     [NotificationsModule],
  providers:   [GradingService, AutoGradingService],
  controllers: [GradingController],
  exports:     [GradingService, AutoGradingService],
})
export class GradingModule {}
