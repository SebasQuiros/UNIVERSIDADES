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
  // Mercadería recibida sin factura: puente entre recepción y factura.
  GOODS_RECEIVED:       '2.1.01.05', // Mercadería recibida por facturar
  IVA_PAYABLE:          '2.1.02.01', // IVA por pagar (ventas)
  WAGES_PAYABLE:        '2.1.04.01', // Sueldos por pagar
  CCSS_PAYABLE:         '2.1.04.02', // CCSS por pagar
  AGUINALDO_PAYABLE:    '2.1.04.03', // Aguinaldo por pagar
  RENTA_RETENIDA:       '2.1.04.04', // Imp. Renta retención por pagar

  // ── Ingresos ────────────────────────────────────────────────────
  REVENUE_SALES: '4.1.01.01', // Ventas
  INVENTORY_ADJUSTMENT_INCOME: '4.2.01.02', // Ajuste de inventario — sobrante (Fase 19)

  // ── Gastos ──────────────────────────────────────────────────────
  COGS:                 '5.1.01.01', // Costo de mercadería vendida
  // Compras que NO alimentan el kardex (servicios, gastos, compra agregada).
  // Ver forPurchase: debitar Inventario en esos casos inventa existencias.
  PURCHASES:            '5.1.02.01', // Compras (sistema periódico)
  INVENTORY_ADJUSTMENT_EXPENSE: '5.1.01.02', // Ajuste de inventario — merma (Fase 19)
  DEPRECIATION_EXPENSE: '5.2.01.05', // Gasto por depreciación
  WAGES_EXPENSE:        '6.1.01.01', // Sueldos y salarios
  CCSS_EXPENSE:         '6.1.02.01', // Cargas sociales patrono
  AGUINALDO_EXP:        '6.1.03.01', // Provisión aguinaldo

  // ── Contra-activo ───────────────────────────────────────────────
  ACCUMULATED_DEPRECIATION: '1.2.02.02', // Depreciación acumulada (general)
} as const;

export type AccountCode = typeof ACCOUNT_CODES[keyof typeof ACCOUNT_CODES];
