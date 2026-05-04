import {
  Controller, Get, Post, Patch, Query,
  Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { UniversitiesService } from './universities.service';
import {
  CreateUniversityDto, UpdateUniversityDto,
  CreateUniversityUserDto, UpdateUserRoleDto,
} from './dto/universities.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { Roles, Public, CurrentUser } from '../auth/decorators/auth.decorators';

@Controller('universities')
@UseGuards(JwtAuthGuard)
export class UniversitiesController {
  constructor(private readonly svc: UniversitiesService) {}

  @Get('detect')
  @Public()
  detectByDomain(@Query('domain') domain: string) {
    if (!domain) return null;
    return this.svc.findByEmailDomain(domain.toLowerCase().trim());
  }

  @Get()
  @Roles('ADMIN', 'SUPERADMIN')
  findAll() {
    return this.svc.findAll();
  }

  @Get('mine')
  getMyUniversity(@CurrentUser() user: { universityId: string | null }) {
    if (!user.universityId) return null;
    return this.svc.findMineForDisplay(user.universityId);
  }

  @Get(':id')
  @Roles('ADMIN', 'SUPERADMIN')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Get(':id/stats')
  @Roles('ADMIN', 'SUPERADMIN')
  getStats(@Param('id') id: string) {
    return this.svc.getStats(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('SUPERADMIN')
  create(@Body() dto: CreateUniversityDto) {
    return this.svc.create(dto);
  }

  // ── User management within a university ──────────────────────────────────────

  @Get(':id/users')
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  findUsers(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.findUsers(id, user.role);
  }

  /**
   * Creates a user for this university.
   * The backend auto-generates a temporary password (mustChangePassword = true).
   * The plain-text password is returned ONCE in the response — store or copy immediately.
   */
  @Post(':id/users')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN', 'SUPERADMIN')
  createUser(
    @Param('id') id: string,
    @Body() body: CreateUniversityUserDto,
  ) {
    return this.svc.createUser(id, { name: body.name, email: body.email, role: body.role });
  }

  /**
   * Update a user's role (ADMIN cannot assign SUPERADMIN).
   */
  @Patch(':id/users/:userId/role')
  @Roles('ADMIN', 'SUPERADMIN')
  updateUserRole(
    @Param('id')     universityId: string,
    @Param('userId') userId: string,
    @Body() body: UpdateUserRoleDto,
  ) {
    return this.svc.updateUserRole(universityId, userId, body.role);
  }

  /**
   * Toggle a user's active/inactive status.
   */
  @Patch(':id/users/:userId/toggle')
  @Roles('ADMIN', 'SUPERADMIN')
  toggleUserActive(
    @Param('id')     universityId: string,
    @Param('userId') userId: string,
  ) {
    return this.svc.toggleUserActive(universityId, userId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPERADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateUniversityDto) {
    return this.svc.update(id, dto);
  }
}
