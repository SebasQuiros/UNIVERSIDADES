import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PracticeGroupsService } from './practice-groups.service';
import { PracticeGroupsController } from './practice-groups.controller';

/**
 * PracticeGroupsModule — "Multiempresa en modo práctica" (Espacio Contador).
 *
 * Grupos de estudiantes cuyas empresas de práctica (isPractice) pueden comerciar
 * entre sí. El comercio en sí lo maneja ProcurementModule vía practiceGroupId.
 */
@Module({
  imports:     [PrismaModule],
  providers:   [PracticeGroupsService],
  controllers: [PracticeGroupsController],
  exports:     [PracticeGroupsService],
})
export class PracticeGroupsModule {}
