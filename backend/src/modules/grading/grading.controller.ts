import {
  Controller, Get, Post,
  Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { GradingService } from './grading.service';
import { AutoGradingService } from './auto-grading.service';
import { GradeAttemptDto } from './dto/grading.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { Roles, CurrentUser } from '../auth/decorators/auth.decorators';

class BroadcastDto {
  @IsString()
  @MaxLength(1000)
  message: string;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class GradingController {
  constructor(
    private readonly svc: GradingService,
    private readonly autoSvc: AutoGradingService,
  ) {}

  // GET /courses/:courseId/exercises/:exerciseId/attempts
  @Get('courses/:courseId/exercises/:exerciseId/attempts')
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  listAttempts(
    @Param('courseId') courseId: string,
    @Param('exerciseId') exerciseId: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.listAttempts(courseId, exerciseId, user.id, user.role);
  }

  // POST /attempts/:id/grade
  @Post('attempts/:id/grade')
  @HttpCode(HttpStatus.OK)
  @Roles('TEACHER')
  grade(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: GradeAttemptDto,
  ) {
    return this.svc.grade(id, user.id, dto);
  }

  // GET /attempts/:id/grade
  // Students can only see their own grade; service enforces ownership by userId + role
  @Get('attempts/:id/grade')
  @Roles('STUDENT', 'TEACHER', 'ADMIN', 'SUPERADMIN')
  getGrade(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.getGrade(id, user.id, user.role);
  }

  // POST /attempts/:id/auto-grade  → returns preview (does NOT save the grade)
  @Post('attempts/:id/auto-grade')
  @HttpCode(HttpStatus.OK)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  autoGrade(@Param('id') id: string, @CurrentUser() user: any) {
    return this.autoSvc.preview(id, user.id);
  }

  // GET /courses/:courseId/exercises/:exerciseId/live
  @Get('courses/:courseId/exercises/:exerciseId/live')
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  getLive(
    @Param('courseId') courseId: string,
    @Param('exerciseId') exerciseId: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.getLiveDashboard(courseId, exerciseId, user.id);
  }

  // POST /courses/:courseId/exercises/:exerciseId/broadcast
  @Post('courses/:courseId/exercises/:exerciseId/broadcast')
  @HttpCode(HttpStatus.OK)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  broadcast(
    @Param('courseId') courseId: string,
    @Param('exerciseId') exerciseId: string,
    @Body() dto: BroadcastDto,
    @CurrentUser() user: any,
  ) {
    return this.svc.broadcast(courseId, exerciseId, user.id, dto.message);
  }
}
