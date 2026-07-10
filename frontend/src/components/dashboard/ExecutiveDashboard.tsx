'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, Cell,
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

// paleta v2
const TEAL = '#2563EB';
const TEAL_D = '#1D4ED8';
const TEAL_L = '#60A5FA';
const RED = '#DC2626';
const INK = '#03080F';

const fmtCRC = (n: number) =>
  '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtCRCfull = (n: number) =>
  '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CARD = 'bg-white rounded-xl border border-gray-200';
const CARD_SH = { boxShadow: '0 1px 2px rgba(16,24,40,0.04)' };

const ZERO_DATA: DashboardData = {
  totals: { invoices: 0, clients: 0, products: 0, journalEntries: 0, totalSales: 0, totalSalesBase: 0, totalPurchases: 0, grossMargin: 0 },
  receivables: { outstanding: 0, count: 0 },
  payables:    { outstanding: 0, count: 0 },
  tax: { ivaCobrado: 0, ivaPagado: 0, ivaPosition: 0 },
  salesTrend: [],
  recentInvoices: [],
};

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

// ─── KPI "split" card (estilo Alegra: total + Vigentes/Vencidas) ───────────────
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
        <span className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${TEAL}18` }}>
          <Icon style={{ color: TEAL, width: 14, height: 14 }} />
        </span>
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide font-mono truncate">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-bold text-gray-900 font-mono tabular-nums leading-none tracking-tight">{fmtCRCfull(total)}</div>
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

// ─── KPI simple (total + 2 sub-datos) ──────────────────────────────────────────
function DualKpi({
  label, icon: Icon, total, totalColor, a, b,
}: {
  label: string; icon: React.ElementType; total: number; totalColor?: string;
  a: { label: string; value: string }; b: { label: string; value: string };
}) {
  return (
    <div className={CARD + ' p-4'} style={CARD_SH}>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${TEAL}18` }}>
          <Icon style={{ color: TEAL, width: 14, height: 14 }} />
        </span>
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide font-mono truncate">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-bold font-mono tabular-nums leading-none tracking-tight" style={{ color: totalColor ?? '#111827' }}>{fmtCRCfull(total)}</div>
      <div className="mt-3 grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
        {[a, b].map((r, i) => (
          <div key={i}>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-mono">{r.label}</p>
            <p className="text-[13px] font-bold text-gray-800 font-mono tabular-nums mt-1">{r.value}</p>
          </div>
        ))}
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

// ─── Main ────────────────────────────────────────────────────────────────────
export function ExecutiveDashboard({ companyId, compact }: { companyId?: string | null; compact?: boolean }) {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    let active = true;
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
  }, [companyId]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-3 p-5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
        <AlertCircle className="w-5 h-5" /> No se pudo cargar el resumen.
      </div>
    );
  }

  const { totals, receivables, payables, tax, salesTrend, recentInvoices } = data;
  const ivaToPay = tax.ivaPosition >= 0;
  const marginPct = totals.totalSalesBase > 0 ? (totals.grossMargin / totals.totalSalesBase) * 100 : 0;

  // Serie para la gráfica: si no hay datos, generamos 6 meses en 0 para que
  // los EJES se dibujen igual (como Alegra muestra ₡0–₡5 con fechas).
  const now = new Date();
  const trendData = salesTrend.length > 0
    ? salesTrend
    : Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        return { label: `${MONTHS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, total: 0 };
      });
  const hasSales = salesTrend.some((p) => p.total > 0);

  return (
    <div className="space-y-6">

      {/* ── KPI row (estilo Alegra) ───────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SplitKpi label="Cuentas por cobrar" icon={Coins} total={receivables.outstanding}
          a={{ label: 'Vigentes', value: receivables.outstanding - (receivables.overdue ?? 0), docs: receivables.count - (receivables.overdueCount ?? 0), color: TEAL }}
          b={{ label: 'Vencidas', value: receivables.overdue ?? 0, docs: receivables.overdueCount ?? 0, color: RED }} />
        <SplitKpi label="Cuentas por pagar" icon={CreditCard} total={payables.outstanding}
          a={{ label: 'Vigentes', value: payables.outstanding - (payables.overdue ?? 0), docs: payables.count - (payables.overdueCount ?? 0), color: TEAL }}
          b={{ label: 'Vencidas', value: payables.overdue ?? 0, docs: payables.overdueCount ?? 0, color: RED }} />
        <DualKpi label={ivaToPay ? 'IVA por pagar · D-104' : 'IVA a favor · D-104'} icon={Landmark}
          total={Math.abs(tax.ivaPosition)}
          a={{ label: 'Débito fiscal', value: fmtCRCfull(tax.ivaCobrado) }}
          b={{ label: 'Crédito fiscal', value: fmtCRCfull(tax.ivaPagado) }} />
        <DualKpi label="Utilidad del período" icon={TrendingUp}
          total={totals.grossMargin} totalColor={totals.grossMargin >= 0 ? TEAL_D : RED}
          a={{ label: 'Ingresos', value: fmtCRCfull(totals.totalSales) }}
          b={{ label: 'Margen neto', value: `${marginPct.toFixed(1)}%` }} />
      </div>

      {/* ── Total de ventas (gráfica full-width, con ejes aunque esté vacía) ── */}
      <div className={CARD} style={CARD_SH}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Total de ventas</h3>
            <p className="text-xs text-gray-400">Últimos 6 meses · impuestos incluidos</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900 font-mono tabular-nums">{fmtCRCfull(totals.totalSales)}</div>
          </div>
        </div>
        <div className="px-2 pb-3">
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={trendData} margin={{ top: 8, right: 12, left: 6, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TEAL} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                width={44}
                domain={[0, (dataMax: number) => (dataMax > 0 ? Math.ceil(dataMax) : 5)]}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `₡${v}`} />
              {hasSales && (
                <Tooltip formatter={(v: any) => [fmtCRCfull(v), 'Ventas']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              )}
              <Area type="monotone" dataKey="total" stroke={TEAL} strokeWidth={2.5} fill="url(#salesGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {!compact && (<>
      {/* ── Mini stats ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat label="Facturas" value={totals.invoices} icon={FileText} />
        <MiniStat label="Clientes activos" value={totals.clients} icon={Users} />
        <MiniStat label="Productos" value={totals.products} icon={Package} />
        <MiniStat label="Asientos contables" value={totals.journalEntries} icon={BookOpen} />
      </div>

      {/* ── IVA position + recent invoices ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={CARD + ' p-4'} style={CARD_SH}>
          <h3 className="text-sm font-bold text-gray-900 mb-1">Posición de IVA (D-104)</h3>
          <p className="text-xs text-gray-400 mb-3">Débito vs crédito fiscal</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={[{ name: 'Débito', value: tax.ivaCobrado }, { name: 'Crédito', value: tax.ivaPagado }]}
              margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={42}
                domain={[0, (dataMax: number) => (dataMax > 0 ? Math.ceil(dataMax) : 5)]}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
              <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                {[TEAL_D, TEAL_L].map((c, i) => <Cell key={i} fill={c} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between ${
            ivaToPay ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'
          }`}>
            <span>{ivaToPay ? 'Impuesto a pagar' : 'Saldo a favor'}</span>
            <span className="font-bold font-mono tabular-nums">{fmtCRCfull(Math.abs(tax.ivaPosition))}</span>
          </div>
        </div>

        <div className={'lg:col-span-2 ' + CARD + ' overflow-hidden'} style={CARD_SH}>
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
