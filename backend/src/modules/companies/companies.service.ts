import {
  Injectable, NotFoundException,
  ConflictException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/companies.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma:   PrismaService,
    private readonly accounts: AccountsService,
  ) {}

  // ── Get company by student ────────────────────────────────────
  // Fase 1: incluye companies INDIVIDUAL (dueño directo) + GROUP donde
  // el estudiante figura en CompanyMembership.
  async findByStudent(studentId: string) {
    const companies = await this.prisma.company.findMany({
      where: {
        OR: [
          { studentId },
          { memberships: { some: { userId: studentId } } },
        ],
      },
      include: {
        // attempt es null para GROUP — el frontend debe tolerarlo.
        attempt: {
          select: { id: true, status: true, exercise: { select: { id: true, title: true, course: { select: { name: true } } } } },
        },
        // Para GROUP companies devolvemos el exercise directo y un flag de membership.
        exercise: { select: { id: true, title: true, course: { select: { name: true } } } },
        // Rol del estudiante en esta empresa (si es GROUP)
        memberships: {
          where:  { userId: studentId },
          select: { role: true },
          take:   1,
        },
        // Conteos rápidos para KPIs en la tarjeta
        _count: { select: { memberships: true, invoices: true, journalEntries: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Normalizar: exponer mode, myRole, conteo de miembros y un exercise unificado.
    return companies.map(c => {
      const { memberships, _count, ...rest } = c;
      return {
        ...rest,
        myRole:        memberships[0]?.role ?? (c.mode === 'INDIVIDUAL' ? 'OWNER' : 'MEMBER'),
        memberCount:   c.mode === 'GROUP' ? _count.memberships : 1,
        invoiceCount:  _count.invoices,
        entryCount:    _count.journalEntries,
        // exercise unificado: directo (GROUP) o vía attempt (INDIVIDUAL)
        linkedExercise: c.exercise ?? c.attempt?.exercise ?? null,
      };
    });
  }

  // ── Get company by attempt ────────────────────────────────────
  // Acceso permitido a:
  //   · El estudiante dueño de la empresa
  //   · TEACHER / ADMIN / SUPERADMIN (con aislamiento por universidad)
  // Esto es consistente con CompanyOwnerGuard usado en los endpoints
  // /companies/:companyId/* — el profesor puede VER las empresas de sus
  // estudiantes para calificar.
  async findByAttempt(attemptId: string, userId: string, userRole = 'STUDENT', universityId?: string | null) {
    const company = await this.prisma.company.findUnique({
      where: { attemptId },
      include: {
        student: { select: { universityId: true } },
      },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada para este intento');

    // SUPERADMIN: acceso global
    if (userRole === 'SUPERADMIN') return company;

    // STUDENT: dueño INDIVIDUAL o miembro GROUP.
    if (userRole === 'STUDENT') {
      if (company.studentId === userId) return company;
      const member = await this.prisma.companyMembership.findUnique({
        where: { companyId_userId: { companyId: company.id, userId } },
        select: { id: true },
      });
      if (!member) {
        throw new ForbiddenException('No tienes acceso a esta empresa');
      }
      return company;
    }

    // TEACHER / ADMIN: solo si pertenece a su misma universidad
    if (userRole === 'TEACHER' || userRole === 'ADMIN') {
      if (universityId && company.student?.universityId !== universityId) {
        throw new ForbiddenException('No tienes acceso a empresas de otras universidades');
      }
      return company;
    }

    throw new ForbiddenException('No tienes acceso a esta empresa');
  }

  // ── Get one company ───────────────────────────────────────────
  // Fase 1: estudiantes pueden acceder si son dueños INDIVIDUAL o miembros GROUP.
  // El check global lo hace CompanyOwnerGuard; este método es defensivo para
  // callers que llaman al service directamente.
  async findOne(companyId: string, studentId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        memberships: {
          where:  { userId: studentId },
          select: { id: true },
          take:   1,
        },
      },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');

    const isOwnerIndividual =
      company.mode === 'INDIVIDUAL' && company.studentId === studentId;
    const isMemberGroup =
      company.mode === 'GROUP' && company.memberships.length > 0;
    if (!isOwnerIndividual && !isMemberGroup) {
      throw new ForbiddenException('No tienes acceso a esta empresa');
    }
    // No exponemos `memberships` al caller — fue solo para auth.
    const { memberships: _m, ...rest } = company;
    return rest;
  }

  // ── Create company + seed chart of accounts ───────────────────
  async create(attemptId: string, studentId: string, dto: CreateCompanyDto) {
    // Verify attempt belongs to student
    const attempt = await this.prisma.exerciseAttempt.findFirst({
      where: { id: attemptId, studentId },
    });
    if (!attempt) {
      throw new NotFoundException('Intento de ejercicio no encontrado');
    }

    // One company per attempt
    const existing = await this.prisma.company.findUnique({
      where: { attemptId },
    });
    if (existing) {
      throw new ConflictException(
        'Ya existe una empresa para este ejercicio. Solo se permite una empresa por intento.',
      );
    }

    // Create company
    const company = await this.prisma.company.create({
      data: {
        attemptId,
        studentId,
        name:             dto.name,
        legalId:          dto.legalId,
        legalIdType:      dto.legalIdType,
        economicActivity: dto.economicActivity,
        address:          dto.address ?? null,
        phone:            dto.phone   ?? null,
        email:            dto.email   ?? null,
        currency:         'CRC',
      },
    });

    // Seed chart of accounts automatically (50 accounts)
    await this.accounts.seedChartOfAccounts(company.id);

    return company;
  }

  // ── Update company info ───────────────────────────────────────
  async update(companyId: string, dto: UpdateCompanyDto) {
    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...(dto.name    && { name:    dto.name    }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.phone   !== undefined && { phone:   dto.phone   }),
        ...(dto.email   !== undefined && { email:   dto.email   }),
        updatedAt: new Date(),
      },
    });
  }

  // ── Dashboard summary ─────────────────────────────────────────
  async getDashboard(companyId: string) {
    const num = (v: any) => Number(v ?? 0);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [
      invoices, clients, products, entries,
      salesAgg, purchasesAgg,
      arAgg, apAgg,
      ivaCobrado, ivaPagado,
      recentInvoices, monthlyRows,
    ] = await Promise.all([
      // ── Conteos ──
      this.prisma.invoice.count({ where: { companyId, status: { not: 'DRAFT' as any } } }),
      this.prisma.client.count({ where: { companyId, isActive: true } }),
      this.prisma.product.count({ where: { companyId, isActive: true } }),
      this.prisma.journalEntry.count({ where: { companyId, isReversed: false } }),

      // ── Ventas (subtotal sin IVA + IVA) ──
      this.prisma.invoice.aggregate({
        where: { companyId, status: { not: 'DRAFT' as any } },
        _sum:  { total: true, subtotal: true, tax: true },
      }),
      // ── Compras ──
      this.prisma.purchaseInvoice.aggregate({
        where: { companyId },
        _sum:  { total: true, subtotal: true, taxAmount: true },
      }).catch(() => ({ _sum: { total: 0, subtotal: 0, taxAmount: 0 } } as any)),

      // ── Cuentas por cobrar pendientes ──
      this.prisma.accountReceivable.aggregate({
        where: { companyId, status: { in: ['PENDING', 'PARTIAL'] as any } },
        _sum:  { balance: true }, _count: true,
      }),
      // ── Cuentas por pagar pendientes ──
      this.prisma.accountPayable.aggregate({
        where: { companyId, status: { in: ['PENDING', 'PARTIAL'] as any } },
        _sum:  { balance: true }, _count: true,
      }),

      // ── IVA cobrado (débito fiscal) ──
      this.prisma.invoice.aggregate({
        where: { companyId, status: { not: 'DRAFT' as any } },
        _sum:  { tax: true },
      }),
      // ── IVA pagado (crédito fiscal) ──
      this.prisma.purchaseInvoice.aggregate({
        where: { companyId },
        _sum:  { taxAmount: true },
      }).catch(() => ({ _sum: { taxAmount: 0 } } as any)),

      // ── Facturas recientes ──
      this.prisma.invoice.findMany({
        where:   { companyId },
        orderBy: { createdAt: 'desc' },
        take:    6,
        select: {
          id: true, consecutiveNumber: true, clientName: true,
          total: true, status: true, haciendaStatus: true, createdAt: true,
        },
      }),

      // ── Tendencia de ventas (últimos 6 meses) ──
      this.prisma.$queryRaw<Array<{ month: string; total: number }>>`
        SELECT to_char(date_trunc('month', issue_date), 'YYYY-MM') AS month,
               COALESCE(SUM(total), 0)::float8 AS total
        FROM invoices
        WHERE company_id = ${companyId}::uuid
          AND status <> 'DRAFT'
          AND issue_date >= ${sixMonthsAgo}
        GROUP BY 1 ORDER BY 1
      `.catch(() => [] as Array<{ month: string; total: number }>),
    ]);

    // ── Construir serie continua de 6 meses (rellena vacíos con 0) ──
    const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Set','Oct','Nov','Dic'];
    const trendMap = new Map(monthlyRows.map(r => [r.month, num(r.total)]));
    const salesTrend: Array<{ label: string; total: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      salesTrend.push({ label: `${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`, total: trendMap.get(key) ?? 0 });
    }

    const totalSales     = num(salesAgg._sum.total);
    const totalSalesBase = num(salesAgg._sum.subtotal);
    const totalPurchases = num(purchasesAgg._sum.total);
    const ivaPosition    = num(ivaCobrado._sum.tax) - num(ivaPagado._sum.taxAmount);

    return {
      totals: {
        invoices,
        clients,
        products,
        journalEntries: entries,
        totalSales,
        totalSalesBase,
        totalPurchases,
        grossMargin: totalSalesBase - num(purchasesAgg._sum.subtotal),
      },
      receivables: { outstanding: num(arAgg._sum.balance), count: arAgg._count },
      payables:    { outstanding: num(apAgg._sum.balance), count: apAgg._count },
      tax: {
        ivaCobrado: num(ivaCobrado._sum.tax),
        ivaPagado:  num(ivaPagado._sum.taxAmount),
        ivaPosition,                         // > 0 a pagar, < 0 saldo a favor
      },
      salesTrend,
      recentInvoices,
    };
  }

  // ── Valoración bursátil simulada ──────────────────────────────
  // Calcula un "precio de acción" y market cap a partir de la contabilidad
  // REAL de la empresa del estudiante (no hay bolsa real: la empresa es ficticia).
  // El precio sube cuando llevan bien los libros (patrimonio, utilidad, ratios)
  // y baja con pérdidas/insolvencia. Fines 100% educativos.
  async getValuation(companyId: string) {
    const num = (v: any) => Number(v ?? 0);
    const SHARES = 10_000;           // acciones en circulación (fijo)
    const PE_MULTIPLE = 6;           // múltiplo precio/utilidad

    // 1) Saldos por cuenta (una sola groupBy) ───────────────────
    const accounts = await this.prisma.account.findMany({
      where:  { companyId, isActive: true },
      select: { id: true, code: true, type: true, normalBalance: true },
    });
    const ids = accounts.map(a => a.id);
    const agg = ids.length === 0 ? [] : await this.prisma.journalLine.groupBy({
      by:    ['accountId'],
      where: { companyId, accountId: { in: ids }, entry: { isReversed: false, status: 'CONFIRMED' as any } },
      _sum:  { debit: true, credit: true },
    });
    const aggMap = new Map(agg.map(r => [r.accountId, { d: num(r._sum.debit), c: num(r._sum.credit) }]));

    let totalAssets = 0, currentAssets = 0, totalLiabilities = 0, currentLiabilities = 0;
    let totalIncome = 0, totalExpenses = 0;
    for (const a of accounts) {
      const m = aggMap.get(a.id) ?? { d: 0, c: 0 };
      const bal = a.normalBalance === 'DEBIT' ? m.d - m.c : m.c - m.d;
      if (a.type === 'ASSET')      { totalAssets += bal; if (a.code.startsWith('1.1')) currentAssets += bal; }
      else if (a.type === 'LIABILITY') { totalLiabilities += bal; if (a.code.startsWith('2.1')) currentLiabilities += bal; }
      else if (a.type === 'INCOME')    totalIncome   += bal;
      else if (a.type === 'EXPENSE')   totalExpenses += bal;
    }

    const equity    = totalAssets - totalLiabilities;       // patrimonio real (incl. resultado)
    const netIncome = totalIncome - totalExpenses;

    // 2) Ratios financieros ─────────────────────────────────────
    const netMargin    = totalIncome > 0 ? netIncome / totalIncome : 0;
    const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : (currentAssets > 0 ? 3 : 0);
    const debtRatio    = totalAssets > 0 ? totalLiabilities / totalAssets : 0;
    const roe          = equity > 0 ? netIncome / equity : 0;

    // 3) Health score 0-100 ─────────────────────────────────────
    let score = 50;
    score += Math.max(-20, Math.min(20, netMargin * 80));
    score += currentRatio >= 1.5 ? 15 : currentRatio >= 1 ? 8 : -10;
    score += debtRatio <= 0.4 ? 10 : debtRatio <= 0.6 ? 4 : debtRatio > 0.8 ? -12 : 0;
    score += roe >= 0.15 ? 10 : roe > 0 ? 4 : roe < 0 ? -10 : 0;
    score = Math.max(0, Math.min(100, Math.round(score)));

    const rating =
      score >= 85 ? 'AAA' : score >= 72 ? 'AA' : score >= 60 ? 'A' :
      score >= 45 ? 'BBB' : score >= 32 ? 'BB' : score >= 20 ? 'B' : 'CCC';

    // 4) Market cap + precio de acción ──────────────────────────
    const bookComp  = Math.max(equity, 0);
    const earnComp  = Math.max(netIncome, 0) * PE_MULTIPLE;
    const revComp   = totalIncome * 0.6;
    let   marketCap = 0.5 * bookComp + 0.35 * earnComp + 0.15 * revComp;
    const healthMult = 0.7 + (score / 100) * 0.6;            // 0.7 .. 1.3
    marketCap *= healthMult;
    if (equity <= 0) marketCap *= 0.3;                       // insolvencia castiga fuerte
    marketCap = Math.max(0, Math.round(marketCap));
    const sharePrice = marketCap / SHARES;

    // 5) Histórico de precio (6 meses, derivado de la actividad real) ──
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1); sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyRows = await this.prisma.$queryRaw<Array<{ month: string; income: number; expense: number }>>`
      SELECT to_char(date_trunc('month', je.entry_date), 'YYYY-MM') AS month,
             COALESCE(SUM(CASE WHEN a.type::text = 'INCOME'  THEN jl.credit - jl.debit ELSE 0 END), 0)::float8 AS income,
             COALESCE(SUM(CASE WHEN a.type::text = 'EXPENSE' THEN jl.debit - jl.credit ELSE 0 END), 0)::float8 AS expense
      FROM journal_lines jl
      JOIN accounts a          ON a.id  = jl.account_id
      JOIN journal_entries je  ON je.id = jl.entry_id
      WHERE jl.company_id = ${companyId}::uuid
        AND je.is_reversed = false
        AND je.status = 'CONFIRMED'
        AND je.entry_date >= ${sixMonthsAgo}
      GROUP BY 1 ORDER BY 1
    `.catch(() => [] as Array<{ month: string; income: number; expense: number }>);

    const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Set','Oct','Nov','Dic'];
    const mMap = new Map(monthlyRows.map(r => [r.month, { income: num(r.income), expense: num(r.expense) }]));

    // Valoración cruda acumulada por mes; luego se escala para que el último
    // punto coincida con el precio actual (consistencia visual).
    let cumNet = 0, cumRev = 0;
    const raw: Array<{ label: string; v: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const row = mMap.get(key) ?? { income: 0, expense: 0 };
      cumNet += row.income - row.expense;
      cumRev += row.income;
      const v = 0.5 * Math.max(equity, 0) + 0.35 * Math.max(cumNet, 0) * PE_MULTIPLE + 0.15 * cumRev * 0.6;
      raw.push({ label: `${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`, v });
    }
    const lastRaw = raw[raw.length - 1]?.v ?? 0;
    const scale = lastRaw > 0 ? sharePrice / (lastRaw / SHARES) : 0;
    const priceHistory = raw.map((p, i) => ({
      label: p.label,
      price: lastRaw > 0
        ? Math.round((p.v / SHARES) * scale * 100) / 100
        : Math.round((sharePrice * (i + 1) / raw.length) * 100) / 100,
    }));

    const prevPrice  = priceHistory.length >= 2 ? priceHistory[priceHistory.length - 2].price : sharePrice;
    const changeAbs  = sharePrice - prevPrice;
    const changePct  = prevPrice > 0 ? (changeAbs / prevPrice) * 100 : 0;

    return {
      ticker: 'Empresa',                  // el frontend puede derivar siglas del nombre
      sharePrice,
      marketCap,
      sharesOutstanding: SHARES,
      change: { abs: Math.round(changeAbs * 100) / 100, pct: Math.round(changePct * 100) / 100 },
      rating,
      healthScore: score,
      financials: {
        totalAssets, totalLiabilities, equity,
        totalIncome, totalExpenses, netIncome,
      },
      ratios: {
        netMargin:    Math.round(netMargin * 1000) / 10,     // %
        currentRatio: Math.round(currentRatio * 100) / 100,
        debtRatio:    Math.round(debtRatio * 1000) / 10,     // %
        roe:          Math.round(roe * 1000) / 10,           // %
      },
      priceHistory,
    };
  }

  /**
   * IA Gerente Financiero (determinista, sin LLM): analiza los libros de la
   * empresa y devuelve alertas + consejos accionables. Funciona siempre,
   * incluso sin ANTHROPIC_API_KEY, porque las reglas se derivan de la contabilidad.
   */
  async getFinancialAdvisor(companyId: string) {
    const num = (v: any) => Number(v ?? 0);

    const accounts = await this.prisma.account.findMany({
      where:  { companyId, isActive: true },
      select: { id: true, code: true, name: true, type: true, normalBalance: true },
    });
    const ids = accounts.map(a => a.id);
    const agg = ids.length === 0 ? [] : await this.prisma.journalLine.groupBy({
      by:    ['accountId'],
      where: { companyId, accountId: { in: ids }, entry: { isReversed: false, status: 'CONFIRMED' as any } },
      _sum:  { debit: true, credit: true },
    });
    const aggMap = new Map(agg.map(r => [r.accountId, { d: num(r._sum.debit), c: num(r._sum.credit) }]));

    let totalAssets = 0, currentAssets = 0, totalLiabilities = 0, currentLiabilities = 0;
    let totalIncome = 0, totalExpenses = 0;
    let cash = 0, receivables = 0, payables = 0, ivaPorPagar = 0;
    for (const a of accounts) {
      const m = aggMap.get(a.id) ?? { d: 0, c: 0 };
      const bal = a.normalBalance === 'DEBIT' ? m.d - m.c : m.c - m.d;
      const name = (a.name || '').toLowerCase();
      if (a.type === 'ASSET') {
        totalAssets += bal;
        if (a.code.startsWith('1.1')) currentAssets += bal;
        if (a.code.startsWith('1.1.1') || name.includes('caja') || name.includes('banco') || name.includes('efectivo')) cash += bal;
        if (name.includes('cobrar') || name.includes('clientes')) receivables += bal;
      } else if (a.type === 'LIABILITY') {
        totalLiabilities += bal;
        if (a.code.startsWith('2.1')) currentLiabilities += bal;
        if (name.includes('pagar') && (name.includes('proveedor') || name.includes('cuentas'))) payables += bal;
        if (name.includes('iva') || name.includes('impuesto')) ivaPorPagar += bal;
      } else if (a.type === 'INCOME')  totalIncome   += bal;
      else if (a.type === 'EXPENSE')   totalExpenses += bal;
    }

    const equity       = totalAssets - totalLiabilities;
    const netIncome    = totalIncome - totalExpenses;
    const netMargin    = totalIncome > 0 ? netIncome / totalIncome : 0;
    const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : (currentAssets > 0 ? 3 : 0);
    const debtRatio    = totalAssets > 0 ? totalLiabilities / totalAssets : 0;
    const roe          = equity > 0 ? netIncome / equity : 0;
    const fmt = (n: number) => '₡' + Math.round(n).toLocaleString('es-CR');

    type Insight = {
      level: 'critical' | 'warning' | 'good' | 'info';
      title: string;
      detail: string;
      action?: string;
    };
    const insights: Insight[] = [];

    // ── Liquidez ────────────────────────────────────────────────
    if (currentLiabilities > 0 && currentRatio < 1) {
      insights.push({
        level: 'critical',
        title: 'Riesgo de liquidez',
        detail: `Tu razón corriente es ${currentRatio.toFixed(2)}x: el activo circulante (${fmt(currentAssets)}) no cubre el pasivo circulante (${fmt(currentLiabilities)}).`,
        action: 'Acelera la cobranza de clientes o renegocia plazos con proveedores antes de asumir nuevas deudas.',
      });
    } else if (currentRatio >= 1.5) {
      insights.push({
        level: 'good',
        title: 'Buena liquidez',
        detail: `Razón corriente de ${currentRatio.toFixed(2)}x: puedes cubrir holgadamente tus obligaciones de corto plazo.`,
      });
    }

    // ── Caja ────────────────────────────────────────────────────
    if (cash <= 0 && totalAssets > 0) {
      insights.push({
        level: 'critical',
        title: 'Sin efectivo disponible',
        detail: 'El saldo de caja/bancos es cero o negativo. Una empresa sin liquidez no puede operar aunque sea rentable.',
        action: 'Registra cobros pendientes o un aporte de capital para restablecer el flujo de caja.',
      });
    } else if (cash > 0 && currentLiabilities > 0 && cash < currentLiabilities * 0.2) {
      insights.push({
        level: 'warning',
        title: 'Colchón de caja bajo',
        detail: `Tu efectivo (${fmt(cash)}) es menor al 20% de tus deudas de corto plazo (${fmt(currentLiabilities)}).`,
        action: 'Mantén una reserva de caja para imprevistos.',
      });
    }

    // ── Cuentas por cobrar ──────────────────────────────────────
    if (receivables > 0 && totalIncome > 0 && receivables > totalIncome * 0.4) {
      insights.push({
        level: 'warning',
        title: 'Mucho dinero en cuentas por cobrar',
        detail: `Tienes ${fmt(receivables)} por cobrar, equivalente a más del 40% de tus ingresos. La venta a crédito sin cobranza ahoga el flujo.`,
        action: 'Da seguimiento a la morosidad y considera políticas de cobro más estrictas.',
      });
    }

    // ── IVA por pagar ───────────────────────────────────────────
    if (ivaPorPagar > 0) {
      insights.push({
        level: ivaPorPagar > cash && cash >= 0 ? 'warning' : 'info',
        title: 'IVA pendiente de declarar',
        detail: `Adeudas ${fmt(ivaPorPagar)} de impuestos (IVA u otros). Recuerda que el D-104 se presenta y paga dentro de los primeros 15 días naturales del mes siguiente.`,
        action: ivaPorPagar > cash ? 'Aparta efectivo: el impuesto por pagar supera tu caja disponible.' : undefined,
      });
    }

    // ── Endeudamiento ───────────────────────────────────────────
    if (debtRatio > 0.7) {
      insights.push({
        level: debtRatio > 0.85 ? 'critical' : 'warning',
        title: 'Endeudamiento elevado',
        detail: `El ${(debtRatio * 100).toFixed(0)}% de tus activos está financiado con deuda. Un nivel alto reduce tu margen de maniobra.`,
        action: 'Prioriza capitalizar utilidades antes de tomar más pasivos.',
      });
    }

    // ── Rentabilidad ────────────────────────────────────────────
    if (totalIncome > 0) {
      if (netIncome < 0) {
        insights.push({
          level: 'critical',
          title: 'Estás operando con pérdida',
          detail: `Gastos (${fmt(totalExpenses)}) superan ingresos (${fmt(totalIncome)}): pérdida de ${fmt(Math.abs(netIncome))}.`,
          action: 'Revisa tus costos y precios de venta; ningún negocio sobrevive con margen negativo sostenido.',
        });
      } else if (netMargin < 0.05) {
        insights.push({
          level: 'warning',
          title: 'Margen neto muy ajustado',
          detail: `Tu margen neto es ${(netMargin * 100).toFixed(1)}%. Un imprevisto pequeño podría volverte deficitario.`,
          action: 'Busca reducir gastos operativos o mejorar precios.',
        });
      } else if (netMargin >= 0.15) {
        insights.push({
          level: 'good',
          title: 'Rentabilidad saludable',
          detail: `Margen neto de ${(netMargin * 100).toFixed(1)}% y ROE de ${(roe * 100).toFixed(1)}%. Tu operación genera valor.`,
        });
      }
    }

    // ── Patrimonio negativo ─────────────────────────────────────
    if (equity < 0) {
      insights.push({
        level: 'critical',
        title: 'Patrimonio negativo',
        detail: `Tus pasivos (${fmt(totalLiabilities)}) superan tus activos (${fmt(totalAssets)}). Contablemente la empresa está en insolvencia técnica.`,
        action: 'Se requiere un aporte de capital o reestructurar deuda con urgencia.',
      });
    }

    // ── Sin actividad ───────────────────────────────────────────
    if (totalIncome === 0 && totalExpenses === 0) {
      insights.push({
        level: 'info',
        title: 'Aún sin movimientos',
        detail: 'Todavía no hay ingresos ni gastos registrados. Empieza por emitir tu primera factura y registrar tus asientos.',
      });
    }

    // Orden por severidad y resumen
    const order = { critical: 0, warning: 1, good: 2, info: 3 } as const;
    insights.sort((a, b) => order[a.level] - order[b.level]);

    const critical = insights.filter(i => i.level === 'critical').length;
    const warnings = insights.filter(i => i.level === 'warning').length;
    const headline =
      critical > 0 ? `Atención: ${critical} ${critical === 1 ? 'alerta crítica' : 'alertas críticas'} requieren tu acción.` :
      warnings > 0 ? `Tu empresa va bien, pero hay ${warnings} ${warnings === 1 ? 'punto' : 'puntos'} por vigilar.` :
      insights.length > 0 ? 'Tu empresa muestra una salud financiera sólida. ¡Buen trabajo!' :
      'Registra movimientos para recibir recomendaciones personalizadas.';

    return {
      headline,
      counts: { critical, warnings, total: insights.length },
      insights,
      snapshot: {
        cash, receivables, payables, ivaPorPagar,
        currentRatio: Math.round(currentRatio * 100) / 100,
        debtRatio:    Math.round(debtRatio * 1000) / 10,
        netMargin:    Math.round(netMargin * 1000) / 10,
        netIncome,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Eventos económicos aleatorios (simulador): genera escenarios que el
   * estudiante debe "resolver" registrando el asiento correcto. Determinista
   * a partir del id de la empresa + la semana actual (rotan cada semana), y
   * escalados según el tamaño real de su operación. Sin tablas nuevas.
   */
  async getEconomicEvents(companyId: string) {
    const num = (v: any) => Number(v ?? 0);

    // Tamaño de la operación para escalar montos a algo verosímil
    const accounts = await this.prisma.account.findMany({
      where:  { companyId, isActive: true },
      select: { id: true, type: true, normalBalance: true },
    });
    const ids = accounts.map(a => a.id);
    const agg = ids.length === 0 ? [] : await this.prisma.journalLine.groupBy({
      by:    ['accountId'],
      where: { companyId, accountId: { in: ids }, entry: { isReversed: false, status: 'CONFIRMED' as any } },
      _sum:  { debit: true, credit: true },
    });
    const aggMap = new Map(agg.map(r => [r.accountId, { d: num(r._sum.debit), c: num(r._sum.credit) }]));
    let totalIncome = 0, totalAssets = 0;
    for (const a of accounts) {
      const m = aggMap.get(a.id) ?? { d: 0, c: 0 };
      const bal = a.normalBalance === 'DEBIT' ? m.d - m.c : m.c - m.d;
      if (a.type === 'INCOME') totalIncome += bal;
      if (a.type === 'ASSET')  totalAssets += bal;
    }
    // Monto base: 5% de ingresos o de activos, con piso de ₡25.000
    const base = Math.max(25_000, Math.round((totalIncome > 0 ? totalIncome * 0.05 : totalAssets * 0.05) / 1000) * 1000 || 25_000);

    // PRNG determinista (mulberry32) sembrado con id+semana → eventos rotan c/semana
    const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    let seed = week;
    for (const ch of companyId) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rand = () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const around = (factor: number) => Math.round((base * factor * (0.7 + rand() * 0.6)) / 1000) * 1000;
    const fmt = (n: number) => '₡' + n.toLocaleString('es-CR');

    type Event = {
      id: string;
      category: 'riesgo' | 'fiscal' | 'mercado' | 'operativo' | 'oportunidad';
      severity: 'alta' | 'media' | 'baja';
      icon: string;
      title: string;
      story: string;
      amount: number;
      impact: string;
      suggestedEntry: { debit: string; credit: string; amount: number }[];
      learn: string;
    };

    const CATALOG: ((a: number) => Event)[] = [
      (a) => ({
        id: 'moroso', category: 'riesgo', severity: 'alta', icon: '⚠️',
        title: 'Cliente moroso',
        story: `Un cliente que te debe ${fmt(a)} entró en mora y no pagará. Debes reconocer la incobrabilidad.`,
        amount: a,
        impact: `Pérdida de ${fmt(a)} en resultados; baja tu cuentas por cobrar.`,
        suggestedEntry: [
          { debit: 'Gasto por incobrables (cuentas malas)', credit: '', amount: a },
          { debit: '', credit: 'Cuentas por cobrar — Clientes', amount: a },
        ],
        learn: 'Las cuentas incobrables se llevan a gasto cuando se confirma que no se recuperarán (principio de prudencia).',
      }),
      (a) => ({
        id: 'inspeccion', category: 'fiscal', severity: 'media', icon: '🏛️',
        title: 'Inspección de Hacienda',
        story: `La Administración Tributaria revisó tus declaraciones y determinó una multa de ${fmt(a)} por una diferencia en el IVA.`,
        amount: a,
        impact: `Salida de efectivo de ${fmt(a)}; se registra como gasto no deducible.`,
        suggestedEntry: [
          { debit: 'Gastos por multas y sanciones', credit: '', amount: a },
          { debit: '', credit: 'Banco / Efectivo', amount: a },
        ],
        learn: 'Las multas fiscales son gasto contable pero NO son deducibles del impuesto sobre la renta.',
      }),
      (a) => ({
        id: 'inflacion', category: 'mercado', severity: 'media', icon: '📈',
        title: 'Inflación en insumos',
        story: `Tus proveedores subieron precios. La compra de inventario que esperabas pagar costó ${fmt(a)} más de lo presupuestado.`,
        amount: a,
        impact: `Mayor costo de inventario / mercadería por ${fmt(a)}.`,
        suggestedEntry: [
          { debit: 'Inventario / Mercadería', credit: '', amount: a },
          { debit: '', credit: 'Cuentas por pagar — Proveedores', amount: a },
        ],
        learn: 'La inflación encarece el costo de ventas y comprime el margen; conviene revisar precios de venta.',
      }),
      (a) => ({
        id: 'dano_activo', category: 'operativo', severity: 'alta', icon: '🔧',
        title: 'Daño de un activo',
        story: `Un equipo se dañó y debe darse de baja parcialmente por ${fmt(a)}.`,
        amount: a,
        impact: `Pérdida de ${fmt(a)}; reduce el valor en libros del activo.`,
        suggestedEntry: [
          { debit: 'Pérdida por deterioro de activos', credit: '', amount: a },
          { debit: '', credit: 'Mobiliario y equipo', amount: a },
        ],
        learn: 'El deterioro de un activo se reconoce como pérdida cuando su valor recuperable cae por debajo del valor en libros (NIC 36).',
      }),
      (a) => ({
        id: 'oportunidad', category: 'oportunidad', severity: 'baja', icon: '🚀',
        title: 'Oportunidad de venta',
        story: `Un cliente nuevo te hace un pedido grande de ${fmt(a)} de contado (más IVA 13%).`,
        amount: a,
        impact: `Ingreso de ${fmt(a)} + IVA; entra efectivo y genera utilidad.`,
        suggestedEntry: [
          { debit: 'Banco / Efectivo', credit: '', amount: Math.round(a * 1.13) },
          { debit: '', credit: 'Ventas / Ingresos', amount: a },
          { debit: '', credit: 'IVA por pagar (débito fiscal)', amount: Math.round(a * 0.13) },
        ],
        learn: 'En una venta de contado entra el total con IVA; el IVA cobrado es un pasivo que luego se declara en el D-104.',
      }),
      (a) => ({
        id: 'prestamo', category: 'mercado', severity: 'media', icon: '🏦',
        title: 'Aprobación de préstamo',
        story: `El banco te aprobó un crédito de ${fmt(a)} para capital de trabajo, depositado en tu cuenta.`,
        amount: a,
        impact: `Entra efectivo ${fmt(a)}; aumenta tu pasivo y endeudamiento.`,
        suggestedEntry: [
          { debit: 'Banco / Efectivo', credit: '', amount: a },
          { debit: '', credit: 'Préstamos por pagar (largo plazo)', amount: a },
        ],
        learn: 'Un préstamo no es ingreso: es un pasivo. Solo los intereses que pagues serán gasto.',
      }),
    ];

    // Selección determinista de 3 eventos distintos para la semana
    const factors = [0.6, 1.0, 1.4, 0.8, 1.2, 1.0];
    const picks: Event[] = [];
    const used = new Set<number>();
    while (picks.length < 3 && used.size < CATALOG.length) {
      const idx = Math.floor(rand() * CATALOG.length);
      if (used.has(idx)) continue;
      used.add(idx);
      picks.push(CATALOG[idx](around(factors[idx] ?? 1)));
    }

    return {
      periodLabel: `Semana ${week % 52 + 1}`,
      intro: 'Tu empresa enfrenta estos eventos. Analiza cada uno y registra el asiento correcto en tu Diario.',
      events: picks,
      generatedAt: new Date().toISOString(),
    };
  }
}
