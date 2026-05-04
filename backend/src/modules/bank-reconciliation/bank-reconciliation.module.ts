import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BankReconciliationService }    from './bank-reconciliation.service';
import { BankReconciliationController } from './bank-reconciliation.controller';

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
  ],
  providers:   [BankReconciliationService],
  controllers: [BankReconciliationController],
  exports:     [BankReconciliationService],
})
export class BankReconciliationModule {}
