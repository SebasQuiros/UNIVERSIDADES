import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayrollCalculatorService } from './payroll-calculator.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { JournalModule } from '../journal/journal.module';

@Module({
  imports:     [PrismaModule, JournalModule],
  controllers: [PayrollController],
  providers:   [PayrollService, PayrollCalculatorService],
  exports:     [PayrollCalculatorService],
})
export class PayrollModule {}
