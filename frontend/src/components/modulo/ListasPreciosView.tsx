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
import { Tags, Plus, X, Star, Trash2, Package, ListChecks, Check } from 'lucide-react';

interface Lista {
  id: string;
  name: string;
  currency: string;
  isDefault: boolean;
  isActive: boolean;
  itemCount: number;
}

interface Item {
  id: string;
  productId: string;
  price: number;
  productName: string;
  sku: string | null;
  unit: string;
  basePrice: number;
}

interface Detalle extends Omit<Lista, 'itemCount'> {
  items: Item[];
}

interface Producto {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  price: number | string;
}

const money = (n: number | string) =>
  '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Listas de precios: precios alternativos (mayoreo, promoción) distintos del
 * precio base del catálogo. La vista compara siempre contra ese precio base,
 * porque lo que el estudiante debe entender es la *diferencia*, no el número.
 */
export function ListasPreciosView() {
  const { companyId, estado } = useEmpresaActiva();

  const [listas, setListas]     = useState<Lista[]>([]);
  const [productos, setProds]   = useState<Producto[]>([]);
  const [selId, setSelId]       = useState<string | null>(null);
  const [detalle, setDetalle]   = useState<Detalle | null>(null);
  const [cargando, setCargando] = useState(false);
  const [abrirNueva, setAbrirNueva] = useState(false);
  const [abrirAgregar, setAbrirAgregar] = useState(false);

  const cargarListas = useCallback(async () => {
    if (!companyId) return;
    setCargando(true);
    try {
      const { data } = await api.get<Lista[]>(`/api/v1/companies/${companyId}/price-lists`);
      const rows = Array.isArray(data) ? data : [];
      setListas(rows);
      // Selección automática: sin esto la pantalla arranca vacía y parece rota.
      setSelId((prev) => (prev && rows.some((l) => l.id === prev) ? prev : rows[0]?.id ?? null));
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setCargando(false); }
  }, [companyId]);

  // El catálogo se trae una sola vez: sirve para el precio base y para el
  // selector de "agregar producto".
  const cargarProductos = useCallback(async () => {
    if (!companyId) return;
    try {
      const { data } = await api.get<Producto[]>(`/api/v1/companies/${companyId}/products`);
      setProds(Array.isArray(data) ? data : []);
    } catch { /* el detalle igual trae basePrice; no vale bloquear la vista */ }
  }, [companyId]);

  const cargarDetalle = useCallback(async () => {
    if (!companyId || !selId) { setDetalle(null); return; }
    try {
      const { data } = await api.get<Detalle>(`/api/v1/companies/${companyId}/price-lists/${selId}`);
      setDetalle(data);
    } catch (e) { toast.error(getErrorMessage(e)); }
  }, [companyId, selId]);

  useEffect(() => { cargarListas(); cargarProductos(); }, [cargarListas, cargarProductos]);
  useEffect(() => { cargarDetalle(); }, [cargarDetalle]);

  if (estado === 'cargando') {
    return <div className="flex-1 grid place-items-center p-12"><Spinner /></div>;
  }
  if (estado === 'sin-empresa' || !companyId) {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <EmptyState
          illustration={<SceneEmptyBox />}
          title="Todavía no tenés una empresa"
          description="Creá una empresa en el Espacio Contador para armar tus listas de precios."
        />
      </div>
    );
  }

  async function marcarPredeterminada(id: string) {
    try {
      await api.patch(`/api/v1/companies/${companyId}/price-lists/${id}`, { isDefault: true });
      toast.success('Lista predeterminada actualizada');
      cargarListas();
    } catch (e) { toast.error(getErrorMessage(e)); }
  }

  async function eliminarLista(id: string) {
    if (!confirm('¿Eliminar esta lista y todos sus precios?')) return;
    try {
      await api.delete(`/api/v1/companies/${companyId}/price-lists/${id}`);
      toast.success('Lista eliminada');
      if (selId === id) setSelId(null);
      cargarListas();
    } catch (e) { toast.error(getErrorMessage(e)); }
  }

  async function renombrar(l: Lista) {
    const nombre = prompt('Nuevo nombre de la lista', l.name);
    if (!nombre || !nombre.trim() || nombre.trim() === l.name) return;
    try {
      await api.patch(`/api/v1/companies/${companyId}/price-lists/${l.id}`, { name: nombre.trim() });
      toast.success('Lista renombrada');
      cargarListas();
      cargarDetalle();
    } catch (e) { toast.error(getErrorMessage(e)); }
  }

  async function fijarPrecio(productId: string, price: number) {
    try {
      await api.put(`/api/v1/companies/${companyId}/price-lists/${selId}/items`, { productId, price });
      cargarDetalle();
      cargarListas();
    } catch (e) { toast.error(getErrorMessage(e)); }
  }

  async function quitarProducto(productId: string) {
    try {
      await api.delete(`/api/v1/companies/${companyId}/price-lists/${selId}/items/${productId}`);
      toast.success('Producto quitado de la lista');
      cargarDetalle();
      cargarListas();
    } catch (e) { toast.error(getErrorMessage(e)); }
  }

  const totalPrecios = listas.reduce((s, l) => s + l.itemCount, 0);
  const predeterminada = listas.find((l) => l.isDefault);

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <PageHeader
          icon={Tags}
          title="Listas de precios"
          subtitle="Definí precios alternativos —mayoreo, promoción— distintos del precio base del catálogo."
          actions={<Button onClick={() => setAbrirNueva(true)} className="cx-press"><Plus className="h-4 w-4" /> Nueva lista</Button>}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Listas creadas" value={String(listas.length)} icon={ListChecks} />
          <StatCard label="Precios definidos" value={String(totalPrecios)} icon={Tags} />
          <StatCard label="Predeterminada" value={predeterminada?.name ?? '—'} icon={Star} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Columna izquierda: las listas de la empresa. */}
          <SectionCard
            icon={ListChecks} eyebrow="Catálogo comercial" title="Tus listas"
            description="Una sola puede ser la predeterminada."
            className="lg:col-span-1"
          >
            {cargando ? (
              <div className="grid place-items-center py-10"><Spinner /></div>
            ) : listas.length === 0 ? (
              <EmptyState
                illustration={<SceneEmptyBox />}
                title="Todavía no hay listas"
                description="Creá una lista de mayoreo o de promoción para empezar."
              />
            ) : (
              <ul className="space-y-2">
                {listas.map((l) => (
                  <li key={l.id}>
                    <button
                      onClick={() => setSelId(l.id)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        l.id === selId ? 'border-blue-300 bg-blue-50/70' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-gray-900">{l.name}</span>
                        {l.isDefault && <Badge variant="gold">Predeterminada</Badge>}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <span>{l.itemCount} producto{l.itemCount === 1 ? '' : 's'}</span>
                        <span>·</span>
                        <span>{l.currency}</span>
                      </div>
                    </button>
                    <div className="mt-1 flex gap-1 px-1">
                      <Button variant="ghost" size="sm" onClick={() => renombrar(l)}>Renombrar</Button>
                      {!l.isDefault && (
                        <Button variant="ghost" size="sm" onClick={() => marcarPredeterminada(l.id)}>
                          <Star className="h-3.5 w-3.5" /> Predeterminar
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => eliminarLista(l.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Columna derecha: los productos de la lista seleccionada. */}
          <SectionCard
            icon={Package} eyebrow="Precios" title={detalle ? detalle.name : 'Seleccioná una lista'}
            description="Compará cada precio contra el precio base del catálogo."
            className="lg:col-span-2"
            action={detalle
              ? <Button size="sm" variant="secondary" onClick={() => setAbrirAgregar(true)}>
                  <Plus className="h-4 w-4" /> Agregar producto
                </Button>
              : undefined}
          >
            {!detalle ? (
              <EmptyState
                illustration={<SceneEmptyBox />}
                title="Sin lista seleccionada"
                description="Elegí una lista a la izquierda para ver y editar sus precios."
              />
            ) : detalle.items.length === 0 ? (
              <EmptyState
                illustration={<SceneEmptyBox />}
                title="Esta lista está vacía"
                description="Agregá productos y fijales un precio distinto del base."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="py-2 pr-3">Producto</th>
                      <th className="py-2 pr-3 text-right">Precio base</th>
                      <th className="py-2 pr-3 text-right">Precio de la lista</th>
                      <th className="py-2 pr-3">Diferencia</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detalle.items.map((it) => (
                      <FilaPrecio
                        key={it.id}
                        item={it}
                        onGuardar={(p) => fijarPrecio(it.productId, p)}
                        onQuitar={() => quitarProducto(it.productId)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {abrirNueva && (
        <ModalNuevaLista
          companyId={companyId}
          onCerrar={() => setAbrirNueva(false)}
          onListo={() => { setAbrirNueva(false); cargarListas(); }}
        />
      )}

      {abrirAgregar && detalle && (
        <ModalAgregarProducto
          productos={productos.filter((p) => !detalle.items.some((i) => i.productId === p.id))}
          onCerrar={() => setAbrirAgregar(false)}
          onListo={async (productId, price) => {
            await fijarPrecio(productId, price);
            setAbrirAgregar(false);
          }}
        />
      )}
    </div>
  );
}

/** Fila con precio editable en sitio: editar precios es la tarea principal. */
function FilaPrecio({ item, onGuardar, onQuitar }: {
  item: Item; onGuardar: (price: number) => void | Promise<void>; onQuitar: () => void;
}) {
  const [valor, setValor] = useState(String(item.price));
  // Si el detalle se recarga, el input debe reflejar el valor del servidor.
  useEffect(() => { setValor(String(item.price)); }, [item.price]);

  const num   = parseFloat(valor || '0') || 0;
  const sucio = num !== Number(item.price);
  const dif   = Number(item.price) - Number(item.basePrice);
  const pct   = item.basePrice > 0 ? (dif / item.basePrice) * 100 : 0;

  return (
    <tr className="hover:bg-gray-50/60">
      <td className="py-2 pr-3">
        <div className="font-medium text-gray-900">{item.productName}</div>
        <div className="text-xs text-gray-400">{item.sku ?? '—'} · {item.unit}</div>
      </td>
      <td className="py-2 pr-3 text-right font-mono tabular-nums text-gray-500">{money(item.basePrice)}</td>
      <td className="py-2 pr-3 text-right">
        <input
          type="number" min="0" step="0.01" value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="w-32 rounded-lg border border-gray-300 px-2 py-1 text-right font-mono text-sm tabular-nums"
        />
      </td>
      <td className="py-2 pr-3">
        {dif === 0 ? (
          <Badge variant="slate">Igual al base</Badge>
        ) : dif < 0 ? (
          <Badge variant="green">−{money(Math.abs(dif))} ({Math.abs(pct).toFixed(1)}%)</Badge>
        ) : (
          <Badge variant="amber">+{money(dif)} ({pct.toFixed(1)}%)</Badge>
        )}
      </td>
      <td className="py-2 text-right whitespace-nowrap">
        {sucio && (
          <Button size="sm" onClick={() => onGuardar(num)}><Check className="h-3.5 w-3.5" /> Guardar</Button>
        )}
        <Button variant="ghost" size="sm" onClick={onQuitar}>
          <Trash2 className="h-3.5 w-3.5 text-red-500" />
        </Button>
      </td>
    </tr>
  );
}

function ModalNuevaLista({ companyId, onCerrar, onListo }: {
  companyId: string; onCerrar: () => void; onListo: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [moneda, setMoneda] = useState('CRC');
  const [porDefecto, setPorDefecto] = useState(false);
  const [guardando, setGuardando]   = useState(false);

  async function guardar() {
    if (!nombre.trim()) { toast.error('Escribí el nombre de la lista'); return; }
    setGuardando(true);
    try {
      await api.post(`/api/v1/companies/${companyId}/price-lists`, {
        name: nombre.trim(), currency: moneda, isDefault: porDefecto,
      });
      toast.success('Lista de precios creada');
      onListo();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setGuardando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Nueva lista de precios</h3>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Nombre *</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Mayoreo, Promoción de julio…" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Moneda</label>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
              <option value="CRC">CRC — Colones</option>
              <option value="USD">USD — Dólares</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={porDefecto} onChange={(e) => setPorDefecto(e.target.checked)} />
            Usar como lista predeterminada
          </label>
          <p className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-xs leading-relaxed text-amber-900">
            Solo una lista puede ser la predeterminada: al marcar esta, la anterior se desmarca automáticamente.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={onCerrar}>Cancelar</Button>
            <Button size="sm" loading={guardando} onClick={guardar}>Crear lista</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalAgregarProducto({ productos, onCerrar, onListo }: {
  productos: Producto[]; onCerrar: () => void; onListo: (productId: string, price: number) => Promise<void>;
}) {
  const [productId, setProductId] = useState('');
  const [precio, setPrecio]       = useState('');
  const [guardando, setGuardando] = useState(false);

  const sel = productos.find((p) => p.id === productId);

  async function guardar() {
    if (!productId) { toast.error('Elegí un producto'); return; }
    const num = parseFloat(precio || '0');
    if (!(num >= 0)) { toast.error('El precio no puede ser negativo'); return; }
    setGuardando(true);
    try { await onListo(productId, num); }
    finally { setGuardando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Agregar producto a la lista</h3>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        {productos.length === 0 ? (
          <EmptyState
            illustration={<SceneEmptyBox />}
            title="No quedan productos por agregar"
            description="Todos los productos del catálogo ya tienen precio en esta lista."
          />
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Producto *</label>
              <select
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  // Se precarga el precio base: casi siempre se ajusta desde ahí.
                  const p = productos.find((x) => x.id === e.target.value);
                  if (p) setPrecio(String(Number(p.price)));
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">Elegí un producto…</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Precio en esta lista *</label>
              <input type="number" min="0" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="₡ 0.00" />
              {sel && (
                <p className="mt-1 text-xs text-gray-500">Precio base del catálogo: {money(sel.price)}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={onCerrar}>Cancelar</Button>
              <Button size="sm" loading={guardando} onClick={guardar}>Fijar precio</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
