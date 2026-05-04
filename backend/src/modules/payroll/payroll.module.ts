import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayrollCalculatorService } from './payroll-calculator.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [PayrollController],
  providers:   [PayrollService, PayrollCalculatorService],
  exports:     [PayrollCalculatorService],
})
export class PayrollModule {}
