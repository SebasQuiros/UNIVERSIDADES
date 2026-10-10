import { Injectable } from '@nestjs/common';
import { ACCOUNT_CODES } from './constants/account-codes';

/**
 * ────────────────────────────────────────────────────────────────
 *  Rules Engine
 *
 *  Función pura: dado un evento de negocio, devuelve las líneas
 *  contables (débito/crédito) que lo representan. NO toca la BD.
 *
 *  Hoy las reglas viven en código (constantes). Si en el futuro
 *  hace falta personalización por empresa, se pueden mover a una
 *  tabla `accounting_rules` sin cambiar la firma de los métodos.
 *
 *  Cada método retorna:
 *    {
 *      lines: [{ accountCode, debit, credit, description }],
 *      description: string,        // descripción del asiento
 *      sourceType: string,         // 'sale','purchase','collection','payment','payroll'
 *    }
 * ────────────────────────────────────────────────────────────────
 */

export type PaymentType = 'CASH' | 'CREDIT';

export interface JournalLineSpec {
  accountCode: string;
  debit:       number;
  credit:      number;
  description: string;
}

export interface JournalEntrySpec {
  description: string;
  sourceType:  string;
  lines:       JournalLineSpec[];
}

// ── Inputs ────────────────────────────────────────────────────────

export interface SaleInput {
  /** Monto de venta antes de impuestos */
  subtotal:           number;
  /** IVA cobrado al cliente */
  taxAmount:          number;
  /** Total = subtotal + tax */
  total:              number;
  /** Costo de la mercadería vendida (0 para servicios) */
  totalCost:          number;
  /** CASH: ingresa al efectivo. CREDIT: queda como cuenta por cobrar. */
  paymentType:        PaymentType;
  /** Ej. "FE-001" */
  documentReference:  string;
  /** Ej. nombre del cliente */
  counterpartyLabel:  string;
}

export interface PurchaseInput {
  subtotal:          number;
  taxAmount:         number;
  total:             number;
  paymentType:       PaymentType;
  documentReference: string;
  counterpartyLabel: string;
  /**
   * Cuenta que recibe el débito.
   *
   * Solo una compra que de verdad entra al kardex debe debitar Inventario.
   * Una compra de servicios, un recibo de electricidad o una compra agregada
   * sin líneas de producto no crean existencias: debitarlas a Inventario
   * infla el activo, esconde el gasto, y deja el kardex diciendo una cosa y
   * el balance otra — con la partida doble cuadrando igual.
   *
   * Si no viene, se asume compra sin kardex y va a Compras (periódico).
   */
  debitAccountCode?: string;
}

/**
 * Medio de pago. Decide SI la plata pasa por caja o por el banco, que es una
 * distincion contable real: no es lo mismo tener el efectivo en la gaveta que
 * tenerlo depositado, y la conciliacion bancaria depende de que el banco
 * refleje solo lo que de verdad paso por el banco.
 */
export type MedioDePago = 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD';

/** Caja si fue efectivo; la cuenta bancaria en cualquier otro caso. */
export function cuentaDeTesoreria(metodo?: MedioDePago | string | null): string {
  return (metodo ?? 'TRANSFER') === 'CASH' ? ACCOUNT_CODES.CASH : ACCOUNT_CODES.BANK;
}

/** true si el movimiento pasa por el banco y debe aparecer en su libro. */
export function pasaPorBanco(metodo?: MedioDePago | string | null): boolean {
  return (metodo ?? 'TRANSFER') !== 'CASH';
}

export interface CollectionInput {
  amount:            number;
  documentReference: string;  // factura
  counterpartyLabel: string;  // cliente
  /** Si no viene, se asume transferencia (lo mas comun en una cobranza). */
  paymentMethod?:    MedioDePago | string;
}

export interface PaymentInput {
  amount:            number;
  documentReference: string;  // factura de compra
  counterpartyLabel: string;  // proveedor
  paymentMethod?:    MedioDePago | string;
}

@Injectable()
export class RulesEngineService {
  /**
   * Venta a contado:
   *   D Caja
   *   C Ventas
   *   C IVA por pagar
   *   D Costo                (si hay inventario)
   *   C Inventario           (si hay inventario)
   *
   * Venta a crédito:
   *   D Cuentas por cobrar  (en lugar de Caja)
   *   ... (igual al resto)
   */
  forSale(input: SaleInput): JournalEntrySpec {
    const debitAccount = input.paymentType === 'CASH'
      ? ACCOUNT_CODES.CASH
      : ACCOUNT_CODES.ACCOUNTS_RECEIVABLE;

    const lines: JournalLineSpec[] = [
      {
        accountCode: debitAccount,
        debit:       input.total,
        credit:      0,
        description: `${input.paymentType === 'CASH' ? 'Cobro' : 'Cuenta por cobrar'} ${input.documentReference}`,
      },
      {
        accountCode: ACCOUNT_CODES.REVENUE_SALES,
        debit:       0,
        credit:      input.subtotal,
        description: `Venta ${input.documentReference}`,
      },
    ];

    if (input.taxAmount > 0) {
      lines.push({
        accountCode: ACCOUNT_CODES.IVA_PAYABLE,
        debit:       0,
        credit:      input.taxAmount,
        description: `IVA por pagar ${input.documentReference}`,
      });
    }

    if (input.totalCost > 0) {
      // Asiento adicional COGS — emitido como entrada separada para mantener
      // legibilidad en el libro diario (el accounting engine los crea como
      // dos asientos consecutivos).
      lines.push({
        accountCode: ACCOUNT_CODES.COGS,
        debit:       input.totalCost,
        credit:      0,
        description: `Costo de mercadería vendida ${input.documentReference}`,
      });
      lines.push({
        accountCode: ACCOUNT_CODES.INVENTORY,
        debit:       0,
        credit:      input.totalCost,
        description: `Salida de inventario ${input.documentReference}`,
      });
    }

    return {
      sourceType:  'sale',
      description: `Venta ${input.documentReference} — ${input.counterpartyLabel}`,
      lines,
    };
  }

  /**
   * Compra a contado:
   *   D Inventario (si alimenta el kardex) o Compras
   *   D IVA crédito  (si hay)
   *   C Caja
   *
   * Compra a crédito:
   *   D Inventario o Compras
   *   D IVA crédito
   *   C Cuentas por pagar
   *
   * Quién decide cuál de las dos: ver `debitAccountCode` en PurchaseInput.
   */
  forPurchase(input: PurchaseInput): JournalEntrySpec {
    const creditAccount = input.paymentType === 'CASH'
      ? ACCOUNT_CODES.CASH
      : ACCOUNT_CODES.ACCOUNTS_PAYABLE;

    const lines: JournalLineSpec[] = [
      {
        accountCode: input.debitAccountCode ?? ACCOUNT_CODES.PURCHASES,
        debit:       input.subtotal,
        credit:      0,
        description: `Compra ${input.documentReference}`,
      },
    ];

    if (input.taxAmount > 0) {
      lines.push({
        accountCode: ACCOUNT_CODES.IVA_CREDIT,
        debit:       input.taxAmount,
        credit:      0,
        description: `IVA crédito fiscal ${input.documentReference}`,
      });
    }

    lines.push({
      accountCode: creditAccount,
      debit:       0,
      credit:      input.total,
      description: `${input.paymentType === 'CASH' ? 'Pago' : 'Cuenta por pagar'} ${input.documentReference}`,
    });

    return {
      sourceType:  'purchase',
      description: `Compra ${input.documentReference} — ${input.counterpartyLabel}`,
      lines,
    };
  }

  /**
   * Cobro al cliente (collection): el cliente paga una cuenta por cobrar.
   *   D Caja o Banco, segun el medio de pago
   *   C Cuentas por cobrar
   *
   * Antes siempre debitaba Caja. El estudiante elegia "transferencia" y la
   * plata entraba igual a la gaveta: la cuenta bancaria nunca se movia.
   */
  forCollection(input: CollectionInput): JournalEntrySpec {
    const tesoreria = cuentaDeTesoreria(input.paymentMethod);
    return {
      sourceType:  'collection',
      description: `Cobro ${input.documentReference} — ${input.counterpartyLabel}`,
      lines: [
        {
          accountCode: tesoreria,
          debit:       input.amount,
          credit:      0,
          description: `Cobro ${input.documentReference}`,
        },
        {
          accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
          debit:       0,
          credit:      input.amount,
          description: `Aplicación cobro ${input.documentReference}`,
        },
      ],
    };
  }

  /**
   * Pago al proveedor (payment): pagamos una cuenta por pagar.
   *   D Cuentas por pagar
   *   C Caja o Banco, segun el medio de pago
   */
  forPayment(input: PaymentInput): JournalEntrySpec {
    const tesoreria = cuentaDeTesoreria(input.paymentMethod);
    return {
      sourceType:  'payment',
      description: `Pago ${input.documentReference} — ${input.counterpartyLabel}`,
      lines: [
        {
          accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE,
          debit:       input.amount,
          credit:      0,
          description: `Aplicación pago ${input.documentReference}`,
        },
        {
          accountCode: tesoreria,
          debit:       0,
          credit:      input.amount,
          description: `Pago ${input.documentReference}`,
        },
      ],
    };
  }
}
