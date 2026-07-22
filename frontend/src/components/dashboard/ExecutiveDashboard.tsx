'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, Cell,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';
import {
  Coins, CreditCard, Receipt, TrendingUp, Landmark,
  FileText, Users, Package, BookOpen, AlertCircle,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface DashboardData {
  totals: {
    invoices: number; clients: number; products: number; journalEntries: number;
    totalSales: number; totalSalesBase: number; totalPurchases: number; grossMargin: number;
  };
  receivables: { outstanding: number; count: number; overdue?: number; overdueCount?: number };
  payables:    { outstanding: number; count: number; overdue?: number; overdueCount?: number };
  tax: { ivaCobrado: number; ivaPagado: number; ivaPosition: number };
  salesTrend: Array<{ label: string; total: number }>;
  recentInvoices: Array<{
    id: string; consecutiveNumber: string; clientName: string;
    total: number | string; status: string; haciendaStatus: string; createdAt: string;
  }>;
}

// Paleta de marca (azules). Nombres heredados del diseño anterior, ya renombrados.
const ACCENT = '#2563EB';
const ACCENT_D = '#1D4ED8';
const ACCENT_L = '#60A5FA';
const GOLD = '#D4A017';        // acento dorado de marca (positivo / destacado)
const SLATE = '#94A3B8';       // serie neutra (costos)
const RED = '#DC2626';
const INK = '#03080F';

const fmtCRC = (n: number) =>
  '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtCRCfull = (n: number) =>
  '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CARD = 'bg-white rounded-card border border-gray-200/70';
const CARD_SH = { boxShadow: '0 4px 16px rgba(27,46,110,0.06)' };

const ZERO_DATA: DashboardData = {
  totals: { invoices: 0, clients: 0, products: 0, journalEntries: 0, totalSales: 0, totalSalesBase: 0, totalPurchases: 0, grossMargin: 0 },
  receivables: { outstanding: 0, count: 0 },
  payables:    { outstanding: 0, count: 0 },
  tax: { ivaCobrado: 0, ivaPagado: 0, ivaPosition: 0 },
  salesTrend: [],
  recentInvoices: [],
};

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

// ─── KPI "split" card (total + Vigentes/Vencidas) ───────────────
function SplitKpi({
  label, icon: Icon, total, a, b,
}: {
  label: string; icon: React.ElementType; total: number;
  a: { label: string; value: number; docs?: number; color: string };
  b: { label: string; value: number; docs?: number; color: string };
}) {
  return (
    <div className={CARD + ' p-4'} style={CARD_SH}>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${ACCENT}18` }}>
          <Icon style={{ color: ACCENT, width: 14, height: 14 }} />
        </span>
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide font-mono truncate">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-bold text-gray-900 font-mono tabular-nums leading-none tracking-tight">{fmtCRCfull(total)}</div>
      {/* Barra de composición vigente/vencida (mini-viz tipo Power BI) */}
      {(a.value + b.value) > 0 ? (
        <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-gray-100">
          <div style={{ width: `${(a.value / (a.value + b.value)) * 100}%`, background: a.color }} />
          <div style={{ width: `${(b.value / (a.value + b.value)) * 100}%`, background: b.color }} />
        </div>
      ) : (
        <div className="mt-3 h-2 rounded-full bg-gray-100" />
      )}
      <div className="mt-3 grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
        {[a, b].map((r, i) => (
          <div key={i}>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-mono flex items-center gap-1.5">
              <i className="w-1.5 h-1.5 rounded-[1px] inline-block" style={{ background: r.color }} />{r.label}
            </p>
            <p className="text-[13px] font-bold text-gray-800 font-mono tabular-nums mt-1">{fmtCRCfull(r.value)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{r.docs ?? 0} documentos</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KPI de IVA (total + mini-barras débito/crédito) ───────────────────────────
function IvaKpi({ label, total, totalColor, debito, credito }: {
  label: string; total: number; totalColor?: string; debito: number; credito: number;
}) {
  const max = Math.max(debito, credito, 1);
  const rows = [
    { l: 'Débito fiscal',  v: debito,  c: ACCENT_D },
    { l: 'Crédito fiscal', v: credito, c: ACCENT_L },
  ];
  return (
    <div className={CARD + ' p-4'} style={CARD_SH}>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${ACCENT}18` }}>
          <Landmark style={{ color: ACCENT, width: 14, height: 14 }} />
        </span>
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide font-mono truncate">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-bold font-mono tabular-nums leading-none tracking-tight" style={{ color: totalColor ?? '#111827' }}>{fmtCRCfull(total)}</div>
      <div className="mt-3 space-y-2 pt-3 border-t border-gray-100">
        {rows.map((r, i) => (
          <div key={i}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-400 uppercase tracking-wide font-mono">{r.l}</span>
              <span className="font-bold text-gray-800 font-mono tabular-nums">{fmtCRCfull(r.v)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(r.v / max) * 100}%`, background: r.c }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KPI de utilidad (total + sparkline de tendencia + margen) ─────────────────
function MarginKpi({ label, total, totalColor, ingresos, margenPct, trend }: {
  label: string; total: number; totalColor?: string; ingresos: number; margenPct: number;
  trend: Array<{ label: string; total: number }>;
}) {
  const hasTrend = trend.some((p) => p.total > 0);
  return (
    <div className={CARD + ' p-4'} style={CARD_SH}>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${ACCENT}18` }}>
          <TrendingUp style={{ color: ACCENT, width: 14, height: 14 }} />
        </span>
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide font-mono truncate">{label}</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="text-2xl font-bold font-mono tabular-nums leading-none tracking-tight" style={{ color: totalColor ?? '#111827' }}>{fmtCRCfull(total)}</div>
        <div className="w-20 h-9 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="total" stroke={hasTrend ? GOLD : '#CBD5E1'} strokeWidth={2} fill="url(#sparkGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide font-mono">Ingresos</p>
          <p className="text-[13px] font-bold text-gray-800 font-mono tabular-nums mt-1">{fmtCRCfull(ingresos)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide font-mono">Margen neto</p>
          <p className="text-[13px] font-bold font-mono tabular-nums mt-1" style={{ color: margenPct >= 0 ? ACCENT_D : RED }}>{margenPct.toFixed(1)}%</p>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200" style={CARD_SH}>
      <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-slate-500" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold text-gray-900 leading-none font-mono tabular-nums">{value}</div>
        <div className="text-xs text-gray-400 mt-0.5 truncate">{label}</div>
      </div>
    </div>
  );
}

// ─── Tarjeta de gráfico (encabezado consistente estilo dashboard ejecutivo) ────
function ChartCard({ title, subtitle, right, className = '', children }: {
  title: string; subtitle?: string; right?: React.ReactNode; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={`${CARD} ${className}`} style={CARD_SH}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-1">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900 truncate">{title}</h3>
          {subtitle && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
        {right && <div className="flex-shrink-0">{right}</div>}
      </div>
      <div className="px-3 pb-3 pt-1">{children}</div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
      <i className="w-2 h-2 rounded-[2px]" style={{ background: color }} />{label}
    </span>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export function ExecutiveDashboard({ companyId, compact, initialData }: { companyId?: string | null; compact?: boolean; initialData?: DashboardData | null }) {
  const [data, setData]       = useState<DashboardData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError]     = useState(false);

  useEffect(() => {
    let active = true;
    // El padre ya cargó el dashboard (evita la request duplicada): sin fetch inicial.
    if (initialData) {
      setData(initialData); setError(false); setLoading(false);
      return;
    }
    if (!companyId) {
      setData(ZERO_DATA); setError(false); setLoading(false);
      return;
    }
    setLoading(true);
    api.get<DashboardData>(`/api/v1/companies/${companyId}/dashboard`)
      .then(({ data }) => { if (active) { setData(data); setError(false); } })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companyId, initialData]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-card animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-3 p-5 bg-red-50 border border-red-100 rounded-card text-red-600 text-sm">
        <AlertCircle className="w-5 h-5" /> No se pudo cargar el resumen.
      </div>
    );
  }

  const { totals, receivables, payables, tax, salesTrend, recentInvoices } = data;
  const ivaToPay = tax.ivaPosition >= 0;
  const marginPct = totals.totalSalesBase > 0 ? (totals.grossMargin / totals.totalSalesBase) * 100 : 0;

  // Serie para la gráfica: si no hay datos, generamos 6 meses en 0 para que
  // los EJES se dibujen igual (mostrar ₡0–₡5 con fechas).
  const now = new Date();
  const trendData = salesTrend.length > 0
    ? salesTrend
    : Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        return { label: `${MONTHS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, total: 0 };
      });
  const hasSales = salesTrend.some((p) => p.total > 0);

  // ── Datos derivados para los gráficos ejecutivos ──
  const cxcVenc = receivables.overdue ?? 0;
  const cxpVenc = payables.overdue ?? 0;
  const agingData = [
    { name: 'Por cobrar', vigente: Math.max(0, receivables.outstanding - cxcVenc), vencida: cxcVenc },
    { name: 'Por pagar',  vigente: Math.max(0, payables.outstanding - cxpVenc),   vencida: cxpVenc },
  ];
  const plData = [
    { name: 'Ingresos', value: Math.max(0, totals.totalSales),     fill: ACCENT_D },
    { name: 'Costos',   value: Math.max(0, totals.totalPurchases), fill: SLATE },
    { name: 'Utilidad', value: Math.max(0, totals.grossMargin),    fill: totals.grossMargin >= 0 ? GOLD : RED },
  ];
  const radialData = [{ name: 'Margen', value: Math.max(0, Math.min(100, Math.abs(marginPct))), fill: totals.grossMargin >= 0 ? GOLD : RED }];

  return (
    <div className="space-y-6 lp-in">

      {/* ── KPI row ───────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SplitKpi label="Cuentas por cobrar" icon={Coins} total={receivables.outstanding}
          a={{ label: 'Vigentes', value: receivables.outstanding - (receivables.overdue ?? 0), docs: receivables.count - (receivables.overdueCount ?? 0), color: ACCENT }}
          b={{ label: 'Vencidas', value: receivables.overdue ?? 0, docs: receivables.overdueCount ?? 0, color: RED }} />
        <SplitKpi label="Cuentas por pagar" icon={CreditCard} total={payables.outstanding}
          a={{ label: 'Vigentes', value: payables.outstanding - (payables.overdue ?? 0), docs: payables.count - (payables.overdueCount ?? 0), color: ACCENT }}
          b={{ label: 'Vencidas', value: payables.overdue ?? 0, docs: payables.overdueCount ?? 0, color: RED }} />
        <IvaKpi label={ivaToPay ? 'IVA por pagar · D-104' : 'IVA a favor · D-104'}
          total={Math.abs(tax.ivaPosition)} totalColor={ivaToPay ? RED : ACCENT_D}
          debito={tax.ivaCobrado} credito={tax.ivaPagado} />
        <MarginKpi label="Utilidad del período"
          total={totals.grossMargin} totalColor={totals.grossMargin >= 0 ? ACCENT_D : RED}
          ingresos={totals.totalSales} margenPct={marginPct} trend={trendData} />
      </div>

      {/* ── Fila 1: tendencia de ventas (2/3) + gauge de margen (1/3) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard className="lg:col-span-2" title="Ventas del período"
          subtitle="Tendencia mensual · impuestos incluidos"
          right={<span className="text-lg font-bold text-gray-900 font-mono tabular-nums">{fmtCRCfull(totals.totalSales)}</span>}>
          <ResponsiveContainer width="100%" height={224}>
            <AreaChart data={trendData} margin={{ top: 8, right: 12, left: 6, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.24} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: SLATE }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: SLATE }} axisLine={false} tickLine={false} width={44}
                domain={[0, (dataMax: number) => (dataMax > 0 ? Math.ceil(dataMax) : 5)]}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `₡${v}`} />
              {hasSales && (
                <Tooltip formatter={(v: any) => [fmtCRCfull(v), 'Ventas']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              )}
              <Area type="monotone" dataKey="total" stroke={ACCENT} strokeWidth={2.5} fill="url(#salesGrad)"
                dot={{ r: 2.5, fill: ACCENT, strokeWidth: 0 }} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Margen del período" subtitle="Utilidad sobre ventas">
          <div className="relative">
            <ResponsiveContainer width="100%" height={176}>
              <RadialBarChart innerRadius="72%" outerRadius="100%" data={radialData} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background={{ fill: '#EEF1F0' }} dataKey="value" cornerRadius={9} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[26px] font-bold font-mono tabular-nums leading-none" style={{ color: totals.grossMargin >= 0 ? GOLD : RED }}>
                {marginPct.toFixed(1)}%
              </span>
              <span className="text-[10px] text-gray-400 uppercase tracking-wide mt-1">margen neto</span>
            </div>
          </div>
          <div className="text-center pb-1">
            <span className="text-sm font-bold font-mono tabular-nums" style={{ color: totals.grossMargin >= 0 ? ACCENT_D : RED }}>
              {fmtCRCfull(totals.grossMargin)}
            </span>
            <span className="text-[11px] text-gray-400 ml-1.5">utilidad</span>
          </div>
        </ChartCard>
      </div>

      {/* ── Fila 2: antigüedad de cartera + resultado + posición de IVA ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Antigüedad de cartera" subtitle="Saldos por cobrar y por pagar"
          right={<div className="flex gap-2.5"><LegendDot color={ACCENT} label="Vigente" /><LegendDot color={RED} label="Vencida" /></div>}>
          <ResponsiveContainer width="100%" height={158}>
            <BarChart data={agingData} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: SLATE }} axisLine={false} tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={72} />
              <Tooltip formatter={(v: any, n: any) => [fmtCRCfull(v), n === 'vigente' ? 'Vigente' : 'Vencida']}
                contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Bar dataKey="vigente" stackId="a" fill={ACCENT} radius={[4, 0, 0, 4]} />
              <Bar dataKey="vencida" stackId="a" fill={RED} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Resultado del período" subtitle="Ingresos · costos · utilidad">
          <ResponsiveContainer width="100%" height={158}>
            <BarChart data={plData} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: SLATE }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: SLATE }} axisLine={false} tickLine={false} width={42}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
              <Tooltip formatter={(v: any) => fmtCRCfull(v)}
                contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                {plData.map((dp, i) => <Cell key={i} fill={dp.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Posición de IVA (D-104)" subtitle="Débito vs crédito fiscal">
          <ResponsiveContainer width="100%" height={126}>
            <BarChart data={[{ name: 'Débito', value: tax.ivaCobrado }, { name: 'Crédito', value: tax.ivaPagado }]}
              margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: SLATE }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: SLATE }} axisLine={false} tickLine={false} width={42}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
              <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                {[ACCENT_D, ACCENT_L].map((c, i) => <Cell key={i} fill={c} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className={`mx-2 mt-1 px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between ${
            ivaToPay ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'
          }`}>
            <span>{ivaToPay ? 'Impuesto a pagar' : 'Saldo a favor'}</span>
            <span className="font-bold font-mono tabular-nums">{fmtCRCfull(Math.abs(tax.ivaPosition))}</span>
          </div>
        </ChartCard>
      </div>

      {!compact && (<>
      {/* ── Mini stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat label="Facturas" value={totals.invoices} icon={FileText} />
        <MiniStat label="Clientes activos" value={totals.clients} icon={Users} />
        <MiniStat label="Productos" value={totals.products} icon={Package} />
        <MiniStat label="Asientos contables" value={totals.journalEntries} icon={BookOpen} />
      </div>

      {/* ── Facturas recientes ── */}
      <div className={CARD + ' overflow-hidden'} style={CARD_SH}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Facturas recientes</h3>
          <Receipt className="w-4 h-4 text-gray-300" />
        </div>
        {recentInvoices.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">Aún no hay facturas registradas.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentInvoices.map((inv) => (
              <div key={inv.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50/60 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-blue-700" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{inv.clientName}</div>
                    <div className="text-xs text-gray-400 font-mono">#{inv.consecutiveNumber}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-gray-900 font-mono tabular-nums">{fmtCRC(Number(inv.total))}</div>
                  <StatusPill status={inv.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ISSUED:   { label: 'Emitida',  cls: 'bg-blue-50 text-blue-700' },
    ACCEPTED: { label: 'Aceptada', cls: 'bg-blue-50 text-blue-700' },
    DRAFT:    { label: 'Borrador', cls: 'bg-gray-100 text-gray-500' },
    REJECTED: { label: 'Rechazada',cls: 'bg-red-50 text-red-600' },
    PENDING:  { label: 'Pendiente',cls: 'bg-amber-50 text-amber-600' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500' };
  return <span className={`inline-block mt-0.5 text-xs font-medium px-2 py-0.5 rounded ${s.cls}`}>{s.label}</span>;
}

export default ExecutiveDashboard;
