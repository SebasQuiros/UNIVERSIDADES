/**
 * journal-validation.spec.ts
 * Pruebas unitarias para la lógica de validación de asientos contables
 *
 * La validación de asientos en JournalService implementa las reglas:
 *   1. Mínimo 2 líneas
 *   2. Sin cuentas duplicadas
 *   3. Débitos = Créditos (tolerancia 0.001)
 *   4. Una línea no puede tener débito Y crédito simultáneamente
 *   5. Una línea no puede tener monto cero
 *
 * Dado que la validación está embebida en createEntry (que requiere Prisma+DB),
 * aquí se extrae la misma lógica como funciones puras para pruebas unitarias.
 */

import { Decimal } from '@prisma/client/runtime/library';

// ─── Replicación fiel de la lógica de validación de journal.service.ts ────────

interface JournalLine {
  accountId: string;
  debit:     number;
  credit:    number;
}

/**
 * Valida que los débitos sean iguales a los créditos.
 * Tolerancia de 0.001 (igual que la implementación).
 */
function validateBalance(lines: JournalLine[]): boolean {
  const sumDebit  = lines.reduce((acc, l) => acc.plus(new Decimal(l.debit.toString())),  new Decimal(0));
  const sumCredit = lines.reduce((acc, l) => acc.plus(new Decimal(l.credit.toString())), new Decimal(0));
  const diff      = sumDebit.minus(sumCredit).abs();
  return !diff.greaterThan(new Decimal('0.001'));
}

/** Valida que el asiento tenga al menos 2 líneas */
function validateMinLines(lines: JournalLine[]): boolean {
  return lines.length >= 2;
}

/** Valida que no haya cuentas duplicadas */
function validateNoDuplicateAccounts(lines: JournalLine[]): boolean {
  const ids   = lines.map(l => l.accountId);
  const unique = new Set(ids);
  return unique.size === ids.length;
}

/** Valida que cada línea no tenga débito Y crédito simultáneamente */
function validateNoMixedLine(line: JournalLine): boolean {
  const d = new Decimal(line.debit.toString());
  const c = new Decimal(line.credit.toString());
  return !(d.greaterThan(0) && c.greaterThan(0));
}

/** Valida que una línea no tenga monto cero en ambos campos */
function validateNonZeroLine(line: JournalLine): boolean {
  const d = new Decimal(line.debit.toString());
  const c = new Decimal(line.credit.toString());
  return !(d.equals(0) && c.equals(0));
}

// ─────────────────────────────────────────────────────────────────────────────
// Pruebas
// ─────────────────────────────────────────────────────────────────────────────

describe('Validación de Asientos Contables', () => {

  describe('Balance Débito / Crédito', () => {
    it('debe pasar cuando débitos son iguales a créditos', () => {
      const lines: JournalLine[] = [
        { accountId: 'acc-1', debit: 100, credit: 0 },
        { accountId: 'acc-2', debit: 0,   credit: 100 },
      ];
      expect(validateBalance(lines)).toBe(true);
    });

    it('debe fallar cuando débitos no son iguales a créditos', () => {
      const lines: JournalLine[] = [
        { accountId: 'acc-1', debit: 100, credit: 0 },
        { accountId: 'acc-2', debit: 0,   credit: 90 },
      ];
      expect(validateBalance(lines)).toBe(false);
    });

    it('debe permitir tolerancia de 0.001 (débito 100.001, crédito 100.000)', () => {
      const lines: JournalLine[] = [
        { accountId: 'acc-1', debit: 100.001, credit: 0 },
        { accountId: 'acc-2', debit: 0,       credit: 100.000 },
      ];
      // Diferencia = 0.001 → debe pasar (≤ 0.001)
      expect(validateBalance(lines)).toBe(true);
    });

    it('debe rechazar diferencia de 0.002 (fuera de tolerancia)', () => {
      const lines: JournalLine[] = [
        { accountId: 'acc-1', debit: 100.002, credit: 0 },
        { accountId: 'acc-2', debit: 0,       credit: 100.000 },
      ];
      // Diferencia = 0.002 > 0.001 → debe fallar
      expect(validateBalance(lines)).toBe(false);
    });

    it('debe balancear correctamente con montos en colones grandes', () => {
      const lines: JournalLine[] = [
        { accountId: 'acc-1', debit: 5_000_000, credit: 0 },
        { accountId: 'acc-2', debit: 0,         credit: 3_000_000 },
        { accountId: 'acc-3', debit: 0,         credit: 2_000_000 },
      ];
      expect(validateBalance(lines)).toBe(true);
    });
  });

  describe('Número mínimo de líneas', () => {
    it('debe rechazar asientos con menos de 2 líneas', () => {
      const lines: JournalLine[] = [
        { accountId: 'acc-1', debit: 100, credit: 0 },
      ];
      expect(validateMinLines(lines)).toBe(false);
    });

    it('debe aceptar asientos con exactamente 2 líneas', () => {
      const lines: JournalLine[] = [
        { accountId: 'acc-1', debit: 100, credit: 0 },
        { accountId: 'acc-2', debit: 0,   credit: 100 },
      ];
      expect(validateMinLines(lines)).toBe(true);
    });

    it('debe aceptar asientos con 3 o más líneas', () => {
      const lines: JournalLine[] = [
        { accountId: 'acc-1', debit: 1000, credit: 0 },
        { accountId: 'acc-2', debit: 0,    credit: 600 },
        { accountId: 'acc-3', debit: 0,    credit: 400 },
      ];
      expect(validateMinLines(lines)).toBe(true);
    });
  });

  describe('Cuentas duplicadas', () => {
    it('debe rechazar líneas con cuentas duplicadas en el mismo asiento', () => {
      const lines: JournalLine[] = [
        { accountId: 'acc-1', debit: 100, credit: 0 },
        { accountId: 'acc-1', debit: 0,   credit: 100 }, // duplicada
      ];
      expect(validateNoDuplicateAccounts(lines)).toBe(false);
    });

    it('debe aceptar líneas con cuentas únicas', () => {
      const lines: JournalLine[] = [
        { accountId: 'acc-1', debit: 100, credit: 0 },
        { accountId: 'acc-2', debit: 0,   credit: 100 },
      ];
      expect(validateNoDuplicateAccounts(lines)).toBe(true);
    });

    it('debe detectar duplicados en asientos de múltiples líneas', () => {
      const lines: JournalLine[] = [
        { accountId: 'acc-1', debit: 500, credit: 0 },
        { accountId: 'acc-2', debit: 0,   credit: 300 },
        { accountId: 'acc-2', debit: 0,   credit: 200 }, // duplicada
      ];
      expect(validateNoDuplicateAccounts(lines)).toBe(false);
    });
  });

  describe('Líneas inválidas', () => {
    it('debe rechazar una línea con débito y crédito simultáneos', () => {
      const line: JournalLine = { accountId: 'acc-1', debit: 100, credit: 50 };
      expect(validateNoMixedLine(line)).toBe(false);
    });

    it('debe aceptar una línea con solo débito', () => {
      const line: JournalLine = { accountId: 'acc-1', debit: 100, credit: 0 };
      expect(validateNoMixedLine(line)).toBe(true);
    });

    it('debe aceptar una línea con solo crédito', () => {
      const line: JournalLine = { accountId: 'acc-1', debit: 0, credit: 100 };
      expect(validateNoMixedLine(line)).toBe(true);
    });

    it('debe rechazar una línea con monto cero en ambos campos', () => {
      const line: JournalLine = { accountId: 'acc-1', debit: 0, credit: 0 };
      expect(validateNonZeroLine(line)).toBe(false);
    });

    it('debe aceptar una línea con monto diferente de cero', () => {
      const line: JournalLine = { accountId: 'acc-1', debit: 100, credit: 0 };
      expect(validateNonZeroLine(line)).toBe(true);
    });
  });

  describe('Asientos de múltiples líneas', () => {
    it('debe validar un asiento de 3 líneas (1 débito, 2 créditos)', () => {
      const lines: JournalLine[] = [
        { accountId: 'acc-1', debit: 1000, credit: 0 },
        { accountId: 'acc-2', debit: 0,    credit: 600 },
        { accountId: 'acc-3', debit: 0,    credit: 400 },
      ];
      expect(validateMinLines(lines)).toBe(true);
      expect(validateBalance(lines)).toBe(true);
      expect(validateNoDuplicateAccounts(lines)).toBe(true);
      lines.forEach(l => {
        expect(validateNoMixedLine(l)).toBe(true);
        expect(validateNonZeroLine(l)).toBe(true);
      });
    });

    it('debe validar un asiento con 2 débitos y 1 crédito (débito dividido)', () => {
      const lines: JournalLine[] = [
        { accountId: 'acc-1', debit: 300, credit: 0 },
        { accountId: 'acc-2', debit: 200, credit: 0 },
        { accountId: 'acc-3', debit: 0,   credit: 500 },
      ];
      expect(validateMinLines(lines)).toBe(true);
      expect(validateBalance(lines)).toBe(true);
      expect(validateNoDuplicateAccounts(lines)).toBe(true);
    });

    it('debe detectar asiento desbalanceado en 3 líneas', () => {
      const lines: JournalLine[] = [
        { accountId: 'acc-1', debit: 1000, credit: 0 },
        { accountId: 'acc-2', debit: 0,    credit: 600 },
        { accountId: 'acc-3', debit: 0,    credit: 350 }, // falta 50
      ];
      expect(validateBalance(lines)).toBe(false);
    });

    it('debe validar un asiento de venta IVA (débito clientes, crédito ventas y IVA)', () => {
      // Venta de ₡100.000 + 13% IVA = ₡113.000
      const lines: JournalLine[] = [
        { accountId: 'clientes',  debit: 113_000, credit: 0 },       // Clientes Comerciales
        { accountId: 'ventas',    debit: 0,        credit: 100_000 }, // Ingresos por Ventas
        { accountId: 'iva-pagar', debit: 0,        credit: 13_000 },  // IVA por Pagar
      ];
      expect(validateBalance(lines)).toBe(true);
      expect(validateMinLines(lines)).toBe(true);
      expect(validateNoDuplicateAccounts(lines)).toBe(true);
    });
  });
});
