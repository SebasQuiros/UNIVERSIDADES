import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { LedgerFilterDto } from './dto/ledger.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

@Controller('companies/:companyId/ledger')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class LedgerController {
  constructor(private readonly svc: LedgerService) {}

  // Summary of all accounts with movements
  @Get()
  getLedger(
    @Param('companyId') companyId: string,
    @Query() filter: LedgerFilterDto,
  ) {
    return this.svc.getLedger(companyId, filter);
  }

  // Detailed movements for a specific account (kardex)
  @Get(':accountId')
  getAccountLedger(
    @Param('companyId') companyId: string,
    @Param('accountId') accountId: string,
    @Query() filter: LedgerFilterDto,
  ) {
    return this.svc.getAccountLedger(companyId, accountId, filter);
  }
}
