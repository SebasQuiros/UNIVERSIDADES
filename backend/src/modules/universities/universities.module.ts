import { Module } from '@nestjs/common';
import { UniversitiesService } from './universities.service';
import { UniversitiesController } from './universities.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports:     [NotificationsModule],
  providers:   [UniversitiesService],
  controllers: [UniversitiesController],
  exports:     [UniversitiesService],
})
export class UniversitiesModule {}
