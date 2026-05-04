import {
  Controller, Get, Post, Patch,
  Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/accounts.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

@Controller('companies/:companyId/accounts')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class AccountsController {
  constructor(private readonly svc: AccountsService) {}

  @Get()
  findAll(@Param('companyId') companyId: string) {
    return this.svc.findAll(companyId);
  }

  @Get(':id')
  findOne(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.svc.findOne(companyId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Param('companyId') companyId: string, @Body() dto: CreateAccountDto) {
    return this.svc.create(companyId, dto);
  }

  @Patch(':id')
  update(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.svc.update(companyId, id, dto);
  }
}
