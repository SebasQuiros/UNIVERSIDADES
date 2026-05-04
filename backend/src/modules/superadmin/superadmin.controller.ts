import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, ParseUUIDPipe, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/auth.decorators';
import { SuperadminService } from './superadmin.service';
import { CreateUniversityDto, UpdateUniversityDto, AssignPlanDto } from './dto/superadmin.dto';

@Controller('superadmin')
@Roles('SUPERADMIN')
export class SuperadminController {
  constructor(private readonly superadminService: SuperadminService) {}

  // ── Dashboard ─────────────────────────────────────────────────────────────

  @Get('dashboard')
  getDashboard() {
    return this.superadminService.getDashboardStats();
  }

  // ── Universities ──────────────────────────────────────────────────────────

  @Get('universities')
  getUniversities(
    @Query('search')   search?: string,
    @Query('isActive') isActive?: string,
  ) {
    const activeFilter =
      isActive === 'true'  ? true  :
      isActive === 'false' ? false : undefined;
    return this.superadminService.getUniversities({ search, isActive: activeFilter });
  }

  @Post('universities')
  createUniversity(@Body() dto: CreateUniversityDto) {
    return this.superadminService.createUniversity(dto);
  }

  @Get('universities/:id')
  getUniversity(@Param('id', ParseUUIDPipe) id: string) {
    return this.superadminService.getUniversity(id);
  }

  @Patch('universities/:id')
  updateUniversity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUniversityDto,
  ) {
    return this.superadminService.updateUniversity(id, dto);
  }

  @Patch('universities/:id/toggle-status')
  toggleUniversityStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.superadminService.toggleUniversityStatus(id);
  }

  @Post('universities/:id/plan')
  assignPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignPlanDto,
  ) {
    return this.superadminService.assignPlan(id, dto.planId);
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  @Get('users')
  getUsers(
    @Query('role')         role?:         string,
    @Query('universityId') universityId?: string,
    @Query('search')       search?:       string,
  ) {
    return this.superadminService.getUsers({ role, universityId, search });
  }

  @Patch('users/:id/toggle-status')
  toggleUserStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.superadminService.toggleUserStatus(id);
  }

  @Post('users/:id/reset-password')
  resetUserPassword(@Param('id', ParseUUIDPipe) id: string) {
    return this.superadminService.resetUserPassword(id);
  }

  @Delete('users/:id')
  deleteUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.superadminService.deleteUser(id);
  }

  // ── Plans ─────────────────────────────────────────────────────────────────

  @Get('plans')
  getPlans() {
    return this.superadminService.getPlans();
  }

  // ── Activity ──────────────────────────────────────────────────────────────

  @Get('activity')
  getActivity(
    @Query('limit',        new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('universityId') universityId?: string,
    @Query('userId')       userId?:       string,
  ) {
    return this.superadminService.getActivityLog(limit, { universityId, userId });
  }
}
