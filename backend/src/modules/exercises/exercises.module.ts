import { Module } from '@nestjs/common';
import { ExercisesService } from './exercises.service';
import { ExercisesController, ExerciseTemplatesController } from './exercises.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports:     [NotificationsModule],
  providers:   [ExercisesService],
  controllers: [ExercisesController, ExerciseTemplatesController],
  exports:     [ExercisesService],
})
export class ExercisesModule {}
