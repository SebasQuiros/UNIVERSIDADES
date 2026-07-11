import {
  Controller, Get, Post, Param, Query, Body,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PedagogyService } from './pedagogy.service';
import { PedagogyAiService } from './pedagogy-ai.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guards';
import { Roles, CurrentUser } from '../auth/decorators/auth.decorators';

class TutorDto {
  @IsOptional() @IsUUID() attemptId?: string;
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsUUID() eventId?: string;
}

class ListEventsQueryDto {
  @IsOptional() @IsUUID() attemptId?: string;
  @IsOptional() @IsString() unresolvedOnly?: string; // '1' | 'true'
}

@Controller('pedagogy')
@UseGuards(JwtAuthGuard)
export class PedagogyController {
  constructor(
    private readonly pedagogy: PedagogyService,
    private readonly pedagogyAi: PedagogyAiService,
  ) {}

  /** GET /pedagogy/profile — perfil de aprendizaje del propio estudiante. */
  @Get('profile')
  profile(@CurrentUser() user: any) {
    return this.pedagogy.getOrCreateProfile(user.id);
  }

  /** GET /pedagogy/events?attemptId=&unresolvedOnly= — eventos del propio estudiante. */
  @Get('events')
  events(@CurrentUser() user: any, @Query() q: ListEventsQueryDto) {
    const unresolvedOnly = q.unresolvedOnly === '1' || q.unresolvedOnly === 'true';
    return this.pedagogy.listEvents(user.id, {
      attemptId: q.attemptId,
      unresolvedOnly,
    });
  }

  /** POST /pedagogy/events/:id/resolve — marca un evento propio como resuelto. */
  @Post('events/:id/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(@Param('id') id: string, @CurrentUser() user: any) {
    return this.pedagogy.markResolved(id, user.id);
  }

  /** POST /pedagogy/tutor — verbalizador socrático por-ejercicio. */
  @Post('tutor')
  @HttpCode(HttpStatus.OK)
  tutor(@Body() dto: TutorDto, @CurrentUser() user: any) {
    return this.pedagogyAi.tutor(user.id, {
      attemptId: dto.attemptId,
      companyId: dto.companyId,
      eventId:   dto.eventId,
    });
  }

  /** GET /pedagogy/mentor — nota de progreso cruzada (varios ejercicios). */
  @Get('mentor')
  mentor(@CurrentUser() user: any) {
    return this.pedagogyAi.mentor(user.id);
  }

  /**
   * GET /pedagogy/students/:studentId/profile — perfil de un estudiante como
   * EVIDENCIA SINAES. Sólo TEACHER/ADMIN/SUPERADMIN.
   */
  @Get('students/:studentId/profile')
  @UseGuards(RolesGuard)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  studentProfile(@Param('studentId') studentId: string) {
    return this.pedagogy.getOrCreateProfile(studentId);
  }
}
