import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/activity/activity-log.service';
import { CreateEmployeeDto, ProcessPayrollDto, UpdateEmployeeDto } from './dto/payroll.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { PayrollCalculatorService } from './payroll-calculator.service';
import { assertCompanyAccess } from '../../common/auth/company-access.helper';
import { ACCOUNT_CODES } from '../accounting/constants/account-codes';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { JournalService } from '../journal/journal.service';
import { JournalSource } from '@prisma/client';

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: PayrollCalculatorService,
    @Inject(REDIS_CLIENT) private readonly redis: any,
    private readonly journal: JournalService,
    private readonly activityLog: ActivityLogService,
  ) {}

  // ── Ownership guard (Fase 1: soporta INDIVIDUAL + GROUP) ────────────────
  // Pasamos `redis` para reusar el core cacheado por el guard (fail-open a DB).
  private async verifyOwner(companyId: string, userId: string) {
    await assertCompanyAccess(this.prisma, companyId, userId, { redis: this.redis });
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


  /**
   * Arma la entrada del calculador para cada persona.
   *
   * Lo permanente (salario, hijos, cónyuge, pensión alimenticia, asociación)
   * vive en el empleado; lo del mes (comisiones, horas extra, viáticos) llega
   * en `movimientos`. Separarlo evita que el estudiante tenga que reescribir
   * la ficha completa cada quincena.
   */
  private armarEntradas(
    empleados: Array<any>,
    movimientos?: Array<{
      employeeId: string; comisiones?: number; horasExtra?: number; bonoFijo?: number;
      viaticos?: number; regalos?: number; otrasDeducciones?: number;
    }>,
  ) {
    const porEmpleado = new Map((movimientos ?? []).map((m) => [m.employeeId, m]));
    return empleados.map((e) => {
      const mov = porEmpleado.get(e.id);
      return {
        empleado: e,
        entrada: {
          salarioBase:          Number(e.salary),
          comisiones:           Number(mov?.comisiones ?? 0),
          horasExtra:           Number(mov?.horasExtra ?? 0),
          bonoFijo:             Number(mov?.bonoFijo ?? 0),
          tieneConyuge:         !!e.tieneConyuge,
          cantidadHijos:        Number(e.cantidadHijos ?? 0),
          pensionAlimenticia:   Number(e.pensionAlimenticia ?? 0),
          tasaAhorroAsociacion: Number(e.tasaAhorroAsociacion ?? 0),
          prestamoAsociacion:   Number(e.prestamoAsociacion ?? 0),
          otrasDeducciones:     Number(mov?.otrasDeducciones ?? 0),
          viaticos:             Number(mov?.viaticos ?? 0),
          regalos:              Number(mov?.regalos ?? 0),
        },
      };
    });
  }

  // ── Preview (no persistence) ──────────────────────────────────────────────

  async previewPayroll(
    companyId: string,
    period: string,
    employeeIds?: string[],
    userId?: string,
    movimientos?: any[],
  ) {
    if (userId) await this.verifyOwner(companyId, userId);
    const where = {
      companyId,
      isActive: true,
      ...(employeeIds?.length ? { id: { in: employeeIds } } : {}),
    };
    const employees = await this.prisma.employee.findMany({ where });
    if (!employees.length) throw new BadRequestException('No hay empleados activos');

    const armadas = this.armarEntradas(employees, movimientos);
    const calculadas = armadas.map((a) => ({
      employeeId:   a.empleado.id,
      employeeName: a.empleado.name,
      position:     a.empleado.position ?? null,
      calc:         this.calculator.calcularLinea(a.entrada),
    }));

    const totales = this.calculator.totalizar(calculadas.map((c) => c.calc));

    return {
      period,
      lines: calculadas,
      totales,
      /** El asiento tal como quedará, para que se pueda revisar antes. */
      asiento: this.armarAsiento(totales, period),
      avisosSalarioMinimo: calculadas
        .filter((l) => l.calc.bajoSalarioMinimo)
        .map((l) => l.employeeName),
    };
  }


  /**
   * Asiento contable de la planilla.
   *
   * Reproduce el asiento que se enseña en Costa Rica, con las obligaciones
   * separadas —cuota patronal y cuota obrera son dos deudas distintas ante la
   * CCSS— y con las provisiones de aguinaldo y vacaciones reconocidas en el
   * mes que se devengan, no cuando se pagan.
   *
   *   DEBE                                      HABER
   *   Gasto por salarios                        CCSS patronal por pagar
   *   Cargas sociales patronales                CCSS cuotas obreras por pagar
   *   Provisión de aguinaldo                    Impuesto de renta por pagar
   *   Provisión de vacaciones                   Pensión alimenticia por pagar
   *   Póliza de riesgos del trabajo             Ahorro/préstamo asociación
   *   Viáticos (no salarial)                    Aguinaldo y vacaciones por pagar
   *   Regalos (no salarial)                     INS por pagar
   *                                             Sueldos por pagar (el efectivo)
   *
   * Se omiten las líneas en cero: un asiento con diez renglones vacíos no le
   * enseña nada a nadie.
   */
  private armarAsiento(t: any, period: string) {
    const lineas: Array<{ accountCode: string; debit: number; credit: number; description: string }> = [];
    const debe  = (accountCode: string, monto: number, description: string) => {
      if (monto > 0) lineas.push({ accountCode, debit: monto, credit: 0, description });
    };
    const haber = (accountCode: string, monto: number, description: string) => {
      if (monto > 0) lineas.push({ accountCode, debit: 0, credit: monto, description });
    };

    // ── DEBE: lo que le cuesta a la empresa ──
    debe(ACCOUNT_CODES.WAGES_EXPENSE,    t.salarioBruto,        `Sueldos y salarios — ${period}`);
    debe(ACCOUNT_CODES.CCSS_EXPENSE,     t.cargasPatronales,    `Cargas sociales patronales 26,83% — ${period}`);
    debe(ACCOUNT_CODES.AGUINALDO_EXP,    t.provisionAguinaldo,  `Provisión de aguinaldo 8,33% — ${period}`);
    debe(ACCOUNT_CODES.VACACIONES_EXP,   t.provisionVacaciones, `Provisión de vacaciones 4,16% — ${period}`);
    debe(ACCOUNT_CODES.INS_EXPENSE,      t.polizaINS,           `Póliza de riesgos del trabajo 1,50% — ${period}`);
    debe(ACCOUNT_CODES.VIATICOS_EXPENSE, t.viaticos,            `Viáticos (no salarial) — ${period}`);
    debe(ACCOUNT_CODES.REGALOS_EXPENSE,  t.regalos,             `Regalos y atenciones (no salarial) — ${period}`);

    // ── HABER: a quién se le debe ──
    haber(ACCOUNT_CODES.CCSS_PAYABLE,          t.cargasPatronales,    `CCSS patronal por pagar 26,83% — ${period}`);
    haber(ACCOUNT_CODES.CCSS_OBRERA_PAYABLE,   t.cuotasObreras,       `CCSS cuotas obreras por pagar 10,83% — ${period}`);
    haber(ACCOUNT_CODES.RENTA_RETENIDA,        t.impuestoRenta,       `Impuesto de renta retenido — ${period}`);
    haber(ACCOUNT_CODES.PENSION_ALIM_PAYABLE,  t.pensionAlimenticia,  `Pensión alimenticia por pagar — ${period}`);
    haber(ACCOUNT_CODES.AHORRO_ASOC_PAYABLE,   t.ahorroAsociacion,    `Ahorro de asociación por pagar — ${period}`);
    haber(ACCOUNT_CODES.PRESTAMO_ASOC_PAYABLE, t.prestamoAsociacion,  `Préstamos de asociación por pagar — ${period}`);
    haber(ACCOUNT_CODES.AGUINALDO_PAYABLE,     t.provisionAguinaldo,  `Aguinaldo por pagar — ${period}`);
    haber(ACCOUNT_CODES.VACACIONES_PAYABLE,    t.provisionVacaciones, `Vacaciones por pagar — ${period}`);
    haber(ACCOUNT_CODES.INS_PAYABLE,           t.polizaINS,           `Póliza INS por pagar — ${period}`);
    // Lo que efectivamente sale: neto + viáticos + regalos.
    haber(ACCOUNT_CODES.WAGES_PAYABLE,         t.totalEfectivoAPagar, `Sueldos por pagar (efectivo) — ${period}`);

    return lineas;
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

    const armadas = this.armarEntradas(employees, dto.movimientos);
    const lines = armadas.map((a) => ({
      employeeId: a.empleado.id,
      calc:       this.calculator.calcularLinea(a.entrada),
    }));
    const t = this.calculator.totalizar(lines.map((l) => l.calc));

    // Run everything in a single transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Empresa + creador del asiento.
      //
      // Antes esto salía SOLO de company.studentId, que es null en las
      // empresas de modo GROUP — y GROUP es como trabaja una clase entera.
      // Resultado: la planilla no se podía procesar en el modo normal del
      // producto, y el error ni siquiera decía eso ("implementación
      // pendiente"), así que parecía una función a medio hacer en vez de un
      // caso no contemplado.
      //
      // El autor del asiento es quien lo procesa. En una empresa individual
      // sigue siendo el estudiante dueño, así que el orden cubre los dos.
      const company = await tx.company.findUnique({ where: { id: companyId } });
      if (!company) throw new NotFoundException('Empresa no encontrada');
      const createdById = userId ?? company.studentId;
      if (!createdById) {
        throw new BadRequestException(
          'No se puede determinar quién procesa la planilla. Iniciá sesión y volvé a intentar.',
        );
      }

      const [periodYear, periodMonth] = period.split('-');
      const entryDate = new Date(`${periodYear}-${periodMonth}-01`);

      // 2. Asiento de planilla por el ESCRITOR ÚNICO (I-AT-2). createAutoEntry
      //    resuelve las cuentas por código y enfuerza los invariantes: partida
      //    doble (V-1), período abierto (I-PE-1), trazabilidad (V-5) e
      //    idempotencia por (sourceType, sourceId). Códigos centralizados en
      //    /accounting/constants/account-codes.ts.
      //      D Sueldos/CCSS Patrono/Aguinaldo · C Sueldos/CCSS/Aguinaldo por pagar
      //      (+ Renta retenida si aplica).
      const journalLines = this.armarAsiento(t, period);

      const entry = await this.journal.createAutoEntry(
        companyId,
        `Planilla de sueldos — ${period}`,
        entryDate,
        journalLines,
        createdById,
        JournalSource.MANUAL,
        tx,
        undefined,
        undefined,
        'payroll',
        `${companyId}:${period}`,
        false,
      );
      const journalEntryId = entry.id;

      // 5. Create Payroll record
      const payroll = await tx.payroll.create({
        data: {
          companyId,
          period,
          totalGross:        new Decimal(t.salarioBruto.toFixed(2)),
          totalNet:          new Decimal(t.salarioNeto.toFixed(2)),
          totalPatrono:      new Decimal(t.cargasPatronales.toFixed(2)),
          totalTrabajador:   new Decimal(t.cuotasObreras.toFixed(2)),
          totalAguinaldo:    new Decimal(t.provisionAguinaldo.toFixed(2)),
          totalRenta:        new Decimal(t.impuestoRenta.toFixed(2)),
          totalVacaciones:   new Decimal(t.provisionVacaciones.toFixed(2)),
          totalINS:          new Decimal(t.polizaINS.toFixed(2)),
          totalNoSalarial:   new Decimal((t.viaticos + t.regalos).toFixed(2)),
          totalEfectivo:     new Decimal(t.totalEfectivoAPagar.toFixed(2)),
          totalCostoPatrono: new Decimal(t.costoTotalPatrono.toFixed(2)),
          journalEntryId:    journalEntryId ?? null,
        },
      });

      // 6. Create PayrollLine records — Fase 5: createMany en lugar de N creates.
      await tx.payrollLine.createMany({
        data: lines.map(l => ({
          payrollId:          payroll.id,
          employeeId:         l.employeeId,
          salaryGross:        new Decimal(l.calc.salarioBase.toFixed(2)),
          comisiones:         new Decimal(l.calc.comisiones.toFixed(2)),
          overtime:           new Decimal(l.calc.horasExtra.toFixed(2)),
          bonus:              new Decimal(l.calc.bonoFijo.toFixed(2)),
          totalGross:         new Decimal(l.calc.salarioBruto.toFixed(2)),
          ccssWorker:         new Decimal(l.calc.cuotasObreras.total.toFixed(2)),
          rentaDeduccion:     new Decimal(l.calc.impuestoRenta.toFixed(2)),
          pensionAlimenticia: new Decimal(l.calc.pensionAlimenticia.toFixed(2)),
          ahorroAsociacion:   new Decimal(l.calc.ahorroAsociacion.toFixed(2)),
          prestamoAsociacion: new Decimal(l.calc.prestamoAsociacion.toFixed(2)),
          otherDeductions:    new Decimal(l.calc.otrasDeducciones.toFixed(2)),
          totalDeductions:    new Decimal(l.calc.totalDeducciones.toFixed(2)),
          netSalary:          new Decimal(l.calc.salarioNeto.toFixed(2)),
          viaticos:           new Decimal(l.calc.viaticos.toFixed(2)),
          regalos:            new Decimal(l.calc.regalos.toFixed(2)),
          totalEfectivoAPagar: new Decimal(l.calc.totalEfectivoAPagar.toFixed(2)),
          ccssPatrono:        new Decimal(l.calc.cargasPatronales.total.toFixed(2)),
          aguinaldo:          new Decimal(l.calc.provisionAguinaldo.toFixed(2)),
          provisionVacaciones: new Decimal(l.calc.provisionVacaciones.toFixed(2)),
          polizaINS:          new Decimal(l.calc.polizaINS.toFixed(2)),
          totalEmployerCost:  new Decimal(l.calc.costoTotalPatrono.toFixed(2)),
          // El desglose completo queda guardado: es lo que el estudiante abre
          // para ver POR QUE paga lo que paga, fondo por fondo y tramo por tramo.
          breakdown: {
            cuotasObreras:    l.calc.cuotasObreras,
            cargasPatronales: l.calc.cargasPatronales,
            detalleRenta:     l.calc.detalleRenta,
            bajoSalarioMinimo: l.calc.bajoSalarioMinimo,
          } as any,
        })),
      });
      const payrollLines = await tx.payrollLine.findMany({
        where: { payrollId: payroll.id },
      });

      return { payroll, lines: payrollLines, journalEntryId };
    });

    // Bitácora (best-effort)
    if (userId) {
      void this.activityLog.log({
        userId, companyId,
        action:   'PAYROLL_PROCESSED',
        entity:   'Payroll',
        entityId: result.payroll.id,
        details:  {
          periodo:   dto.period,
          empleados: result.lines?.length ?? 0,
          neto:      result.payroll.totalNet?.toString(),
        },
      });
    }

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

  async getPayroll(companyId: string, payrollId: string, userId?: string) {
    // Defensa en profundidad: además del CompanyOwnerGuard del controller,
    // validamos la pertenencia acá (esta ruta devuelve datos personales de
    // empleados: nombre, cédula y salario).
    if (userId) await this.verifyOwner(companyId, userId);
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
