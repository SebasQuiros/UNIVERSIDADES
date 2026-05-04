/**
 * renta.service.spec.ts
 * Pruebas unitarias para la lógica D-101 Impuesto sobre la Renta
 *
 * La lógica de cálculo se replica aquí como funciones puras,
 * ya que los servicios fuente requieren Prisma (no disponible en tests unitarios).
 *
 * Fuentes de referencia:
 *   - src/modules/tax-declarations/renta.service.ts (TAX_BRACKETS_2026)
 *   - src/modules/tax-declarations/tax-declarations.service.ts (RENTA_BRACKETS_2026, calcD101)
 */

// ─── Tramos PYME 2026 — renta.service.ts ─────────────────────────────────────
const TAX_BRACKETS_2026 = [
  { upTo: 5_665_000,  rate: 0.05 },
  { upTo: 8_485_000,  rate: 0.10 },
  { upTo: 11_313_000, rate: 0.15 },
  { upTo: 22_627_000, rate: 0.20 },
  { upTo: Infinity,   rate: 0.25 },
] as const;

const PYME_THRESHOLD     = 119_024_000;
const LARGE_COMPANY_RATE = 0.30;

const RETENTION_RATES: Record<string, number> = {
  SERVICIOS_PROFESIONALES: 0.02,
  ALQUILER:                0.15,
  DIVIDENDOS:              0.15,
  TRANSPORTE:              0.01,
};

const QUARTER_DATES = [
  { quarter: 1, month: 2,  day: 31 },  // Marzo 31
  { quarter: 2, month: 5,  day: 30 },  // Junio 30
  { quarter: 3, month: 8,  day: 30 },  // Setiembre 30
  { quarter: 4, month: 11, day: 15 },  // Diciembre 15
] as const;

// ─── Tramos PYME — tax-declarations.service.ts (calcD101) ────────────────────
const RENTA_BRACKETS_2026_DECL = [
  { hasta: 5_610_000,  rate: 0.05 },
  { hasta: 8_415_000,  rate: 0.10 },
  { hasta: 11_220_000, rate: 0.15 },
  { hasta: 14_875_000, rate: 0.20 },
  { hasta: 17_670_000, rate: 0.25 },
  { hasta: Infinity,   rate: 0.30 },
];
const RENTA_PYME_THRESHOLD_DECL = 122_145_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Calcula impuesto progresivo PYME usando los tramos de renta.service.ts */
function calcTaxPymeRentaService(netIncome: number): number {
  if (netIncome <= 0) return 0;
  let remaining = netIncome;
  let previous  = 0;
  let total     = 0;
  for (const bracket of TAX_BRACKETS_2026) {
    if (remaining <= 0) break;
    const bracketSize   = bracket.upTo === Infinity ? remaining : bracket.upTo - previous;
    const taxableAmount = Math.min(remaining, bracketSize);
    total    += round(taxableAmount * bracket.rate);
    remaining -= taxableAmount;
    previous  = bracket.upTo === Infinity ? previous + taxableAmount : bracket.upTo;
  }
  return round(total);
}

/** Calcula impuesto progresivo PYME usando los tramos de tax-declarations.service.ts */
function calcTaxPymeDeclService(rentaNeta: number): number {
  if (rentaNeta <= 0) return 0;
  let base      = rentaNeta;
  let anterior  = 0;
  let total     = 0;
  for (const tramo of RENTA_BRACKETS_2026_DECL) {
    if (base <= 0) break;
    const limiteTramo = tramo.hasta === Infinity ? rentaNeta : tramo.hasta;
    const baseTramo   = Math.min(base, limiteTramo - anterior);
    const impTramo    = round(baseTramo * tramo.rate);
    if (baseTramo > 0) total += impTramo;
    base     -= baseTramo;
    anterior  = tramo.hasta === Infinity ? rentaNeta : tramo.hasta;
  }
  return round(total);
}

/** Determina si la empresa es PYME según renta.service.ts */
function isSmallCompany(grossIncome: number): boolean {
  return grossIncome <= PYME_THRESHOLD;
}

/**
 * Replica la lógica de calcD101 de tax-declarations.service.ts
 */
function calcD101(d: Record<string, number>) {
  const ingresosBrutos    = d.ingresosBrutos    ?? 0;
  const ingresosExentos   = d.ingresosExentos   ?? 0;
  const ingresosGravables = Math.max(0, round(ingresosBrutos - ingresosExentos));

  const gSueldos       = d.gastosSueldos       ?? 0;
  const gCargas        = d.gastosCargas         ?? 0;
  const gAlquileres    = d.gastosAlquileres     ?? 0;
  const gServicios     = d.gastosServicios      ?? 0;
  const gDepreciacion  = d.gastosDepreciacion   ?? 0;
  const gPublicidad    = d.gastosPublicidad     ?? 0;
  const gSerPublicos   = d.gastosSerPublicos    ?? 0;
  const gRepMaximo     = round(ingresosBrutos * 0.01);
  const gRepresentacion = Math.min(d.gastosRepresentacion ?? 0, gRepMaximo);
  const gOtros         = d.gastosOtros          ?? 0;

  const totalGastos = round(
    gSueldos + gCargas + gAlquileres + gServicios + gDepreciacion +
    gPublicidad + gSerPublicos + gRepresentacion + gOtros,
  );

  const rentaNeta = Math.max(0, round(ingresosGravables - totalGastos));
  const esPyme    = ingresosBrutos <= RENTA_PYME_THRESHOLD_DECL;

  let impuestoCalculado = 0;
  if (rentaNeta > 0) {
    impuestoCalculado = esPyme
      ? calcTaxPymeDeclService(rentaNeta)
      : round(rentaNeta * 0.30);
  }

  const retencionesSource = d.retencionesSource ?? 0;
  const pagosParciales    = d.pagosParciales    ?? 0;
  const totalCreditos     = round(retencionesSource + pagosParciales);
  const impuestoNeto      = round(impuestoCalculado - totalCreditos);

  return {
    cas103_ingresosGravables:  ingresosGravables,
    gastoRepresentacionMaximo: gRepMaximo,
    cas210_totalGastos:        totalGastos,
    cas301_rentaNeta:          rentaNeta,
    tipoEmpresa:               esPyme ? 'PYME' : 'GRANDE',
    cas402_impuestoCalculado:  impuestoCalculado,
    cas503_totalCreditos:      totalCreditos,
    cas601_impuestoNeto:       impuestoNeto,
    cas602_impuestoPagar:      impuestoNeto > 0 ? impuestoNeto : 0,
    cas603_saldoFavor:         impuestoNeto < 0 ? Math.abs(impuestoNeto) : 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBAS — Tramos renta.service.ts (TAX_BRACKETS_2026)
// ─────────────────────────────────────────────────────────────────────────────

describe('RentaService — Lógica de tramos PYME 2026', () => {

  describe('Tramos progresivos Costa Rica 2026', () => {
    it('debe aplicar 5% para renta neta hasta ₡5.665.000', () => {
      const netIncome = 3_000_000;
      const tax = calcTaxPymeRentaService(netIncome);
      // 3.000.000 × 5% = 150.000
      expect(tax).toBe(150_000);
    });

    it('debe aplicar tasas progresivas para renta neta de ₡10.000.000', () => {
      const netIncome = 10_000_000;
      const tax = calcTaxPymeRentaService(netIncome);
      // Tramo 1: 5.665.000 × 5%                              = 283.250
      // Tramo 2: (8.485.000 - 5.665.000) × 10% = 2.820.000  = 282.000
      // Tramo 3: (10.000.000 - 8.485.000) × 15% = 1.515.000 = 227.250
      // Total = 792.500
      expect(tax).toBe(792_500);
    });

    it('debe aplicar tramo 4 del 20% para rentas mayores a ₡11.313.000', () => {
      const netIncome = 15_000_000;
      const tax = calcTaxPymeRentaService(netIncome);
      // Tramo 1: 5.665.000 × 5%                              = 283.250
      // Tramo 2: (8.485.000 - 5.665.000) × 10%              = 282.000
      // Tramo 3: (11.313.000 - 8.485.000) × 15% = 2.828.000 = 424.200
      // Tramo 4: (15.000.000 - 11.313.000) × 20% = 3.687.000 = 737.400
      // Total = 1.726.850
      expect(tax).toBe(1_726_850);
    });

    it('debe devolver 0 de impuesto para renta neta negativa o cero', () => {
      expect(calcTaxPymeRentaService(0)).toBe(0);
      expect(calcTaxPymeRentaService(-500_000)).toBe(0);
    });
  });

  describe('Clasificación PYME vs empresa grande', () => {
    it('debe identificar empresa como PYME si ingresos brutos ≤ ₡119.024.000', () => {
      expect(isSmallCompany(100_000_000)).toBe(true);
      expect(isSmallCompany(119_024_000)).toBe(true);
    });

    it('debe identificar empresa como GRANDE si ingresos brutos > ₡119.024.000', () => {
      expect(isSmallCompany(119_024_001)).toBe(false);
      expect(isSmallCompany(200_000_000)).toBe(false);
    });
  });

  describe('Empresas grandes — tarifa plana 30%', () => {
    it('debe calcular 30% plano para empresa grande con renta neta de ₡50.000.000', () => {
      const netIncome = 50_000_000;
      const tax = round(netIncome * LARGE_COMPANY_RATE);
      expect(tax).toBe(15_000_000);
    });

    it('debe calcular 30% plano para cualquier monto de renta neta', () => {
      const netIncome = 1_000_000;
      const tax = round(netIncome * LARGE_COMPANY_RATE);
      expect(tax).toBe(300_000);
    });
  });

  describe('Tasas de retención en la fuente', () => {
    it('debe calcular retención del 2% para servicios profesionales', () => {
      const gross         = 500_000;
      const rate          = RETENTION_RATES['SERVICIOS_PROFESIONALES'];
      const retention     = round(gross * rate);
      const netPaid       = gross - retention;
      expect(rate).toBe(0.02);
      expect(retention).toBe(10_000);
      expect(netPaid).toBe(490_000);
    });

    it('debe calcular retención del 15% para pagos de alquiler', () => {
      const gross     = 200_000;
      const rate      = RETENTION_RATES['ALQUILER'];
      const retention = round(gross * rate);
      expect(rate).toBe(0.15);
      expect(retention).toBe(30_000);
    });

    it('debe calcular retención del 15% para dividendos', () => {
      const gross     = 1_000_000;
      const rate      = RETENTION_RATES['DIVIDENDOS'];
      const retention = round(gross * rate);
      expect(rate).toBe(0.15);
      expect(retention).toBe(150_000);
    });

    it('debe calcular retención del 1% para transporte', () => {
      const gross     = 300_000;
      const rate      = RETENTION_RATES['TRANSPORTE'];
      const retention = round(gross * rate);
      expect(rate).toBe(0.01);
      expect(retention).toBe(3_000);
    });
  });

  describe('Pagos parciales y créditos', () => {
    it('debe restar pagos parciales del impuesto determinado', () => {
      const tax         = 500_000;
      const partialPaid = 200_000;
      const taxDue      = Math.max(0, tax - partialPaid);
      expect(taxDue).toBe(300_000);
    });

    it('debe mostrar saldo a favor cuando los pagos parciales superan el impuesto', () => {
      const tax          = 100_000;
      const partialPaid  = 150_000;
      const impuestoNeto = tax - partialPaid;
      const saldoAFavor  = impuestoNeto < 0 ? Math.abs(impuestoNeto) : 0;
      expect(saldoAFavor).toBe(50_000);
    });

    it('debe programar exactamente 4 pagos parciales trimestrales', () => {
      expect(QUARTER_DATES).toHaveLength(4);
    });

    it('debe establecer fechas de vencimiento correctas (mar31, jun30, set30, dic15)', () => {
      const fiscalYear = 2026;
      const dates = QUARTER_DATES.map(q => new Date(fiscalYear, q.month, q.day));
      expect(dates[0].getMonth()).toBe(2);   // Marzo (0-indexed)
      expect(dates[0].getDate()).toBe(31);
      expect(dates[1].getMonth()).toBe(5);   // Junio
      expect(dates[1].getDate()).toBe(30);
      expect(dates[2].getMonth()).toBe(8);   // Setiembre
      expect(dates[2].getDate()).toBe(30);
      expect(dates[3].getMonth()).toBe(11);  // Diciembre
      expect(dates[3].getDate()).toBe(15);
    });

    it('debe dividir el impuesto estimado en 4 cuotas iguales del 25%', () => {
      const estimatedTax  = 1_000_000;
      const quarterAmount = round(estimatedTax / 4);
      expect(quarterAmount).toBe(250_000);
      expect(quarterAmount * 4).toBe(estimatedTax);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBAS — calcD101 (réplica de tax-declarations.service.ts)
// ─────────────────────────────────────────────────────────────────────────────

describe('D-101 Renta — Cálculo completo', () => {

  it('debe calcular 5% para renta gravable de ₡3.000.000 (solo tramo 1)', () => {
    const result = calcD101({ ingresosBrutos: 3_000_000 });
    expect(result.cas301_rentaNeta).toBe(3_000_000);
    expect(result.cas402_impuestoCalculado).toBe(150_000); // 3.000.000 × 5%
    expect(result.tipoEmpresa).toBe('PYME');
  });

  it('debe aplicar tramos progresivos para renta neta de ₡8.000.000', () => {
    const result = calcD101({ ingresosBrutos: 8_000_000 });
    expect(result.cas301_rentaNeta).toBe(8_000_000);
    expect(result.tipoEmpresa).toBe('PYME');
    expect(result.cas402_impuestoCalculado).toBeGreaterThan(150_000); // más que solo tramo 1
  });

  it('debe aplicar tarifa plana 30% para empresa grande (ingresos > ₡122.145.000)', () => {
    const netIncome = 50_000_000;
    const result    = calcD101({ ingresosBrutos: 200_000_000 }); // grande, sin gastos
    expect(result.tipoEmpresa).toBe('GRANDE');
    expect(result.cas402_impuestoCalculado).toBe(round(200_000_000 * 0.30));
  });

  it('debe devolver 0 de impuesto cuando la renta neta es cero', () => {
    const result = calcD101({ ingresosBrutos: 1_000_000, gastosSueldos: 1_000_000 });
    expect(result.cas301_rentaNeta).toBe(0);
    expect(result.cas402_impuestoCalculado).toBe(0);
  });

  it('debe calcular correctamente los gastos deducibles totales', () => {
    const result = calcD101({
      ingresosBrutos:   5_000_000,
      gastosSueldos:    1_000_000,
      gastosAlquileres: 500_000,
      gastosServicios:  200_000,
    });
    expect(result.cas210_totalGastos).toBe(1_700_000);
    expect(result.cas301_rentaNeta).toBe(3_300_000);
  });

  it('debe limitar gastos de representación al 1% de los ingresos brutos', () => {
    const result = calcD101({
      ingresosBrutos:        10_000_000,
      gastosRepresentacion:  500_000,  // supera el límite de 100.000
    });
    expect(result.gastoRepresentacionMaximo).toBe(100_000); // 10.000.000 × 1%
    expect(result.cas210_totalGastos).toBe(100_000);        // solo se deduce el máximo
  });

  it('debe restar créditos del impuesto calculado y mostrar impuesto a pagar', () => {
    const result = calcD101({
      ingresosBrutos:     5_000_000,
      retencionesSource:  50_000,
      pagosParciales:     100_000,
    });
    expect(result.cas503_totalCreditos).toBe(150_000);
    const expectedNeto = round(result.cas402_impuestoCalculado - 150_000);
    expect(result.cas601_impuestoNeto).toBe(expectedNeto);
  });

  it('debe mostrar saldo a favor cuando los créditos superan el impuesto', () => {
    // impuesto ≈ 150.000 (tramo 1 de 3.000.000 × 5%), créditos = 200.000
    const result = calcD101({
      ingresosBrutos:     3_000_000,
      retencionesSource:  200_000,
    });
    expect(result.cas602_impuestoPagar).toBe(0);
    expect(result.cas603_saldoFavor).toBeGreaterThan(0);
    expect(result.cas603_saldoFavor).toBe(50_000); // 200.000 - 150.000
  });

  it('debe tratar correctamente ingresos exentos restándolos de los gravables', () => {
    const result = calcD101({
      ingresosBrutos:   5_000_000,
      ingresosExentos:  1_000_000,
    });
    expect(result.cas103_ingresosGravables).toBe(4_000_000);
  });
});
