import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { CompanyMembershipsService } from './company-memberships.service';
import {
  CreateGroupCompanyDto,
  AddCompanyMemberDto,
  SetCompanyEnabledDto,
} from './dto/company-memberships.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';

@Controller()
@UseGuards(JwtAuthGuard)
export class CompanyMembershipsController {
  constructor(private readonly svc: CompanyMembershipsService) {}

  // ── GROUP COMPANIES ───────────────────────────────────────
  @Post('exercises/:exerciseId/group-companies')
  @HttpCode(HttpStatus.CREATED)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  createGroupCompany(
    @Param('exerciseId') exerciseId: string,
    @CurrentUser() user: { id: string; role: string },
    @Body() dto: CreateGroupCompanyDto,
  ) {
    return this.svc.createGroupCompany(exerciseId, user, dto);
  }

  @Get('exercises/:exerciseId/group-companies')
  list(
    @Param('exerciseId') exerciseId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.listGroupCompanies(exerciseId, user);
  }

  // ── Fase 4: panel del profesor con stats live de TODAS las companies ─
  @Get('exercises/:exerciseId/companies/dashboard')
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  exerciseDashboard(
    @Param('exerciseId') exerciseId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.exerciseDashboard(exerciseId, user);
  }

  // ── MEMBERSHIPS ───────────────────────────────────────────
  @Get('companies/:companyId/members')
  members(
    @Param('companyId') companyId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.listMembers(companyId, user);
  }

  @Post('companies/:companyId/members')
  @HttpCode(HttpStatus.CREATED)
  addMember(
    @Param('companyId') companyId: string,
    @CurrentUser() user: { id: string; role: string },
    @Body() dto: AddCompanyMemberDto,
  ) {
    return this.svc.addMember(companyId, user, dto);
  }

  @Delete('companies/:companyId/members/:userId')
  @HttpCode(HttpStatus.OK)
  removeMember(
    @Param('companyId') companyId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.removeMember(companyId, userId, user);
  }

  // ── isCompanyEnabled toggle ───────────────────────────────
  @Patch('companies/:companyId/enabled')
  @HttpCode(HttpStatus.OK)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  setEnabled(
    @Param('companyId') companyId: string,
    @CurrentUser() user: { id: string; role: string },
    @Body() dto: SetCompanyEnabledDto,
  ) {
    return this.svc.setEnabled(companyId, user, dto);
  }
}
