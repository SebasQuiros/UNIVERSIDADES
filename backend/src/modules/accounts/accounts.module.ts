import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';

@Module({
  imports:     [MulterModule.register({ storage: memoryStorage() })],
  providers:   [AccountsService],
  controllers: [AccountsController],
  exports:     [AccountsService],
})
export class AccountsModule {}
