/**
 * ────────────────────────────────────────────────────────────────
 *  Plan contable estándar — códigos usados por la lógica automática
 *
 *  Los códigos coinciden con el chart-of-accounts seed (Costa Rica
 *  PYME). Se mantienen aquí como constantes para que el rules engine
 *  no dependa de strings mágicos repartidos por todos los services.
 * ────────────────────────────────────────────────────────────────
 */
export const ACCOUNT_CODES = {
  // ── Activo ──────────────────────────────────────────────────────
  CASH:                '1.1.01.01',  // Caja
  ACCOUNTS_RECEIVABLE: '1.1.02.01',  // Cuentas por cobrar — clientes
  INVENTORY:           '1.1.03.01',  // Inventario de mercaderías
  IVA_CREDIT:          '1.1.04.01',  // IVA crédito fiscal (compras)

  // ── Pasivo ──────────────────────────────────────────────────────
  ACCOUNTS_PAYABLE:     '2.1.01.01', // Cuentas por pagar — proveedores
  IVA_PAYABLE:          '2.1.02.01', // IVA por pagar (ventas)
  WAGES_PAYABLE:        '2.1.04.01', // Sueldos por pagar
  CCSS_PAYABLE:         '2.1.04.02', // CCSS por pagar
  AGUINALDO_PAYABLE:    '2.1.04.03', // Aguinaldo por pagar
  RENTA_RETENIDA:       '2.1.04.04', // Imp. Renta retención por pagar

  // ── Ingresos ────────────────────────────────────────────────────
  REVENUE_SALES: '4.1.01.01', // Ventas

  // ── Gastos ──────────────────────────────────────────────────────
  COGS:           '5.1.01.01', // Costo de mercadería vendida
  WAGES_EXPENSE:  '6.1.01.01', // Sueldos y salarios
  CCSS_EXPENSE:   '6.1.02.01', // Cargas sociales patrono
  AGUINALDO_EXP:  '6.1.03.01', // Provisión aguinaldo
} as const;

export type AccountCode = typeof ACCOUNT_CODES[keyof typeof ACCOUNT_CODES];
