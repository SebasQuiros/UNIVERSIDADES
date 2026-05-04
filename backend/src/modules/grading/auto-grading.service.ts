import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface RubricResult {
  rubricId:    string;
  criterion:   string;
  description: string;
  points:      number;
  passed:      boolean;
  detail:      string;
}

export interface AutoGradePreview {
  score:          number;
  maxScore:       number;
  earnedPoints:   number;
  totalPoints:    number;
  passedCount:    number;
  totalCount:     number;
  results:        RubricResult[];
  feedbackText:   string;
  rubricComments: Record<string, string>;
}

@Injectable()
export class AutoGradingService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Main entry point ────────────────────────────────────────────────────────
  async preview(attemptId: string, teacherId: string): Promise<AutoGradePreview> {
    const attempt = await this.prisma.exerciseAttempt.findUnique({
      where:   { id: attemptId },
      include: {
        exercise: {
          include: {
            rubrics: { orderBy: { order: 'asc' } },
            course:  { select: { teacherId: true } },
          },
        },
        student:         { select: { id: true, name: true, email: true } },
        company:         { select: { id: true } },
        studentProgress: true,
      },
    });

    if (!attempt) throw new NotFoundException('Intento no encontrado');
    if (attempt.exercise.course.teacherId !== teacherId) {
      throw new ForbiddenException('Solo el profesor del curso puede auto-calificar');
    }
    if (attempt.status === 'NOT_STARTED') {
      throw new BadRequestException('No se puede calificar un intento que no ha sido iniciado');
    }

    const rubrics = attempt.exercise.rubrics;
    if (rubrics.length === 0) {
      throw new BadRequestException('Este ejercicio no tiene rúbricas configuradas para auto-calificación');
    }

    const companyId = attempt.company?.id ?? null;

    // ── Gather company data in parallel ────────────────────────────────────────
    const [entries, invoicesCount, clientsCount, productsCount, journalLines, closingCheck] = await Promise.all([
      companyId
        ? this.prisma.journalEntry.findMany({
            where:   { companyId },
            include: { lines: true },
          })
        : Promise.resolve([]),
      companyId
        ? this.prisma.invoice.count({ where: { companyId } })
        : Promise.resolve(0),
      companyId
        ? this.prisma.client.count({ where: { companyId } })
        : Promise.resolve(0),
      companyId
        ? this.prisma.product.count({ where: { companyId } })
        : Promise.resolve(0),
      companyId
        ? this.prisma.journalLine.findMany({
            where:   { companyId },
            include: { account: { select: { code: true, type: true, normalBalance: true } } },
          })
        : Promise.resolve([]),
      // Check for closing entries: entries that debit income accounts or credit expense accounts
      companyId
        ? this.prisma.journalLine.findFirst({
            where: {
              entry: {
                companyId,
                isReversed: false,
              },
              OR: [
                // Income accounts being debited (closing revenues)
                {
                  debit: { gt: 0 },
                  account: { type: 'INCOME' },
                },
                // Expense accounts being credited (closing expenses)
                {
                  credit: { gt: 0 },
                  account: { type: 'EXPENSE' },
                },
              ],
            },
            include: { account: true },
          })
        : Promise.resolve(null),
    ]);

    const ctx: EvalContext = {
      entries, invoicesCount, clientsCount, productsCount,
      journalLines, companyId,
      progress: attempt.studentProgress,
      closingCheck,
    };

    // ── Evaluate each rubric ────────────────────────────────────────────────────
    const results: RubricResult[] = rubrics.map(r => {
      const { passed, detail } = this.evaluate(r.criterion, r.expectedValue ?? null, ctx);
      return {
        rubricId:    r.id,
        criterion:   r.criterion,
        description: r.description,
        points:      Number(r.points),
        passed,
        detail,
      };
    });

    // ── Score calculation ───────────────────────────────────────────────────────
    const maxScore     = Number(attempt.maxScore);
    const totalPoints  = results.reduce((s, r) => s + r.points, 0);
    const earnedPoints = results.filter(r => r.passed).reduce((s, r) => s + r.points, 0);
    const passedCount  = results.filter(r => r.passed).length;

    const score = totalPoints > 0
      ? Math.round((earnedPoints / totalPoints) * maxScore * 10) / 10
      : 0;

    // ── Structured feedback ─────────────────────────────────────────────────────
    const rubricComments: Record<string, string> = {};
    for (const r of results) {
      rubricComments[r.rubricId] = `${r.passed ? '✓' : '✗'} ${r.detail}`;
    }

    const feedbackText =
      `Auto-calificación: ${passedCount}/${results.length} criterios cumplidos (${earnedPoints.toFixed(1)}/${totalPoints.toFixed(1)} pts). ` +
      `Puntaje sugerido: ${score}/${maxScore}.`;

    return {
      score, maxScore, earnedPoints, totalPoints,
      passedCount, totalCount: results.length,
      results, feedbackText, rubricComments,
    };
  }

  // ── Criterion evaluator ─────────────────────────────────────────────────────
  private evaluate(criterion: string, expected: string | null, ctx: EvalContext): { passed: boolean; detail: string } {
    const { entries, invoicesCount, clientsCount, productsCount, journalLines, companyId, progress, closingCheck } = ctx;

    switch (criterion) {

      // ── Structural checks ────────────────────────────────────────────────
      case 'has_company':
        return { passed: !!companyId, detail: companyId ? 'Empresa creada' : 'Empresa no creada' };

      case 'has_issued_invoices': {
        const passed = invoicesCount > 0;
        return { passed, detail: passed ? `${invoicesCount} factura(s) emitida(s)` : 'Sin facturas emitidas' };
      }

      // ── Quantity checks ──────────────────────────────────────────────────
      case 'min_invoices': {
        const min = parseInt(expected ?? '1');
        return { passed: invoicesCount >= min, detail: `Facturas: ${invoicesCount} / ${min} requeridas` };
      }
      case 'min_journal_entries':
      case 'min_entries': {
        const min = parseInt(expected ?? '1');
        return { passed: entries.length >= min, detail: `Asientos: ${entries.length} / ${min} requeridos` };
      }
      case 'min_clients': {
        const min = parseInt(expected ?? '1');
        return { passed: clientsCount >= min, detail: `Clientes: ${clientsCount} / ${min} requeridos` };
      }
      case 'min_products': {
        const min = parseInt(expected ?? '1');
        return { passed: productsCount >= min, detail: `Productos: ${productsCount} / ${min} requeridos` };
      }
      case 'time_spent_min': {
        const min = parseInt(expected ?? '5');
        const spent = progress?.timeSpentMin ?? 0;
        return { passed: spent >= min, detail: `Tiempo dedicado: ${spent} min / ${min} min mínimos` };
      }

      // ── Accounting integrity ─────────────────────────────────────────────
      case 'balanced_entries': {
        if (entries.length === 0) return { passed: false, detail: 'No hay asientos contables' };
        const bad = entries.filter(e => {
          const d = e.lines.reduce((s: number, l: any) => s + Number(l.debit), 0);
          const c = e.lines.reduce((s: number, l: any) => s + Number(l.credit), 0);
          return Math.abs(d - c) > 0.01;
        });
        return bad.length === 0
          ? { passed: true,  detail: `Todos los ${entries.length} asientos están cuadrados (débito = crédito)` }
          : { passed: false, detail: `${bad.length} asiento(s) descuadrado(s): débitos ≠ créditos` };
      }

      case 'balance_sheet_balanced': {
        const bals = this.balancesByType(journalLines);
        const assets  = bals.filter(b => b.type === 'ASSET').reduce((s, b) => s + b.balance, 0);
        const liabEq  = bals.filter(b => b.type === 'LIABILITY' || b.type === 'EQUITY').reduce((s, b) => s + b.balance, 0);
        const diff    = Math.abs(assets - liabEq);
        const tol     = Math.max(assets * 0.001, 1);
        return diff <= tol
          ? { passed: true,  detail: `Balance cuadrado: Activos ₡${fmt(assets)} = Pasivo+Patrimonio ₡${fmt(liabEq)}` }
          : { passed: false, detail: `Balance descuadrado: Activos ₡${fmt(assets)} ≠ Pasivo+Patrimonio ₡${fmt(liabEq)} (dif. ₡${fmt(diff)})` };
      }

      case 'income_statement_positive': {
        const bals    = this.balancesByType(journalLines);
        const income  = bals.filter(b => b.type === 'INCOME').reduce((s, b) => s + b.balance, 0);
        const expense = bals.filter(b => b.type === 'EXPENSE').reduce((s, b) => s + b.balance, 0);
        const net     = income - expense;
        return {
          passed: net > 0,
          detail: `Resultado neto: ₡${fmt(net)} (Ingresos ₡${fmt(income)} - Gastos ₡${fmt(expense)})`,
        };
      }

      // ── Special entries ──────────────────────────────────────────────────
      case 'has_closing_entries': {
        const hasClosingEntries = closingCheck !== null;
        return {
          passed: hasClosingEntries,
          detail: hasClosingEntries
            ? 'Asientos de cierre registrados (débito a ingresos o crédito a gastos)'
            : 'Sin asientos de cierre válidos (se requiere débito a cuentas de ingresos o crédito a cuentas de gastos)',
        };
      }

      case 'has_adjustment_entries': {
        const has = entries.some(e =>
          (e.reference ?? '').toUpperCase().startsWith('ADJ') ||
          (e.description ?? '').toLowerCase().includes('ajuste'),
        );
        return { passed: has, detail: has ? 'Asientos de ajuste registrados' : 'Sin asientos de ajuste' };
      }

      // ── Account balance checks ────────────────────────────────────────────
      // expectedValue format: "CODE:AMOUNT" e.g. "1.1.01:500000"
      case 'account_balance_gte':
      case 'account_balance_lte':
      case 'account_balance_eq': {
        if (!expected) return { passed: false, detail: 'Sin valor esperado definido' };
        const sepIdx = expected.lastIndexOf(':');
        if (sepIdx === -1) return { passed: false, detail: `Formato inválido (use "CODIGO:MONTO")` };
        const code   = expected.slice(0, sepIdx).trim();
        const target = parseFloat(expected.slice(sepIdx + 1).trim());
        if (isNaN(target)) return { passed: false, detail: `Monto inválido: "${expected.slice(sepIdx + 1)}"` };

        const accLines = journalLines.filter(l =>
          l.account.code === code || l.account.code.startsWith(code + '.'),
        );
        if (accLines.length === 0) {
          return { passed: false, detail: `Cuenta ${code} sin movimientos` };
        }
        const balance = this.accountBalance(accLines, accLines[0].account.normalBalance);
        const op = criterion === 'account_balance_gte' ? '>=' : criterion === 'account_balance_lte' ? '<=' : '≈';
        const passed = criterion === 'account_balance_gte' ? balance >= target
                      : criterion === 'account_balance_lte' ? balance <= target
                      : Math.abs(balance - target) / Math.max(Math.abs(target), 1) < 0.01;
        return {
          passed,
          detail: `Cuenta ${code}: saldo ₡${fmt(balance)} (esperado ${op} ₡${fmt(target)})`,
        };
      }

      default:
        return { passed: false, detail: `Criterio "${criterion}" no reconocido` };
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  private balancesByType(lines: any[]): Array<{ type: string; balance: number }> {
    const map = new Map<string, { type: string; nb: string; d: number; c: number }>();
    for (const l of lines) {
      const k = l.account.code;
      if (!map.has(k)) map.set(k, { type: l.account.type, nb: l.account.normalBalance, d: 0, c: 0 });
      const e = map.get(k)!;
      e.d += Number(l.debit);
      e.c += Number(l.credit);
    }
    return Array.from(map.values()).map(a => ({
      type:    a.type,
      balance: a.nb === 'DEBIT' ? a.d - a.c : a.c - a.d,
    }));
  }

  private accountBalance(lines: any[], normalBalance: string): number {
    const d = lines.reduce((s, l) => s + Number(l.debit), 0);
    const c = lines.reduce((s, l) => s + Number(l.credit), 0);
    return normalBalance === 'DEBIT' ? d - c : c - d;
  }
}

interface EvalContext {
  entries:        any[];
  invoicesCount:  number;
  clientsCount:   number;
  productsCount:  number;
  journalLines:   any[];
  companyId:      string | null;
  progress:       any;
  closingCheck:   any | null;
}

function fmt(n: number): string {
  return n.toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
