import {
  Controller, Get, Post, Put, Delete, Patch,
  Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollCalculatorService } from './payroll-calculator.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  ProcessPayrollDto,
  PreviewPayrollDto,
} from './dto/payroll.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';

@UseGuards(JwtAuthGuard)
@Controller('companies/:companyId')
export class PayrollController {
  constructor(
    private readonly svc: PayrollService,
    private readonly calculator: PayrollCalculatorService,
  ) {}

  // ── Employees ─────────────────────────────────────────────────────────────

  @Get('employees')
  findEmployees(@Param('companyId') companyId: string, @Request() req: any) {
    return this.svc.findEmployees(companyId, req.user.id);
  }

  @Post('employees')
  createEmployee(
    @Param('companyId') companyId: string,
    @Body() dto: CreateEmployeeDto,
    @Request() req: any,
  ) {
    return this.svc.createEmployee(companyId, dto, req.user.id);
  }

  @Put('employees/:employeeId')
  updateEmployee(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: UpdateEmployeeDto,
    @Request() req: any,
  ) {
    return this.svc.updateEmployee(companyId, employeeId, dto, req.user.id);
  }

  @Delete('employees/:employeeId')
  deleteEmployee(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @Request() req: any,
  ) {
    return this.svc.deleteEmployee(companyId, employeeId, req.user.id);
  }

  // ── Payroll preview (no persistence) ─────────────────────────────────────

  @Post('payrolls/preview')
  previewPayroll(
    @Param('companyId') companyId: string,
    @Body() dto: PreviewPayrollDto,
    @Request() req: any,
  ) {
    return this.svc.previewPayroll(companyId, dto.period, dto.employeeIds, req.user.id);
  }

  // ── Quick calculator (pure, no employees needed) ──────────────────────────
  // POST /companies/:id/payrolls/calculate { salary, overtime?, bonus? }
  @Post('payrolls/calculate')
  calculateSingle(@Body() body: { salary: number; overtime?: number; bonus?: number }) {
    return this.calculator.calculatePayrollLine(
      Number(body.salary),
      Number(body.overtime ?? 0),
      Number(body.bonus ?? 0),
    );
  }

  // ── Process & persist payroll ─────────────────────────────────────────────

  @Post('payrolls')
  processPayroll(
    @Param('companyId') companyId: string,
    @Body() dto: ProcessPayrollDto,
    @Request() req: any,
  ) {
    return this.svc.processPayroll(companyId, dto, req.user.id);
  }

  // ── History ───────────────────────────────────────────────────────────────

  @Get('payrolls')
  getPayrolls(@Param('companyId') companyId: string, @Request() req: any) {
    return this.svc.getPayrolls(companyId, req.user.id);
  }

  @Get('payrolls/:payrollId')
  getPayroll(
    @Param('companyId') companyId: string,
    @Param('payrollId') payrollId: string,
  ) {
    return this.svc.getPayroll(companyId, payrollId);
  }
}
