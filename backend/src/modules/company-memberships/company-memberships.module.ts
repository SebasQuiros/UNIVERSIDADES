import { Module } from '@nestjs/common';
import { CompanyMembershipsService } from './company-memberships.service';
import { CompanyMembershipsController } from './company-memberships.controller';

@Module({
  providers:   [CompanyMembershipsService],
  controllers: [CompanyMembershipsController],
  exports:     [CompanyMembershipsService],
})
export class CompanyMembershipsModule {}
