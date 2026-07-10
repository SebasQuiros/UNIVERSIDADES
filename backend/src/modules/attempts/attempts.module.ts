import { Module } from '@nestjs/common';
import { AttemptsService } from './attempts.service';
import { AttemptsController } from './attempts.controller';
import { GradingModule } from '../grading/grading.module';

@Module({
  imports:     [GradingModule],
  providers:   [AttemptsService],
  controllers: [AttemptsController],
  exports:     [AttemptsService],
})
export class AttemptsModule {}
