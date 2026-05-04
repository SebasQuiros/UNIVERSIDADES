import { Module } from '@nestjs/common';
import { AccountsReceivableService }    from './accounts-receivable.service';
import { AccountsReceivableController } from './accounts-receivable.controller';
import { JournalModule }                from '../journal/journal.module';
import { BusinessModule }               from '../business/business.module';

@Module({
  imports:     [JournalModule, BusinessModule],
  providers:   [AccountsReceivableService],
  controllers: [AccountsReceivableController],
  exports:     [AccountsReceivableService],
})
export class AccountsReceivableModule {}
