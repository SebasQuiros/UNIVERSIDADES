import { Module } from '@nestjs/common';
import { FixedAssetsController } from './fixed-assets.controller';
import { FixedAssetsService } from './fixed-assets.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { JournalModule } from '../journal/journal.module';

@Module({
  imports: [PrismaModule, JournalModule],
  controllers: [FixedAssetsController],
  providers: [FixedAssetsService],
})
export class FixedAssetsModule {}
