import {
  Controller, Get, Post, Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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

  // Throttle dedicado y estricto: el código de unión es de 6 chars sobre un
  // alfabeto de 32 símbolos (~10⁹ combinaciones). 10 intentos/min por IP hacen
  // la enumeración por fuerza bruta impracticable (defensa en profundidad sobre
  // el throttle global). Solo funciona en fase LOBBY, además.
  @Post('class-sessions/join')
  @HttpCode(HttpStatus.OK)
  @Roles('STUDENT')
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
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

  // Ranking empresarial (Enterprise Score) — leaderboard vivo de la sesión.
  @Get('class-sessions/:id/ranking')
  @Roles('STUDENT', 'TEACHER', 'ADMIN', 'SUPERADMIN')
  @UseGuards(ClassSessionGuard)
  ranking(@Param('id') id: string) {
    return this.svc.ranking(id);
  }

  // Perfil público de una empresa del mercado: quién es y cómo se comporta.
  @Get('class-sessions/:id/companies/:companyId/profile')
  @Roles('STUDENT', 'TEACHER', 'ADMIN', 'SUPERADMIN')
  @UseGuards(ClassSessionGuard)
  companyProfile(@Param('id') id: string, @Param('companyId') companyId: string) {
    return this.svc.companyProfile(id, companyId);
  }

  // Anuncios/noticias de la sesión — visibles a participantes y staff.
  @Get('class-sessions/:id/announcements')
  @Roles('STUDENT', 'TEACHER', 'ADMIN', 'SUPERADMIN')
  @UseGuards(ClassSessionGuard)
  announcements(@Param('id') id: string) {
    return this.svc.listAnnouncements(id);
  }
}
