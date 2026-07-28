import { Global, Module } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogController } from './activity-log.controller';

/**
 * Global para que cualquier módulo pueda inyectar ActivityLogService sin
 * tener que importarlo en cada uno (la bitácora se escribe desde muchos sitios).
 */
@Global()
@Module({
  providers:   [ActivityLogService],
  controllers: [ActivityLogController],
  exports:     [ActivityLogService],
})
export class ActivityLogModule {}
