'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArtCoins, SceneEmptyBox } from '@/components/illustrations';
import {
  PaymentStatusPill,
  derivePaymentStatus,
  type PaymentStatus,
} from '@/components/ui/PaymentStatusPill';
import { KPICardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import {
  ArrowLeft, Search, X, FileText, ChevronRight, Truck,
  AlertTriangle, Clock, CircleDollarSign, ReceiptText,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ApDashboardKpi {
  totalOutstanding: number;
  overdueAmount:    number;
  currentAmount:    number;
  supplierCount:    number;
}

interface BillRow {
  id:             string;
  invoiceNumber:  string;
  supplierName:   string;
  supplierCedula: string | null;
  date:           string;
  total:          string | number;
  paidAmount:     string | number;
  description:    string | null;
}

interface ApPaymentRow {
  id:                string;
  purchaseInvoiceId: string;
  amount:            string | number;
  paymentDate:       string;
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

// ── Pay supplier modal ────────────────────────────────────────────────────────
function PaySupplierModal({
  bill, companyId, onClose, onSaved,
}: {
  bill: BillRow & { balance: number };
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount]   = useState(String(bill.balance));
  const [date, setDate]       = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod]   = useState<'TRANSFER' | 'CASH' | 'CHECK'>('TRANSFER');
  const [reference, setRef]   = useState('');
  const [saving, setSaving]   = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0)          return toast.error('Monto inválido');
    if (amt > bill.balance + 0.01) return toast.error(`Excede el saldo (${fmtCRC(bill.balance)})`);

    setSaving(true);
    try {
      await api.post(`/api/v1/companies/${companyId}/ap/payments`, {
        purchaseInvoiceId: bill.id,
        amount: amt,
        paymentDate: date,
        method,
        reference: reference || undefined,
      });
      toast.success('Pago registrado');
      onSaved();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally       { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-csq-dark/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-card shadow-card-hover w-full max-w-md ring-1 ring-gray-900/5 cx-pop">
        <div className="flex items-center justify-between px-7 pt-6 pb-5 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900 mb-0.5">Proveedores</p>
            <h3 className="text-base font-bold text-gray-900 tracking-tight">Registrar pago</h3>
            <p className="text-sm text-gray-500 mt-1 truncate">
              <span className="font-mono">{bill.invoiceNumber}</span> · {bill.supplierName}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cx-press">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="px-7 py-6 space-y-5">
          <div className="bg-gradient-to-br from-csq-mid to-csq-active text-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-soft">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-200/80">Saldo pendiente</span>
            <span className="text-lg font-extrabold tabular-nums">{fmtCRC(bill.balance)}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Monto</span>
              <input
                type="number" step="0.01" min="0" max={bill.balance}
                value={amount} onChange={(e) => setAmount(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-colors"
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
              <option value="TRANSFER">Transferencia / SINPE</option>
              <option value="CASH">Efectivo</option>
              <option value="CHECK">Cheque</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Referencia <span className="text-gray-400 font-normal">(opcional)</span></span>
            <input
              type="text" value={reference} onChange={(e) => setRef(e.target.value)}
              placeholder="Comprobante, sinpe, etc."
              className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-colors"
            />
          </label>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 cx-press">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1 cx-press">Registrar pago</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CxPPage() {
  const { attemptId } = useParams<{ attemptId: string }>();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [kpi,       setKpi]       = useState<ApDashboardKpi | null>(null);
  const [bills,     setBills]     = useState<BillRow[]>([]);
  const [payments,  setPayments]  = useState<ApPaymentRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<'ALL' | PaymentStatus>('ALL');
  const [search,    setSearch]    = useState('');
  const [target,    setTarget]    = useState<(BillRow & { balance: number }) | null>(null);

  useEffect(() => {
    api.get(`/api/v1/attempts/${attemptId}`)
      .then(({ data }) => setCompanyId((data as any)?.company?.id ?? null))
      .catch(() => toast.error('No se pudo cargar el ejercicio'));
  }, [attemptId]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [k, list, pay] = await Promise.all([
        api.get<ApDashboardKpi>(`/api/v1/companies/${companyId}/ap/dashboard`),
        api.get<any>(`/api/v1/companies/${companyId}/purchase-invoices?limit=200`),
        api.get<ApPaymentRow[]>(`/api/v1/companies/${companyId}/ap/payments`),
      ]);
      setKpi(k.data);
      const arr: BillRow[] = Array.isArray(list.data) ? list.data : (list.data?.invoices ?? []);
      setBills(arr);
      setPayments(Array.isArray(pay.data) ? pay.data : []);
    } catch { toast.error('Error al cargar cuentas por pagar'); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { if (companyId) load(); }, [companyId, load]);

  const paidThisMonth = useMemo(() => {
    const now = new Date();
    return payments
      .filter((p) => {
        const d = new Date(p.paymentDate);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((s, p) => s + Number(p.amount), 0);
  }, [payments]);

  const paidLastMonth = useMemo(() => {
    const now  = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return payments
      .filter((p) => {
        const d = new Date(p.paymentDate);
        return d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth();
      })
      .reduce((s, p) => s + Number(p.amount), 0);
  }, [payments]);

  const paidTrend = useMemo(() => {
    if (paidLastMonth === 0) return null;
    return ((paidThisMonth - paidLastMonth) / paidLastMonth) * 100;
  }, [paidThisMonth, paidLastMonth]);

  const rows = useMemo(() => {
    return bills.map((b) => {
      const balance = Number(b.total) - Number(b.paidAmount);
      const dueDate = dueFromIssue(b.date);
      const status: PaymentStatus = derivePaymentStatus({ balance, total: Number(b.total), dueDate });
      return { ...b, balance, dueDate, paymentStatus: status };
    })
    .filter((b) => filter === 'ALL' ? true : b.paymentStatus === filter)
    .filter((b) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return b.supplierName.toLowerCase().includes(q) || b.invoiceNumber.toLowerCase().includes(q);
    })
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [bills, filter, search]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/60">
      {target && companyId && (
        <PaySupplierModal
          bill={target}
          companyId={companyId}
          onClose={() => setTarget(null)}
          onSaved={() => { setTarget(null); load(); }}
        />
      )}

      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8 lg:py-10 space-y-7">
        {/* Volver */}
        <Link
          href={`/estudiante/ejercicio/${attemptId}`}
          className="inline-flex items-center gap-2 -ml-1 text-sm font-medium text-gray-500 hover:text-blue-700 transition-colors cx-press"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al ejercicio
        </Link>

        {/* Encabezado */}
        <PageHeader
          eyebrow="Obligaciones"
          title="Cuentas por pagar"
          subtitle="Facturas de proveedores y pagos efectuados."
          icon={Truck}
          iconTint="#1B2E6E"
          className="lp-in"
        />

        {/* Banda del módulo */}
        <Card variant="onDark" className="cx-pop">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-6 lg:px-7 py-6">
            <div className="flex-1 min-w-0">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-1.5">
                Ciclo de pago
              </p>
              <h2 className="text-lg font-bold leading-snug">Lo que debes también es parte de tu contabilidad.</h2>
              <p className="mt-1.5 text-sm text-blue-200/80 max-w-xl">
                Controla los vencimientos con tus proveedores: cada pago reduce el pasivo y sale de tus cuentas de efectivo.
              </p>
            </div>
            <ArtCoins size={140} className="lp-drift flex-shrink-0" />
          </div>
        </Card>

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
              <StatCard
                label="Total por pagar"
                value={fmtCRC(kpi?.totalOutstanding ?? 0)}
                hint={`${kpi?.supplierCount ?? 0} ${kpi?.supplierCount === 1 ? 'proveedor' : 'proveedores'}`}
                icon={CircleDollarSign}
                tint="#1B2E6E"
                className="cx-pop cx-d1 cx-lift cx-hop-parent"
              />
              <StatCard
                label="Vencido"
                value={fmtCRC(kpi?.overdueAmount ?? 0)}
                hint="Requiere acción"
                icon={AlertTriangle}
                tint="#EF4444"
                className="cx-pop cx-d2 cx-lift cx-hop-parent"
              />
              <StatCard
                label="Pendiente vigente"
                value={fmtCRC(kpi?.currentAmount ?? 0)}
                hint="Aún dentro del plazo"
                icon={Clock}
                tint="#B8860B"
                className="cx-pop cx-d3 cx-lift cx-hop-parent"
              />
              <StatCard
                label="Pagado este mes"
                value={fmtCRC(paidThisMonth)}
                hint={new Date().toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })}
                icon={ReceiptText}
                tint="#2563EB"
                delta={paidTrend != null ? `${paidTrend > 0 ? '+' : ''}${paidTrend.toFixed(1)}%` : undefined}
                deltaDirection={paidTrend == null ? 'neutral' : paidTrend >= 0 ? 'up' : 'down'}
                className="cx-pop cx-d4 cx-lift cx-hop-parent"
              />
            </>
          )}
        </div>

        {/* Toolbar + Tabla */}
        <SectionCard
          eyebrow="Detalle"
          title="Facturas de proveedores"
          description="Registra los pagos conforme cancelas a tus proveedores."
          icon={FileText}
          iconTint="#2563EB"
          flushBody
          className="cx-pop cx-d5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 lg:px-7 py-5 border-b border-gray-100">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar proveedor o número…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white transition-colors"
              />
            </div>
            <div className="flex items-center gap-1 bg-gray-100/80 rounded-xl p-1">
              {(['ALL', 'PENDING', 'OVERDUE', 'PARTIAL', 'PAID'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cx-press ${
                    filter === f
                      ? 'text-white bg-gradient-to-br from-blue-600 to-csq-mid shadow-[0_6px_20px_rgba(27,46,110,0.28)]'
                      : 'text-gray-500 hover:text-blue-700 hover:bg-white'
                  }`}
                >
                  {f === 'ALL'     ? 'Todas'      :
                   f === 'PENDING' ? 'Pendientes' :
                   f === 'OVERDUE' ? 'Vencidas'   :
                   f === 'PARTIAL' ? 'Parciales'  : 'Pagadas'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={6} cols={7} />
          ) : rows.length === 0 ? (
            <EmptyState
              illustration={
                filter === 'OVERDUE'
                  ? <ArtCoins size={190} className="lp-drift" />
                  : <SceneEmptyBox size={200} className="lp-drift" />
              }
              title={filter === 'OVERDUE' ? 'Todo bajo control' : 'No hay facturas registradas'}
              description={
                filter === 'OVERDUE'
                  ? 'Sin facturas vencidas. No tienes pagos atrasados con tus proveedores.'
                  : 'Cambia los filtros o registra una nueva factura de compra.'
              }
              action={
                filter !== 'ALL' ? (
                  <Button variant="outline" onClick={() => setFilter('ALL')} className="cx-press">
                    Ver todas las facturas
                  </Button>
                ) : undefined
              }
              className="py-16"
            />
          ) : (
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-22rem)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50/95 backdrop-blur border-b border-gray-200/70">
                    <th className="text-left  px-8 py-3.5">Proveedor</th>
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
                    <tr key={r.id} className="group cx-hop-parent hover:bg-blue-50/40 transition-colors">
                      <td className="px-8 py-4">
                        <div className="font-medium text-gray-900 truncate max-w-[220px]" title={r.supplierName}>
                          {r.supplierName}
                        </div>
                        {r.supplierCedula && (
                          <div className="text-xs text-gray-400 font-mono mt-0.5">{r.supplierCedula}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-gray-500">{r.invoiceNumber}</td>
                      <td className="px-4 py-4 text-gray-600">{fmtDate(r.date)}</td>
                      <td className="px-4 py-4 text-gray-600">{fmtDate(r.dueDate)}</td>
                      <td className="px-4 py-4 text-right tabular-nums text-gray-700">{fmtCRC(Number(r.total))}</td>
                      <td className="px-4 py-4 text-right tabular-nums font-bold text-gray-900">
                        {fmtCRC(r.balance)}
                      </td>
                      <td className="px-4 py-4"><PaymentStatusPill status={r.paymentStatus} /></td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {r.balance > 0 && (
                            <button
                              onClick={() => setTarget(r)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg text-blue-700 hover:text-white hover:bg-blue-600 ring-1 ring-blue-200 hover:ring-blue-600 bg-white transition-all cx-press"
                            >
                              Registrar pago
                            </button>
                          )}
                          <button
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-700 hover:bg-white transition-colors cx-press"
                            title="Ver factura"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-gray-300 cx-hop" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
