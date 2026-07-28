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
import { SceneEmptyBox } from '@/components/illustrations';
import { Badge } from '@/components/ui/Badge';
import { ClipboardList, Package, ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react';

interface KardexRow {
  id: string; fecha: string; tipo: string; detalle: string; notas: string | null;
  entrada: { cantidad: string; costoUnitario: string; total: string } | null;
  salida:  { cantidad: string; costoUnitario: string; total: string } | null;
  saldo:   { cantidad: string; costoUnitario: string; total: string };
}
interface Kardex {
  product: { id: string; name: string; sku: string | null; unit: string; stockActual: string };
  costMethod: 'PEPS' | 'UEPS' | 'PROMEDIO';
  rows: KardexRow[];
  totals: { entradas: string; salidas: string; saldoQty: string; saldoTotal: string };
}
interface Product { id: string; name: string; isService?: boolean; }

const fmt  = (n: string | number) => '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty  = (n: string | number) => Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const date = (d: string) => { try { return new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: '2-digit' }); } catch { return ''; } };

const METHOD_INFO: Record<string, string> = {
  PEPS: 'Primero en entrar, primero en salir: las salidas se valúan con el costo de las compras más antiguas.',
  UEPS: 'Último en entrar, primero en salir: las salidas se valúan con el costo de las compras más recientes.',
  PROMEDIO: 'Costo promedio ponderado de las existencias.',
};

/** Kardex: tarjeta de control de existencias por producto (entradas/salidas/saldo). */
export function KardexView() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [products, setProducts]   = useState<Product[]>([]);
  const [productId, setProductId] = useState<string>('');
  const [kardex, setKardex]       = useState<Kardex | null>(null);
  const [method, setMethod]       = useState<'PEPS' | 'UEPS' | 'PROMEDIO'>('PEPS');
  const [phase, setPhase]         = useState<'loading' | 'ready' | 'no-company'>('loading');
  const [loadingK, setLoadingK]   = useState(false);

  // Resolver empresa activa + productos
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get<any[]>('/api/v1/attempts');
        const list = Array.isArray(data) ? data : [];
        const active = list.find((x) => x.status === 'IN_PROGRESS') ?? list.find((x) => x.company) ?? list[0];
        const cId: string | undefined = active?.company?.id;
        if (!cId) { if (alive) setPhase('no-company'); return; }
        if (!alive) return;
        setCompanyId(cId);
        const [pr, cm] = await Promise.all([
          api.get<Product[]>(`/api/v1/companies/${cId}/products`),
          api.get<{ costMethod: any }>(`/api/v1/companies/${cId}/inventory/cost-method`).catch(() => ({ data: { costMethod: 'PEPS' } })),
        ]);
        if (!alive) return;
        const items = (Array.isArray(pr.data) ? pr.data : []).filter((p) => !p.isService);
        setProducts(items);
        setMethod(cm.data.costMethod ?? 'PEPS');
        if (items[0]) setProductId(items[0].id);
        setPhase('ready');
      } catch { if (alive) setPhase('no-company'); }
    })();
    return () => { alive = false; };
  }, []);

  const loadKardex = useCallback(async () => {
    if (!companyId || !productId) { setKardex(null); return; }
    setLoadingK(true);
    try {
      const { data } = await api.get<Kardex>(`/api/v1/companies/${companyId}/inventory/products/${productId}/kardex`);
      setKardex(data);
    } catch { setKardex(null); }
    finally { setLoadingK(false); }
  }, [companyId, productId]);

  useEffect(() => { loadKardex(); }, [loadKardex]);

  async function changeMethod(m: 'PEPS' | 'UEPS' | 'PROMEDIO') {
    if (!companyId) return;
    const prev = method;
    setMethod(m);
    try {
      await api.patch(`/api/v1/companies/${companyId}/inventory/cost-method`, { costMethod: m });
      toast.success(`Método de valuación: ${m} (aplica a salidas futuras)`);
      loadKardex();
    } catch (e) { setMethod(prev); toast.error(getErrorMessage(e)); }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#FBF8F1] p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Inventario"
          title="Kardex"
          subtitle="Tarjeta de control de existencias: entradas, salidas y saldo valuado de cada producto."
          icon={ClipboardList}
          iconTint="#1B2E6E"
          className="mb-6"
        />

        {phase === 'loading' ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : phase === 'no-company' ? (
          <EmptyState illustration={<SceneEmptyBox size={200} />} title="Todavía no tenés una empresa"
            description="Creá tu empresa dentro de un ejercicio para llevar el control de inventario." />
        ) : (
          <>
            {/* Controles: producto + método de valuación */}
            <div className="mb-6 flex flex-wrap items-end gap-4 rounded-card border border-gray-200/70 bg-white p-4 shadow-card">
              <div className="min-w-[220px] flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Producto</label>
                <select value={productId} onChange={(e) => setProductId(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60">
                  {products.length === 0 && <option value="">Sin productos</option>}
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Método de valuación</label>
                <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
                  {(['PEPS', 'UEPS', 'PROMEDIO'] as const).map((m) => (
                    <button key={m} onClick={() => changeMethod(m)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                        method === m ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="-mt-3 mb-6 text-xs leading-relaxed text-gray-500">{METHOD_INFO[method]}</p>

            {loadingK ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : !kardex || kardex.rows.length === 0 ? (
              <SectionCard icon={Package} iconTint="#2563EB" title="Sin movimientos"
                description="Este producto todavía no tiene entradas ni salidas registradas.">
                <p className="py-4 text-center text-sm text-gray-400">
                  Registrá una compra o una venta para ver el Kardex.
                </p>
              </SectionCard>
            ) : (
              <>
                <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <StatCard label="Entradas (costo)" value={fmt(kardex.totals.entradas)} icon={ArrowDownCircle} tint="#2563EB" />
                  <StatCard label="Salidas (costo)"  value={fmt(kardex.totals.salidas)}  icon={ArrowUpCircle}   tint="#DC2626" />
                  <StatCard label="Existencias"      value={`${qty(kardex.totals.saldoQty)} ${kardex.product.unit}`} icon={Package} tint="#B8860B" />
                  <StatCard label="Saldo valuado"    value={fmt(kardex.totals.saldoTotal)} icon={Wallet} tint="#1B2E6E" />
                </div>

                <SectionCard flushBody
                  icon={ClipboardList} iconTint="#1B2E6E"
                  title={`Kardex — ${kardex.product.name}`}
                  description={`Método ${kardex.costMethod}`}
                  action={<Badge variant="gold">{kardex.costMethod}</Badge>}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                          <th rowSpan={2} className="px-3 py-2 text-left font-semibold">Fecha</th>
                          <th rowSpan={2} className="px-3 py-2 text-left font-semibold">Detalle</th>
                          <th colSpan={3} className="border-l border-gray-200 px-3 py-1.5 text-center font-semibold text-blue-700">Entradas</th>
                          <th colSpan={3} className="border-l border-gray-200 px-3 py-1.5 text-center font-semibold text-red-700">Salidas</th>
                          <th colSpan={3} className="border-l border-gray-200 px-3 py-1.5 text-center font-semibold text-gray-900">Saldo</th>
                        </tr>
                        <tr className="border-b border-gray-200 bg-gray-50 text-[10px] uppercase tracking-wider text-gray-400">
                          {['Cant.', 'C/U', 'Total', 'Cant.', 'C/U', 'Total', 'Cant.', 'C/U', 'Total'].map((h, i) => (
                            <th key={i} className={`px-3 py-1.5 text-right font-medium ${i % 3 === 0 ? 'border-l border-gray-200' : ''}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {kardex.rows.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50/60">
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums text-gray-500">{date(r.fecha)}</td>
                            <td className="px-3 py-2 text-gray-700">{r.detalle}</td>
                            {/* Entradas */}
                            <td className="border-l border-gray-100 px-3 py-2 text-right font-mono text-xs tabular-nums text-blue-700">{r.entrada ? qty(r.entrada.cantidad) : '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-blue-700">{r.entrada ? fmt(r.entrada.costoUnitario) : '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-blue-700">{r.entrada ? fmt(r.entrada.total) : '—'}</td>
                            {/* Salidas */}
                            <td className="border-l border-gray-100 px-3 py-2 text-right font-mono text-xs tabular-nums text-red-600">{r.salida ? qty(r.salida.cantidad) : '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-red-600">{r.salida ? fmt(r.salida.costoUnitario) : '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-red-600">{r.salida ? fmt(r.salida.total) : '—'}</td>
                            {/* Saldo */}
                            <td className="border-l border-gray-100 px-3 py-2 text-right font-mono text-xs font-semibold tabular-nums text-gray-900">{qty(r.saldo.cantidad)}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-gray-600">{fmt(r.saldo.costoUnitario)}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs font-semibold tabular-nums text-gray-900">{fmt(r.saldo.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                          <td colSpan={4} className="px-3 py-2 text-right text-xs uppercase tracking-wide text-gray-500">Totales</td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-blue-700">{fmt(kardex.totals.entradas)}</td>
                          <td colSpan={2} />
                          <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-red-600">{fmt(kardex.totals.salidas)}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-gray-900">{qty(kardex.totals.saldoQty)}</td>
                          <td />
                          <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-gray-900">{fmt(kardex.totals.saldoTotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </SectionCard>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
