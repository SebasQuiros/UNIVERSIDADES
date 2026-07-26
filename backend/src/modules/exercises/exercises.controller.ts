import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, HttpCode, HttpStatus, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto, UpdateExerciseDto, UploadAttachmentDto } from './dto/exercises.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { Roles, CurrentUser } from '../auth/decorators/auth.decorators';

// ── Per-course exercise routes ────────────────────────────────────────────────
@Controller('courses/:courseId/exercises')
@UseGuards(JwtAuthGuard)
export class ExercisesController {
  constructor(private readonly svc: ExercisesService) {}

  @Get()
  findAll(@Param('courseId') courseId: string, @CurrentUser() user: any) {
    return this.svc.findAll(courseId, user);
  }

  @Get(':id')
  findOne(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.findOne(courseId, id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  create(
    @Param('courseId') courseId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateExerciseDto,
  ) {
    return this.svc.create(courseId, user, dto);
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
    return this.svc.update(courseId, id, user, dto);
  }

  @Patch(':id/archive')
  @HttpCode(HttpStatus.OK)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  archive(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.archive(courseId, id, user);
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
    return this.svc.remove(courseId, id, user);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  publish(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.publish(courseId, id, user);
  }

  /** POST .../:id/preview — crea/reutiliza el intento propio del profesor para
   *  probar el ejercicio con la misma experiencia que ve un estudiante. */
  @Post(':id/preview')
  @HttpCode(HttpStatus.OK)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  previewAsStudent(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.previewAsStudent(courseId, id, user);
  }

  // ── Adjuntos del enunciado (Spec UTN §1) ──────────────────────────────────
  /** POST .../:id/attachments — el profesor adjunta material del caso. */
  @Post(':id/attachments')
  @HttpCode(HttpStatus.CREATED)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  addAttachment(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UploadAttachmentDto,
  ) {
    return this.svc.addAttachment(courseId, id, user, dto);
  }

  /** GET .../:id/attachments — metadatos (sin binario). Profesor y estudiante. */
  @Get(':id/attachments')
  listAttachments(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.listAttachments(courseId, id, user);
  }

  /** GET .../:id/attachments/:attId/download — sirve el archivo. */
  @Get(':id/attachments/:attId/download')
  async downloadAttachment(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @Param('attId') attId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const att = await this.svc.getAttachment(courseId, id, attId, user);
    const buf = Buffer.from(att.fileData, 'base64');
    res.setHeader('Content-Type', att.mimeType);
    res.setHeader('Content-Length', buf.length);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(att.fileName)}"`,
    );
    res.end(buf);
  }

  /** DELETE .../:id/attachments/:attId — el profesor elimina material. */
  @Delete(':id/attachments/:attId')
  @HttpCode(HttpStatus.OK)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  deleteAttachment(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @Param('attId') attId: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.deleteAttachment(courseId, id, attId, user);
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
