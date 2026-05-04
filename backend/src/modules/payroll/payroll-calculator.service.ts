import { Injectable } from '@nestjs/common';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PatronoBreakdown {
  sem: number;
  ivm: number;
  bancoPop: number;
  asfa: number;
  fodesaf: number;
  ina: number;
  fcl: number;
  ins: number;
  total: number;
}

export interface TrabajadorBreakdown {
  sem: number;
  ivm: number;
  bancoPop: number;
  total: number;
}

export interface PayrollLineCalculation {
  salaryGross: number;
  overtime: number;
  bonus: number;
  totalGross: number;

  // Deducciones trabajador
  ccssWorker: number;       // 10.34%
  rentaDeduccion: number;   // Impuesto sobre la renta (progressive)
  totalDeductions: number;
  netSalary: number;

  // Cargas patronales
  ccssPatrono: number;      // 22.17%
  aguinaldo: number;        // 8.333%
  totalEmployerCost: number;

  // Detailed breakdown for UI
  breakdown: {
    patrono: PatronoBreakdown;
    trabajador: TrabajadorBreakdown;
    taxBrackets: Array<{ from: number; to: number | null; rate: number; amount: number }>;
  };

  // Flags
  belowMinWage: boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Pure calculation service — no Prisma dependency.
 * All rates are Costa Rica CCSS 2026 official rates.
 */
@Injectable()
export class PayrollCalculatorService {

  // ── Costa Rica CCSS 2026 rates ────────────────────────────────────────────

  private readonly PATRONO = {
    sem:      0.0925,   // Enfermedad y Maternidad
    ivm:      0.0542,   // Invalidez, Vejez y Muerte
    bancoPop: 0.0025,   // Banco Popular (patrono)
    asfa:     0.0050,   // ASFA
    fodesaf:  0.0050,   // FODESAF
    ina:      0.0150,   // INA
    fcl:      0.0300,   // Fondo Capitalización Laboral
    ins:      0.0175,   // INS Riesgos del Trabajo (approx)
    get total() {
      return (
        this.sem + this.ivm + this.bancoPop +
        this.asfa + this.fodesaf + this.ina +
        this.fcl + this.ins
      ); // = 0.2217
    },
  };

  private readonly TRABAJADOR = {
    sem:      0.0550,   // Enfermedad y Maternidad
    ivm:      0.0384,   // Invalidez, Vejez y Muerte
    bancoPop: 0.0100,   // Banco Popular (trabajador)
    get total() { return this.sem + this.ivm + this.bancoPop; }, // = 0.1034
  };

  private readonly AGUINALDO_RATE = 1 / 12; // 8.333...%

  // Salario mínimo 2026 — trabajador no calificado
  readonly SALARIO_MINIMO = 381_000;

  // ── Salary income tax brackets (monthly, 2026) ────────────────────────────
  // Applied on: totalGross - ccssWorker (CCSS is deductible)
  private readonly SALARY_TAX_BRACKETS = [
    { upTo: 941_000,    rate: 0.00 },  // Exento
    { upTo: 1_381_000,  rate: 0.10 },  // 10% sobre exceso de ₡941,000
    { upTo: 2_423_000,  rate: 0.15 },  // 15%
    { upTo: Infinity,   rate: 0.20 },  // 20%
  ];

  // ── Main calculation ──────────────────────────────────────────────────────

  calculatePayrollLine(
    grossSalary: number,
    overtime = 0,
    bonus = 0,
  ): PayrollLineCalculation {
    const totalGross = grossSalary + overtime + bonus;

    // --- Deducciones trabajador ---
    const ccssWorkerRaw = totalGross * this.TRABAJADOR.total;
    const ccssWorker = this.round2(ccssWorkerRaw);

    // CCSS is deductible before renta
    const taxableIncome = totalGross - ccssWorker;
    const { tax: rentaDeduccionRaw, bracketDetail } = this.calcSalaryTax(taxableIncome);
    const rentaDeduccion = this.round2(rentaDeduccionRaw);

    const totalDeductions = ccssWorker + rentaDeduccion;
    const netSalary = this.round2(totalGross - totalDeductions);

    // --- Cargas patronales ---
    const ccssPatronoRaw = totalGross * this.PATRONO.total;
    const ccssPatrono = this.round2(ccssPatronoRaw);
    const aguinaldo = this.round2(totalGross * this.AGUINALDO_RATE);
    const totalEmployerCost = this.round2(totalGross + ccssPatrono + aguinaldo);

    // --- Breakdown by fund ---
    const patronoBreakdown: PatronoBreakdown = {
      sem:      this.round2(totalGross * this.PATRONO.sem),
      ivm:      this.round2(totalGross * this.PATRONO.ivm),
      bancoPop: this.round2(totalGross * this.PATRONO.bancoPop),
      asfa:     this.round2(totalGross * this.PATRONO.asfa),
      fodesaf:  this.round2(totalGross * this.PATRONO.fodesaf),
      ina:      this.round2(totalGross * this.PATRONO.ina),
      fcl:      this.round2(totalGross * this.PATRONO.fcl),
      ins:      this.round2(totalGross * this.PATRONO.ins),
      total:    ccssPatrono,
    };

    const trabajadorBreakdown: TrabajadorBreakdown = {
      sem:      this.round2(totalGross * this.TRABAJADOR.sem),
      ivm:      this.round2(totalGross * this.TRABAJADOR.ivm),
      bancoPop: this.round2(totalGross * this.TRABAJADOR.bancoPop),
      total:    ccssWorker,
    };

    return {
      salaryGross: grossSalary,
      overtime,
      bonus,
      totalGross,
      ccssWorker,
      rentaDeduccion,
      totalDeductions,
      netSalary,
      ccssPatrono,
      aguinaldo,
      totalEmployerCost,
      breakdown: {
        patrono: patronoBreakdown,
        trabajador: trabajadorBreakdown,
        taxBrackets: bracketDetail,
      },
      belowMinWage: grossSalary < this.SALARIO_MINIMO,
    };
  }

  // ── Preview: calculate without persisting ─────────────────────────────────
  previewPayroll(
    employees: Array<{ id: string; name: string; salary: number; position?: string | null }>,
  ): Array<{ employeeId: string; employeeName: string; position: string | null; calc: PayrollLineCalculation }> {
    return employees.map(emp => ({
      employeeId:   emp.id,
      employeeName: emp.name,
      position:     emp.position ?? null,
      calc:         this.calculatePayrollLine(Number(emp.salary)),
    }));
  }

  // ── Progressive salary income tax ────────────────────────────────────────

  private calcSalaryTax(taxableMonthly: number): {
    tax: number;
    bracketDetail: Array<{ from: number; to: number | null; rate: number; amount: number }>;
  } {
    let tax = 0;
    let prev = 0;
    const bracketDetail: Array<{ from: number; to: number | null; rate: number; amount: number }> = [];

    for (const bracket of this.SALARY_TAX_BRACKETS) {
      if (taxableMonthly <= prev) break;
      const ceil = bracket.upTo === Infinity ? taxableMonthly : Math.min(taxableMonthly, bracket.upTo);
      const taxableInBracket = ceil - prev;
      const bracketTax = taxableInBracket * bracket.rate;
      tax += bracketTax;
      bracketDetail.push({
        from:   prev,
        to:     bracket.upTo === Infinity ? null : bracket.upTo,
        rate:   bracket.rate,
        amount: this.round2(bracketTax),
      });
      prev = bracket.upTo;
      if (bracket.upTo === Infinity) break;
    }

    return { tax, bracketDetail };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
