import {
  Controller, Get, Post, Patch,
  Body, Param, Request, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { PeriodsService } from './periods.service';
import { CreatePeriodDto, ClosePeriodDto } from './dto/periods.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

@Controller('companies/:companyId/periods')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class PeriodsController {
  constructor(private readonly svc: PeriodsService) {}

  @Get()
  findAll(@Param('companyId') companyId: string) {
    return this.svc.findAll(companyId);
  }

  @Get('active')
  findActive(@Param('companyId') companyId: string) {
    return this.svc.findActive(companyId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('companyId') companyId: string,
    @Body() dto: CreatePeriodDto,
    @Request() req: any,
  ) {
    return this.svc.create(companyId, dto, req.user.id);
  }

  @Patch(':id/close')
  @HttpCode(HttpStatus.OK)
  close(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: ClosePeriodDto,
    @Request() req: any,
  ) {
    return this.svc.close(companyId, id, dto, req.user.id);
  }
}
