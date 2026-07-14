'use client';

/**
 * Página de inventario del estudiante (Fase 2 — FIFO).
 *
 * Muestra:
 *  · Resumen de valuación total al costo (saldo cuenta 1.1.03.01).
 *  · Tabla de productos con qty, costo promedio, valor total.
 *  · Al click sobre un producto: panel lateral con sus lotes activos
 *    + kardex de movimientos.
 *
 * Lectura pura — las mutaciones (addLot, consumeFIFO) las dispara el
 * sistema automáticamente al emitir factura o aceptar compra cuando
 * `ExerciseConfig.autoInventory` está activado.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Boxes, Layers, ArrowDownCircle, ArrowUpCircle, MinusCircle, X, ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArtInventory, SceneEmptyBox } from '@/components/illustrations';
import { getErrorMessage } from '@/lib/utils';

interface ValuationItem {
  productId: string;
  productName: string;
  sku: string | null;
  unit: string;
  qty: number;
  cost: number;
  avgUnitCost: number;
}
interface Valuation {
  items: ValuationItem[];
  total: number;
}
interface LotRow {
  id: string;
  qtyOriginal: string | number;
  qtyRemaining: string | number;
  unitCost: string | number;
  source: string;
  sourceId: string | null;
  receivedAt: string;
}
interface MovementRow {
  id: string;
  type: 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'RETURN' | 'INITIAL_STOCK';
  quantity: string | number;
  unitCost: string | number | null;
  totalCost: string | number | null;
  balanceAfter: string | number;
  referenceType: string | null;
  createdAt: string;
  lot?: { id: string; source: string; sourceId: string | null; receivedAt: string } | null;
}

const fmtNum = (n: any, decimals = 2) =>
  Number(n ?? 0).toLocaleString('es-CR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const TYPE_BADGE: Record<string, { label: string; cls: string; icon: any }> = {
  PURCHASE:      { label: 'Compra',          cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: ArrowDownCircle },
  INITIAL_STOCK: { label: 'Stock inicial',   cls: 'bg-blue-50 text-blue-700 border-blue-200',          icon: Layers          },
  SALE:          { label: 'Venta',           cls: 'bg-red-50 text-red-700 border-red-200',             icon: ArrowUpCircle   },
  ADJUSTMENT:    { label: 'Ajuste',          cls: 'bg-amber-50 text-amber-700 border-amber-200',       icon: MinusCircle     },
  RETURN:        { label: 'Devolución',      cls: 'bg-slate-50 text-slate-700 border-slate-200',    icon: ArrowDownCircle },
};

export default function InventarioPage() {
  const { attemptId } = useParams<{ attemptId: string }>();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState<ValuationItem | null>(null);
  const [lots,      setLots]      = useState<LotRow[] | null>(null);
  const [movs,      setMovs]      = useState<MovementRow[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 1. Resolver companyId desde el attempt.
  useEffect(() => {
    api.get<any>(`/api/v1/attempts/${attemptId}`)
      .then(({ data }) => setCompanyId(data?.company?.id ?? null))
      .catch((err) => toast.error(getErrorMessage(err)));
  }, [attemptId]);

  // 2. Cargar valuación cuando ya tengo companyId.
  const loadValuation = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data } = await api.get<Valuation>(
        `/api/v1/companies/${companyId}/inventory/valuation`,
      );
      setValuation(data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadValuation(); }, [loadValuation]);

  // 3. Detalle al seleccionar.
  async function openDetail(item: ValuationItem) {
    setSelected(item);
    setLots(null);
    setMovs(null);
    if (!companyId) return;
    setDetailLoading(true);
    try {
      const [lotsRes, movsRes] = await Promise.all([
        api.get<LotRow[]>(`/api/v1/companies/${companyId}/inventory/products/${item.productId}/lots`),
        api.get<MovementRow[]>(`/api/v1/companies/${companyId}/inventory/products/${item.productId}/movements`),
      ]);
      setLots(lotsRes.data);
      setMovs(movsRes.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/60">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8 space-y-7">

        {/* Volver */}
        <Link href={`/estudiante/ejercicio/${attemptId}`}
          className="inline-flex items-center gap-2 -ml-1 text-sm font-medium text-gray-500 hover:text-blue-700 transition-colors cx-press">
          <ArrowLeft className="w-4 h-4" /> Volver al ejercicio
        </Link>

        {/* Encabezado */}
        <PageHeader
          eyebrow="Costos e inventarios"
          title="Inventario (FIFO)"
          subtitle="Lotes activos por producto y kardex de movimientos."
          icon={Boxes}
          iconTint="#1B2E6E"
          className="lp-in"
        />

        {/* Banda del módulo */}
        <Card variant="onDark" className="cx-pop">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-6 lg:px-7 py-6">
            <div className="flex-1 min-w-0">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-1.5">
                Primeras entradas, primeras salidas
              </p>
              <h2 className="text-lg font-bold leading-snug">Lo primero que entra es lo primero que se vende.</h2>
              <p className="mt-1.5 text-sm text-blue-200/80 max-w-xl">
                Cada venta consume los lotes más antiguos y define tu costo de ventas. Abre un producto
                para ver sus lotes y su kardex.
              </p>
            </div>
            <ArtInventory size={140} className="lp-drift flex-shrink-0" />
          </div>
        </Card>

        {/* Valuación total */}
        {valuation && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <StatCard
              label="Valor total al costo"
              value={`₡ ${fmtNum(valuation.total)}`}
              hint="Cuenta 1.1.03.01"
              icon={Boxes}
              tint="#1B2E6E"
              className="cx-pop cx-d1 cx-lift cx-hop-parent"
            />
            <StatCard
              label="Productos con stock"
              value={String(valuation.items.length)}
              hint="Con lotes activos"
              icon={Layers}
              tint="#2563EB"
              className="cx-pop cx-d2 cx-lift cx-hop-parent"
            />
          </div>
        )}

        {/* Tabla de productos */}
        {loading || !valuation ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : valuation.items.length === 0 ? (
          <Card className="cx-pop cx-d3">
            <EmptyState
              illustration={<SceneEmptyBox size={200} className="lp-drift" />}
              title="Aún no hay inventario"
              description="Las compras de proveedores con líneas de producto crearán los primeros lotes."
              className="py-14"
            />
          </Card>
        ) : (
          <SectionCard
            eyebrow="Valuación"
            title="Productos en existencia"
            description="Haz clic en un producto para ver sus lotes activos y su kardex."
            icon={Layers}
            iconTint="#2563EB"
            flushBody
            className="cx-pop cx-d3"
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase text-[10px] tracking-wide">Producto</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase text-[10px] tracking-wide">SKU</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase text-[10px] tracking-wide">Stock</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase text-[10px] tracking-wide">Costo prom.</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase text-[10px] tracking-wide">Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {valuation.items.map(item => (
                  <tr
                    key={item.productId}
                    onClick={() => openDetail(item)}
                    className="group cx-hop-parent cx-press cursor-pointer hover:bg-blue-50/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{item.productName}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{item.sku ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {fmtNum(item.qty, 3)} <span className="text-xs text-gray-400">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-700">₡ {fmtNum(item.avgUnitCost)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-gray-900">₡ {fmtNum(item.cost)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-blue-700 text-xs font-semibold">
                        Ver kardex <ChevronRight className="w-3.5 h-3.5 cx-hop" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        )}
      </div>

      {/* Drawer de detalle */}
      {selected && (
        <div className="fixed inset-0 z-40 flex" onClick={() => setSelected(null)}>
          <div className="flex-1 bg-csq-dark/40 backdrop-blur-[2px]" />
          <div
            className="w-full max-w-2xl bg-white shadow-card-hover overflow-y-auto cx-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-gradient-to-br from-csq-mid to-csq-active text-white px-6 py-5 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-0.5">Kardex del producto</p>
                <div className="font-bold text-lg truncate">{selected.productName}</div>
                <div className="text-xs text-blue-200/80">
                  Stock: <span className="font-mono tabular-nums">{fmtNum(selected.qty, 3)} {selected.unit}</span>
                  {' · '}Costo prom. <span className="font-mono tabular-nums">₡ {fmtNum(selected.avgUnitCost)}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-blue-200/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cx-press">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {detailLoading && <Spinner />}

              {/* Lotes activos */}
              <section>
                <h3 className="text-[0.68rem] font-bold text-gold-900 uppercase tracking-[0.13em] mb-2.5 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Lotes activos
                </h3>
                {!lots ? null : lots.length === 0 ? (
                  <div className="text-xs text-gray-400 py-3">Sin lotes activos.</div>
                ) : (
                  <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                    <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide text-[10px] font-semibold">
                      <tr>
                        <th className="px-2.5 py-2 text-left">Recibido</th>
                        <th className="px-2.5 py-2 text-left">Origen</th>
                        <th className="px-2.5 py-2 text-right">Original</th>
                        <th className="px-2.5 py-2 text-right">Disponible</th>
                        <th className="px-2.5 py-2 text-right">Costo unit.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lots.map(l => (
                        <tr key={l.id} className="hover:bg-blue-50/40 transition-colors">
                          <td className="px-2.5 py-2 text-gray-700">{new Date(l.receivedAt).toLocaleDateString('es-CR')}</td>
                          <td className="px-2.5 py-2 text-gray-500">{l.source}</td>
                          <td className="px-2.5 py-2 text-right font-mono tabular-nums">{fmtNum(l.qtyOriginal, 3)}</td>
                          <td className="px-2.5 py-2 text-right font-mono tabular-nums font-bold">{fmtNum(l.qtyRemaining, 3)}</td>
                          <td className="px-2.5 py-2 text-right font-mono tabular-nums">₡ {fmtNum(l.unitCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              {/* Kardex */}
              <section>
                <h3 className="text-[0.68rem] font-bold text-gold-900 uppercase tracking-[0.13em] mb-2.5 flex items-center gap-1.5">
                  Kardex de movimientos
                </h3>
                {!movs ? null : movs.length === 0 ? (
                  <div className="text-xs text-gray-400 py-3">Sin movimientos.</div>
                ) : (
                  <div className="space-y-1.5">
                    {movs.map(m => {
                      const badge = TYPE_BADGE[m.type] ?? { label: m.type, cls: 'bg-gray-50 text-gray-600 border-gray-200', icon: MinusCircle };
                      const Icon  = badge.icon;
                      const qty   = Number(m.quantity);
                      return (
                        <div key={m.id} className="cx-hop-parent flex items-center gap-3 p-2.5 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
                          <div className={`px-1.5 py-1 rounded-lg border ${badge.cls} flex items-center gap-1 text-[10px] font-bold uppercase`}>
                            <Icon className="w-3 h-3 cx-hop" />
                            {badge.label}
                          </div>
                          <div className="flex-1 text-xs text-gray-600">
                            {new Date(m.createdAt).toLocaleString('es-CR')}
                          </div>
                          <div className={`text-xs font-mono tabular-nums font-bold ${qty < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                            {qty > 0 ? '+' : ''}{fmtNum(qty, 3)}
                          </div>
                          <div className="text-xs text-gray-500 font-mono tabular-nums w-24 text-right">
                            saldo {fmtNum(m.balanceAfter, 3)}
                          </div>
                          {m.totalCost != null && (
                            <div className="text-xs text-gray-700 font-mono tabular-nums w-24 text-right">
                              ₡ {fmtNum(m.totalCost)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
