import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ClassSessionsService } from './class-sessions.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guards';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import { ClassSessionGuard } from './guards/class-session-access.guard';
import {
  CreateClassSessionDto, CreateSessionGroupDto, UpdateArchetypeDto,
  StartSessionDto, CancelSessionDto,
} from './dto/class-sessions.dto';

type AuthUser = { id: string; role: string; universityId?: string | null };

/**
 * Endpoints del PROFESOR (staff). Todo el controller es solo TEACHER/ADMIN/
 * SUPERADMIN. `ClassSessionGuard` valida la propiedad de la sesión en las
 * rutas `:id`; en las rutas por `:exerciseId` (crear/obtener) la validación de
 * dueño la hace el service (`assertCanAdminExercise`).
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, ClassSessionGuard)
@Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
export class ClassSessionsController {
  constructor(private readonly svc: ClassSessionsService) {}

  @Post('courses/:courseId/exercises/:exerciseId/class-session')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('exerciseId') exerciseId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateClassSessionDto,
  ) {
    return this.svc.createForExercise(exerciseId, user, dto);
  }

  @Get('courses/:courseId/exercises/:exerciseId/class-session')
  getByExercise(
    @Param('exerciseId') exerciseId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.getForExercise(exerciseId, user);
  }

  @Post('class-sessions/:id/lobby/open')
  openLobby(@Param('id') id: string) {
    return this.svc.openLobby(id);
  }

  @Post('class-sessions/:id/groups')
  @HttpCode(HttpStatus.CREATED)
  createGroup(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSessionGroupDto,
  ) {
    return this.svc.createGroup(id, user, dto);
  }

  @Patch('class-sessions/:id/groups/:companyId/archetype')
  setArchetype(
    @Param('id') id: string,
    @Param('companyId') companyId: string,
    @Body() dto: UpdateArchetypeDto,
  ) {
    return this.svc.setArchetype(id, companyId, dto);
  }

  @Post('class-sessions/:id/groups/auto-assign')
  autoAssign(@Param('id') id: string) {
    return this.svc.autoAssign(id);
  }

  @Delete('class-sessions/:id/participants/:participantId')
  removeParticipant(
    @Param('id') id: string,
    @Param('participantId') participantId: string,
  ) {
    return this.svc.removeParticipant(id, participantId);
  }

  @Post('class-sessions/:id/start')
  start(@Param('id') id: string, @Body() dto: StartSessionDto) {
    return this.svc.start(id, dto);
  }

  @Post('class-sessions/:id/close-operations')
  closeOperations(@Param('id') id: string) {
    return this.svc.closeOperations(id);
  }

  @Post('class-sessions/:id/publish-snapshot')
  publishSnapshot(@Param('id') id: string) {
    return this.svc.publishSnapshot(id);
  }

  @Post('class-sessions/:id/close-audit')
  closeAudit(@Param('id') id: string) {
    return this.svc.closeAudit(id);
  }

  @Post('class-sessions/:id/grade')
  grade(@Param('id') id: string) {
    return this.svc.grade(id);
  }

  @Post('class-sessions/:id/finish')
  finish(@Param('id') id: string) {
    return this.svc.finish(id);
  }

  @Post('class-sessions/:id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelSessionDto) {
    return this.svc.cancel(id, dto);
  }

  @Get('class-sessions/:id/dashboard')
  dashboard(@Param('id') id: string) {
    return this.svc.dashboard(id);
  }

  // Anuncios del profesor (noticias de la sesión)
  @Post('class-sessions/:id/announcements')
  createAnnouncement(
    @Param('id') id: string,
    @Body() dto: { title: string; body?: string; kind?: string },
  ) {
    return this.svc.createAnnouncement(id, dto);
  }

  @Delete('class-sessions/:id/announcements/:announcementId')
  deleteAnnouncement(
    @Param('id') id: string,
    @Param('announcementId') announcementId: string,
  ) {
    return this.svc.deleteAnnouncement(id, announcementId);
  }
}
