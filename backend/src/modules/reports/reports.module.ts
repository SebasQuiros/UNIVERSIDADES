import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsExportService } from './reports-export.service';
import { ReportsController } from './reports.controller';

@Module({
  providers:   [ReportsService, ReportsExportService],
  controllers: [ReportsController],
  exports:     [ReportsService, ReportsExportService],
})
export class ReportsModule {}
