import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports:     [AccountsModule],
  providers:   [CompaniesService],
  controllers: [CompaniesController],
  exports:     [CompaniesService],
})
export class CompaniesModule {}
