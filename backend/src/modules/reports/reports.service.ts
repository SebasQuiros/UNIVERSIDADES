import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { ReportFilterDto } from './dto/reports.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Resolve date range from filter ────────────────────────────
  private async resolveDates(companyId: string, filter: ReportFilterDto) {
    if (filter.periodId) {
      const period = await this.prisma.accountingPeriod.findFirst({
        where: { id: filter.periodId, companyId },
      });
      if (!period) throw new NotFoundException('Período no encontrado');
      return { startDate: period.startDate, endDate: period.endDate, period };
    }

    const inception = new Date('2000-01-01');

    // Point-in-time (I-DV-2): asOfDate fija el corte superior (entryDate <= asOf)
    // y, sin startDate, arma un snapshot acumulado desde el inicio. Prioridad
    // sobre endDate.
    if (filter.asOfDate) {
      return {
        startDate: filter.startDate ? new Date(filter.startDate) : inception,
        endDate:   new Date(filter.asOfDate),
        period:    null,
      };
    }

    return {
      startDate: filter.startDate ? new Date(filter.startDate) : inception,
      endDate:   filter.endDate   ? new Date(filter.endDate)   : new Date(),
      period:    null,
    };
  }

  // ── Get account balances (internal helper) ────────────────────
  private async getAccountBalances(
    companyId: string,
    startDate: Date,
    endDate: Date,
    types?: string[],
  ) {
    const accounts = await this.prisma.account.findMany({
      where: {
        companyId,
        isActive: true,
        ...(types ? { type: { in: types as any[] } } : {}),
      },
      orderBy: { code: 'asc' },
    });

    // Fase 5 — fix N+1: antes era 1 aggregate por cuenta. Reemplazamos por
    // UNA sola groupBy sobre todas las cuentas a la vez. Pasa de N round-trips
    // a 1, sin importar si la empresa tiene 10 o 1000 cuentas.
    const accountIds = accounts.map(a => a.id);
    const agg = accountIds.length === 0 ? [] : await this.prisma.journalLine.groupBy({
      by:    ['accountId'],
      where: {
        companyId,
        accountId: { in: accountIds },
        entry: {
          isReversed: false,
          status:     'CONFIRMED',  // excluye PENDING/REJECTED
          entryDate:  { gte: startDate, lte: endDate },
        },
      },
      _sum: { debit: true, credit: true },
    });
    const aggMap = new Map(
      agg.map(row => [row.accountId, {
        debit:  new Decimal((row._sum.debit  ?? 0).toString()),
        credit: new Decimal((row._sum.credit ?? 0).toString()),
      }]),
    );

    return accounts.map(account => {
      const totalDebit  = aggMap.get(account.id)?.debit  ?? new Decimal(0);
      const totalCredit = aggMap.get(account.id)?.credit ?? new Decimal(0);

      // Firmamos por TIPO (no por normalBalance) para que las cuentas de
      // contrapartida (contra-activos como Depreciación Acumulada: ASSET con
      // saldo CREDIT) NETEEN correctamente dentro de su tipo. Para toda cuenta
      // normal el signo por tipo == el de normalBalance, así que esto solo
      // cambia el comportamiento de las contra-cuentas (lo correcto).
      const debitNormalType = account.type === 'ASSET' || account.type === 'EXPENSE';
      const balance = debitNormalType
        ? totalDebit.minus(totalCredit)
        : totalCredit.minus(totalDebit);

      return {
        id:            account.id,
        code:          account.code,
        altCode:       account.altCode,   // codigo del plan del profesor
        name:          account.name,
        type:          account.type,
        level:         account.level,
        isHeader:      account.isHeader,
        normalBalance: account.normalBalance,
        totalDebit:    totalDebit.toFixed(2),
        totalCredit:   totalCredit.toFixed(2),
        balance:       balance.toFixed(2),
        balanceNum:    balance,
      };
    });
  }

  // ── 1. TRIAL BALANCE — Balance de Comprobación ────────────────
  // Shows ALL accounts (including those with zero balance)
  // Uses LEFT JOIN semantics by fetching all accounts then their movements
  async getTrialBalance(companyId: string, filter: ReportFilterDto) {
    const { startDate, endDate, period } = await this.resolveDates(companyId, filter);
    // En paralelo: no dependen entre sí y cada ida a la base cuesta ~400 ms.
    const [accounts, companyInfo] = await Promise.all([
      this.getAccountBalances(companyId, startDate, endDate),
      this.getCompanyInfo(companyId),
    ]);

    // Include all accounts (even zero balance) — that's what trial balance requires
    const rows = accounts.filter(a => !a.isHeader);

    const totalDebit  = rows.reduce((s, a) => s.plus(new Decimal(a.totalDebit)),  new Decimal(0));
    const totalCredit = rows.reduce((s, a) => s.plus(new Decimal(a.totalCredit)), new Decimal(0));
    const isBalanced  = totalDebit.minus(totalCredit).abs().lessThanOrEqualTo(new Decimal('0.01'));

    return {
      reportType: 'TRIAL_BALANCE',
      company:    companyInfo,
      period:     period ?? { startDate, endDate },
      generatedAt: new Date(),
      rows,
      totals: {
        totalDebit:  totalDebit.toFixed(2),
        totalCredit: totalCredit.toFixed(2),
        difference:  totalDebit.minus(totalCredit).toFixed(2),
        isBalanced,
      },
    };
  }

  // ── Agrupador por reglas de codigo ────────────────────────────
  //
  // Los estados financieros formales no se presentan como una lista plana de
  // cuentas: se presentan agrupados (Efectivo y equivalentes, Cuentas por
  // cobrar, Inventarios...). Cada regla es una lista de prefijos de codigo y
  // gana LA PRIMERA que calce, de modo que un caso particular pueda ir antes
  // que su grupo general (Documentos por Pagar es 2.1.01.02 y vive dentro de
  // 2.1.01 Cuentas por Pagar, pero el balance clasificado los separa).
  //
  // La ultima regla de cada bloque puede ser [''] (calza con todo): asi
  // ninguna cuenta se queda afuera y los subtotales SIEMPRE reconcilian con
  // el total del tipo, incluso con cuentas creadas a mano por el estudiante.
  private groupByRules(
    accounts: any[],
    rules: Array<{ label: string; match: string[] }>,
  ) {
    const restantes = accounts.filter(a => a.balanceNum.abs().greaterThan(0));
    const grupos = rules.map(r => ({
      label:    r.label,
      accounts: [] as any[],
      total:    '0.00',
      totalNum: new Decimal(0),
    }));

    for (const acc of restantes) {
      const code = String(acc.code ?? '');
      const i = rules.findIndex(r => r.match.some(p => p === '' || code.startsWith(p)));
      if (i < 0) continue;   // sin catch-all, una cuenta rara puede no calzar
      grupos[i].accounts.push({
        id: acc.id, code: acc.code, altCode: acc.altCode ?? null,
        name: acc.name, amount: acc.balance,
      });
      grupos[i].totalNum = grupos[i].totalNum.plus(acc.balanceNum);
    }

    grupos.forEach(g => { g.total = g.totalNum.toFixed(2); });
    // Un grupo vacio no se dibuja: el estado quedaria lleno de renglones en cero.
    return grupos.filter(g => g.accounts.length > 0);
  }

  private sumGroups(grupos: Array<{ totalNum: Decimal }>) {
    return grupos.reduce((s, g) => s.plus(g.totalNum), new Decimal(0));
  }

  // ── 2. BALANCE SHEET — Balance General ────────────────────────
  // Assets = Liabilities + Equity
  // Uses ALL history up to endDate (balance sheet is cumulative)
  async getBalanceSheet(companyId: string, filter: ReportFilterDto = {} as ReportFilterDto) {
    // Cada ida y vuelta a la base cuesta ~400 ms, así que lo que pesa no es
    // el costo de cada consulta sino CUÁNTAS van en fila. Antes esto resolvía
    // las fechas DOS veces (misma llamada, mismo resultado) y encadenaba tres
    // lecturas de saldos que no dependen entre sí.
    const { startDate: filterStart, endDate, period } = await this.resolveDates(companyId, filter);

    // Balance sheet is cumulative — start from the beginning of time
    const startDate = new Date('2000-01-01');

    const [allAccounts, incomeAccounts, expenseAccounts, companyInfo] = await Promise.all([
      this.getAccountBalances(companyId, startDate, endDate),
      this.getAccountBalances(companyId, filterStart, endDate, ['INCOME']),
      this.getAccountBalances(companyId, filterStart, endDate, ['EXPENSE']),
      this.getCompanyInfo(companyId),
    ]);

    const assets      = allAccounts.filter(a => a.type === 'ASSET');
    const liabilities = allAccounts.filter(a => a.type === 'LIABILITY');
    const equity      = allAccounts.filter(a => a.type === 'EQUITY');

    const totalAssets      = assets.reduce((s, a) => s.plus(a.balanceNum), new Decimal(0));
    const totalLiabilities = liabilities.reduce((s, a) => s.plus(a.balanceNum), new Decimal(0));
    const totalEquity      = equity.reduce((s, a) => s.plus(a.balanceNum), new Decimal(0));

    // Utilidad del período, para incluirla en el patrimonio (balance a mitad
    // de período). Los saldos ya vinieron en el lote paralelo de arriba.
    const totalIncome     = incomeAccounts.reduce((s, a) => s.plus(a.balanceNum), new Decimal(0));
    const totalExpenses   = expenseAccounts.reduce((s, a) => s.plus(a.balanceNum), new Decimal(0));
    const currentNetIncome = totalIncome.minus(totalExpenses);

    // Total equity including current period net income
    const adjustedEquity  = totalEquity.plus(currentNetIncome);
    const totalLiabEquity = totalLiabilities.plus(adjustedEquity);
    const isBalanced      = totalAssets.minus(totalLiabEquity).abs().lessThanOrEqualTo(new Decimal('0.01'));

    // ── Presentacion clasificada (Activo / Pasivo / Patrimonio) ──────────
    //
    // Corriente vs no corriente, y dentro de cada uno los grupos con los que
    // se enseña el estado. Depreciacion acumulada va JUNTO a Propiedad,
    // planta y equipo, no en un bloque aparte: ahi es donde resta.
    const activoCorriente = this.groupByRules(assets, [
      { label: 'Efectivo y equivalentes',        match: ['1.1.01'] },
      { label: 'Cuentas por cobrar',             match: ['1.1.02'] },
      { label: 'Inventarios',                    match: ['1.1.03'] },
      { label: 'Gastos pagados por anticipado',  match: ['1.1.05'] },
      { label: 'Otros activos corrientes',       match: ['1.1'] },
    ]);
    // El bloque "no corriente" lleva el comodin (para que ninguna cuenta se
    // pierda), asi que tiene que correr sobre lo que NO se llevo el corriente:
    // si no, se traga tambien caja, clientes e inventarios.
    const noEmpieza = (pref: string) => (a: any) => !String(a.code ?? '').startsWith(pref);
    const activoNoCorriente = this.groupByRules(assets.filter(noEmpieza('1.1')), [
      { label: 'Propiedad, planta y equipo',     match: ['1.2.01', '1.2.02'] },
      { label: 'Activos intangibles',            match: ['1.2.03'] },
      { label: 'Inversiones a largo plazo',      match: ['1.2.04'] },
      // Catch-all: cualquier activo que no sea 1.1.* cae aca y el total cierra.
      { label: 'Otros activos no corrientes',    match: ['1.2', ''] },
    ]);

    const pasivoCorriente = this.groupByRules(liabilities, [
      // Documentos por pagar vive DENTRO de 2.1.01, y va antes a proposito.
      { label: 'Documentos por pagar',           match: ['2.1.01.02'] },
      { label: 'Cuentas por pagar',              match: ['2.1.01'] },
      { label: 'Impuestos por pagar',            match: ['2.1.02'] },
      { label: 'Provisiones',                    match: ['2.1.03', '2.1.04'] },
      { label: 'Otros pasivos corrientes',       match: ['2.1'] },
    ]);
    const pasivoNoCorriente = this.groupByRules(liabilities.filter(noEmpieza('2.1')), [
      { label: 'Préstamos a largo plazo',        match: ['2.2.01.01'] },
      { label: 'Obligaciones financieras',       match: ['2.2.01'] },
      { label: 'Provisiones a largo plazo',      match: ['2.2.02'] },
      { label: 'Otros pasivos no corrientes',    match: ['2.2', ''] },
    ]);

    const patrimonioGrupos = this.groupByRules(equity, [
      { label: 'Capital social',                 match: ['3.1.01.01'] },
      { label: 'Aportes de socios',              match: ['3.1.01'] },
      { label: 'Reservas',                       match: ['3.1.02'] },
      { label: 'Utilidades retenidas',           match: ['3.2.01'] },
      { label: 'Resultados acumulados',          match: ['3.2', '3.1', ''] },
    ]);
    // La utilidad del periodo todavia NO esta asentada en una cuenta de
    // patrimonio (eso pasa al cierre), pero el balance a mitad de periodo no
    // cuadra sin ella. Va como renglon propio, igual que en el formato.
    const patrimonioClasificado = [
      ...patrimonioGrupos,
      {
        label: 'Utilidad o pérdida del período',
        accounts: [{
          id: 'resultado-periodo', code: '', altCode: null,
          name: currentNetIncome.greaterThanOrEqualTo(0)
            ? 'Utilidad del período' : 'Pérdida del período',
          amount: currentNetIncome.toFixed(2),
        }],
        total:    currentNetIncome.toFixed(2),
        totalNum: currentNetIncome,
      },
    ];

    const totalActivoCorriente   = this.sumGroups(activoCorriente);
    const totalActivoNoCorriente = this.sumGroups(activoNoCorriente);
    const totalPasivoCorriente   = this.sumGroups(pasivoCorriente);
    const totalPasivoNoCorriente = this.sumGroups(pasivoNoCorriente);

    const sinCentavos = (g: any) => ({ label: g.label, accounts: g.accounts, total: g.total });

    return {
      reportType:  'BALANCE_SHEET',
      // Presentacion clasificada — es la que dibuja la pantalla y el PDF.
      classified: {
        activo: {
          corriente:    { label: 'Activo corriente',     grupos: activoCorriente.map(sinCentavos),   total: totalActivoCorriente.toFixed(2) },
          noCorriente:  { label: 'Activo no corriente',  grupos: activoNoCorriente.map(sinCentavos), total: totalActivoNoCorriente.toFixed(2) },
          total: totalAssets.toFixed(2),
        },
        pasivo: {
          corriente:    { label: 'Pasivo corriente',     grupos: pasivoCorriente.map(sinCentavos),   total: totalPasivoCorriente.toFixed(2) },
          noCorriente:  { label: 'Pasivo no corriente',  grupos: pasivoNoCorriente.map(sinCentavos), total: totalPasivoNoCorriente.toFixed(2) },
          total: totalLiabilities.toFixed(2),
        },
        patrimonio: {
          grupos: patrimonioClasificado.map(sinCentavos),
          total:  adjustedEquity.toFixed(2),
        },
        ecuacion: {
          activo:            totalAssets.toFixed(2),
          pasivoMasPatrimonio: totalLiabEquity.toFixed(2),
          diferencia:        totalAssets.minus(totalLiabEquity).toFixed(2),
          cuadra:            isBalanced,
        },
      },
      company:     companyInfo,
      asOfDate:    endDate,
      generatedAt: new Date(),
      assets: {
        accounts:    assets.filter(a => a.balanceNum.abs().greaterThan(0)),
        total:       totalAssets.toFixed(2),
      },
      liabilities: {
        accounts:    liabilities.filter(a => a.balanceNum.abs().greaterThan(0)),
        total:       totalLiabilities.toFixed(2),
      },
      equity: {
        accounts:    equity.filter(a => a.balanceNum.abs().greaterThan(0)),
        total:       totalEquity.toFixed(2),
      },
      totals: {
        totalAssets:       totalAssets.toFixed(2),
        totalLiabilities:  totalLiabilities.toFixed(2),
        totalEquity:       totalEquity.toFixed(2),
        currentNetIncome:  currentNetIncome.toFixed(2),
        adjustedEquity:    adjustedEquity.toFixed(2),
        totalLiabEquity:   totalLiabEquity.toFixed(2),
        isBalanced,
        difference:        totalAssets.minus(totalLiabEquity).toFixed(2),
      },
    };
  }

  // ── 3. INCOME STATEMENT — Estado de Resultados ───────────────
  // Only covers the specified period (not cumulative)
  async getIncomeStatement(companyId: string, filter: ReportFilterDto = {} as ReportFilterDto) {
    const { startDate, endDate, period } = await this.resolveDates(companyId, filter);
    const [accounts, companyInfo] = await Promise.all([
      this.getAccountBalances(companyId, startDate, endDate, ['INCOME', 'EXPENSE']),
      this.getCompanyInfo(companyId),
    ]);

    const incomeAccounts  = accounts.filter(a => a.type === 'INCOME');
    const expenseAccounts = accounts.filter(a => a.type === 'EXPENSE');

    const totalIncome   = incomeAccounts.reduce((s, a) => s.plus(a.balanceNum), new Decimal(0));
    const totalExpenses = expenseAccounts.reduce((s, a) => s.plus(a.balanceNum), new Decimal(0));
    const netIncome     = totalIncome.minus(totalExpenses);

    // ── Presentacion escalonada ─────────────────────────────────────────
    //
    // Los cinco bloques del formato, cada uno cerrando en su propio
    // resultado: ingresos → utilidad bruta → utilidad operativa → utilidad
    // antes de impuestos → utilidad neta.
    //
    // La clasificacion es una PARTICION: cada cuenta cae en exactamente un
    // bloque (el ultimo de cada tipo calza con todo), asi la utilidad neta
    // escalonada da identica a totalIngresos - totalGastos. Eso se verifica
    // abajo y se reporta en `cuadra`.
    // "Ventas netas" es neta de veras: las devoluciones y descuentos sobre
    // ventas (4.1.01.04/.05 y 4.1.02.*) son contra-ingreso con saldo deudor,
    // asi que entran con signo negativo y restan solas.
    const ordinarios = this.groupByRules(incomeAccounts, [
      { label: 'Servicios prestados',       match: ['4.1.01.02'] },
      { label: 'Ventas netas',              match: ['4.1.01', '4.1.02'] },
      { label: 'Otros ingresos operativos', match: ['4.1'] },
    ]);
    const costoVentas = this.groupByRules(expenseAccounts, [
      { label: 'Costo de ventas',              match: ['5.1.01', '5.1.02'] },
      { label: 'Costo de servicios prestados', match: ['5.1'] },
    ]);
    const gastosOperativos = this.groupByRules(expenseAccounts, [
      { label: 'Gastos de administración', match: ['5.2.01', '5.2.03', '6'] },
      { label: 'Gastos de ventas',         match: ['5.2.02'] },
      { label: 'Otros gastos operativos',  match: ['5.2'] },
    ]);
    const impuestos = this.groupByRules(expenseAccounts, [
      { label: 'Impuesto sobre la renta', match: ['5.4'] },
    ]);

    // El bloque 4 recoge el sobrante, asi que sus catch-all tienen que correr
    // sobre lo que NO se llevaron los bloques anteriores: si no, una cuenta
    // de gasto operativo aparecería contada dos veces.
    const noEs = (prefs: string[]) => (a: any) =>
      !prefs.some(p => String(a.code ?? '').startsWith(p));
    const otrosIngresosNeto = this.groupByRules(incomeAccounts.filter(noEs(['4.1'])), [
      { label: 'Ingresos financieros',         match: ['4.2.01.01'] },
      { label: 'Otros ingresos no operativos', match: [''] },
    ]);
    const otrosGastosNeto = this.groupByRules(
      expenseAccounts.filter(noEs(['5.1', '5.2', '5.4', '6'])), [
      { label: 'Gastos financieros',         match: ['5.3'] },
      { label: 'Otros gastos no operativos', match: [''] },
    ]);

    const totalOrdinarios  = this.sumGroups(ordinarios);
    const totalCosto       = this.sumGroups(costoVentas);
    const utilidadBruta    = totalOrdinarios.minus(totalCosto);
    const totalOperativos  = this.sumGroups(gastosOperativos);
    const utilidadOperativa = utilidadBruta.minus(totalOperativos);
    const totalOtrosIng    = this.sumGroups(otrosIngresosNeto);
    const totalOtrosGas    = this.sumGroups(otrosGastosNeto);
    const utilidadAntesImp = utilidadOperativa.plus(totalOtrosIng).minus(totalOtrosGas);
    const totalImpuestos   = this.sumGroups(impuestos);
    const utilidadNeta     = utilidadAntesImp.minus(totalImpuestos);

    const sinCentavos = (g: any) => ({ label: g.label, accounts: g.accounts, total: g.total });

    return {
      reportType:  'INCOME_STATEMENT',
      // Presentacion escalonada — es la que dibuja la pantalla y el PDF.
      structured: {
        bloques: [
          { numero: 1, titulo: 'Ingresos de actividades ordinarias', signo: '+',
            grupos: ordinarios.map(sinCentavos),
            resultado: { label: 'TOTAL INGRESOS', value: totalOrdinarios.toFixed(2) } },
          { numero: 2, titulo: 'Costo de ventas o prestación de servicios', signo: '-',
            grupos: costoVentas.map(sinCentavos),
            resultado: { label: 'UTILIDAD BRUTA', value: utilidadBruta.toFixed(2) } },
          { numero: 3, titulo: 'Gastos operativos', signo: '-',
            grupos: gastosOperativos.map(sinCentavos),
            resultado: { label: 'UTILIDAD OPERATIVA', value: utilidadOperativa.toFixed(2) } },
          { numero: 4, titulo: 'Otros ingresos y gastos', signo: '+/-',
            grupos: [
              ...otrosIngresosNeto.map(sinCentavos),
              ...otrosGastosNeto.map((g: any) => ({ ...sinCentavos(g), negativo: true })),
            ],
            resultado: { label: 'UTILIDAD ANTES DE IMPUESTOS', value: utilidadAntesImp.toFixed(2) } },
          { numero: 5, titulo: 'Impuestos', signo: '-',
            grupos: impuestos.map((g: any) => ({ ...sinCentavos(g), negativo: true })),
            resultado: { label: 'UTILIDAD NETA DEL PERÍODO', value: utilidadNeta.toFixed(2) } },
        ],
        resultadoFinal: {
          value:     utilidadNeta.toFixed(2),
          esUtilidad: utilidadNeta.greaterThanOrEqualTo(0),
          etiqueta:  utilidadNeta.greaterThanOrEqualTo(0) ? 'UTILIDAD' : 'PÉRDIDA',
        },
        // Los escalones tienen que dar lo mismo que ingresos - gastos. Si esto
        // dijera false habria una cuenta escapandose de la particion.
        cuadra: utilidadNeta.minus(netIncome).abs().lessThanOrEqualTo(new Decimal('0.01')),
      },
      company:     companyInfo,
      period:      period ?? { startDate, endDate },
      generatedAt: new Date(),
      income: {
        accounts: incomeAccounts.filter(a => !a.isHeader && a.balanceNum.abs().greaterThan(0)),
        headers:  incomeAccounts.filter(a => a.isHeader),
        total:    totalIncome.toFixed(2),
      },
      expenses: {
        accounts: expenseAccounts.filter(a => !a.isHeader && a.balanceNum.abs().greaterThan(0)),
        headers:  expenseAccounts.filter(a => a.isHeader),
        total:    totalExpenses.toFixed(2),
      },
      totals: {
        totalIncome:    totalIncome.toFixed(2),
        totalExpenses:  totalExpenses.toFixed(2),
        netIncome:      netIncome.toFixed(2),
        isProfit:       netIncome.greaterThanOrEqualTo(0),
      },
    };
  }

  // ── ANÁLISIS VERTICAL Y HORIZONTAL ──────────────────────────────────
  //
  // Vertical  = cada partida como % de una base (Estado de Resultados: ventas
  //             netas; Balance: total de activos).
  // Horizontal= variación (absoluta y %) contra el período anterior.
  async getStatementAnalysis(companyId: string, filter: ReportFilterDto = {} as ReportFilterDto) {
    const { startDate, endDate, period } = await this.resolveDates(companyId, filter);

    // Período anterior: mismo largo, inmediatamente antes.
    const spanMs   = endDate.getTime() - startDate.getTime();
    const prevEnd  = new Date(startDate.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - spanMs);
    const inception = new Date(2000, 0, 1);

    const [curIS, curBS, prevIncExp, prevBal] = await Promise.all([
      this.getIncomeStatement(companyId, filter),
      this.getBalanceSheet(companyId, filter),
      this.getAccountBalances(companyId, prevStart, prevEnd, ['INCOME', 'EXPENSE']),
      this.getAccountBalances(companyId, inception, prevEnd, ['ASSET', 'LIABILITY', 'EQUITY']),
    ]);

    const num = (v: any) => new Decimal((v ?? 0).toString());
    const pct = (part: Decimal, base: Decimal) =>
      base.abs().greaterThan(0) ? part.dividedBy(base).times(100).toDecimalPlaces(2).toNumber() : 0;
    const varPct = (cur: Decimal, prev: Decimal) =>
      prev.abs().greaterThan(0) ? cur.minus(prev).dividedBy(prev.abs()).times(100).toDecimalPlaces(2).toNumber() : null;

    // Mapa de saldos previos por código de cuenta.
    const prevMap = new Map<string, Decimal>();
    [...prevIncExp, ...prevBal].forEach((a: any) => prevMap.set(a.code, num(a.balanceNum ?? a.balance)));

    const buildRows = (accounts: any[], base: Decimal) => accounts.map((a: any) => {
      const actual   = num(a.balanceNum ?? a.balance);
      const anterior = prevMap.get(a.code) ?? new Decimal(0);
      const variacion = actual.minus(anterior);
      return {
        code: a.code, name: a.name, type: a.type,
        actual:            actual.toFixed(2),
        anterior:          anterior.toFixed(2),
        // Vertical: peso de la partida sobre la base
        porcentajeVertical: pct(actual, base),
        // Horizontal: cuánto cambió contra el período anterior
        variacionAbsoluta:  variacion.toFixed(2),
        variacionPorcentual: varPct(actual, anterior),
      };
    });

    // ── Estado de Resultados ──
    const ventas       = num(curIS.totals.totalIncome);
    const isRows       = buildRows([...(curIS.income.accounts ?? []), ...(curIS.expenses.accounts ?? [])], ventas);
    const prevIngresos = prevIncExp.filter((a: any) => a.type === 'INCOME')
      .reduce((s: Decimal, a: any) => s.plus(num(a.balanceNum)), new Decimal(0));
    const prevGastos   = prevIncExp.filter((a: any) => a.type === 'EXPENSE')
      .reduce((s: Decimal, a: any) => s.plus(num(a.balanceNum)), new Decimal(0));
    const prevUtilidad = prevIngresos.minus(prevGastos);
    const curUtilidad  = num(curIS.totals.netIncome);

    // ── Balance ──
    const totalActivos = num(curBS.totals?.totalAssets);
    const bsRows = buildRows([
      ...(curBS.assets?.accounts ?? []), ...(curBS.liabilities?.accounts ?? []), ...(curBS.equity?.accounts ?? []),
    ], totalActivos);

    return {
      companyId,
      period:         period ?? { startDate, endDate },
      previousPeriod: { startDate: prevStart, endDate: prevEnd },
      generatedAt:    new Date(),
      incomeStatement: {
        base: { label: 'Ventas netas', value: ventas.toFixed(2) },
        rows: isRows,
        totals: {
          ingresos:  { actual: ventas.toFixed(2),      anterior: prevIngresos.toFixed(2), variacionPorcentual: varPct(ventas, prevIngresos) },
          gastos:    { actual: num(curIS.totals.totalExpenses).toFixed(2), anterior: prevGastos.toFixed(2), variacionPorcentual: varPct(num(curIS.totals.totalExpenses), prevGastos) },
          utilidad:  { actual: curUtilidad.toFixed(2), anterior: prevUtilidad.toFixed(2), variacionPorcentual: varPct(curUtilidad, prevUtilidad),
                       margenVertical: pct(curUtilidad, ventas) },
        },
      },
      balanceSheet: {
        base: { label: 'Total activos', value: totalActivos.toFixed(2) },
        rows: bsRows,
      },
    };
  }

  // ── 3.5 FINANCIAL ANALYSIS — Estados y Análisis (ratios + comparativo) ──
  //
  // Reusa getBalanceSheet/getIncomeStatement para los totales (evita divergir
  // de esos números) y clasifica Corriente/No Corriente por PREFIJO DE CÓDIGO
  // (1.1.*/1.2.* activos, 2.1.*/2.2.* pasivos) — el catálogo por defecto ya
  // nombra las cuentas así ("Activo Corriente"/"Activo No Corriente"), no
  // hace falta un campo nuevo ni migración.
  async getFinancialAnalysis(companyId: string, filter: ReportFilterDto) {
    const { startDate, endDate, period } = await this.resolveDates(companyId, filter);

    const [balanceSheet, incomeStatement] = await Promise.all([
      this.getBalanceSheet(companyId, filter),
      this.getIncomeStatement(companyId, filter),
    ]);

    // Desglose Corriente/No Corriente — misma ventana acumulada que usa
    // getBalanceSheet (desde el origen hasta endDate).
    const inception = new Date('2000-01-01');
    const allAccounts = await this.getAccountBalances(companyId, inception, endDate, ['ASSET', 'LIABILITY']);
    const leaf = allAccounts.filter(a => !a.isHeader);

    const sumBy = (pred: (code: string) => boolean) =>
      leaf.filter(a => pred(a.code)).reduce((s, a) => s.plus(a.balanceNum), new Decimal(0));

    const currentAssets      = sumBy(c => c.startsWith('1.1'));
    const nonCurrentAssets   = sumBy(c => c.startsWith('1.2'));
    const currentLiabilities = sumBy(c => c.startsWith('2.1'));
    const nonCurrentLiabs    = sumBy(c => c.startsWith('2.2'));

    const totalAssets      = new Decimal(balanceSheet.totals.totalAssets);
    const totalLiabilities = new Decimal(balanceSheet.totals.totalLiabilities);
    const adjustedEquity   = new Decimal(balanceSheet.totals.adjustedEquity);
    const totalIncome      = new Decimal(incomeStatement.totals.totalIncome);
    const netIncome        = new Decimal(incomeStatement.totals.netIncome);

    const safeDiv = (a: Decimal, b: Decimal) => b.isZero() ? null : a.dividedBy(b);
    const pct = (a: Decimal, b: Decimal) => b.isZero() ? null : a.dividedBy(b).times(100).toFixed(1);

    const currentRatio = safeDiv(currentAssets, currentLiabilities);
    const debtRatio     = safeDiv(totalLiabilities, totalAssets);
    const netMargin     = safeDiv(netIncome, totalIncome);
    const roe           = safeDiv(netIncome, adjustedEquity);

    const tagCurrentRatio = currentRatio === null ? null
      : currentRatio.greaterThanOrEqualTo('1.5') ? 'Óptimo'
      : currentRatio.greaterThanOrEqualTo('1')   ? 'Aceptable' : 'Bajo';
    const tagDebtRatio = debtRatio === null ? null
      : debtRatio.lessThanOrEqualTo('0.4') ? 'Bajo'
      : debtRatio.lessThanOrEqualTo('0.7') ? 'Moderado' : 'Alto';
    const tagNetMargin = netMargin === null ? null
      : netMargin.greaterThanOrEqualTo('0.10') ? 'Óptimo'
      : netMargin.greaterThanOrEqualTo('0')     ? 'Aceptable' : 'Negativo';

    // ── Comparativo vs período anterior ──────────────────────────
    // Con periodId: el período contable inmediatamente anterior (mismo
    // ciclo). Sin periodId (rango libre): snapshot un mes calendario antes
    // del corte, como aproximación rápida — mismo criterio que usa el resto
    // del sistema para "vs mes anterior".
    let previousLabel: string | null = null;
    let previousEndDate: Date | null = null;
    let previousStartDate: Date | null = null;

    if (period) {
      const prevPeriod = await this.prisma.accountingPeriod.findFirst({
        where: { companyId, endDate: { lt: period.startDate } },
        orderBy: { endDate: 'desc' },
      });
      if (prevPeriod) {
        previousLabel = prevPeriod.name ?? null;
        previousStartDate = prevPeriod.startDate;
        previousEndDate = prevPeriod.endDate;
      }
    } else {
      previousEndDate = new Date(endDate);
      previousEndDate.setMonth(previousEndDate.getMonth() - 1);
      previousStartDate = new Date(startDate);
      previousStartDate.setMonth(previousStartDate.getMonth() - 1);
    }

    let comparison: any = null;
    if (previousEndDate && previousStartDate) {
      const [prevAssetsLiab, prevIncomeExpense] = await Promise.all([
        this.getAccountBalances(companyId, inception, previousEndDate, ['ASSET', 'LIABILITY', 'EQUITY']),
        this.getAccountBalances(companyId, previousStartDate, previousEndDate, ['INCOME', 'EXPENSE']),
      ]);
      const prevLeaf = prevAssetsLiab.filter(a => !a.isHeader);
      const prevTotalAssets      = prevLeaf.filter(a => a.type === 'ASSET').reduce((s, a) => s.plus(a.balanceNum), new Decimal(0));
      const prevTotalLiabilities = prevLeaf.filter(a => a.type === 'LIABILITY').reduce((s, a) => s.plus(a.balanceNum), new Decimal(0));
      const prevTotalEquity      = prevLeaf.filter(a => a.type === 'EQUITY').reduce((s, a) => s.plus(a.balanceNum), new Decimal(0));
      const prevIncome  = prevIncomeExpense.filter(a => !a.isHeader && a.type === 'INCOME').reduce((s, a) => s.plus(a.balanceNum), new Decimal(0));
      const prevExpense = prevIncomeExpense.filter(a => !a.isHeader && a.type === 'EXPENSE').reduce((s, a) => s.plus(a.balanceNum), new Decimal(0));
      const prevNetIncome = prevIncome.minus(prevExpense);
      const prevAdjustedEquity = prevTotalEquity.plus(prevNetIncome);

      const variance = (curr: Decimal, prev: Decimal) => prev.isZero() ? null : curr.minus(prev).dividedBy(prev.abs()).times(100).toFixed(2);

      comparison = {
        label: previousLabel,
        asOfDate: previousEndDate,
        totalAssets:      prevTotalAssets.toFixed(2),
        totalLiabilities: prevTotalLiabilities.toFixed(2),
        adjustedEquity:   prevAdjustedEquity.toFixed(2),
        netIncome:        prevNetIncome.toFixed(2),
        variance: {
          totalAssets:      variance(totalAssets, prevTotalAssets),
          totalLiabilities: variance(totalLiabilities, prevTotalLiabilities),
          adjustedEquity:   variance(adjustedEquity, prevAdjustedEquity),
          netIncome:        variance(netIncome, prevNetIncome),
        },
      };
    }

    return {
      reportType:  'FINANCIAL_ANALYSIS',
      company:     await this.getCompanyInfo(companyId),
      period:      period ?? { startDate, endDate },
      generatedAt: new Date(),
      balanceSheet: {
        totalAssets:          totalAssets.toFixed(2),
        totalLiabilities:     totalLiabilities.toFixed(2),
        adjustedEquity:       adjustedEquity.toFixed(2),
        currentAssets:        currentAssets.toFixed(2),
        nonCurrentAssets:     nonCurrentAssets.toFixed(2),
        currentLiabilities:   currentLiabilities.toFixed(2),
        nonCurrentLiabilities: nonCurrentLiabs.toFixed(2),
        // % de cada bloque relativo a SU PROPIO total (activo vs pasivo+patrimonio),
        // no relativo a un único "gran total" — si el balance cuadra, ambos grupos
        // suman 100% cada uno por separado (no 100% combinado entre los 5).
        distribution: {
          currentAssetsPct:        pct(currentAssets, totalAssets),
          nonCurrentAssetsPct:     pct(nonCurrentAssets, totalAssets),
          currentLiabilitiesPct:   pct(currentLiabilities, totalLiabilities.plus(adjustedEquity)),
          nonCurrentLiabilitiesPct: pct(nonCurrentLiabs, totalLiabilities.plus(adjustedEquity)),
          equityPct:               pct(adjustedEquity, totalLiabilities.plus(adjustedEquity)),
        },
      },
      incomeStatement: {
        totalIncome:   totalIncome.toFixed(2),
        totalExpenses: incomeStatement.totals.totalExpenses,
        netIncome:     netIncome.toFixed(2),
      },
      ratios: {
        currentRatio:    currentRatio === null ? null : currentRatio.toFixed(2),
        currentRatioTag: tagCurrentRatio,
        debtRatio:       debtRatio === null ? null : debtRatio.times(100).toFixed(1),
        debtRatioTag:    tagDebtRatio,
        netMargin:       netMargin === null ? null : netMargin.times(100).toFixed(1),
        netMarginTag:    tagNetMargin,
        roe:             roe === null ? null : roe.times(100).toFixed(1),
      },
      comparison,
    };
  }

  // ── 4. JOURNAL BOOK — Libro Diario ────────────────────────────
  async getJournalBook(companyId: string, filter: ReportFilterDto) {
    const { startDate, endDate, period } = await this.resolveDates(companyId, filter);

    const entries = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        isReversed: false,
        entryDate: { gte: startDate, lte: endDate },
      },
      orderBy: [{ entryDate: 'asc' }, { entryNumber: 'asc' }],
      include: {
        lines: {
          include: {
            account: { select: { code: true, name: true, type: true } },
          },
          orderBy: { debit: 'desc' },
        },
        createdBy: { select: { name: true } },
      },
    });

    const totalDebit  = entries.reduce((s, e) =>
      s.plus(e.lines.reduce((ls, l) => ls.plus(new Decimal(l.debit.toString())), new Decimal(0))),
      new Decimal(0));

    const totalCredit = entries.reduce((s, e) =>
      s.plus(e.lines.reduce((ls, l) => ls.plus(new Decimal(l.credit.toString())), new Decimal(0))),
      new Decimal(0));

    return {
      reportType:  'JOURNAL_BOOK',
      company:     await this.getCompanyInfo(companyId),
      period:      period ?? { startDate, endDate },
      generatedAt: new Date(),
      entries,
      totals: {
        entryCount:  entries.length,
        totalDebit:  totalDebit.toFixed(2),
        totalCredit: totalCredit.toFixed(2),
      },
    };
  }

  // ── 5. T-ACCOUNTS — Cuentas en T ─────────────────────────────
  async getTAccounts(
    companyId: string,
    filters?: {
      periodId?:   string;
      startDate?:  string;
      endDate?:    string;
      accountIds?: string[];
      type?:       'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
    },
  ) {
    // Resolve date range
    let startDate: Date;
    let endDate:   Date;

    if (filters?.periodId) {
      const period = await this.prisma.accountingPeriod.findFirst({
        where: { id: filters.periodId, companyId },
      });
      if (!period) throw new NotFoundException('Período no encontrado');
      startDate = period.startDate;
      endDate   = period.endDate;
    } else {
      startDate = filters?.startDate ? new Date(filters.startDate) : new Date('2000-01-01');
      endDate   = filters?.endDate   ? new Date(filters.endDate)   : new Date();
    }

    // Fetch matching accounts
    const accounts = await this.prisma.account.findMany({
      where: {
        companyId,
        isActive: true,
        isHeader: false,
        ...(filters?.type       && { type: filters.type as any }),
        ...(filters?.accountIds && filters.accountIds.length > 0
          ? { id: { in: filters.accountIds } }
          : {}),
      },
      orderBy: { code: 'asc' },
    });

    // Fase 5 — fix N+1: antes era 1 findMany por cuenta (Promise.all sobre N
    // cuentas = N queries). Ahora hacemos UNA sola findMany con
    // `accountId: { in: [...] }` y agrupamos en memoria por accountId con un Map.
    const allLines = accounts.length === 0 ? [] : await this.prisma.journalLine.findMany({
      where: {
        accountId: { in: accounts.map(a => a.id) },
        companyId,
        entry: {
          isReversed: false,
          status:     'CONFIRMED',  // excluye PENDING/REJECTED
          entryDate:  { gte: startDate, lte: endDate },
        },
      },
      include: {
        entry: {
          select: {
            entryNumber: true,
            description: true,
            entryDate:   true,
          },
        },
      },
      orderBy: { entry: { entryDate: 'asc' } },
    });

    const linesByAccount = new Map<string, typeof allLines>();
    for (const line of allLines) {
      const bucket = linesByAccount.get(line.accountId);
      if (bucket) bucket.push(line);
      else linesByAccount.set(line.accountId, [line]);
    }

    const result = accounts.map(account => {
        // Journal lines for this account within the date range (agrupadas arriba)
        const lines = linesByAccount.get(account.id) ?? [];

        const debitEntries = lines
          .filter(l => new Decimal(l.debit.toString()).greaterThan(0))
          .map(l => ({
            date:        l.entry.entryDate.toISOString().split('T')[0],
            description: l.entry.description,
            amount:      Number(new Decimal(l.debit.toString()).toFixed(2)),
            entryNumber: String(l.entry.entryNumber),
          }));

        const creditEntries = lines
          .filter(l => new Decimal(l.credit.toString()).greaterThan(0))
          .map(l => ({
            date:        l.entry.entryDate.toISOString().split('T')[0],
            description: l.entry.description,
            amount:      Number(new Decimal(l.credit.toString()).toFixed(2)),
            entryNumber: String(l.entry.entryNumber),
          }));

        const totalDebit  = debitEntries.reduce((s, e) => s.plus(new Decimal(e.amount.toString())), new Decimal(0));
        const totalCredit = creditEntries.reduce((s, e) => s.plus(new Decimal(e.amount.toString())), new Decimal(0));

        const balance = account.normalBalance === 'DEBIT'
          ? Number(totalDebit.minus(totalCredit).toFixed(2))
          : Number(totalCredit.minus(totalDebit).toFixed(2));

        return {
          account: {
            id:            account.id,
            code:          account.code,
            name:          account.name,
            type:          account.type,
            normalBalance: account.normalBalance,
          },
          leftSide: {    // DEBIT side
            entries: debitEntries,
            total:   Number(totalDebit.toFixed(2)),
          },
          rightSide: {   // CREDIT side
            entries: creditEntries,
            total:   Number(totalCredit.toFixed(2)),
          },
          balance,
          normalBalance: account.normalBalance,
        };
      });

    // Only return accounts that have at least one movement
    return result.filter(
      r => r.leftSide.entries.length > 0 || r.rightSide.entries.length > 0,
    );
  }

  // ── Helper — get company info for report header ───────────────
  private async getCompanyInfo(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where:  { id: companyId },
      select: { id: true, name: true, legalId: true, email: true },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    return company;
  }
}
