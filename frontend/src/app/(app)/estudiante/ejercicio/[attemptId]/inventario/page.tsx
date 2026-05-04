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
  ArrowLeft, Boxes, Layers, ArrowDownCircle, ArrowUpCircle, MinusCircle, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
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
  RETURN:        { label: 'Devolución',      cls: 'bg-purple-50 text-purple-700 border-purple-200',    icon: ArrowDownCircle },
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
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href={`/estudiante/ejercicio/${attemptId}`}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4" /> Volver al ejercicio
          </Link>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Boxes className="w-6 h-6 text-blue-700" />
              Inventario (FIFO)
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Lotes activos por producto y kardex de movimientos.
            </p>
          </div>
          {valuation && (
            <Card className="px-5 py-3 text-right">
              <div className="text-xs uppercase tracking-wide text-gray-500">Valor total al costo</div>
              <div className="text-2xl font-bold text-gray-900 font-mono">
                ₡ {fmtNum(valuation.total)}
              </div>
              <div className="text-xs text-gray-400">
                Cuenta 1.1.03.01 · {valuation.items.length} producto(s)
              </div>
            </Card>
          )}
        </div>

        {/* Tabla de productos */}
        {loading || !valuation ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : valuation.items.length === 0 ? (
          <Card className="py-14 flex flex-col items-center text-gray-500">
            <Boxes className="w-10 h-10 text-gray-300 mb-3" />
            <div className="text-sm">Aún no hay inventario.</div>
            <div className="text-xs text-gray-400 mt-1">
              Las compras de proveedores con `lines` crearán los primeros lotes.
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 uppercase text-[10px] tracking-wide">Producto</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 uppercase text-[10px] tracking-wide">SKU</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 uppercase text-[10px] tracking-wide">Stock</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 uppercase text-[10px] tracking-wide">Costo prom.</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 uppercase text-[10px] tracking-wide">Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {valuation.items.map(item => (
                  <tr
                    key={item.productId}
                    onClick={() => openDetail(item)}
                    className="cursor-pointer hover:bg-blue-50/40"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{item.productName}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{item.sku ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {fmtNum(item.qty, 3)} <span className="text-xs text-gray-400">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">₡ {fmtNum(item.avgUnitCost)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">₡ {fmtNum(item.cost)}</td>
                    <td className="px-4 py-3 text-right text-blue-600 text-xs">Ver kardex →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* Drawer de detalle */}
      {selected && (
        <div className="fixed inset-0 z-40 flex" onClick={() => setSelected(null)}>
          <div className="flex-1 bg-black/30" />
          <div
            className="w-full max-w-2xl bg-white shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900">{selected.productName}</div>
                <div className="text-xs text-gray-500">
                  Stock: {fmtNum(selected.qty, 3)} {selected.unit} · Costo prom. ₡ {fmtNum(selected.avgUnitCost)}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {detailLoading && <Spinner />}

              {/* Lotes activos */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Lotes activos
                </h3>
                {!lots ? null : lots.length === 0 ? (
                  <div className="text-xs text-gray-400 py-3">Sin lotes activos.</div>
                ) : (
                  <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Recibido</th>
                        <th className="px-2 py-1.5 text-left">Origen</th>
                        <th className="px-2 py-1.5 text-right">Original</th>
                        <th className="px-2 py-1.5 text-right">Disponible</th>
                        <th className="px-2 py-1.5 text-right">Costo unit.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lots.map(l => (
                        <tr key={l.id}>
                          <td className="px-2 py-1.5 text-gray-700">{new Date(l.receivedAt).toLocaleDateString('es-CR')}</td>
                          <td className="px-2 py-1.5 text-gray-500">{l.source}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{fmtNum(l.qtyOriginal, 3)}</td>
                          <td className="px-2 py-1.5 text-right font-mono font-semibold">{fmtNum(l.qtyRemaining, 3)}</td>
                          <td className="px-2 py-1.5 text-right font-mono">₡ {fmtNum(l.unitCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              {/* Kardex */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  Kardex
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
                        <div key={m.id} className="flex items-center gap-3 p-2 border border-gray-100 rounded-lg">
                          <div className={`px-1.5 py-1 rounded border ${badge.cls} flex items-center gap-1 text-[10px] font-bold uppercase`}>
                            <Icon className="w-3 h-3" />
                            {badge.label}
                          </div>
                          <div className="flex-1 text-xs text-gray-600">
                            {new Date(m.createdAt).toLocaleString('es-CR')}
                          </div>
                          <div className={`text-xs font-mono ${qty < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                            {qty > 0 ? '+' : ''}{fmtNum(qty, 3)}
                          </div>
                          <div className="text-xs text-gray-500 font-mono w-24 text-right">
                            saldo {fmtNum(m.balanceAfter, 3)}
                          </div>
                          {m.totalCost != null && (
                            <div className="text-xs text-gray-700 font-mono w-24 text-right">
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
