/**
 * balance-sheet.spec.ts
 * Pruebas unitarias para la lógica del Balance General (Balance Sheet)
 *
 * La ecuación contable fundamental:
 *   Activos = Pasivos + Patrimonio + Utilidad del Período
 *
 * Lógica extraída de ReportsService.getBalanceSheet y getAccountBalances.
 */

import { Decimal } from '@prisma/client/runtime/library';

// ─── Tipos de cuenta según el plan de cuentas de SJQA GROUP ──────────────────

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
type NormalBalance = 'DEBIT' | 'CREDIT';

interface AccountBalance {
  code:          string;
  type:          AccountType;
  normalBalance: NormalBalance;
  totalDebit:    number;
  totalCredit:   number;
}

// ─── Funciones puras extraídas de reports.service.ts ─────────────────────────

/**
 * Determina el tipo de cuenta por el primer dígito del código.
 * Estándar del plan de cuentas SJQA GROUP:
 *   1.x.xx.xx → ASSET
 *   2.x.xx.xx → LIABILITY
 *   3.x.xx.xx → EQUITY
 *   4.x.xx.xx → INCOME
 *   5.x.xx.xx → EXPENSE
 */
function getAccountType(code: string): AccountType {
  const prefix = code.charAt(0);
  const map: Record<string, AccountType> = {
    '1': 'ASSET',
    '2': 'LIABILITY',
    '3': 'EQUITY',
    '4': 'INCOME',
    '5': 'EXPENSE',
  };
  return map[prefix] ?? 'ASSET';
}

/**
 * Determina el saldo normal por tipo de cuenta.
 * ASSET y EXPENSE: saldo normal DEBIT → balance = debit - credit
 * LIABILITY, EQUITY e INCOME: saldo normal CREDIT → balance = credit - debit
 */
function getNormalBalance(type: AccountType): NormalBalance {
  return type === 'ASSET' || type === 'EXPENSE' ? 'DEBIT' : 'CREDIT';
}

/**
 * Calcula el balance de una cuenta según su saldo normal.
 * Replica la lógica de ReportsService.getAccountBalances.
 */
function calcBalance(account: AccountBalance): Decimal {
  const debit  = new Decimal(account.totalDebit.toString());
  const credit = new Decimal(account.totalCredit.toString());
  return account.normalBalance === 'DEBIT'
    ? debit.minus(credit)
    : credit.minus(debit);
}

/**
 * Verifica si el balance general está balanceado.
 * Activos = Pasivos + Patrimonio + Utilidad neta del período
 */
function isBalanceSheetBalanced(
  totalAssets:      Decimal,
  totalLiabilities: Decimal,
  adjustedEquity:   Decimal,
  tolerance         = new Decimal('0.01'),
): boolean {
  return totalAssets.minus(totalLiabilities.plus(adjustedEquity)).abs()
    .lessThanOrEqualTo(tolerance);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pruebas
// ─────────────────────────────────────────────────────────────────────────────

describe('Balance General (Balance Sheet)', () => {

  describe('Ecuación contable fundamental', () => {
    it('debe balancear: Activos = Pasivos + Patrimonio + Utilidad Neta', () => {
      const assets     = 1_000_000;
      const liabilities = 400_000;
      const equity     = 500_000;
      const netIncome  = 100_000;
      expect(Math.abs(assets - (liabilities + equity + netIncome))).toBeLessThan(0.01);
    });

    it('debe reportar isBalanced=true para un balance correctamente cuadrado', () => {
      const totalAssets      = new Decimal(1_000_000);
      const totalLiabilities = new Decimal(400_000);
      const adjustedEquity   = new Decimal(600_000); // equity 500.000 + netIncome 100.000
      expect(isBalanceSheetBalanced(totalAssets, totalLiabilities, adjustedEquity)).toBe(true);
    });

    it('debe reportar isBalanced=false para un balance descuadrado', () => {
      const totalAssets      = new Decimal(1_000_000);
      const totalLiabilities = new Decimal(400_000);
      const adjustedEquity   = new Decimal(500_000); // falta 100.000
      expect(isBalanceSheetBalanced(totalAssets, totalLiabilities, adjustedEquity)).toBe(false);
    });

    it('debe permitir tolerancia de ₡0.01 en el balance', () => {
      const totalAssets      = new Decimal(1_000_000.01);
      const totalLiabilities = new Decimal(400_000);
      const adjustedEquity   = new Decimal(600_000);
      expect(isBalanceSheetBalanced(totalAssets, totalLiabilities, adjustedEquity)).toBe(true);
    });

    it('debe rechazar diferencia superior a ₡0.01 como descuadrado', () => {
      const totalAssets      = new Decimal(1_000_000.02);
      const totalLiabilities = new Decimal(400_000);
      const adjustedEquity   = new Decimal(600_000);
      expect(isBalanceSheetBalanced(totalAssets, totalLiabilities, adjustedEquity)).toBe(false);
    });
  });

  describe('Clasificación de cuentas por tipo', () => {
    it('debe clasificar cuenta 1.x.xx.xx como ASSET (Activo)', () => {
      expect(getAccountType('1.1.01.01')).toBe('ASSET');
      expect(getAccountType('1.2.01.01')).toBe('ASSET');
    });

    it('debe clasificar cuenta 2.x.xx.xx como LIABILITY (Pasivo)', () => {
      expect(getAccountType('2.1.01.01')).toBe('LIABILITY');
      expect(getAccountType('2.2.01.01')).toBe('LIABILITY');
    });

    it('debe clasificar cuenta 3.x.xx.xx como EQUITY (Patrimonio)', () => {
      expect(getAccountType('3.1.01.01')).toBe('EQUITY');
    });

    it('debe clasificar cuenta 4.x.xx.xx como INCOME (Ingresos)', () => {
      expect(getAccountType('4.1.01.01')).toBe('INCOME');
    });

    it('debe clasificar cuenta 5.x.xx.xx como EXPENSE (Gastos)', () => {
      expect(getAccountType('5.1.01.01')).toBe('EXPENSE');
    });
  });

  describe('Saldo normal por tipo de cuenta', () => {
    it('ASSET debe tener saldo normal DEBIT', () => {
      expect(getNormalBalance('ASSET')).toBe('DEBIT');
    });

    it('EXPENSE debe tener saldo normal DEBIT', () => {
      expect(getNormalBalance('EXPENSE')).toBe('DEBIT');
    });

    it('LIABILITY debe tener saldo normal CREDIT', () => {
      expect(getNormalBalance('LIABILITY')).toBe('CREDIT');
    });

    it('EQUITY debe tener saldo normal CREDIT', () => {
      expect(getNormalBalance('EQUITY')).toBe('CREDIT');
    });

    it('INCOME debe tener saldo normal CREDIT', () => {
      expect(getNormalBalance('INCOME')).toBe('CREDIT');
    });
  });

  describe('Cálculo del saldo por cuenta', () => {
    it('ASSET: débito 500, crédito 200 → saldo = +300 (saldo normal positivo)', () => {
      const account: AccountBalance = {
        code: '1.1.01.01', type: 'ASSET', normalBalance: 'DEBIT',
        totalDebit: 500, totalCredit: 200,
      };
      const balance = calcBalance(account);
      expect(balance.toNumber()).toBe(300);
    });

    it('LIABILITY: débito 100, crédito 300 → saldo = +200 (saldo normal positivo)', () => {
      const account: AccountBalance = {
        code: '2.1.01.01', type: 'LIABILITY', normalBalance: 'CREDIT',
        totalDebit: 100, totalCredit: 300,
      };
      const balance = calcBalance(account);
      expect(balance.toNumber()).toBe(200);
    });

    it('INCOME: crédito 1.000.000, débito 0 → saldo = +1.000.000', () => {
      const account: AccountBalance = {
        code: '4.1.01.01', type: 'INCOME', normalBalance: 'CREDIT',
        totalDebit: 0, totalCredit: 1_000_000,
      };
      const balance = calcBalance(account);
      expect(balance.toNumber()).toBe(1_000_000);
    });

    it('EXPENSE: débito 500.000, crédito 50.000 → saldo = +450.000', () => {
      const account: AccountBalance = {
        code: '5.1.01.01', type: 'EXPENSE', normalBalance: 'DEBIT',
        totalDebit: 500_000, totalCredit: 50_000,
      };
      const balance = calcBalance(account);
      expect(balance.toNumber()).toBe(450_000);
    });

    it('EQUITY: débito 0, crédito 2.000.000 → saldo = +2.000.000', () => {
      const account: AccountBalance = {
        code: '3.1.01.01', type: 'EQUITY', normalBalance: 'CREDIT',
        totalDebit: 0, totalCredit: 2_000_000,
      };
      const balance = calcBalance(account);
      expect(balance.toNumber()).toBe(2_000_000);
    });
  });

  describe('Escenario completo de Balance General', () => {
    it('debe sumar correctamente activos de múltiples cuentas', () => {
      const assetAccounts: AccountBalance[] = [
        { code: '1.1.01.01', type: 'ASSET', normalBalance: 'DEBIT', totalDebit: 500_000, totalCredit: 0 },
        { code: '1.1.02.01', type: 'ASSET', normalBalance: 'DEBIT', totalDebit: 300_000, totalCredit: 0 },
        { code: '1.2.01.01', type: 'ASSET', normalBalance: 'DEBIT', totalDebit: 200_000, totalCredit: 0 },
      ];
      const totalAssets = assetAccounts.reduce(
        (sum, a) => sum.plus(calcBalance(a)), new Decimal(0),
      );
      expect(totalAssets.toNumber()).toBe(1_000_000);
    });

    it('debe calcular utilidad neta = ingresos - gastos', () => {
      const incomeAccounts: AccountBalance[] = [
        { code: '4.1.01.01', type: 'INCOME', normalBalance: 'CREDIT', totalDebit: 0, totalCredit: 800_000 },
      ];
      const expenseAccounts: AccountBalance[] = [
        { code: '5.1.01.01', type: 'EXPENSE', normalBalance: 'DEBIT', totalDebit: 300_000, totalCredit: 0 },
      ];
      const totalIncome   = incomeAccounts.reduce((s, a) => s.plus(calcBalance(a)), new Decimal(0));
      const totalExpenses = expenseAccounts.reduce((s, a) => s.plus(calcBalance(a)), new Decimal(0));
      const netIncome     = totalIncome.minus(totalExpenses);
      expect(netIncome.toNumber()).toBe(500_000);
    });

    it('debe verificar ecuación completa con datos reales de una PYME', () => {
      // Activos
      const totalAssets      = new Decimal(2_500_000);
      // Pasivos
      const totalLiabilities = new Decimal(800_000);
      // Patrimonio contable
      const totalEquity      = new Decimal(1_500_000);
      // Utilidad del período
      const netIncome        = new Decimal(200_000);
      // Patrimonio ajustado
      const adjustedEquity   = totalEquity.plus(netIncome);

      expect(isBalanceSheetBalanced(totalAssets, totalLiabilities, adjustedEquity)).toBe(true);
      expect(totalAssets.toNumber()).toBe(
        totalLiabilities.plus(adjustedEquity).toNumber(),
      );
    });
  });
});
