import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto, ProcessPayrollDto, UpdateEmployeeDto } from './dto/payroll.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { PayrollCalculatorService } from './payroll-calculator.service';
import { assertCompanyAccess } from '../../common/auth/company-access.helper';
import { ACCOUNT_CODES } from '../accounting/constants/account-codes';

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: PayrollCalculatorService,
  ) {}

  // ── Ownership guard (Fase 1: soporta INDIVIDUAL + GROUP) ────────────────
  private async verifyOwner(companyId: string, userId: string) {
    await assertCompanyAccess(this.prisma, companyId, userId);
  }

  // ── Employees ─────────────────────────────────────────────────────────────

  async findEmployees(companyId: string, userId: string) {
    await this.verifyOwner(companyId, userId);
    return this.prisma.employee.findMany({
      where:   { companyId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createEmployee(companyId: string, dto: CreateEmployeeDto, userId: string) {
    await this.verifyOwner(companyId, userId);
    return this.prisma.employee.create({
      data: {
        companyId,
        name:           dto.name,
        identification: dto.identification,
        position:       dto.position   ?? null,
        department:     dto.department ?? null,
        salary:         new Decimal(dto.salary),
        salaryType:     dto.salaryType ?? 'MENSUAL',
        startDate:      new Date(dto.startDate),
      },
    });
  }

  async updateEmployee(companyId: string, employeeId: string, dto: UpdateEmployeeDto, userId: string) {
    await this.verifyOwner(companyId, userId);
    const emp = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId } });
    if (!emp) throw new NotFoundException('Empleado no encontrado');
    return this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        name:       dto.name       ?? emp.name,
        position:   dto.position   ?? emp.position,
        department: dto.department ?? emp.department,
        salary:     dto.salary !== undefined ? new Decimal(dto.salary) : emp.salary,
        isActive:   dto.isActive   ?? emp.isActive,
      },
    });
  }

  async deleteEmployee(companyId: string, employeeId: string, userId: string) {
    await this.verifyOwner(companyId, userId);
    const emp = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId } });
    if (!emp) throw new NotFoundException('Empleado no encontrado');
    // Soft delete
    return this.prisma.employee.update({
      where: { id: employeeId },
      data:  { isActive: false },
    });
  }

  // ── Preview (no persistence) ──────────────────────────────────────────────

  async previewPayroll(companyId: string, period: string, employeeIds?: string[], userId?: string) {
    if (userId) await this.verifyOwner(companyId, userId);
    const where = {
      companyId,
      isActive: true,
      ...(employeeIds?.length ? { id: { in: employeeIds } } : {}),
    };
    const employees = await this.prisma.employee.findMany({ where });
    if (!employees.length) throw new BadRequestException('No hay empleados activos');

    const lines = this.calculator.previewPayroll(
      employees.map(e => ({
        id:       e.id,
        name:     e.name,
        salary:   Number(e.salary),
        position: e.position,
      })),
    );

    const totalGross      = lines.reduce((s, l) => s + l.calc.totalGross,        0);
    const totalNet        = lines.reduce((s, l) => s + l.calc.netSalary,         0);
    const totalPatrono    = lines.reduce((s, l) => s + l.calc.ccssPatrono,       0);
    const totalTrabajador = lines.reduce((s, l) => s + l.calc.ccssWorker,        0);
    const totalAguinaldo  = lines.reduce((s, l) => s + l.calc.aguinaldo,         0);
    const totalRenta      = lines.reduce((s, l) => s + l.calc.rentaDeduccion,    0);
    const totalCost       = lines.reduce((s, l) => s + l.calc.totalEmployerCost, 0);

    return {
      period,
      lines,
      totals: { totalGross, totalNet, totalPatrono, totalTrabajador, totalAguinaldo, totalRenta, totalCost },
      ccssPayableToday: totalPatrono + totalTrabajador,
      minWageWarnings: lines.filter(l => l.calc.belowMinWage).map(l => l.employeeName),
    };
  }

  // ── Process Payroll (persist + journal entry) ─────────────────────────────

  async processPayroll(companyId: string, dto: ProcessPayrollDto, userId?: string) {
    if (userId) await this.verifyOwner(companyId, userId);
    const { period, employeeIds } = dto;

    // Check not already processed
    const existing = await this.prisma.payroll.findUnique({
      where: { companyId_period: { companyId, period } },
    });
    if (existing) throw new ConflictException(`Ya existe una planilla para el período ${period}`);

    const where = {
      companyId,
      isActive: true,
      ...(employeeIds?.length ? { id: { in: employeeIds } } : {}),
    };
    const employees = await this.prisma.employee.findMany({ where });
    if (!employees.length) throw new BadRequestException('No hay empleados activos');

    const lines = this.calculator.previewPayroll(
      employees.map(e => ({
        id:       e.id,
        name:     e.name,
        salary:   Number(e.salary),
        position: e.position,
      })),
    );

    const totalGross      = lines.reduce((s, l) => s + l.calc.totalGross,        0);
    const totalNet        = lines.reduce((s, l) => s + l.calc.netSalary,         0);
    const totalPatrono    = lines.reduce((s, l) => s + l.calc.ccssPatrono,       0);
    const totalTrabajador = lines.reduce((s, l) => s + l.calc.ccssWorker,        0);
    const totalAguinaldo  = lines.reduce((s, l) => s + l.calc.aguinaldo,         0);
    const totalRenta      = lines.reduce((s, l) => s + l.calc.rentaDeduccion,    0);

    // Run everything in a single transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Resolve payroll accounts (they must exist already — seeded in chart)
      const company = await tx.company.findUnique({ where: { id: companyId } });
      if (!company) throw new NotFoundException('Empresa no encontrada');

      // Códigos centralizados en /accounting/constants/account-codes.ts —
      // si cambia el plan contable, se actualiza un solo lugar.
      const accountCodes = [
        ACCOUNT_CODES.WAGES_EXPENSE,
        ACCOUNT_CODES.CCSS_EXPENSE,
        ACCOUNT_CODES.AGUINALDO_EXP,
        ACCOUNT_CODES.WAGES_PAYABLE,
        ACCOUNT_CODES.CCSS_PAYABLE,
        ACCOUNT_CODES.AGUINALDO_PAYABLE,
        ACCOUNT_CODES.RENTA_RETENIDA,
      ];
      const accounts = await tx.account.findMany({
        where: { companyId, code: { in: accountCodes } },
      });
      const byCode = Object.fromEntries(accounts.map(a => [a.code, a]));

      // 2. Get/increment journal sequence
      const seq = await tx.journalSequence.upsert({
        where:  { companyId },
        update: { lastNumber: { increment: 1 } },
        create: { companyId, lastNumber: 1 },
      });

      // 3. Build journal entry lines
      const [periodYear, periodMonth] = period.split('-');
      const entryDate = new Date(`${periodYear}-${periodMonth}-01`);
      // Fase 1: studentId es opcional para companies modo GROUP. Payroll
      // requiere un creador concreto, así que para GROUP companies se exige
      // que el caller especifique uno (futuro: tomarlo de Membership OWNER).
      const createdById = company.studentId;
      if (!createdById) {
        throw new Error(
          'Payroll: la empresa no tiene studentId (modo GROUP). ' +
          'Implementación pendiente para asentar planilla en companies grupales.',
        );
      }

      const journalLines: Array<{
        accountId: string;
        companyId: string;
        debit: Decimal;
        credit: Decimal;
        description: string;
      }> = [];

      const d = (code: string, amount: number, desc: string) => {
        const acc = byCode[code];
        if (acc) journalLines.push({ accountId: acc.id, companyId, debit: new Decimal(amount.toFixed(2)), credit: new Decimal('0'), description: desc });
      };
      const c = (code: string, amount: number, desc: string) => {
        const acc = byCode[code];
        if (acc) journalLines.push({ accountId: acc.id, companyId, debit: new Decimal('0'), credit: new Decimal(amount.toFixed(2)), description: desc });
      };

      // Debits (expenses)
      d(ACCOUNT_CODES.WAGES_EXPENSE,   totalGross,     `Sueldos y Salarios — ${period}`);
      d(ACCOUNT_CODES.CCSS_EXPENSE,    totalPatrono,   `Cargas Sociales Patrono — ${period}`);
      d(ACCOUNT_CODES.AGUINALDO_EXP,   totalAguinaldo, `Provisión Aguinaldo — ${period}`);

      // Credits (liabilities)
      c(ACCOUNT_CODES.WAGES_PAYABLE,     totalNet,                       `Sueldos por Pagar — ${period}`);
      c(ACCOUNT_CODES.CCSS_PAYABLE,      totalTrabajador + totalPatrono, `CCSS por Pagar (trab + patrón) — ${period}`);
      c(ACCOUNT_CODES.AGUINALDO_PAYABLE, totalAguinaldo,                 `Aguinaldo por Pagar — ${period}`);
      if (totalRenta > 0) {
        c(ACCOUNT_CODES.RENTA_RETENIDA, totalRenta, `Retención Imp. Renta — ${period}`);
      }

      // 4. Create journal entry (only if we have payroll accounts)
      let journalEntryId: string | undefined;
      if (journalLines.length >= 2) {
        const entry = await tx.journalEntry.create({
          data: {
            companyId,
            entryNumber:  seq.lastNumber,
            description:  `Planilla de sueldos — ${period}`,
            entryDate,
            reference:    `PLANILLA-${period}`,
            source:       'MANUAL',
            createdById,
            lines:        { create: journalLines },
          },
        });
        journalEntryId = entry.id;
      }

      // 5. Create Payroll record
      const payroll = await tx.payroll.create({
        data: {
          companyId,
          period,
          totalGross:        new Decimal(totalGross.toFixed(2)),
          totalNet:          new Decimal(totalNet.toFixed(2)),
          totalPatrono:      new Decimal(totalPatrono.toFixed(2)),
          totalTrabajador:   new Decimal(totalTrabajador.toFixed(2)),
          totalAguinaldo:    new Decimal(totalAguinaldo.toFixed(2)),
          totalRenta:        new Decimal(totalRenta.toFixed(2)),
          journalEntryId:    journalEntryId ?? null,
        },
      });

      // 6. Create PayrollLine records — Fase 5: createMany en lugar de N creates.
      await tx.payrollLine.createMany({
        data: lines.map(l => ({
          payrollId:        payroll.id,
          employeeId:       l.employeeId,
          salaryGross:      new Decimal(l.calc.salaryGross.toFixed(2)),
          overtime:         new Decimal(l.calc.overtime.toFixed(2)),
          bonus:            new Decimal(l.calc.bonus.toFixed(2)),
          totalGross:       new Decimal(l.calc.totalGross.toFixed(2)),
          ccssWorker:       new Decimal(l.calc.ccssWorker.toFixed(2)),
          rentaDeduccion:   new Decimal(l.calc.rentaDeduccion.toFixed(2)),
          otherDeductions:  new Decimal('0'),
          totalDeductions:  new Decimal(l.calc.totalDeductions.toFixed(2)),
          netSalary:        new Decimal(l.calc.netSalary.toFixed(2)),
          ccssPatrono:      new Decimal(l.calc.ccssPatrono.toFixed(2)),
          aguinaldo:        new Decimal(l.calc.aguinaldo.toFixed(2)),
          totalEmployerCost: new Decimal(l.calc.totalEmployerCost.toFixed(2)),
          breakdown:        l.calc.breakdown as any,
        })),
      });
      const payrollLines = await tx.payrollLine.findMany({
        where: { payrollId: payroll.id },
      });

      return { payroll, lines: payrollLines, journalEntryId };
    });

    // Return full payroll with lines + employee data
    return this.prisma.payroll.findUnique({
      where:   { id: result.payroll.id },
      include: {
        lines: {
          include: { employee: { select: { id: true, name: true, identification: true, position: true } } },
        },
      },
    });
  }

  // ── Payroll history ───────────────────────────────────────────────────────

  async getPayrolls(companyId: string, userId?: string) {
    if (userId) await this.verifyOwner(companyId, userId);
    return this.prisma.payroll.findMany({
      where:   { companyId },
      include: {
        lines: {
          include: { employee: { select: { id: true, name: true, identification: true, position: true } } },
        },
      },
      orderBy: { period: 'desc' },
    });
  }

  async getPayroll(companyId: string, payrollId: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where:   { id: payrollId, companyId },
      include: {
        lines: {
          include: { employee: { select: { id: true, name: true, identification: true, position: true } } },
        },
      },
    });
    if (!payroll) throw new NotFoundException('Planilla no encontrada');
    return payroll;
  }

  // ── Legacy compat: run payroll for single employee ────────────────────────
  // (kept so old frontend calls don't break if still used elsewhere)
  async runPayroll(companyId: string, employeeId: string, period: string) {
    return this.processPayroll(companyId, { period, employeeIds: [employeeId] });
  }
}
