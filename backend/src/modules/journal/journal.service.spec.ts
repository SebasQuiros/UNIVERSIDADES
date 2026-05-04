/**
 * Unit tests for journal accounting validation logic.
 * These tests run against pure business logic — NO database or Prisma calls.
 * Run with: npm test
 */

import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

// ─── Pure helpers extracted from JournalService for testability ────────────

function validateBalance(
  lines: Array<{ debit: number | string; credit: number | string }>,
): void {
  const sumDebit  = lines.reduce((acc, l) => acc.plus(new Decimal(l.debit.toString())),  new Decimal(0));
  const sumCredit = lines.reduce((acc, l) => acc.plus(new Decimal(l.credit.toString())), new Decimal(0));
  const diff      = sumDebit.minus(sumCredit).abs();

  if (diff.greaterThan(new Decimal('0.001'))) {
    throw new BadRequestException(
      `El asiento no está balanceado. Débitos: ${sumDebit.toFixed(2)} | Créditos: ${sumCredit.toFixed(2)} | Diferencia: ${diff.toFixed(2)}`,
    );
  }
}

function validateLineAmounts(
  lines: Array<{ debit: number | string; credit: number | string; accountCode?: string }>,
): void {
  if (lines.length < 2) {
    throw new BadRequestException('Un asiento contable requiere al menos 2 líneas.');
  }
  for (const line of lines) {
    const d = new Decimal(line.debit.toString());
    const c = new Decimal(line.credit.toString());
    const code = line.accountCode ?? 'desconocida';
    if (d.greaterThan(0) && c.greaterThan(0)) {
      throw new BadRequestException(
        `La línea de la cuenta "${code}" tiene débito y crédito simultáneamente.`,
      );
    }
    if (d.equals(0) && c.equals(0)) {
      throw new BadRequestException(
        `La línea de la cuenta "${code}" tiene monto cero.`,
      );
    }
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('JournalService — validación de asientos contables', () => {

  // ── Balance (partida doble) ──────────────────────────────────────────────

  describe('validateBalance', () => {
    it('acepta un asiento perfectamente balanceado', () => {
      expect(() => validateBalance([
        { debit: 1000, credit: 0 },
        { debit: 0,    credit: 1000 },
      ])).not.toThrow();
    });

    it('acepta balance con múltiples líneas que suman igual', () => {
      expect(() => validateBalance([
        { debit: 500,  credit: 0 },
        { debit: 300,  credit: 0 },
        { debit: 200,  credit: 0 },
        { debit: 0,    credit: 1000 },
      ])).not.toThrow();
    });

    it('acepta diferencia dentro de la tolerancia de 0.001', () => {
      expect(() => validateBalance([
        { debit: 1000.0005, credit: 0 },
        { debit: 0,         credit: 1000 },
      ])).not.toThrow();
    });

    it('rechaza asiento desbalanceado (débito > crédito)', () => {
      expect(() => validateBalance([
        { debit: 1500, credit: 0 },
        { debit: 0,    credit: 1000 },
      ])).toThrow(BadRequestException);
    });

    it('rechaza asiento desbalanceado (crédito > débito)', () => {
      expect(() => validateBalance([
        { debit: 1000, credit: 0 },
        { debit: 0,    credit: 2000 },
      ])).toThrow(BadRequestException);
    });

    it('rechaza líneas con valores string que no balancean', () => {
      expect(() => validateBalance([
        { debit: '999.99', credit: '0' },
        { debit: '0',      credit: '1000.00' },
      ])).toThrow(BadRequestException);
    });

    it('maneja correctamente decimales de colones (2 decimales)', () => {
      expect(() => validateBalance([
        { debit: '12345.67', credit: '0' },
        { debit: '0',        credit: '12345.67' },
      ])).not.toThrow();
    });

    it('maneja montos grandes correctamente (sin pérdida de precisión)', () => {
      expect(() => validateBalance([
        { debit: '9999999.99', credit: '0' },
        { debit: '0',          credit: '9999999.99' },
      ])).not.toThrow();
    });
  });

  // ── Validación de líneas individuales ────────────────────────────────────

  describe('validateLineAmounts', () => {
    it('rechaza asiento con menos de 2 líneas', () => {
      expect(() => validateLineAmounts([
        { debit: 1000, credit: 0 },
      ])).toThrow(BadRequestException);
    });

    it('acepta asiento con exactamente 2 líneas válidas', () => {
      expect(() => validateLineAmounts([
        { debit: 1000, credit: 0 },
        { debit: 0,    credit: 1000 },
      ])).not.toThrow();
    });

    it('rechaza línea con débito y crédito simultáneos', () => {
      expect(() => validateLineAmounts([
        { debit: 500,  credit: 200, accountCode: '1101' },
        { debit: 0,    credit: 300 },
      ])).toThrow(BadRequestException);
    });

    it('rechaza línea con monto cero en ambos campos', () => {
      expect(() => validateLineAmounts([
        { debit: 0, credit: 0, accountCode: '2101' },
        { debit: 1000, credit: 0 },
      ])).toThrow(BadRequestException);
    });

    it('acepta asiento con múltiples débitos y un crédito', () => {
      expect(() => validateLineAmounts([
        { debit: 300, credit: 0 },
        { debit: 200, credit: 0 },
        { debit: 0,   credit: 500 },
      ])).not.toThrow();
    });
  });

  // ── Casos de negocio contable costarricense ──────────────────────────────

  describe('Casos de uso contables reales (CR)', () => {
    it('Venta al contado — efectivo vs ingresos', () => {
      // Débito: 1101 Caja | Crédito: 4101 Ingresos por ventas
      expect(() => {
        validateLineAmounts([
          { debit: 50000, credit: 0,     accountCode: '1101' },
          { debit: 0,     credit: 50000, accountCode: '4101' },
        ]);
        validateBalance([
          { debit: 50000, credit: 0 },
          { debit: 0,     credit: 50000 },
        ]);
      }).not.toThrow();
    });

    it('Venta con IVA 13% — descompone IVA', () => {
      // Venta ₡100,000 + IVA ₡13,000 = ₡113,000
      const base = 100000;
      const iva  = 13000;
      const total = base + iva;
      expect(() => {
        validateLineAmounts([
          { debit: total, credit: 0,     accountCode: '1101' }, // Caja
          { debit: 0,     credit: base,  accountCode: '4101' }, // Ingresos
          { debit: 0,     credit: iva,   accountCode: '2201' }, // IVA por pagar
        ]);
        validateBalance([
          { debit: total, credit: 0 },
          { debit: 0,     credit: base },
          { debit: 0,     credit: iva },
        ]);
      }).not.toThrow();
    });

    it('Pago de planilla — salarios y cargas sociales', () => {
      // Salario bruto ₡500,000, CCSS empleado ₡40,000, neto ₡460,000
      expect(() => {
        validateLineAmounts([
          { debit: 500000, credit: 0,      accountCode: '5101' }, // Gasto salarios
          { debit: 0,      credit: 40000,  accountCode: '2301' }, // CCSS por pagar
          { debit: 0,      credit: 460000, accountCode: '1101' }, // Banco
        ]);
        validateBalance([
          { debit: 500000, credit: 0 },
          { debit: 0,      credit: 40000 },
          { debit: 0,      credit: 460000 },
        ]);
      }).not.toThrow();
    });

    it('Asiento mal construido — planilla desbalanceada lanza error', () => {
      expect(() => validateBalance([
        { debit: 500000, credit: 0 },
        { debit: 0,      credit: 40000 },
        { debit: 0,      credit: 400000 }, // debería ser 460,000
      ])).toThrow(BadRequestException);
    });
  });
});
