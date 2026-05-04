import { Module } from '@nestjs/common';
import { JournalService } from './journal.service';
import { JournalApprovalService } from './journal-approval.service';
import { JournalController } from './journal.controller';
import { PeriodsModule } from '../periods/periods.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports:     [PeriodsModule, AccountingModule],
  providers:   [JournalService, JournalApprovalService],
  controllers: [JournalController],
  exports:     [JournalService, JournalApprovalService],
})
export class JournalModule {}
