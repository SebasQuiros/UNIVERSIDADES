'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { buttonClasses } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { SceneEmptyBox, SceneSearchEmpty } from '@/components/illustrations';
import { BarChart2, Package, Boxes, Coins, AlertTriangle } from 'lucide-react';

// ── Tipos del endpoint real ────────────────────────────────────
// GET /api/v1/companies/:companyId/inventory/valuation
//   → { items: ValuationItem[]; total: number }  (FIFO al costo)
interface ValuationItem {
  productId: string;
  productName: string;
  sku: string | null;
  unit: string;
  qty: number;         // existencias restantes (sum qty_remaining)
  cost: number;        // valor total al costo (sum qty_remaining * unit_cost)
  avgUnitCost: number; // costo unitario promedio ponderado
}

interface Valuation {
  items: ValuationItem[];
  total: number;
}

// ── Formato de colones (es-CR) ─────────────────────────────────
function crc(value: number, opts?: { decimals?: number }): string {
  const decimals = opts?.decimals ?? 2;
  return `₡${value.toLocaleString('es-CR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function qtyFmt(value: number): string {
  // Existencias: hasta 3 decimales pero sin ceros de relleno forzados.
  return value.toLocaleString('es-CR', { maximumFractionDigits: 3 });
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'no-company' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; valuation: Valuation };

export function ValorInventarioView() {
  const [state, setState] = useState<LoadState>({ phase: 'loading' });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // 1) Resolver empresa igual que el sidebar: attempt activo → company.
        const { data } = await api.get<any[]>('/api/v1/attempts');
        const list = Array.isArray(data) ? data : [];
        const active =
          list.find((x) => x.status === 'IN_PROGRESS') ??
          list.find((x) => x.company) ??
          list.find((x) => x.status === 'NOT_STARTED') ??
          list[0];

        const companyId: string | undefined = active?.company?.id;
        if (!companyId) {
          if (alive) setState({ phase: 'no-company' });
          return;
        }

        // 2) Traer la valoración FIFO al costo.
        const res = await api.get<Valuation>(`/api/v1/companies/${companyId}/inventory/valuation`);
        const valuation: Valuation = {
          items: Array.isArray(res.data?.items) ? res.data.items : [],
          total: typeof res.data?.total === 'number' ? res.data.total : 0,
        };
        if (alive) setState({ phase: 'ready', valuation });
      } catch {
        if (alive) {
          setState({
            phase: 'error',
            message: 'No pudimos cargar la valoración de tu inventario. Intentá de nuevo en un momento.',
          });
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const header = (
    <PageHeader
      eyebrow="Inventario"
      title="Valor de inventario"
      subtitle="Valoración de tu inventario al costo por método FIFO."
      icon={BarChart2}
      iconTint="#6D28D9"
      className="mb-6"
    />
  );

  // ── Loading ───────────────────────────────────────────────────
  if (state.phase === 'loading') {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
        <div className="max-w-6xl mx-auto">
          {header}
          <SectionCard>
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Spinner size="lg" />
              <p className="text-sm text-gray-500">Calculando la valoración de tu inventario…</p>
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  // ── Sin empresa activa ────────────────────────────────────────
  if (state.phase === 'no-company') {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
        <div className="max-w-6xl mx-auto">
          {header}
          <Card>
            <EmptyState
              illustration={<SceneSearchEmpty size={200} className="cx-float" />}
              title="Aún no tenés una empresa activa"
              description="Iniciá un ejercicio para operar tu empresa; al registrar compras de mercadería verás aquí su valoración FIFO."
              action={
                <Link href="/estudiante" className={buttonClasses({ variant: 'primary', className: 'cx-press' })}>
                  Ir a mis ejercicios
                </Link>
              }
            />
          </Card>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────
  if (state.phase === 'error') {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
        <div className="max-w-6xl mx-auto">
          {header}
          <Card>
            <EmptyState
              illustration={
                <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center">
                  <AlertTriangle className="w-9 h-9 text-amber-600" />
                </div>
              }
              title="No pudimos cargar la valoración"
              description={state.message}
            />
          </Card>
        </div>
      </div>
    );
  }

  // ── Ready ─────────────────────────────────────────────────────
  const { valuation } = state;
  const { items, total } = valuation;

  if (items.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
        <div className="max-w-6xl mx-auto">
          {header}
          <Card>
            <EmptyState
              illustration={<SceneEmptyBox size={180} className="cx-float" />}
              title="Aún no hay inventario valorado"
              description="Registra compras de mercadería a tus proveedores para ver su valoración FIFO al costo."
            />
          </Card>
        </div>
      </div>
    );
  }

  const totalUnits = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
      <div className="max-w-6xl mx-auto">
        {header}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard label="Valor total" value={crc(total)} icon={Coins} tint="#6D28D9" className="cx-pop cx-d1" />
          <StatCard label="N.º de ítems" value={items.length.toLocaleString('es-CR')} icon={Package} tint="#2563EB" className="cx-pop cx-d2" />
          <StatCard label="Existencias totales" value={qtyFmt(totalUnits)} icon={Boxes} tint="#B8860B" className="cx-pop cx-d3" />
        </div>

        {/* Tabla de valoración por producto */}
        <SectionCard flushBody className="cx-pop cx-d2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-2.5 font-semibold">Producto</th>
                  <th className="px-4 py-2.5 font-semibold text-right w-40">Existencias</th>
                  <th className="px-4 py-2.5 font-semibold text-right w-44">Costo unitario</th>
                  <th className="px-4 py-2.5 font-semibold text-right w-44">Valor total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.productId} className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-900">{item.productName}</div>
                      {item.sku && (
                        <div className="text-[11px] font-mono text-gray-400 mt-0.5">{item.sku}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 whitespace-nowrap">
                      {qtyFmt(item.qty)}
                      <span className="text-gray-400 ml-1">{item.unit}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 whitespace-nowrap">
                      {crc(item.avgUnitCost)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900 whitespace-nowrap">
                      {crc(item.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td className="px-4 py-3 font-bold text-gray-900" colSpan={3}>
                    Total del inventario
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-extrabold text-gold-900 whitespace-nowrap">
                    {crc(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionCard>

        <p className="text-xs text-gray-400 mt-4">
          Valoración calculada al costo por método FIFO (primeras entradas, primeras salidas).
        </p>
      </div>
    </div>
  );
}
