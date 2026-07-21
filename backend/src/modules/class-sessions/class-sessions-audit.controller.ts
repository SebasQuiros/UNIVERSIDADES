import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Req, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ClassSessionsService } from './class-sessions.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guards';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import { AuditAssignmentGuard } from './guards/audit-assignment.guard';
import { SubmitFindingDto, UpdateFindingDto } from './dto/class-sessions.dto';

type AuthUser = { id: string; role: string; universityId?: string | null };

/**
 * Endpoints de AUDITORÍA. Todo pasa por `AuditAssignmentGuard`, el único guard
 * que cruza la frontera entre empresas: resuelve la empresa auditada SOLO desde
 * la asignación del usuario (nunca de un `:companyId` del cliente — por eso la
 * ruta de snapshot no lo lleva) y adjunta `req.auditAssignment`.
 */
@Controller('class-sessions/:id/audit')
@UseGuards(JwtAuthGuard, RolesGuard, AuditAssignmentGuard)
@Roles('STUDENT', 'TEACHER', 'ADMIN', 'SUPERADMIN')
export class ClassSessionsAuditController {
  constructor(private readonly svc: ClassSessionsService) {}

  @Get('assignment')
  assignment(@Req() req: any) {
    return this.svc.getAssignment(req);
  }

  @Get('snapshot')
  snapshot(@Req() req: any) {
    return this.svc.getSnapshot(req);
  }

  @Post('findings')
  @HttpCode(HttpStatus.CREATED)
  @Roles('STUDENT')
  createFinding(
    @Req() req: any,
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitFindingDto,
  ) {
    return this.svc.createFinding(req, user, dto);
  }

  @Get('findings')
  listFindings(@Req() req: any) {
    return this.svc.listFindings(req);
  }

  @Patch('findings/:findingId')
  @Roles('STUDENT')
  updateFinding(
    @Req() req: any,
    @Param('findingId') findingId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateFindingDto,
  ) {
    return this.svc.updateFinding(req, findingId, user, dto);
  }

  @Delete('findings/:findingId')
  @Roles('STUDENT')
  deleteFinding(
    @Req() req: any,
    @Param('findingId') findingId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.deleteFinding(req, findingId, user);
  }
}
