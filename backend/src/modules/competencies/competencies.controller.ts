import {
  Controller, Get, Post, Patch, Delete, Put,
  Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  IsString, IsOptional, IsInt, IsBoolean, IsIn, IsArray,
  ValidateNested, IsUUID, IsNumber, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CompetenciesService } from './competencies.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guards';
import { Roles, CurrentUser } from '../auth/decorators/auth.decorators';

const AREAS = ['CONTABLE', 'TRIBUTARIO', 'FINANCIERO', 'COSTOS', 'AUDITORIA', 'DATOS', 'GESTION'];

class UpsertCompetencyDto {
  @IsString() @MaxLength(30)  code: string;
  @IsString() @MaxLength(160) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsIn(AREAS) area?: any;
  @IsOptional() @IsInt() level?: number;
  @IsOptional() @IsInt() order?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class LinkDto {
  @IsUUID() competencyId: string;
  @IsOptional() @IsNumber() weight?: number;
}
class SetLinksDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => LinkDto)
  competencies: LinkDto[];
}

@Controller()
@UseGuards(JwtAuthGuard)
export class CompetenciesController {
  constructor(private readonly svc: CompetenciesService) {}

  /** GET /competencies — catálogo (globales + de la universidad del usuario) */
  @Get('competencies')
  list(@CurrentUser() user: any) {
    return this.svc.listCatalog(user?.universityId ?? null);
  }

  @Post('competencies')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  create(@Body() dto: UpsertCompetencyDto, @CurrentUser() user: any) {
    // TEACHER/ADMIN crean competencias de SU universidad; SUPERADMIN global.
    const universityId = user?.role === 'SUPERADMIN' ? null : (user?.universityId ?? null);
    return this.svc.create(dto, universityId);
  }

  @Patch('competencies/:id')
  @UseGuards(RolesGuard)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  update(@Param('id') id: string, @Body() dto: Partial<UpsertCompetencyDto>) {
    return this.svc.update(id, dto);
  }

  @Delete('competencies/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  // ── Vínculo con ejercicios ────────────────────────────────────
  @Get('exercises/:exerciseId/competencies')
  getForExercise(@Param('exerciseId') exerciseId: string) {
    return this.svc.getExerciseCompetencies(exerciseId);
  }

  @Put('exercises/:exerciseId/competencies')
  @UseGuards(RolesGuard)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  setForExercise(@Param('exerciseId') exerciseId: string, @Body() dto: SetLinksDto) {
    return this.svc.setExerciseCompetencies(exerciseId, dto.competencies ?? []);
  }

  // ── Evidencia de competencias (dashboards) ────────────────────
  /** Dashboard del profesor: dominio por competencia + alumnos en riesgo. */
  @Get('courses/:courseId/competency-evidence')
  @UseGuards(RolesGuard)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  courseEvidence(@Param('courseId') courseId: string, @CurrentUser() user: any) {
    return this.svc.getCourseEvidence(courseId, { id: user.id, role: user.role });
  }

  /** Dashboard institucional (acreditación): dominio por competencia y por cohorte. */
  @Get('universities/:universityId/competency-evidence')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  universityEvidence(@Param('universityId') universityId: string, @CurrentUser() user: any) {
    return this.svc.getUniversityEvidence(universityId, { role: user.role, universityId: user.universityId });
  }
}
