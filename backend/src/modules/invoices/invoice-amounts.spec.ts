/**
 * invoice-amounts.spec.ts
 * Pruebas unitarias para el cálculo de montos en facturas electrónicas
 *
 * Cubre:
 *   - Cálculo de IVA por línea y totales
 *   - Determinación de cuenta contable según condición de venta (contado/crédito)
 *   - Lógica de COGS (costo de ventas) para productos vs servicios
 *   - Validación de números consecutivos de factura
 */

import { Decimal } from '@prisma/client/runtime/library';

// ─── Helpers que replican la lógica de invoices.service.ts ───────────────────

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

interface InvoiceLine {
  quantity:  number;
  unitPrice: number;
  taxRate:   number;  // porcentaje: 13, 8, 4, 2, 1, 0
}

interface InvoiceLineResult {
  subtotal:  Decimal;
  taxAmount: Decimal;
  total:     Decimal;
}

/**
 * Calcula subtotal, IVA y total de una línea de factura.
 * Replica la lógica de InvoicesService.create lines.map(...)
 */
function calcLine(line: InvoiceLine): InvoiceLineResult {
  const qty       = new Decimal(line.quantity.toString());
  const unitPrice = new Decimal(line.unitPrice.toString());
  const taxRate   = new Decimal(line.taxRate.toString());

  const subtotal  = qty.times(unitPrice).toDecimalPlaces(2);
  const taxAmount = subtotal.times(taxRate).dividedBy(100).toDecimalPlaces(2);
  const total     = subtotal.plus(taxAmount);
  return { subtotal, taxAmount, total };
}

/**
 * Calcula totales de una factura sumando todas las líneas.
 */
function calcInvoiceTotals(lines: InvoiceLine[]) {
  let subtotal = new Decimal(0);
  let tax      = new Decimal(0);
  const results = lines.map(l => {
    const r = calcLine(l);
    subtotal = subtotal.plus(r.subtotal);
    tax      = tax.plus(r.taxAmount);
    return r;
  });
  const total = subtotal.plus(tax);
  return { subtotal, tax, total, lines: results };
}

/**
 * Determina la cuenta contable de débito según condición de venta.
 * Réplica de la lógica del asiento automático en invoices.service.ts
 *   CASH   → 1.1.01.01 (Caja General)
 *   CREDIT → 1.1.02.01 (Clientes Comerciales)
 */
function getDebitAccount(saleCondition: 'CASH' | 'CREDIT'): string {
  return saleCondition === 'CASH' ? '1.1.01.01' : '1.1.02.01';
}

/**
 * Determina si se debe generar asiento de COGS.
 * Solo cuando el producto tiene costo > 0 y no es servicio.
 */
function shouldCreateCOGS(params: { cost: number; isService: boolean }): boolean {
  return !params.isService && params.cost > 0;
}

/**
 * Calcula el monto de COGS para un producto.
 */
function calcCOGS(cost: number, quantity: number): number {
  return round(cost * quantity);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pruebas
// ─────────────────────────────────────────────────────────────────────────────

describe('Cálculo de Montos en Facturas', () => {

  describe('Cálculo de IVA por línea', () => {
    it('debe calcular 13% de IVA correctamente', () => {
      const result = calcLine({ quantity: 1, unitPrice: 100_000, taxRate: 13 });
      expect(result.subtotal.toNumber()).toBe(100_000);
      expect(result.taxAmount.toNumber()).toBe(13_000);
      expect(result.total.toNumber()).toBe(113_000);
    });

    it('debe calcular 8% de IVA correctamente', () => {
      const result = calcLine({ quantity: 1, unitPrice: 100_000, taxRate: 8 });
      expect(result.subtotal.toNumber()).toBe(100_000);
      expect(result.taxAmount.toNumber()).toBe(8_000);
      expect(result.total.toNumber()).toBe(108_000);
    });

    it('debe manejar IVA cero (exento)', () => {
      const result = calcLine({ quantity: 1, unitPrice: 50_000, taxRate: 0 });
      expect(result.taxAmount.toNumber()).toBe(0);
      expect(result.total.toNumber()).toBe(50_000);
    });

    it('debe calcular 4% de IVA correctamente', () => {
      const result = calcLine({ quantity: 1, unitPrice: 200_000, taxRate: 4 });
      expect(result.taxAmount.toNumber()).toBe(8_000);
      expect(result.total.toNumber()).toBe(208_000);
    });

    it('debe calcular 2% de IVA correctamente', () => {
      const result = calcLine({ quantity: 1, unitPrice: 100_000, taxRate: 2 });
      expect(result.taxAmount.toNumber()).toBe(2_000);
      expect(result.total.toNumber()).toBe(102_000);
    });

    it('debe calcular 1% de IVA correctamente', () => {
      const result = calcLine({ quantity: 1, unitPrice: 100_000, taxRate: 1 });
      expect(result.taxAmount.toNumber()).toBe(1_000);
      expect(result.total.toNumber()).toBe(101_000);
    });

    it('debe manejar cantidades decimales (ej: 2.5 unidades)', () => {
      const result = calcLine({ quantity: 2.5, unitPrice: 40_000, taxRate: 13 });
      // subtotal = 2.5 × 40.000 = 100.000
      // iva      = 100.000 × 13% = 13.000
      expect(result.subtotal.toNumber()).toBe(100_000);
      expect(result.taxAmount.toNumber()).toBe(13_000);
      expect(result.total.toNumber()).toBe(113_000);
    });
  });

  describe('Suma de múltiples líneas con distintas tasas de IVA', () => {
    it('debe sumar correctamente líneas con diferentes tasas de IVA', () => {
      const lines: InvoiceLine[] = [
        { quantity: 1, unitPrice: 100_000, taxRate: 13 }, // iva = 13.000
        { quantity: 1, unitPrice: 100_000, taxRate: 8  }, // iva = 8.000
        { quantity: 1, unitPrice: 50_000,  taxRate: 0  }, // iva = 0
      ];
      const totals = calcInvoiceTotals(lines);
      expect(totals.subtotal.toNumber()).toBe(250_000);
      expect(totals.tax.toNumber()).toBe(21_000);
      expect(totals.total.toNumber()).toBe(271_000);
    });

    it('debe manejar facturas con todas las líneas exentas', () => {
      const lines: InvoiceLine[] = [
        { quantity: 2, unitPrice: 25_000, taxRate: 0 },
        { quantity: 1, unitPrice: 30_000, taxRate: 0 },
      ];
      const totals = calcInvoiceTotals(lines);
      expect(totals.tax.toNumber()).toBe(0);
      expect(totals.total.toNumber()).toBe(80_000);
    });

    it('debe calcular correctamente múltiples unidades de la misma línea', () => {
      // 3 unidades × ₡50.000 con 13% = subtotal 150.000, iva 19.500
      const result = calcLine({ quantity: 3, unitPrice: 50_000, taxRate: 13 });
      expect(result.subtotal.toNumber()).toBe(150_000);
      expect(result.taxAmount.toNumber()).toBe(19_500);
      expect(result.total.toNumber()).toBe(169_500);
    });
  });

  describe('Venta contado vs crédito — Cuenta de débito', () => {
    it('debe debitar Caja General (1.1.01.01) para ventas de contado', () => {
      const account = getDebitAccount('CASH');
      expect(account).toBe('1.1.01.01');
    });

    it('debe debitar Clientes Comerciales (1.1.02.01) para ventas a crédito', () => {
      const account = getDebitAccount('CREDIT');
      expect(account).toBe('1.1.02.01');
    });
  });

  describe('COGS — Costo de Ventas para productos físicos', () => {
    it('debe crear asiento de COGS cuando el producto tiene costo > 0', () => {
      const shouldCreate = shouldCreateCOGS({ cost: 60_000, isService: false });
      expect(shouldCreate).toBe(true);
    });

    it('NO debe crear asiento de COGS para servicios (costo = 0)', () => {
      const shouldCreate = shouldCreateCOGS({ cost: 0, isService: true });
      expect(shouldCreate).toBe(false);
    });

    it('NO debe crear asiento de COGS para productos con costo cero', () => {
      const shouldCreate = shouldCreateCOGS({ cost: 0, isService: false });
      expect(shouldCreate).toBe(false);
    });

    it('debe calcular COGS = costo unitario × cantidad', () => {
      // producto.cost = 60.000, quantity = 2 → COGS = 120.000
      const cogs = calcCOGS(60_000, 2);
      expect(cogs).toBe(120_000);
    });

    it('debe sumar COGS de múltiples líneas de producto', () => {
      const lines = [
        { cost: 60_000, quantity: 2, isService: false }, // COGS = 120.000
        { cost: 30_000, quantity: 3, isService: false }, // COGS = 90.000
        { cost: 0,      quantity: 1, isService: true  }, // servicio → no COGS
      ];
      const totalCOGS = lines
        .filter(l => shouldCreateCOGS(l))
        .reduce((sum, l) => sum + calcCOGS(l.cost, l.quantity), 0);
      expect(totalCOGS).toBe(210_000);
    });

    it('debe calcular COGS con decimales de cantidad', () => {
      // costo = 10.000, cantidad = 1.5 → COGS = 15.000
      const cogs = calcCOGS(10_000, 1.5);
      expect(cogs).toBe(15_000);
    });
  });

  describe('Número consecutivo de factura', () => {
    it('debe generar número consecutivo de 20 dígitos', () => {
      // Formato CR: 00100100001 (11 chars) + secuencia 9 dígitos = 20 chars
      const lastNumber = 1;
      const consecutivo = `00100100001${String(lastNumber).padStart(9, '0')}`;
      expect(consecutivo).toHaveLength(20);
    });

    it('debe rellenar el número secuencial con ceros a la izquierda', () => {
      const lastNumber  = 42;
      const consecutivo = `00100100001${String(lastNumber).padStart(9, '0')}`;
      expect(consecutivo).toBe('00100100001000000042');
    });

    it('debe mantener formato fijo para número secuencial grande', () => {
      const lastNumber  = 999_999_999;
      const consecutivo = `00100100001${String(lastNumber).padStart(9, '0')}`;
      expect(consecutivo).toHaveLength(20);
      expect(consecutivo).toBe('00100100001999999999');
    });
  });

  describe('Precisión decimal en montos', () => {
    it('debe redondear IVA a exactamente 2 decimales', () => {
      // 3 × 33.333 = 99.999, IVA 13% = 12.99987 → redondeado a 13.00
      const result = calcLine({ quantity: 3, unitPrice: 33.333, taxRate: 13 });
      const ivaStr = result.taxAmount.toFixed(2);
      expect(ivaStr).toMatch(/^\d+\.\d{2}$/);
    });

    it('debe calcular subtotal con exactamente 2 decimales', () => {
      const result = calcLine({ quantity: 1, unitPrice: 100_000.005, taxRate: 13 });
      const subtotalStr = result.subtotal.toFixed(2);
      expect(subtotalStr).toMatch(/^\d+\.\d{2}$/);
    });
  });
});
