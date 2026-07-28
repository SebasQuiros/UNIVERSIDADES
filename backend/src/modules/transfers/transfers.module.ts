import { Module } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { TransfersController } from './transfers.controller';
import { JournalModule } from '../journal/journal.module';

@Module({
  imports:     [JournalModule],
  providers:   [TransfersService],
  controllers: [TransfersController],
  exports:     [TransfersService],
})
export class TransfersModule {}
