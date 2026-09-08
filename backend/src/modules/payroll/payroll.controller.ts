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
  CalculatePayrollLineDto,
} from './dto/payroll.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
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
    return this.svc.previewPayroll(companyId, dto.period, dto.employeeIds, req.user.id, dto.movimientos);
  }

  // ── Calculadora suelta: no necesita empleados dados de alta ───────────────
  //
  // Sirve para que el estudiante juegue con un salario y vea el efecto de los
  // hijos, las comisiones o la pension alimenticia sin tener que crear una
  // ficha. Devuelve el desglose completo, incluidos los tramos de renta.
  @Post('payrolls/calculate')
  calculateSingle(@Body() body: CalculatePayrollLineDto) {
    return this.calculator.calcularLinea({
      salarioBase:          Number(body.salary),
      horasExtra:           Number(body.overtime ?? 0),
      bonoFijo:             Number(body.bonus ?? 0),
      comisiones:           Number(body.comisiones ?? 0),
      tieneConyuge:         !!body.tieneConyuge,
      cantidadHijos:        Number(body.cantidadHijos ?? 0),
      pensionAlimenticia:   Number(body.pensionAlimenticia ?? 0),
      tasaAhorroAsociacion: Number(body.tasaAhorroAsociacion ?? 0),
      prestamoAsociacion:   Number(body.prestamoAsociacion ?? 0),
      viaticos:             Number(body.viaticos ?? 0),
      regalos:              Number(body.regalos ?? 0),
    });
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
    @Request() req: any,
  ) {
    return this.svc.getPayroll(companyId, payrollId, req.user.id);
  }
}
