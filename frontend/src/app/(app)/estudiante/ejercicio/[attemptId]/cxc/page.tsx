'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Card, KPICard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  PaymentStatusPill,
  derivePaymentStatus,
  type PaymentStatus,
} from '@/components/ui/PaymentStatusPill';
import { KPICardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import {
  ArrowLeft, ArrowRight, Search, X, ChevronRight, Wallet,
  AlertTriangle, Clock, CircleDollarSign, Inbox, Sparkles,
} from 'lucide-react';
// (Sparkles ya estaba importado — el ícono del link "Análisis de cartera")
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashboardKpi {
  totalOutstanding:  number;
  overdueAmount:     number;
  currentAmount:     number;
  clientCount:       number;
  oldestInvoiceDays: number;
}

interface InvoiceRow {
  id:                string;
  consecutiveNumber: string;
  clientName:        string;
  clientId:          string | null;
  issueDate:         string;
  total:             string | number;
  paidAmount:        string | number;
  balanceDue:        string | number;
  status:            string;
}

interface ArPaymentRow {
  id:          string;
  invoiceId:   string;
  amount:      string | number;
  paymentDate: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtCRC = (n: number) =>
  '₡' + n.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });

const dueFromIssue = (iso: string) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + 30);
  return d;
};

// ── Register payment modal ────────────────────────────────────────────────────
function RegisterPaymentModal({
  invoice, companyId, onClose, onSaved,
}: {
  invoice: InvoiceRow;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const balance = Number(invoice.balanceDue);
  const [amount, setAmount]   = useState(String(balance));
  const [date,   setDate]     = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod]   = useState<'CASH' | 'TRANSFER' | 'CARD' | 'CHECK'>('TRANSFER');
  const [reference, setReference] = useState('');
  const [saving, setSaving]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error('Monto inválido');
    if (amt > balance)    return toast.error(`Excede el saldo pendiente (${fmtCRC(balance)})`);

    setSaving(true);
    try {
      await api.post(`/api/v1/companies/${companyId}/ar/payments`, {
        invoiceId:   invoice.id,
        amount:      amt,
        paymentDate: date,
        method,
        reference:   reference || undefined,
      });
      toast.success('Cobro registrado');
      onSaved();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally       { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md ring-1 ring-gray-900/5 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-7 pt-6 pb-5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900 tracking-tight">Registrar cobro</h3>
            <p className="text-sm text-gray-500 mt-1">FE-{invoice.consecutiveNumber} · {invoice.clientName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">
          <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Saldo pendiente</span>
            <span className="text-lg font-bold text-gray-900 tabular-nums">{fmtCRC(balance)}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Monto</span>
              <input
                type="number" step="0.01" min="0" max={balance}
                value={amount} onChange={(e) => setAmount(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 tabular-nums transition-colors"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Fecha</span>
              <input
                type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-colors"
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Método</span>
            <select
              value={method} onChange={(e) => setMethod(e.target.value as any)}
              className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-colors"
            >
              <option value="TRANSFER">Transferencia</option>
              <option value="CASH">Efectivo</option>
              <option value="CARD">Tarjeta</option>
              <option value="CHECK">Cheque</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Referencia <span className="text-gray-400 font-normal">(opcional)</span></span>
            <input
              type="text" value={reference} onChange={(e) => setReference(e.target.value)}
              placeholder="N.º de comprobante, sinpe, etc."
              className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-colors"
            />
          </label>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1">Registrar cobro</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CxCPage() {
  const { attemptId } = useParams<{ attemptId: string }>();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [kpi,       setKpi]       = useState<DashboardKpi | null>(null);
  const [invoices,  setInvoices]  = useState<InvoiceRow[]>([]);
  const [payments,  setPayments]  = useState<ArPaymentRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<'ALL' | PaymentStatus>('ALL');
  const [search,    setSearch]    = useState('');
  const [target,    setTarget]    = useState<InvoiceRow | null>(null);

  useEffect(() => {
    api.get(`/api/v1/attempts/${attemptId}`)
      .then(({ data }) => setCompanyId((data as any)?.company?.id ?? null))
      .catch(() => toast.error('No se pudo cargar el ejercicio'));
  }, [attemptId]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [k, inv, pay] = await Promise.all([
        api.get<DashboardKpi>(`/api/v1/companies/${companyId}/ar/dashboard`),
        api.get<any>(`/api/v1/companies/${companyId}/invoices?limit=200`),
        api.get<ArPaymentRow[]>(`/api/v1/companies/${companyId}/ar/payments`),
      ]);
      setKpi(k.data);
      const list: InvoiceRow[] = Array.isArray(inv.data) ? inv.data : (inv.data?.invoices ?? []);
      setInvoices(list);
      setPayments(Array.isArray(pay.data) ? pay.data : []);
    } catch { toast.error('Error al cargar cuentas por cobrar'); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { if (companyId) load(); }, [companyId, load]);

  const collectedThisMonth = useMemo(() => {
    const now = new Date();
    return payments
      .filter((p) => {
        const d = new Date(p.paymentDate);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((s, p) => s + Number(p.amount), 0);
  }, [payments]);

  const collectedLastMonth = useMemo(() => {
    const now  = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return payments
      .filter((p) => {
        const d = new Date(p.paymentDate);
        return d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth();
      })
      .reduce((s, p) => s + Number(p.amount), 0);
  }, [payments]);

  const collectedTrend = useMemo(() => {
    if (collectedLastMonth === 0) return null;
    const diff = ((collectedThisMonth - collectedLastMonth) / collectedLastMonth) * 100;
    return diff;
  }, [collectedThisMonth, collectedLastMonth]);

  const rows = useMemo(() => {
    return invoices
      .filter((i) => Number(i.balanceDue) > 0 || filter === 'PAID' || filter === 'ALL')
      .filter((i) => i.status !== 'DRAFT' && i.status !== 'CANCELLED')
      .map((i) => {
        const dueDate = dueFromIssue(i.issueDate);
        const status  = derivePaymentStatus({
          balance: Number(i.balanceDue),
          total:   Number(i.total),
          dueDate,
        });
        return { ...i, dueDate, paymentStatus: status };
      })
      .filter((i) => filter === 'ALL' ? true : i.paymentStatus === filter)
      .filter((i) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return i.clientName.toLowerCase().includes(q) || i.consecutiveNumber.toLowerCase().includes(q);
      })
      .sort((a, b) => +new Date(b.issueDate) - +new Date(a.issueDate));
  }, [invoices, filter, search]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/60">
      {target && companyId && (
        <RegisterPaymentModal
          invoice={target}
          companyId={companyId}
          onClose={() => setTarget(null)}
          onSaved={() => { setTarget(null); load(); }}
        />
      )}

      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8 lg:py-10 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/estudiante/ejercicio/${attemptId}`}
              className="p-2 -ml-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Cuentas por cobrar</h1>
              <p className="text-sm text-gray-500 mt-1">Facturas emitidas y cobros registrados.</p>
            </div>
          </div>
          {/* Fase 3: link a análisis (ledger consolidado + estimación incobrables) */}
          <Link
            href={`/estudiante/ejercicio/${attemptId}/cxc/analisis`}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            Análisis de cartera
          </Link>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {loading && !kpi ? (
            <>
              <KPICardSkeleton />
              <KPICardSkeleton />
              <KPICardSkeleton />
              <KPICardSkeleton />
            </>
          ) : (
            <>
              <KPICard
                label="Total por cobrar"
                value={fmtCRC(kpi?.totalOutstanding ?? 0)}
                hint={`${kpi?.clientCount ?? 0} ${kpi?.clientCount === 1 ? 'cliente' : 'clientes'}`}
                icon={CircleDollarSign}
                tone="gray"
              />
              <KPICard
                label="Vencido"
                value={fmtCRC(kpi?.overdueAmount ?? 0)}
                hint={kpi?.oldestInvoiceDays ? `Más antigua: ${kpi.oldestInvoiceDays} días` : 'Sin vencimientos'}
                icon={AlertTriangle}
                tone="red"
              />
              <KPICard
                label="Pendiente vigente"
                value={fmtCRC(kpi?.currentAmount ?? 0)}
                hint="Aún dentro del plazo"
                icon={Clock}
                tone="amber"
              />
              <KPICard
                label="Cobrado este mes"
                value={fmtCRC(collectedThisMonth)}
                hint={new Date().toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })}
                icon={Wallet}
                tone="emerald"
                trend={collectedTrend != null ? `${collectedTrend > 0 ? '+' : ''}${collectedTrend.toFixed(1)}%` : undefined}
                trendDirection={collectedTrend == null ? 'neutral' : collectedTrend >= 0 ? 'up' : 'down'}
              />
            </>
          )}
        </div>

        {/* Toolbar + Table */}
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 lg:px-8 py-5 border-b border-gray-100">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente o factura…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 bg-white transition-colors"
              />
            </div>
            <div className="flex items-center gap-1 bg-gray-100/80 rounded-xl p-1">
              {(['ALL', 'PENDING', 'OVERDUE', 'PARTIAL', 'PAID'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    filter === f
                      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/70'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {f === 'ALL' ? 'Todas' :
                   f === 'PENDING' ? 'Pendientes' :
                   f === 'OVERDUE' ? 'Vencidas' :
                   f === 'PARTIAL' ? 'Parciales' : 'Pagadas'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={6} cols={7} />
          ) : rows.length === 0 ? (
            <div className="py-20 px-8 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-100 mb-4">
                {filter === 'OVERDUE'
                  ? <Sparkles className="w-7 h-7 text-emerald-500" />
                  : <Inbox className="w-7 h-7 text-gray-400" />}
              </div>
              <p className="text-base font-medium text-gray-900">
                {filter === 'OVERDUE' ? 'Sin vencimientos' : 'No hay facturas'}
              </p>
              <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                {filter === 'OVERDUE'
                  ? 'No tienes cuentas vencidas. Buen trabajo manteniendo la cobranza al día.'
                  : 'Cambia los filtros o emite una nueva factura para verla aquí.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-22rem)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50/95 backdrop-blur border-b border-gray-200/70">
                    <th className="text-left  px-8 py-3.5">Cliente</th>
                    <th className="text-left  px-4 py-3.5">Factura</th>
                    <th className="text-left  px-4 py-3.5">Emisión</th>
                    <th className="text-left  px-4 py-3.5">Vencimiento</th>
                    <th className="text-right px-4 py-3.5">Total</th>
                    <th className="text-right px-4 py-3.5">Saldo</th>
                    <th className="text-left  px-4 py-3.5">Estado</th>
                    <th className="px-4 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="group hover:bg-gray-50/70 transition-colors">
                      <td className="px-8 py-4">
                        <div className="font-medium text-gray-900 truncate max-w-[200px]" title={r.clientName}>
                          {r.clientName}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-gray-500">FE-{r.consecutiveNumber}</td>
                      <td className="px-4 py-4 text-gray-600">{fmtDate(r.issueDate)}</td>
                      <td className="px-4 py-4 text-gray-600">{fmtDate(r.dueDate)}</td>
                      <td className="px-4 py-4 text-right tabular-nums text-gray-700">{fmtCRC(Number(r.total))}</td>
                      <td className="px-4 py-4 text-right tabular-nums font-semibold text-gray-900">
                        {fmtCRC(Number(r.balanceDue))}
                      </td>
                      <td className="px-4 py-4">
                        <PaymentStatusPill status={r.paymentStatus} />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {Number(r.balanceDue) > 0 && (
                            <button
                              onClick={() => setTarget(r)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg text-gray-700 hover:text-gray-900 hover:bg-white ring-1 ring-gray-200 hover:ring-gray-300 transition-all"
                            >
                              Registrar cobro
                            </button>
                          )}
                          <Link
                            href={`/estudiante/ejercicio/${attemptId}?invoice=${r.id}`}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white transition-colors"
                            title="Ver factura"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
