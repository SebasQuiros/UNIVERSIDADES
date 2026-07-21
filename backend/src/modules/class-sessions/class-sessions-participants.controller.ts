import {
  Controller, Get, Post, Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ClassSessionsService } from './class-sessions.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guards';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import { ClassSessionGuard } from './guards/class-session-access.guard';
import { JoinClassSessionDto } from './dto/class-sessions.dto';

type AuthUser = { id: string; role: string; universityId?: string | null };

/** Endpoints del ESTUDIANTE (unirse, mi sesión, heartbeat) + live compartido. */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassSessionsParticipantsController {
  constructor(private readonly svc: ClassSessionsService) {}

  @Post('class-sessions/join')
  @HttpCode(HttpStatus.OK)
  @Roles('STUDENT')
  join(@CurrentUser() user: AuthUser, @Body() dto: JoinClassSessionDto) {
    return this.svc.join(user, dto);
  }

  @Get('class-sessions/:id/me')
  @Roles('STUDENT')
  @UseGuards(ClassSessionGuard)
  me(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.svc.me(id, user);
  }

  @Post('class-sessions/:id/ping')
  @HttpCode(HttpStatus.OK)
  @Roles('STUDENT')
  @UseGuards(ClassSessionGuard)
  ping(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.svc.ping(id, user);
  }

  // Payload liviano para polling — accesible a participantes y staff.
  @Get('class-sessions/:id/live')
  @Roles('STUDENT', 'TEACHER', 'ADMIN', 'SUPERADMIN')
  @UseGuards(ClassSessionGuard)
  live(@Param('id') id: string) {
    return this.svc.live(id);
  }
}
