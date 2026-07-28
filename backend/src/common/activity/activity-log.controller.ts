import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { JwtAuthGuard } from '../../modules/auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../guards/company-owner.guard';

/** Bitácora de acciones de una empresa. El guard ya valida el acceso
 *  (dueño/miembro de la empresa, profesor del curso, admin). */
@Controller('companies/:companyId/activity-log')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class ActivityLogController {
  constructor(private readonly svc: ActivityLogService) {}

  @Get()
  list(@Param('companyId') companyId: string, @Query('limit') limit?: string) {
    return this.svc.forCompany(companyId, limit ? parseInt(limit, 10) : 100);
  }
}
