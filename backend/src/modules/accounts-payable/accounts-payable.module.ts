import { Module } from '@nestjs/common';
import { AccountsPayableService }    from './accounts-payable.service';
import { AccountsPayableController } from './accounts-payable.controller';
import { JournalModule }             from '../journal/journal.module';
import { BusinessModule }            from '../business/business.module';

@Module({
  imports:     [JournalModule, BusinessModule],
  providers:   [AccountsPayableService],
  controllers: [AccountsPayableController],
  exports:     [AccountsPayableService],
})
export class AccountsPayableModule {}
