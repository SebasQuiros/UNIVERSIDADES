import {
  Controller, Get, Post, Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { IsString } from 'class-validator';
import { CourseTemplatesService } from './course-templates.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guards';
import { Roles, CurrentUser } from '../auth/decorators/auth.decorators';

class ApplyTemplateDto {
  @IsString() templateKey: string;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class CourseTemplatesController {
  constructor(private readonly svc: CourseTemplatesService) {}

  /** GET /course-templates — catálogo de plantillas UTN disponibles */
  @Get('course-templates')
  list() {
    return this.svc.listTemplates();
  }

  /** GET /course-templates/:key — detalle (ejercicios + rúbricas) */
  @Get('course-templates/:key')
  detail(@Param('key') key: string) {
    return this.svc.getTemplate(key);
  }

  /** POST /courses/:courseId/apply-template — instancia la plantilla en el curso */
  @Post('courses/:courseId/apply-template')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  apply(
    @Param('courseId') courseId: string,
    @Body() dto: ApplyTemplateDto,
    @CurrentUser() user: any,
  ) {
    return this.svc.applyTemplate(courseId, dto.templateKey, { id: user.id, role: user.role });
  }
}
