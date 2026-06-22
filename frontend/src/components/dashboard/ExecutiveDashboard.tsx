'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Receipt, ShoppingCart, Wallet,
  ArrowDownCircle, ArrowUpCircle, Landmark, FileText, Users,
  Package, BookOpen, Percent, AlertCircle,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface DashboardData {
  totals: {
    invoices: number; clients: number; products: number; journalEntries: number;
    totalSales: number; totalSalesBase: number; totalPurchases: number; grossMargin: number;
  };
  receivables: { outstanding: number; count: number };
  payables:    { outstanding: number; count: number };
  tax: { ivaCobrado: number; ivaPagado: number; ivaPosition: number };
  salesTrend: Array<{ label: string; total: number }>;
  recentInvoices: Array<{
    id: string; consecutiveNumber: string; clientName: string;
    total: number | string; status: string; haciendaStatus: string; createdAt: string;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtCRC = (n: number) =>
  '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtCRCfull = (n: number) =>
  '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, accent, trend,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; accent: string; trend?: { dir: 'up' | 'down'; text: string };
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3 transition-shadow hover:shadow-lg"
      style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}14` }}>
          <Icon className="w-4.5 h-4.5" style={{ color: accent, width: 18, height: 18 }} />
        </div>
      </div>
      <div>
        <div className="text-2xl font-black text-gray-900 leading-none tracking-tight">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-1.5">{sub}</div>}
      </div>
      {trend && (
        <div className="flex items-center gap-1 text-xs font-semibold"
          style={{ color: trend.dir === 'up' ? '#10B981' : '#EF4444' }}>
          {trend.dir === 'up' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {trend.text}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-100">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold text-gray-900 leading-none">{value}</div>
        <div className="text-xs text-gray-400 mt-0.5 truncate">{label}</div>
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export function ExecutiveDashboard({ companyId }: { companyId: string }) {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    let active = true;
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
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-3 p-5 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm">
        <AlertCircle className="w-5 h-5" /> No se pudo cargar el panel ejecutivo.
      </div>
    );
  }

  const { totals, receivables, payables, tax, salesTrend, recentInvoices } = data;
  const ivaToPay = tax.ivaPosition >= 0;

  // Margin %
  const marginPct = totals.totalSalesBase > 0
    ? (totals.grossMargin / totals.totalSalesBase) * 100 : 0;

  return (
    <div className="space-y-6">

      {/* ── KPI row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Ventas del período" value={fmtCRC(totals.totalSales)}
          sub={`${totals.invoices} facturas emitidas`} icon={Receipt} accent="#2563EB" />
        <KpiCard label="Compras" value={fmtCRC(totals.totalPurchases)}
          sub="Crédito fiscal incluido" icon={ShoppingCart} accent="#7C3AED" />
        <KpiCard label="Margen bruto" value={fmtCRC(totals.grossMargin)}
          sub={`${marginPct.toFixed(1)}% sobre ventas`} icon={Percent} accent="#10B981"
          trend={{ dir: totals.grossMargin >= 0 ? 'up' : 'down', text: `${marginPct.toFixed(1)}%` }} />
        <KpiCard label={ivaToPay ? 'IVA por pagar' : 'IVA saldo a favor'}
          value={fmtCRC(Math.abs(tax.ivaPosition))}
          sub={`Débito ${fmtCRC(tax.ivaCobrado)} − Crédito ${fmtCRC(tax.ivaPagado)}`}
          icon={Landmark} accent={ivaToPay ? '#EF4444' : '#10B981'} />
      </div>

      {/* ── Charts + AR/AP ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Sales trend */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5"
          style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Tendencia de ventas</h3>
              <p className="text-xs text-gray-400">Últimos 6 meses</p>
            </div>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={salesTrend} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} width={42} />
              <Tooltip formatter={(v: any) => [fmtCRCfull(v), 'Ventas']}
                contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Area type="monotone" dataKey="total" stroke="#2563EB" strokeWidth={2.5}
                fill="url(#salesGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* AR / AP */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5"
            style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Por cobrar</span>
            </div>
            <div className="text-2xl font-black text-gray-900">{fmtCRC(receivables.outstanding)}</div>
            <div className="text-xs text-gray-400 mt-1">{receivables.count} documentos pendientes</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5"
            style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpCircle className="w-4 h-4 text-rose-500" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Por pagar</span>
            </div>
            <div className="text-2xl font-black text-gray-900">{fmtCRC(payables.outstanding)}</div>
            <div className="text-xs text-gray-400 mt-1">{payables.count} documentos pendientes</div>
          </div>
          {/* Posición neta */}
          <div className="rounded-2xl p-5 text-white"
            style={{ background: 'linear-gradient(135deg,#0F2657,#1E3A8A)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 opacity-80" />
              <span className="text-xs font-semibold opacity-70 uppercase tracking-wide">Posición neta</span>
            </div>
            <div className="text-2xl font-black">{fmtCRC(receivables.outstanding - payables.outstanding)}</div>
            <div className="text-xs opacity-60 mt-1">Cobrar − Pagar</div>
          </div>
        </div>
      </div>

      {/* ── Mini stats ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat label="Facturas" value={totals.invoices} icon={FileText} />
        <MiniStat label="Clientes activos" value={totals.clients} icon={Users} />
        <MiniStat label="Productos" value={totals.products} icon={Package} />
        <MiniStat label="Asientos contables" value={totals.journalEntries} icon={BookOpen} />
      </div>

      {/* ── IVA position + recent invoices ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* IVA bar */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5"
          style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <h3 className="text-sm font-bold text-gray-900 mb-1">Posición de IVA (D-104)</h3>
          <p className="text-xs text-gray-400 mb-3">Débito vs crédito fiscal</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={[
              { name: 'Débito', value: tax.ivaCobrado, color: '#2563EB' },
              { name: 'Crédito', value: tax.ivaPagado, color: '#10B981' },
            ]} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} width={42} />
              <Tooltip formatter={(v: any) => fmtCRCfull(v)}
                contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {[{ color: '#2563EB' }, { color: '#10B981' }].map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className={`mt-3 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between ${
            ivaToPay ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            <span>{ivaToPay ? 'Impuesto a pagar' : 'Saldo a favor'}</span>
            <span className="font-black">{fmtCRCfull(Math.abs(tax.ivaPosition))}</span>
          </div>
        </div>

        {/* Recent invoices */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden"
          style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Facturas recientes</h3>
            <Receipt className="w-4 h-4 text-gray-300" />
          </div>
          {recentInvoices.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">Aún no hay facturas registradas.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentInvoices.map((inv) => (
                <div key={inv.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50/60 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{inv.clientName}</div>
                      <div className="text-xs text-gray-400 font-mono">#{inv.consecutiveNumber}</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-gray-900">{fmtCRC(Number(inv.total))}</div>
                    <StatusPill status={inv.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ISSUED:   { label: 'Emitida',  cls: 'bg-emerald-50 text-emerald-600' },
    ACCEPTED: { label: 'Aceptada', cls: 'bg-emerald-50 text-emerald-600' },
    DRAFT:    { label: 'Borrador', cls: 'bg-gray-100 text-gray-500' },
    REJECTED: { label: 'Rechazada',cls: 'bg-red-50 text-red-600' },
    PENDING:  { label: 'Pendiente',cls: 'bg-amber-50 text-amber-600' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500' };
  return <span className={`inline-block mt-0.5 text-xs font-medium px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>;
}

export default ExecutiveDashboard;
