import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { FinancialStatementEngine } from './financial-statement.engine';

/**
 * ────────────────────────────────────────────────────────────────
 *  AccountingEngine  (Accounting Manifest §5 — invariantes verificables)
 *
 *  Guardas de runtime + helpers puros que blindan las leyes del motor.
 *  Los helpers puros (isBalanced, equationDiff, reconcileDiff) NO tocan
 *  la BD y se testean en aislamiento (accounting-engine.spec.ts).
 * ────────────────────────────────────────────────────────────────
 */

export const ACCOUNTING_TOLERANCE = new Decimal('0.01');

export interface InvariantCheck {
  ok: boolean;
  difference: string;
  detail?: Record<string, string>;
}

// ── Helpers puros (V-1, V-2, V-3/V-4) ───────────────────────────────────────

/** V-1 — Partida doble: Σdébitos = Σcréditos (tolerancia). */
export function isBalanced(
  lines: { debit: Decimal | number | string; credit: Decimal | number | string }[],
  tolerance: Decimal = ACCOUNTING_TOLERANCE,
): InvariantCheck {
  const totalDebit = lines.reduce((s, l) => s.plus(new Decimal(l.debit.toString())), new Decimal(0));
  const totalCredit = lines.reduce((s, l) => s.plus(new Decimal(l.credit.toString())), new Decimal(0));
  const difference = totalDebit.minus(totalCredit);
  return {
    ok: difference.abs().lessThanOrEqualTo(tolerance),
    difference: difference.toFixed(2),
    detail: { totalDebit: totalDebit.toFixed(2), totalCredit: totalCredit.toFixed(2) },
  };
}

/** V-2 — Ecuación contable: Activo = Pasivo + Patrimonio + (Ingresos − Gastos). */
export function equationDiff(
  t: { assets: Decimal; liabilities: Decimal; equity: Decimal; income: Decimal; expense: Decimal },
  tolerance: Decimal = ACCOUNTING_TOLERANCE,
): InvariantCheck {
  const netIncome = t.income.minus(t.expense);
  const rhs = t.liabilities.plus(t.equity).plus(netIncome);
  const difference = t.assets.minus(rhs);
  return {
    ok: difference.abs().lessThanOrEqualTo(tolerance),
    difference: difference.toFixed(2),
    detail: {
      assets: t.assets.toFixed(2),
      liabilities: t.liabilities.toFixed(2),
      equity: t.equity.toFixed(2),
      netIncome: netIncome.toFixed(2),
    },
  };
}

/** V-3/V-4 — Control = Σ subledger (o stock = Σ lotes). */
export function reconcileDiff(
  control: Decimal | number | string,
  subledger: Decimal | number | string,
  tolerance: Decimal = ACCOUNTING_TOLERANCE,
): InvariantCheck {
  const c = new Decimal(control.toString());
  const s = new Decimal(subledger.toString());
  const difference = c.minus(s);
  return {
    ok: difference.abs().lessThanOrEqualTo(tolerance),
    difference: difference.toFixed(2),
    detail: { control: c.toFixed(2), subledger: s.toFixed(2) },
  };
}

@Injectable()
export class AccountingEngine {
  private readonly logger = new Logger(AccountingEngine.name);

  constructor(private readonly statements: FinancialStatementEngine) {}

  /** V-1 — lanza si un asiento no cuadra. Usar antes de postear. */
  assertBalanced(lines: { debit: Decimal | number | string; credit: Decimal | number | string }[]) {
    const check = isBalanced(lines);
    if (!check.ok) {
      throw new BadRequestException(
        `Asiento descuadrado (V-1): débitos ${check.detail?.totalDebit} ≠ créditos ${check.detail?.totalCredit} ` +
        `(diferencia ${check.difference}).`,
      );
    }
    return check;
  }

  /** V-5 — todo asiento automático debe tener trazabilidad de su evento. */
  assertTraceable(entry: { source: string; sourceType?: string | null; sourceId?: string | null }) {
    const isManual = entry.source === 'MANUAL';
    if (!isManual && (!entry.sourceType || !entry.sourceId)) {
      throw new BadRequestException(
        `Asiento automático sin trazabilidad (V-5): falta sourceType/sourceId (source=${entry.source}).`,
      );
    }
  }

  /** V-2 — ecuación contable a una fecha; deriva del Diario. */
  async checkAccountingEquation(companyId: string, asOfDate?: Date): Promise<InvariantCheck> {
    const totals = await this.statements.totals(companyId, asOfDate);
    return equationDiff(totals);
  }

  /**
   * V-6 — testigo de escritura directa fuera del orquestador. No bloquea
   * (los escritores legacy —nómina, cierre, depreciación— se migran en F4);
   * deja rastro para detectarlos hasta entonces.
   */
  warnLegacyDirectWrite(source: string, companyId: string) {
    this.logger.warn(
      `[V-6] Asiento creado fuera de BusinessEventsService (source=${source}, company=${companyId}). ` +
      `Migrar al orquestador (Accounting Manifest I-AT-2, F4).`,
    );
  }
}
