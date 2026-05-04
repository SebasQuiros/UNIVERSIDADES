import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto, UpdateExerciseDto } from './dto/exercises.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { Roles, CurrentUser } from '../auth/decorators/auth.decorators';

// ── Per-course exercise routes ────────────────────────────────────────────────
@Controller('courses/:courseId/exercises')
@UseGuards(JwtAuthGuard)
export class ExercisesController {
  constructor(private readonly svc: ExercisesService) {}

  @Get()
  findAll(@Param('courseId') courseId: string, @CurrentUser() user: any) {
    return this.svc.findAll(courseId, user?.role);
  }

  @Get(':id')
  findOne(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: { role: string },
  ) {
    return this.svc.findOne(courseId, id, user.role);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  create(
    @Param('courseId') courseId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateExerciseDto,
  ) {
    return this.svc.create(courseId, user.id, dto);
  }

  /** POST /courses/:courseId/exercises/from-template — create from a saved template */
  @Post('from-template')
  @HttpCode(HttpStatus.CREATED)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  createFromTemplate(
    @Param('courseId') courseId: string,
    @CurrentUser() user: any,
    @Body() body: { templateId: string },
  ) {
    return this.svc.createFromTemplate(courseId, body.templateId, user.id);
  }

  @Patch(':id')
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  update(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateExerciseDto,
  ) {
    return this.svc.update(courseId, id, user.id, user.role, dto);
  }

  @Patch(':id/archive')
  @HttpCode(HttpStatus.OK)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  archive(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.archive(courseId, id, user.id, user.role);
  }

  /** PATCH /courses/:courseId/exercises/:id/toggle-template — mark/unmark as template */
  @Patch(':id/toggle-template')
  @HttpCode(HttpStatus.OK)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  toggleTemplate(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.toggleTemplate(courseId, id, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  remove(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.remove(courseId, id, user.id, user.role);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  publish(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.publish(courseId, id, user.id, user.role);
  }
}

// ── Global exercise template routes (no courseId required) ────────────────────
@Controller('exercises')
@UseGuards(JwtAuthGuard)
export class ExerciseTemplatesController {
  constructor(private readonly svc: ExercisesService) {}

  /** GET /exercises/templates — list teacher's saved exercise templates */
  @Get('templates')
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  findTemplates(@CurrentUser() user: any) {
    return this.svc.findTemplates(user.id);
  }
}
