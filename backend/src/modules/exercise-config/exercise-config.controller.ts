import {
  Controller, Get, Put, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ExerciseConfigService } from './exercise-config.service';
import { UpdateExerciseConfigDto } from './dto/exercise-config.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { Roles, CurrentUser } from '../auth/decorators/auth.decorators';

/**
 * Endpoints del Config Engine (Fase 1).
 *
 * - GET    /exercises/:exerciseId/config   → cualquiera autenticado
 * - PUT    /exercises/:exerciseId/config   → TEACHER/ADMIN/SUPERADMIN, locked si publicado
 *
 * El path queda separado del controller principal de exercises a propósito —
 * lo mantiene chico y permite reutilizar el service desde la futura página
 * del panel del profesor (Fase 4).
 */
@Controller('exercises/:exerciseId/config')
@UseGuards(JwtAuthGuard)
export class ExerciseConfigController {
  constructor(private readonly svc: ExerciseConfigService) {}

  @Get()
  get(@Param('exerciseId') exerciseId: string) {
    return this.svc.findByExercise(exerciseId);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @Roles('TEACHER', 'ADMIN', 'SUPERADMIN')
  update(
    @Param('exerciseId') exerciseId: string,
    @CurrentUser() user: { id: string; role: string },
    @Body() dto: UpdateExerciseConfigDto,
  ) {
    return this.svc.update(exerciseId, user, dto);
  }
}
