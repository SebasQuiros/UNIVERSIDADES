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
import { useEmpresaActiva } from '@/components/modulo/ModuloWorkspace';
import { Truck, Plus, X, PackageCheck, Send, Ban, Trash2, Search, Info } from 'lucide-react';

type EstadoRemision = 'DRAFT' | 'DISPATCHED' | 'DELIVERED' | 'INVOICED' | 'CANCELLED';

interface LineaRemision {
  id: string;
  description: string;
  quantity: number | string;
  product?: { id: string; name: string; sku: string | null; unit: string } | null;
}

interface Remision {
  id: string;
  number: string;
  date: string;
  status: EstadoRemision;
  notes: string | null;
  client?: { id: string; name: string; identification?: string } | null;
  lines: LineaRemision[];
}

interface ClienteOpt { id: string; name: string }
interface ProductoOpt { id: string; name: string; unit?: string; sku?: string | null }

/** Etiqueta + color por estado. Los variants son los reales de Badge. */
const ESTADOS: Record<EstadoRemision, { label: string; variant: 'slate' | 'blue' | 'green' | 'purple' | 'red' }> = {
  DRAFT:      { label: 'Borrador',   variant: 'slate'  },
  DISPATCHED: { label: 'Despachada', variant: 'blue'   },
  DELIVERED:  { label: 'Entregada',  variant: 'green'  },
  INVOICED:   { label: 'Facturada',  variant: 'purple' },
  CANCELLED:  { label: 'Anulada',    variant: 'red'    },
};

const fecha = (d: string) => {
  try { return new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return '—'; }
};

const cantidad = (n: number | string) =>
  Number(n || 0).toLocaleString('es-CR', { maximumFractionDigits: 3 });

/**
 * Remisiones: el documento de ENTREGA de mercancía que todavía no se factura.
 * Es el eslabón que a los estudiantes se les suele escapar: hay movimiento
 * físico sin movimiento contable, y el asiento aparece hasta la factura.
 */
export function RemisionesView() {
  const { companyId, estado } = useEmpresaActiva();
  const [rows, setRows] = useState<Remision[]>([]);
  const [cargando, setCargando] = useState(false);
  const [abrir, setAbrir] = useState(false);
  const [q, setQ] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!companyId) return;
    setCargando(true);
    try {
      const { data } = await api.get<any>(`/api/v1/companies/${companyId}/delivery-notes`);
      setRows(Array.isArray(data) ? data : (data?.deliveryNotes ?? []));
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setCargando(false); }
  }, [companyId]);

  useEffect(() => { cargar(); }, [cargar]);

  /** Avanza el flujo borrador → despachada → entregada. */
  async function avanzar(r: Remision) {
    if (!companyId) return;
    const siguiente: EstadoRemision | null =
      r.status === 'DRAFT' ? 'DISPATCHED' : r.status === 'DISPATCHED' ? 'DELIVERED' : null;
    if (!siguiente) return;
    setOcupado(r.id);
    try {
      await api.patch(`/api/v1/companies/${companyId}/delivery-notes/${r.id}/status`, { status: siguiente });
      toast.success(siguiente === 'DISPATCHED' ? 'Remisión despachada' : 'Entrega confirmada');
      await cargar();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setOcupado(null); }
  }

  async function anular(r: Remision) {
    if (!companyId) return;
    if (!confirm(`¿Anular la remisión ${r.number}? No genera ningún asiento, solo queda como anulada.`)) return;
    setOcupado(r.id);
    try {
      await api.patch(`/api/v1/companies/${companyId}/delivery-notes/${r.id}/cancel`, {});
      toast.success('Remisión anulada');
      await cargar();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setOcupado(null); }
  }

  async function eliminar(r: Remision) {
    if (!companyId) return;
    if (!confirm(`¿Eliminar el borrador ${r.number}? Esta acción no se puede deshacer.`)) return;
    setOcupado(r.id);
    try {
      await api.delete(`/api/v1/companies/${companyId}/delivery-notes/${r.id}`);
      toast.success('Borrador eliminado');
      await cargar();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setOcupado(null); }
  }

  if (estado === 'cargando') {
    return <div className="flex-1 grid place-items-center p-12"><Spinner /></div>;
  }
  if (estado === 'sin-empresa' || !companyId) {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <EmptyState
          illustration={<SceneEmptyBox />}
          title="Todavía no tenés una empresa"
          description="Creá una empresa en el Espacio Contador para registrar tus entregas de mercancía."
        />
      </div>
    );
  }

  const filtradas = rows.filter((r) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return r.number.toLowerCase().includes(t)
      || (r.client?.name ?? '').toLowerCase().includes(t)
      || (r.notes ?? '').toLowerCase().includes(t);
  });

  const pendientes = rows.filter((r) => r.status === 'DRAFT' || r.status === 'DISPATCHED').length;
  const porFacturar = rows.filter((r) => r.status === 'DELIVERED').length;

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <PageHeader
          icon={Truck}
          title="Remisiones"
          subtitle="Documentá la entrega de mercancía que todavía no facturás. La contabilidad ocurre al facturar."
          actions={<Button onClick={() => setAbrir(true)} className="cx-press"><Plus className="h-4 w-4" /> Nueva remisión</Button>}
        />

        {/* La confusión clásica: creer que entregar mercancía ya genera asiento. */}
        <div className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-xs leading-relaxed text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <b>Ojo:</b> una remisión <b>no genera asiento contable</b>. Solo deja constancia de que la
            mercancía salió. El ingreso, el IVA y el costo de ventas se registran cuando emitís la
            factura a partir de la entrega.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Remisiones emitidas" value={String(rows.length)} icon={Truck} />
          <StatCard label="En tránsito o borrador" value={String(pendientes)} icon={Send} />
          <StatCard label="Entregadas por facturar" value={String(porFacturar)} icon={PackageCheck} />
        </div>

        <SectionCard
          icon={Truck} eyebrow="Ciclo de ingresos" title="Entregas de mercancía"
          description="Seguí el flujo: borrador → despachada → entregada. Al facturar, la remisión pasa a facturada."
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar número o cliente…"
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
              title={rows.length === 0 ? '¡Registrá tu primera remisión!' : 'Sin resultados'}
              description={rows.length === 0
                ? 'Documentá la salida de mercancía antes de facturarla.'
                : 'Probá con otro número o cliente.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Número</th>
                    <th className="py-2 pr-3">Cliente</th>
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Artículos</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtradas.map((r) => {
                    const meta = ESTADOS[r.status] ?? ESTADOS.DRAFT;
                    const unidades = r.lines.reduce((s, l) => s + Number(l.quantity || 0), 0);
                    const trabajando = ocupado === r.id;
                    const congelada = r.status === 'INVOICED' || r.status === 'CANCELLED';
                    return (
                      <tr key={r.id} className="align-top hover:bg-gray-50/60">
                        <td className="py-2 pr-3 font-mono text-xs">{r.number}</td>
                        <td className="py-2 pr-3">{r.client?.name ?? '—'}</td>
                        <td className="py-2 pr-3 text-gray-500">{fecha(r.date)}</td>
                        <td className="py-2 pr-3 text-gray-600">
                          {r.lines.length} línea{r.lines.length === 1 ? '' : 's'}
                          <span className="ml-1 text-xs text-gray-400">({cantidad(unidades)} u.)</span>
                          <div className="mt-0.5 max-w-xs truncate text-[11px] text-gray-400">
                            {r.lines.map((l) => l.product?.name ?? l.description).join(', ')}
                          </div>
                        </td>
                        <td className="py-2 pr-3"><Badge variant={meta.variant}>{meta.label}</Badge></td>
                        <td className="py-2">
                          <div className="flex justify-end gap-1.5">
                            {!congelada && (r.status === 'DRAFT' || r.status === 'DISPATCHED') && (
                              <Button size="sm" variant="secondary" loading={trabajando} onClick={() => avanzar(r)}>
                                {r.status === 'DRAFT'
                                  ? <><Send className="h-3.5 w-3.5" /> Despachar</>
                                  : <><PackageCheck className="h-3.5 w-3.5" /> Confirmar entrega</>}
                              </Button>
                            )}
                            {!congelada && (
                              <Button size="sm" variant="ghost" loading={trabajando} onClick={() => anular(r)}>
                                <Ban className="h-3.5 w-3.5" /> Anular
                              </Button>
                            )}
                            {r.status === 'DRAFT' && (
                              <Button size="sm" variant="ghost" loading={trabajando} onClick={() => eliminar(r)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {abrir && (
        <ModalNuevaRemision
          companyId={companyId}
          onCerrar={() => setAbrir(false)}
          onListo={() => { setAbrir(false); cargar(); }}
        />
      )}
    </div>
  );
}

interface LineaForm { productId: string; quantity: string }

function ModalNuevaRemision({ companyId, onCerrar, onListo }: {
  companyId: string; onCerrar: () => void; onListo: () => void;
}) {
  const [clientes, setClientes]   = useState<ClienteOpt[]>([]);
  const [productos, setProductos] = useState<ProductoOpt[]>([]);
  const [clientId, setClientId]   = useState('');
  const [fechaDoc, setFechaDoc]   = useState(new Date().toISOString().split('T')[0]);
  const [notas, setNotas]         = useState('');
  const [lineas, setLineas]       = useState<LineaForm[]>([{ productId: '', quantity: '1' }]);
  const [guardando, setGuardando] = useState(false);

  // Catálogos: sin ellos no se puede armar la remisión, se cargan al abrir.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [cli, prod] = await Promise.all([
          api.get<any>(`/api/v1/companies/${companyId}/clients`),
          api.get<any>(`/api/v1/companies/${companyId}/products`),
        ]);
        if (!vivo) return;
        const norm = (d: any, k: string) => Array.isArray(d) ? d : (d?.[k] ?? []);
        setClientes(norm(cli.data, 'clients'));
        setProductos(norm(prod.data, 'products'));
      } catch (e) { if (vivo) toast.error(getErrorMessage(e)); }
    })();
    return () => { vivo = false; };
  }, [companyId]);

  const setLinea = (i: number, patch: Partial<LineaForm>) =>
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const agregarLinea = () => setLineas((prev) => [...prev, { productId: '', quantity: '1' }]);
  const quitarLinea  = (i: number) => setLineas((prev) => prev.filter((_, idx) => idx !== i));

  async function guardar() {
    if (!clientId) { toast.error('Elegí el cliente que recibe la mercancía'); return; }
    const validas = lineas
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => ({ productId: l.productId, quantity: Number(l.quantity) }));
    if (validas.length === 0) { toast.error('Agregá al menos un producto con cantidad mayor a cero'); return; }

    setGuardando(true);
    try {
      await api.post(`/api/v1/companies/${companyId}/delivery-notes`, {
        clientId,
        date: new Date(fechaDoc).toISOString(),
        notes: notas.trim() || undefined,
        lines: validas,
      });
      toast.success('Remisión creada en borrador');
      onListo();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setGuardando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Nueva remisión</h3>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Cliente *</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                <option value="">Seleccioná un cliente…</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Fecha de entrega *</label>
              <input type="date" value={fechaDoc} onChange={(e) => setFechaDoc(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Mercancía entregada *</label>
              <Button size="sm" variant="ghost" onClick={agregarLinea}>
                <Plus className="h-3.5 w-3.5" /> Agregar línea
              </Button>
            </div>

            <div className="space-y-2">
              {lineas.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={l.productId}
                    onChange={(e) => setLinea(i, { productId: e.target.value })}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Producto…</option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                    ))}
                  </select>
                  <input
                    type="number" min="0" step="0.001" value={l.quantity}
                    onChange={(e) => setLinea(i, { quantity: e.target.value })}
                    className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm text-right"
                    placeholder="Cantidad"
                  />
                  <button
                    onClick={() => quitarLinea(i)}
                    disabled={lineas.length === 1}
                    className="rounded-lg p-2 text-gray-400 hover:text-red-600 disabled:opacity-30"
                    title="Quitar línea"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Notas</label>
            <input value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={200}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Transportista, dirección de entrega… (opcional)" />
          </div>

          {/* Se repite acá, en el punto de decisión: sin precios y sin asiento. */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs leading-relaxed text-blue-900">
            <p><b>La remisión no genera asiento contable.</b> Por eso no se piden precios ni IVA: solo qué salió y cuánto.</p>
            <p className="mt-1">Al facturar esta entrega se registran el ingreso, el IVA por pagar y el costo de ventas.</p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={onCerrar}>Cancelar</Button>
            <Button size="sm" loading={guardando} onClick={guardar}>Crear remisión</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
