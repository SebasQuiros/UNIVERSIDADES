'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SceneEmptyBox } from '@/components/illustrations';
import { Coins, Plus, X, Wallet, Clock } from 'lucide-react';
import { useEmpresaActiva } from './ModuloWorkspace';

interface Pago {
  id: string;
  amount: number;
  paymentDate: string;
  method: string | null;
  reference: string | null;
  invoice?: { consecutiveNumber?: string; clientName?: string | null } | null;
}

interface FacturaPendiente {
  id: string;
  number: string;
  clientName: string;
  balance: number;
  daysOverdue: number;
}

const METODOS = [
  { value: 'CASH',     label: 'Efectivo' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'CARD',     label: 'Tarjeta' },
  { value: 'CHECK',    label: 'Cheque' },
];

const money = (n: number | string) =>
  '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fecha = (d: string) => {
  try { return new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return '—'; }
};

/** Cobros a clientes: aplica pagos sobre facturas de venta pendientes. */
export function PagosRecibidosView() {
  const { companyId, estado } = useEmpresaActiva();
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [pendientes, setPendientes] = useState<FacturaPendiente[]>([]);
  const [cargando, setCargando] = useState(false);
  const [abrir, setAbrir] = useState(false);

  const cargar = useCallback(async () => {
    if (!companyId) return;
    setCargando(true);
    try {
      // El panel de CxC solo devuelve totales; el detalle de facturas por
      // cobrar vive en el reporte de antigüedad, agrupado por cliente.
      const [p, a] = await Promise.all([
        api.get<any>(`/api/v1/companies/${companyId}/ar/payments`),
        api.get<any>(`/api/v1/companies/${companyId}/ar/aging`).catch(() => ({ data: null })),
      ]);
      setPagos(Array.isArray(p.data) ? p.data : (p.data?.payments ?? []));
      const porCliente = a.data?.clients ?? [];
      setPendientes(
        (Array.isArray(porCliente) ? porCliente : []).flatMap((c: any) =>
          (c.invoices ?? []).map((f: any) => ({
            id: f.id, number: f.number, clientName: c.clientName,
            balance: Number(f.balance), daysOverdue: Number(f.daysOverdue ?? 0),
          })),
        ),
      );
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setCargando(false); }
  }, [companyId]);

  useEffect(() => { cargar(); }, [cargar]);

  if (estado === 'cargando') return <div className="flex-1 grid place-items-center p-12"><Spinner /></div>;
  if (estado === 'sin-empresa' || !companyId) {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <EmptyState illustration={<SceneEmptyBox />} title="Todavía no tenés una empresa"
          description="Creá una empresa en el Espacio Contador para registrar cobros." />
      </div>
    );
  }

  const totalCobrado = pagos.reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <PageHeader
          icon={Coins} title="Cobros recibidos"
          subtitle="Aplicá los pagos de tus clientes sobre las facturas de venta pendientes."
          actions={<Button onClick={() => setAbrir(true)} className="cx-press"><Plus className="h-4 w-4" /> Registrar cobro</Button>}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Cobros registrados" value={String(pagos.length)} icon={Coins} />
          <StatCard label="Total cobrado" value={money(totalCobrado)} icon={Wallet} />
          <StatCard label="Facturas por cobrar" value={String(pendientes.length)} icon={Clock} />
        </div>

        <SectionCard icon={Coins} eyebrow="Ciclo de ingresos" title="Historial de cobros"
          description="Cada cobro descarga la cuenta por cobrar del cliente y entra a caja o banco.">
          {cargando ? (
            <div className="grid place-items-center py-10"><Spinner /></div>
          ) : pagos.length === 0 ? (
            <EmptyState illustration={<SceneEmptyBox />} title="Aún no hay cobros"
              description="Se aplican sobre facturas de venta a crédito que estén pendientes." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Cliente</th>
                    <th className="py-2 pr-3">Factura</th>
                    <th className="py-2 pr-3">Método</th>
                    <th className="py-2 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagos.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/60">
                      <td className="py-2 pr-3 text-gray-500">{fecha(p.paymentDate)}</td>
                      <td className="py-2 pr-3">{p.invoice?.clientName ?? '—'}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{p.invoice?.consecutiveNumber ?? '—'}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="slate">
                          {METODOS.find((m) => m.value === p.method)?.label ?? p.method ?? '—'}
                        </Badge>
                      </td>
                      <td className="py-2 text-right font-mono font-semibold tabular-nums text-emerald-700">
                        {money(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {abrir && (
        <ModalCobro companyId={companyId} pendientes={pendientes}
          onCerrar={() => setAbrir(false)} onListo={() => { setAbrir(false); cargar(); }} />
      )}
    </div>
  );
}

function ModalCobro({ companyId, pendientes, onCerrar, onListo }: {
  companyId: string; pendientes: FacturaPendiente[]; onCerrar: () => void; onListo: () => void;
}) {
  const [invoiceId, setInvoiceId] = useState('');
  const [monto, setMonto]   = useState('');
  const [dia, setDia]       = useState(new Date().toISOString().split('T')[0]);
  const [metodo, setMetodo] = useState('TRANSFER');
  const [ref, setRef]       = useState('');
  const [guardando, setGuardando] = useState(false);

  const sel = pendientes.find((f) => f.id === invoiceId);

  async function guardar() {
    if (!invoiceId) { toast.error('Elegí la factura a cobrar'); return; }
    const n = Number(monto);
    if (!n || n <= 0) { toast.error('Ingresá un monto válido'); return; }
    setGuardando(true);
    try {
      await api.post(`/api/v1/companies/${companyId}/ar/payments`, {
        invoiceId, amount: n,
        paymentDate: new Date(dia).toISOString(),
        method: metodo, reference: ref.trim() || undefined,
      });
      toast.success('Cobro registrado con su asiento');
      onListo();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setGuardando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Registrar cobro</h3>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Factura *</label>
            {pendientes.length === 0 ? (
              <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
                No hay facturas pendientes de cobro. Emití una factura a crédito primero.
              </p>
            ) : (
              <select value={invoiceId} onChange={(e) => {
                  setInvoiceId(e.target.value);
                  const f = pendientes.find((x) => x.id === e.target.value);
                  if (f) setMonto(String(f.balance));
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                <option value="">Elegí una factura…</option>
                {pendientes.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.number} — {f.clientName} · {money(f.balance)}{f.daysOverdue > 0 ? ` · ${f.daysOverdue}d vencida` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Monto *</label>
              <input type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="₡ 0.00" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Fecha *</label>
              <input type="date" value={dia} onChange={(e) => setDia(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Método</label>
              <select value={metodo} onChange={(e) => setMetodo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                {METODOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Referencia</label>
              <input value={ref} onChange={(e) => setRef(e.target.value)} maxLength={60}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Opcional" />
            </div>
          </div>

          {sel && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs leading-relaxed text-emerald-900">
              <p className="mb-1 font-semibold">Asiento que se registrará:</p>
              <p>· <b>Banco/Caja</b> al debe por {money(Number(monto) || 0)}.</p>
              <p>· <b>Cuentas por cobrar</b> al haber, bajando el saldo de {sel.clientName}.</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={onCerrar}>Cancelar</Button>
            <Button size="sm" loading={guardando} onClick={guardar}>Registrar cobro</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
