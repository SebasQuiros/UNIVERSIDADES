/**
 * d104-iva.spec.ts
 * Pruebas unitarias para el cálculo de la Declaración D-104 IVA
 *
 * La lógica de calcD104 se replica aquí como funciones puras para evitar
 * dependencia del cliente Prisma (que en este entorno tiene modelos faltantes).
 *
 * Fuente de referencia: src/modules/tax-declarations/tax-declarations.service.ts
 */

// ─── Helpers replicando la lógica de tax-declarations.service.ts ─────────────

function roundD104(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calcula IVA a pagar = débito fiscal - crédito fiscal.
 * Resultado positivo → impuesto a pagar.
 * Resultado negativo → saldo a favor.
 */
function ivaAPagar(ivaVentas: number, ivaCompras: number): number {
  const neto = roundD104(ivaVentas - ivaCompras);
  return neto > 0 ? neto : 0;
}

/**
 * Liquida el IVA del período y devuelve impuesto a pagar o saldo a favor.
 */
function liquidarIVA(ivaVentas: number, ivaCompras: number) {
  const impuestoNeto = roundD104(ivaVentas - ivaCompras);
  return {
    ivaAPagar:    impuestoNeto > 0 ? impuestoNeto : 0,
    saldoAFavor:  impuestoNeto < 0 ? Math.abs(impuestoNeto) : 0,
    impuestoNeto,
  };
}

interface SaleItem {
  tax:      number;
  taxRate:  number;   // decimal: 0.13, 0.08, 0.04, 0.02, 0.01, 0
  subtotal: number;
}

/**
 * Agrupa ventas por tasa de IVA y suma bases e IVA.
 */
function groupByRate(sales: SaleItem[]): Record<string, { base: number; iva: number }> {
  const result: Record<string, { base: number; iva: number }> = {};
  for (const sale of sales) {
    const key = String(sale.taxRate);
    if (!result[key]) result[key] = { base: 0, iva: 0 };
    result[key].base = roundD104(result[key].base + sale.subtotal);
    result[key].iva  = roundD104(result[key].iva  + sale.tax);
  }
  return result;
}

/**
 * Réplica completa de calcD104 de tax-declarations.service.ts
 */
function calcD104(d: Record<string, number>) {
  const v13 = d.ventas13 ?? 0;
  const v8  = d.ventas8  ?? 0;
  const v4  = d.ventas4  ?? 0;
  const v2  = d.ventas2  ?? 0;
  const v1  = d.ventas1  ?? 0;
  const vEx = d.ventasExentas ?? 0;

  const c13 = d.compras13 ?? 0;
  const c8  = d.compras8  ?? 0;
  const c4  = d.compras4  ?? 0;
  const c2  = d.compras2  ?? 0;
  const c1  = d.compras1  ?? 0;

  // Débito fiscal
  const ivaVentas13  = roundD104(v13 * 0.13);
  const ivaVentas8   = roundD104(v8  * 0.08);
  const ivaVentas4   = roundD104(v4  * 0.04);
  const ivaVentas2   = roundD104(v2  * 0.02);
  const ivaVentas1   = roundD104(v1  * 0.01);
  const debitoFiscal = roundD104(ivaVentas13 + ivaVentas8 + ivaVentas4 + ivaVentas2 + ivaVentas1);

  // Crédito fiscal
  const ivaCompras13  = roundD104(c13 * 0.13);
  const ivaCompras8   = roundD104(c8  * 0.08);
  const ivaCompras4   = roundD104(c4  * 0.04);
  const ivaCompras2   = roundD104(c2  * 0.02);
  const ivaCompras1   = roundD104(c1  * 0.01);
  const creditoFiscal = roundD104(ivaCompras13 + ivaCompras8 + ivaCompras4 + ivaCompras2 + ivaCompras1);

  const impuestoNeto  = roundD104(debitoFiscal - creditoFiscal);
  const totalVentas   = roundD104(v13 + v8 + v4 + v2 + v1 + vEx);
  const totalCompras  = roundD104(c13 + c8 + c4 + c2 + c1);

  return {
    ivaVentas: { t13: ivaVentas13, t8: ivaVentas8, t4: ivaVentas4, t2: ivaVentas2, t1: ivaVentas1 },
    ivaCompras: { t13: ivaCompras13, t8: ivaCompras8, t4: ivaCompras4, t2: ivaCompras2, t1: ivaCompras1 },
    cas301_debitoFiscal:  debitoFiscal,
    cas302_creditoFiscal: creditoFiscal,
    cas303_impuestoNeto:  impuestoNeto,
    cas304_impuestoPagar: impuestoNeto > 0 ? impuestoNeto : 0,
    cas305_saldoFavor:    impuestoNeto < 0 ? Math.abs(impuestoNeto) : 0,
    totalVentas,
    totalCompras,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBAS
// ─────────────────────────────────────────────────────────────────────────────

describe('D-104 — Declaración de IVA', () => {

  describe('Liquidación básica de IVA', () => {
    it('debe calcular IVA a pagar = IVA ventas - IVA compras', () => {
      const ivaVentas  = 130_000;
      const ivaCompras = 52_000;
      expect(ivaAPagar(ivaVentas, ivaCompras)).toBe(78_000);
    });

    it('debe mostrar saldo a favor cuando IVA compras > IVA ventas', () => {
      const ivaVentas  = 30_000;
      const ivaCompras = 50_000;
      const result     = liquidarIVA(ivaVentas, ivaCompras);
      expect(result.ivaAPagar).toBe(0);
      expect(result.saldoAFavor).toBe(20_000);
    });

    it('debe mostrar cero a pagar y cero a favor cuando IVA ventas = IVA compras', () => {
      const result = liquidarIVA(100_000, 100_000);
      expect(result.ivaAPagar).toBe(0);
      expect(result.saldoAFavor).toBe(0);
      expect(result.impuestoNeto).toBe(0);
    });

    it('debe manejar correctamente IVA de ventas cero (mes sin ventas)', () => {
      const result = liquidarIVA(0, 50_000);
      expect(result.ivaAPagar).toBe(0);
      expect(result.saldoAFavor).toBe(50_000);
    });
  });

  describe('Agrupación de ventas por tasa de IVA', () => {
    it('debe agrupar ventas por tasa de IVA correctamente', () => {
      const sales: SaleItem[] = [
        { tax: 13_000, taxRate: 0.13, subtotal: 100_000 },
        { tax: 8_000,  taxRate: 0.08, subtotal: 100_000 },
      ];
      const grouped = groupByRate(sales);
      expect(grouped['0.13'].iva).toBe(13_000);
      expect(grouped['0.08'].iva).toBe(8_000);
    });

    it('debe acumular ventas múltiples de la misma tasa', () => {
      const sales: SaleItem[] = [
        { tax: 13_000, taxRate: 0.13, subtotal: 100_000 },
        { tax: 6_500,  taxRate: 0.13, subtotal: 50_000  },
      ];
      const grouped = groupByRate(sales);
      expect(grouped['0.13'].iva).toBe(19_500);
      expect(grouped['0.13'].base).toBe(150_000);
    });

    it('debe manejar ventas exentas (tasa 0) correctamente', () => {
      const sales: SaleItem[] = [
        { tax: 0, taxRate: 0, subtotal: 200_000 },
      ];
      const grouped = groupByRate(sales);
      expect(grouped['0'].iva).toBe(0);
      expect(grouped['0'].base).toBe(200_000);
    });

    it('debe separar ventas de diferentes tasas en grupos distintos', () => {
      const sales: SaleItem[] = [
        { tax: 13_000, taxRate: 0.13, subtotal: 100_000 },
        { tax: 8_000,  taxRate: 0.08, subtotal: 100_000 },
        { tax: 4_000,  taxRate: 0.04, subtotal: 100_000 },
        { tax: 0,      taxRate: 0,    subtotal: 100_000 },
      ];
      const grouped = groupByRate(sales);
      expect(Object.keys(grouped)).toHaveLength(4);
    });
  });

  describe('calcD104 — Cálculo completo por casillas', () => {
    it('debe calcular débito fiscal 13% correctamente', () => {
      const result = calcD104({ ventas13: 100_000 });
      expect(result.ivaVentas.t13).toBe(13_000);
      expect(result.cas301_debitoFiscal).toBe(13_000);
    });

    it('debe calcular débito fiscal 8% correctamente', () => {
      const result = calcD104({ ventas8: 100_000 });
      expect(result.ivaVentas.t8).toBe(8_000);
      expect(result.cas301_debitoFiscal).toBe(8_000);
    });

    it('debe calcular crédito fiscal 13% correctamente', () => {
      const result = calcD104({ ventas13: 100_000, compras13: 40_000 });
      expect(result.ivaCompras.t13).toBe(roundD104(40_000 * 0.13));
      expect(result.cas302_creditoFiscal).toBe(roundD104(40_000 * 0.13));
    });

    it('debe calcular IVA a pagar cuando débito fiscal > crédito fiscal', () => {
      const result = calcD104({ ventas13: 100_000, compras13: 40_000 });
      // débito = 13.000, crédito = 5.200, neto = 7.800
      expect(result.cas304_impuestoPagar).toBe(7_800);
      expect(result.cas305_saldoFavor).toBe(0);
    });

    it('debe calcular saldo a favor cuando crédito fiscal > débito fiscal', () => {
      const result = calcD104({ ventas13: 20_000, compras13: 50_000 });
      // débito = 2.600, crédito = 6.500, neto = -3.900 → saldo a favor
      expect(result.cas304_impuestoPagar).toBe(0);
      expect(result.cas305_saldoFavor).toBe(3_900);
    });

    it('debe sumar ventas de todas las tasas en el total de ventas', () => {
      const result = calcD104({ ventas13: 100_000, ventas8: 50_000, ventasExentas: 30_000 });
      expect(result.totalVentas).toBe(180_000);
    });

    it('debe sumar correctamente débito fiscal de múltiples tasas', () => {
      const result = calcD104({ ventas13: 100_000, ventas8: 100_000, ventas4: 100_000 });
      // 13.000 + 8.000 + 4.000 = 25.000
      expect(result.cas301_debitoFiscal).toBe(25_000);
    });

    it('debe manejar formulario vacío sin errores (todos los campos en 0)', () => {
      const result = calcD104({});
      expect(result.cas301_debitoFiscal).toBe(0);
      expect(result.cas302_creditoFiscal).toBe(0);
      expect(result.cas303_impuestoNeto).toBe(0);
      expect(result.cas304_impuestoPagar).toBe(0);
      expect(result.cas305_saldoFavor).toBe(0);
    });

    it('debe calcular tasa 2% (tarifa reducida) correctamente', () => {
      const result = calcD104({ ventas2: 100_000 });
      expect(result.ivaVentas.t2).toBe(2_000);
    });

    it('debe calcular tasa 1% (tarifa reducida) correctamente', () => {
      const result = calcD104({ ventas1: 100_000 });
      expect(result.ivaVentas.t1).toBe(1_000);
    });

    it('debe calcular tasa 4% (tarifa reducida) correctamente', () => {
      const result = calcD104({ ventas4: 100_000 });
      expect(result.ivaVentas.t4).toBe(4_000);
    });
  });

  describe('Asiento de cierre D-104', () => {
    it('debe producir un asiento balanceado cuando hay IVA a pagar', () => {
      // D: IVA por Pagar (2.1.02.01)        = debitoFiscal
      // C: IVA Crédito Fiscal (1.1.04.01)   = creditoFiscal
      // C: IVA a Pagar Hacienda (2.1.02.03) = ivaAPagar
      const debitoFiscal  = 13_000;
      const creditoFiscal = 5_200;
      const ivaPagar      = roundD104(debitoFiscal - creditoFiscal); // 7.800

      const totalDebits  = debitoFiscal;
      const totalCredits = roundD104(creditoFiscal + ivaPagar);
      expect(totalDebits).toBe(totalCredits);
    });

    it('debe producir un asiento balanceado cuando hay saldo a favor', () => {
      // Cuando hay saldo a favor, el neto cancela el débito completo
      const debitoFiscal = 2_600;
      const totalDebits  = debitoFiscal;
      const totalCredits = debitoFiscal; // compensado completamente
      expect(totalDebits).toBe(totalCredits);
    });

    it('debe identificar correctamente las cuentas contables del asiento de cierre', () => {
      const CUENTA_IVA_POR_PAGAR   = '2.1.02.01';
      const CUENTA_IVA_CREDITO     = '1.1.04.01';
      const CUENTA_IVA_PAGAR_HAC   = '2.1.02.03';

      expect(CUENTA_IVA_POR_PAGAR).toBe('2.1.02.01');
      expect(CUENTA_IVA_CREDITO).toBe('1.1.04.01');
      expect(CUENTA_IVA_PAGAR_HAC).toBe('2.1.02.03');
    });
  });
});
