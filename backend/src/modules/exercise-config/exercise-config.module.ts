import { Module } from '@nestjs/common';
import { ExerciseConfigService } from './exercise-config.service';
import { ExerciseConfigController } from './exercise-config.controller';

/**
 * Módulo del Config Engine. Se exporta el service para que otros módulos
 * (business-events, AR, AP, inventory) puedan leer config sin acoplarse
 * al schema de Prisma directamente.
 */
@Module({
  providers:   [ExerciseConfigService],
  controllers: [ExerciseConfigController],
  exports:     [ExerciseConfigService],
})
export class ExerciseConfigModule {}
