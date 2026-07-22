import { Module } from '@nestjs/common';
import { CompanyMembershipsService } from './company-memberships.service';
import { CompanyMembershipsController } from './company-memberships.controller';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports:     [AccountsModule], // seedChartOfAccounts al crear la Company GROUP
  providers:   [CompanyMembershipsService],
  controllers: [CompanyMembershipsController],
  exports:     [CompanyMembershipsService],
})
export class CompanyMembershipsModule {}
