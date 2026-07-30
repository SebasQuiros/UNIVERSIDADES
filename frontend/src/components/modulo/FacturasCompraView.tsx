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
import { ShoppingCart, Plus, X, Receipt, Wallet, Search } from 'lucide-react';

interface PurchaseInvoice {
  id: string;
  supplierName: string;
  invoiceNumber: string;
  date: string;
  subtotal: number | string;
  taxRate: number | string;
  taxAmount: number | string;
  total: number | string;
  description: string | null;
  isAccepted: boolean;
}

// Porcentaje, la convención de todo el sistema.
const TASAS = [
  { value: 13, label: '13% — Tarifa general' },
  { value: 8,  label: '8% — Medicina privada / seguros' },
  { value: 4,  label: '4% — Boletos aéreos / espectáculos' },
  { value: 2,  label: '2% — Canasta básica' },
  { value: 1,  label: '1% — Medicamentos / insumos agropecuarios' },
  { value: 0,  label: '0% — Exento' },
];

const money = (n: number | string) =>
  '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fecha = (d: string) => {
  try { return new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return '—'; }
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Facturas de compra en el Espacio Contador. Antes este slug era un esqueleto:
 * el botón de crear solo mostraba "en construcción", así que no se podían
 * registrar compras fuera de un ejercicio.
 */
export function FacturasCompraView() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [rows, setRows]   = useState<PurchaseInvoice[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'no-company'>('loading');
  const [cargando, setCargando] = useState(false);
  const [abrir, setAbrir] = useState(false);
  const [q, setQ] = useState('');

  // Empresa activa: primero la del ejercicio en curso, si no la de práctica.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        let cId: string | undefined;
        try {
          const { data } = await api.get<any[]>('/api/v1/attempts');
          const lista = Array.isArray(data) ? data : [];
          const activo = lista.find((x) => x.status === 'IN_PROGRESS') ?? lista.find((x) => x.company) ?? lista[0];
          cId = activo?.company?.id;
        } catch { /* sigue con las de práctica */ }
        if (!cId) {
          const { data } = await api.get<any[]>('/api/v1/practice/companies');
          cId = Array.isArray(data) && data[0] ? data[0].id : undefined;
        }
        if (!vivo) return;
        if (!cId) { setPhase('no-company'); return; }
        setCompanyId(cId);
        setPhase('ready');
      } catch { if (vivo) setPhase('no-company'); }
    })();
    return () => { vivo = false; };
  }, []);

  const cargar = useCallback(async () => {
    if (!companyId) return;
    setCargando(true);
    try {
      const { data } = await api.get<any>(`/api/v1/companies/${companyId}/purchase-invoices`);
      setRows(data?.invoices ?? (Array.isArray(data) ? data : []));
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setCargando(false); }
  }, [companyId]);

  useEffect(() => { cargar(); }, [cargar]);

  if (phase === 'loading') {
    return <div className="flex-1 grid place-items-center p-12"><Spinner /></div>;
  }
  if (phase === 'no-company') {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <EmptyState
          illustration={<SceneEmptyBox />}
          title="Todavía no tenés una empresa"
          description="Creá una empresa en el Espacio Contador para registrar tus compras."
        />
      </div>
    );
  }

  const filtradas = rows.filter((r) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return r.supplierName?.toLowerCase().includes(t)
      || r.invoiceNumber?.toLowerCase().includes(t)
      || (r.description ?? '').toLowerCase().includes(t);
  });

  const totalPeriodo = rows.reduce((s, r) => s + Number(r.total || 0), 0);
  const creditoFiscal = rows.reduce((s, r) => s + Number(r.taxAmount || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <PageHeader
          icon={ShoppingCart}
          title="Facturas de compra"
          subtitle="Registrá tus compras a proveedores. Cada una genera su asiento y su crédito fiscal para el D-104."
          actions={<Button onClick={() => setAbrir(true)} className="cx-press"><Plus className="h-4 w-4" /> Nueva factura de compra</Button>}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Compras registradas" value={String(rows.length)} icon={Receipt} />
          <StatCard label="Total del período" value={money(totalPeriodo)} icon={ShoppingCart} />
          <StatCard label="Crédito fiscal" value={money(creditoFiscal)} icon={Wallet} />
        </div>

        <SectionCard
          icon={Receipt} eyebrow="Ciclo de egresos" title="Comprobantes recibidos"
          description="Las compras aceptadas suman crédito fiscal a tu declaración de IVA."
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar proveedor o número…"
                className="w-56 rounded-lg border border-gray-300 py-1.5 pl-8 pr-3 text-sm"
              />
            </div>
          }
        >
          {cargando ? (
            <div className="grid place-items-center py-10"><Spinner /></div>
          ) : filtradas.length === 0 ? (
            <EmptyState
              illustration={<SceneEmptyBox />}
              title={rows.length === 0 ? '¡Registrá tu primera compra!' : 'Sin resultados'}
              description={rows.length === 0
                ? 'Genera crédito fiscal para tu D-104 y su asiento contable.'
                : 'Probá con otro proveedor o número de factura.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Número</th>
                    <th className="py-2 pr-3">Proveedor</th>
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3 text-right">Subtotal</th>
                    <th className="py-2 pr-3 text-right">IVA</th>
                    <th className="py-2 pr-3 text-right">Total</th>
                    <th className="py-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtradas.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/60">
                      <td className="py-2 pr-3 font-mono text-xs">{r.invoiceNumber}</td>
                      <td className="py-2 pr-3">{r.supplierName}</td>
                      <td className="py-2 pr-3 text-gray-500">{fecha(r.date)}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">{money(r.subtotal)}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">
                        {money(r.taxAmount)}
                        <span className="ml-1 text-[10px] text-gray-400">{Number(r.taxRate).toFixed(0)}%</span>
                      </td>
                      <td className="py-2 pr-3 text-right font-mono font-semibold tabular-nums">{money(r.total)}</td>
                      <td className="py-2">
                        <Badge variant={r.isAccepted ? 'green' : 'slate'}>
                          {r.isAccepted ? 'Aceptada' : 'Pendiente'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {abrir && companyId && (
        <ModalNuevaCompra
          companyId={companyId}
          onCerrar={() => setAbrir(false)}
          onListo={() => { setAbrir(false); cargar(); }}
        />
      )}
    </div>
  );
}

function ModalNuevaCompra({ companyId, onCerrar, onListo }: {
  companyId: string; onCerrar: () => void; onListo: () => void;
}) {
  const [proveedor, setProveedor] = useState('');
  const [cedula, setCedula]       = useState('');
  const [numero, setNumero]       = useState('');
  const [fechaDoc, setFechaDoc]   = useState(new Date().toISOString().split('T')[0]);
  const [subtotal, setSubtotal]   = useState('');
  const [tasa, setTasa]           = useState('13');
  const [desc, setDesc]           = useState('');
  const [guardando, setGuardando] = useState(false);

  const subNum  = parseFloat(subtotal || '0') || 0;
  const tasaNum = parseFloat(tasa) || 0;
  const iva     = round2(subNum * tasaNum / 100);
  const total   = round2(subNum + iva);

  async function guardar() {
    if (!proveedor.trim()) { toast.error('Escribí el nombre del proveedor'); return; }
    if (!numero.trim())    { toast.error('Escribí el número de factura'); return; }
    if (subNum <= 0)       { toast.error('El subtotal debe ser mayor a cero'); return; }
    setGuardando(true);
    try {
      await api.post(`/api/v1/companies/${companyId}/purchase-invoices`, {
        supplierName:   proveedor.trim(),
        supplierCedula: cedula.trim() || undefined,
        invoiceNumber:  numero.trim(),
        date:           new Date(fechaDoc).toISOString(),
        subtotal:       subNum,
        taxRate:        tasaNum,
        description:    desc.trim() || undefined,
      });
      toast.success('Compra registrada con su asiento contable');
      onListo();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setGuardando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Nueva factura de compra</h3>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Proveedor *</label>
              <input value={proveedor} onChange={(e) => setProveedor(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Nombre del proveedor" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Cédula</label>
              <input value={cedula} onChange={(e) => setCedula(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Opcional" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">N.º de factura *</label>
              <input value={numero} onChange={(e) => setNumero(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="00100001010000000001" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Fecha *</label>
              <input type="date" value={fechaDoc} onChange={(e) => setFechaDoc(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Subtotal *</label>
              <input type="number" min="0" step="0.01" value={subtotal} onChange={(e) => setSubtotal(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="₡ 0.00" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Tasa de IVA *</label>
              <select value={tasa} onChange={(e) => setTasa(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                {TASAS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Descripción</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Qué compraste (opcional)" />
          </div>

          {/* El asiento es lo que se está enseñando: mostrarlo antes de confirmar. */}
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-xs leading-relaxed text-amber-900">
            <div className="mb-1 flex items-center justify-between font-semibold">
              <span>Total a registrar</span>
              <span className="font-mono text-sm">{money(total)}</span>
            </div>
            <p>Subtotal {money(subNum)} + IVA {money(iva)} ({tasaNum}%).</p>
            <p className="mt-1">El IVA soportado va a <b>crédito fiscal</b> y se resta en tu D-104.</p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={onCerrar}>Cancelar</Button>
            <Button size="sm" loading={guardando} onClick={guardar}>Registrar compra</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
