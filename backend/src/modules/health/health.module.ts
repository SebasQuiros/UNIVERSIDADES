import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/** Health check público (/api/v1/health). PrismaService es global. */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
