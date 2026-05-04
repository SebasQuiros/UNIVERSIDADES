import {
  Controller, Get, Post, Patch,
  Body, Param, Request, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/companies.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private readonly svc: CompaniesService) {}

  // GET — all companies for the authenticated student
  @Get('companies')
  findAll(@Request() req: any) {
    return this.svc.findByStudent(req.user.id);
  }

  // GET — company linked to an exercise attempt
  // Accesible al estudiante dueño y a TEACHER/ADMIN/SUPERADMIN.
  @Get('attempts/:attemptId/company')
  findByAttempt(
    @Param('attemptId') attemptId: string,
    @Request() req: any,
  ) {
    return this.svc.findByAttempt(
      attemptId,
      req.user.id,
      req.user.role,
      req.user.universityId,
    );
  }

  // POST — create company (linked to an exercise attempt)
  @Post('attempts/:attemptId/company')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('attemptId') attemptId: string,
    @Body() dto: CreateCompanyDto,
    @Request() req: any,
  ) {
    return this.svc.create(attemptId, req.user.id, dto);
  }

  // GET — one company with CompanyOwnerGuard
  @Get('companies/:companyId')
  @UseGuards(CompanyOwnerGuard)
  findOne(@Param('companyId') companyId: string, @Request() req: any) {
    return this.svc.findOne(companyId, req.user.id);
  }

  // PATCH — update company info
  @Patch('companies/:companyId')
  @UseGuards(CompanyOwnerGuard)
  update(@Param('companyId') companyId: string, @Body() dto: UpdateCompanyDto) {
    return this.svc.update(companyId, dto);
  }

  // GET — dashboard summary
  @Get('companies/:companyId/dashboard')
  @UseGuards(CompanyOwnerGuard)
  dashboard(@Param('companyId') companyId: string) {
    return this.svc.getDashboard(companyId);
  }
}
