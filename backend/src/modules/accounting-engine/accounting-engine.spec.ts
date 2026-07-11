import { Decimal } from '@prisma/client/runtime/library';
import { isBalanced, equationDiff, reconcileDiff } from './accounting.engine';

// Invariantes verificables del Accounting Manifest (§5). Funciones puras.

describe('AccountingEngine — invariantes puros', () => {
  describe('V-1 · isBalanced (partida doble)', () => {
    it('acepta un asiento cuadrado', () => {
      const r = isBalanced([
        { debit: 1000, credit: 0 },
        { debit: 0, credit: 1000 },
      ]);
      expect(r.ok).toBe(true);
      expect(r.difference).toBe('0.00');
    });

    it('acepta multi-línea cuadrado (venta con IVA + COGS)', () => {
      const r = isBalanced([
        { debit: 1130, credit: 0 },     // CxC
        { debit: 0, credit: 1000 },     // Ventas
        { debit: 0, credit: 130 },      // IVA por pagar
        { debit: 600, credit: 0 },      // COGS
        { debit: 0, credit: 600 },      // Inventario
      ]);
      expect(r.ok).toBe(true);
    });

    it('el asiento de planilla cuadra (nómina CR, I-AT-2)', () => {
      // Invariante de nómina: totalGross = totalNet + totalTrabajador + totalRenta.
      const totalGross = 1000000, totalNet = 850000, totalTrabajador = 100000, totalRenta = 50000;
      const totalPatrono = 265000, totalAguinaldo = 83333;
      const lines = [
        { debit: totalGross,     credit: 0 },                       // D Sueldos
        { debit: totalPatrono,   credit: 0 },                       // D CCSS Patrono
        { debit: totalAguinaldo, credit: 0 },                       // D Aguinaldo
        { debit: 0, credit: totalNet },                             // C Sueldos por pagar
        { debit: 0, credit: totalTrabajador + totalPatrono },       // C CCSS por pagar
        { debit: 0, credit: totalAguinaldo },                       // C Aguinaldo por pagar
        { debit: 0, credit: totalRenta },                           // C Renta retenida
      ];
      expect(isBalanced(lines).ok).toBe(true);
    });

    it('rechaza un asiento descuadrado', () => {
      const r = isBalanced([
        { debit: 1000, credit: 0 },
        { debit: 0, credit: 950 },
      ]);
      expect(r.ok).toBe(false);
      expect(r.difference).toBe('50.00');
    });

    it('respeta la tolerancia (0.01)', () => {
      expect(isBalanced([{ debit: '100.00', credit: 0 }, { debit: 0, credit: '99.995' }]).ok).toBe(true);
      expect(isBalanced([{ debit: '100.00', credit: 0 }, { debit: 0, credit: '99.98' }]).ok).toBe(false);
    });
  });

  describe('V-2 · equationDiff (Activo = Pasivo + Patrimonio + Resultado)', () => {
    it('cuadra con utilidad del período', () => {
      const r = equationDiff({
        assets: new Decimal(15000),
        liabilities: new Decimal(4000),
        equity: new Decimal(10000),
        income: new Decimal(3000),
        expense: new Decimal(2000),
      }); // 15000 = 4000 + 10000 + (3000-2000)
      expect(r.ok).toBe(true);
      expect(r.detail?.netIncome).toBe('1000.00');
    });

    it('se mantiene tras depreciación (contra-activo netea + gasto)', () => {
      // Base cuadrada: A=15000, P=4000, PN=10000, I=3000, G=2000 (net=1000).
      // Depreciación de 500 → activos −500 (Dep. Acumulada, contra-activo que
      // netea por tipo) y gasto +500. Debe seguir cuadrando: 14500 = 4000 +
      // 10000 + (3000 − 2500) = 14500.
      const r = equationDiff({
        assets: new Decimal(14500),
        liabilities: new Decimal(4000),
        equity: new Decimal(10000),
        income: new Decimal(3000),
        expense: new Decimal(2500),
      });
      expect(r.ok).toBe(true);
    });

    it('detecta una ecuación rota', () => {
      const r = equationDiff({
        assets: new Decimal(15000),
        liabilities: new Decimal(4000),
        equity: new Decimal(10000),
        income: new Decimal(0),
        expense: new Decimal(0),
      }); // 15000 ≠ 14000
      expect(r.ok).toBe(false);
      expect(r.difference).toBe('1000.00');
    });
  });

  describe('V-3/V-4 · reconcileDiff (control = Σ subledger)', () => {
    it('acepta control = subledger', () => {
      expect(reconcileDiff(5000, 5000).ok).toBe(true);
    });
    it('detecta desfase control ≠ subledger', () => {
      const r = reconcileDiff('5000.00', '4900.00');
      expect(r.ok).toBe(false);
      expect(r.difference).toBe('100.00');
    });
    it('tolera diferencias de centavo', () => {
      expect(reconcileDiff('5000.00', '4999.995').ok).toBe(true);
    });
  });
});
