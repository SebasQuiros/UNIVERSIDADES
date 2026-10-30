'use client';

import { useState } from 'react';
import { Plus, Trash2, Store, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { SectionCard } from '@/components/ui/SectionCard';

interface ProductoFila {
  nombre: string;
  cabysCode: string;
  precio: string;
  costo: string;
  stock: string;
  iva: string;
}

const FILA_VACIA: ProductoFila = { nombre: '', cabysCode: '', precio: '', costo: '', stock: '', iva: '13' };

const money = (n: number) =>
  '₡' + n.toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * Configuración del aula: qué negocio es y con qué arrancan todas las empresas.
 *
 * El escenario es UNO para toda la clase a propósito. Si cada grupo partiera de
 * un capital o un inventario distinto, la nota terminaría midiendo la suerte
 * del reparto y no el trabajo.
 */
export function ConfigurarAula({
  sessionId,
  inicial,
  onSaved,
}: {
  sessionId: string;
  inicial?: { tipoNegocio?: string | null; escenarioInicial?: any };
  onSaved: () => void;
}) {
  const esc = inicial?.escenarioInicial ?? {};
  const [tipoNegocio, setTipoNegocio] = useState(inicial?.tipoNegocio ?? '');
  const [capital, setCapital]         = useState(esc.capital ? String(esc.capital) : '');
  const [enCaja, setEnCaja]           = useState(esc.enCaja != null ? String(esc.enCaja) : '');
  const [productos, setProductos]     = useState<ProductoFila[]>(
    Array.isArray(esc.productos) && esc.productos.length
      ? esc.productos.map((p: any) => ({
          nombre: p.nombre ?? '', cabysCode: p.cabysCode ?? '',
          precio: String(p.precio ?? ''), costo: String(p.costo ?? ''),
          stock: String(p.stock ?? ''), iva: String(p.iva ?? 13),
        }))
      : [],
  );
  const [saving, setSaving] = useState(false);

  const nCapital = Number(capital) || 0;
  const nCaja    = Number(enCaja) || 0;
  const valorInv = productos.reduce((s, p) => s + (Number(p.costo) || 0) * (Number(p.stock) || 0), 0);

  const setFila = (i: number, campo: keyof ProductoFila, v: string) =>
    setProductos(prev => prev.map((p, idx) => (idx === i ? { ...p, [campo]: v } : p)));

  async function guardar() {
    if (nCaja > nCapital) {
      toast.error('El efectivo en caja no puede superar al capital.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.patch<{ empresasSembradas: number; empresasTotales: number }>(
        `/api/v1/class-sessions/${sessionId}/configuracion`,
        {
          tipoNegocio: tipoNegocio.trim() || undefined,
          capital: nCapital,
          enCaja: nCaja,
          productos: productos
            .filter(p => p.nombre.trim())
            .map(p => ({
              nombre:    p.nombre.trim(),
              cabysCode: p.cabysCode.trim() || undefined,
              precio:    Number(p.precio) || 0,
              costo:     Number(p.costo) || 0,
              stock:     Number(p.stock) || 0,
              iva:       Number(p.iva) || 13,
            })),
        },
      );
      toast.success(
        data.empresasTotales > 0
          ? `Guardado. ${data.empresasSembradas} de ${data.empresasTotales} empresas quedaron listas.`
          : 'Guardado. Las empresas que crees arrancarán con este escenario.',
      );
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      icon={Store}
      iconTint="#6D28D9"
      eyebrow="Configuración del aula"
      title="Tipo de negocio y punto de partida"
      description="Todas las empresas arrancan con esto mismo, para que ningún grupo salga con ventaja."
      className="cx-pop"
    >
      <div className="space-y-5">
        <div>
          <label className="text-xs font-semibold text-gray-700">¿De qué es la empresa?</label>
          <input
            value={tipoNegocio}
            onChange={(e) => setTipoNegocio(e.target.value)}
            placeholder="Panadería artesanal, taller mecánico, librería…"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30"
          />
          <p className="mt-1 text-[11px] text-gray-400">
            Escribilo como lo dirías en clase. No hay lista cerrada.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-gray-700">Capital aportado</label>
            <input
              type="number" min="0" step="1000" value={capital}
              onChange={(e) => setCapital(e.target.value)}
              placeholder="2000000"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700">De eso, en caja</label>
            <input
              type="number" min="0" step="1000" value={enCaja}
              onChange={(e) => setEnCaja(e.target.value)}
              placeholder="300000"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30"
            />
            <p className="mt-1 text-[11px] text-gray-400">El resto entra al banco.</p>
          </div>
        </div>

        {nCaja > nCapital && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            El efectivo en caja no puede superar al capital aportado.
          </p>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-700">Inventario de arranque</label>
            <button
              type="button"
              onClick={() => setProductos(p => [...p, { ...FILA_VACIA }])}
              className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900 cx-press"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar producto
            </button>
          </div>

          {productos.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
              Sin inventario inicial. Las empresas arrancan solo con el capital.
            </p>
          ) : (
            <div className="space-y-2">
              {productos.map((p, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 rounded-lg bg-gray-50 p-2">
                  <input
                    value={p.nombre} onChange={(e) => setFila(i, 'nombre', e.target.value)}
                    placeholder="Producto" className="col-span-12 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs sm:col-span-4"
                  />
                  <input
                    value={p.precio} onChange={(e) => setFila(i, 'precio', e.target.value)}
                    type="number" min="0" placeholder="Precio"
                    className="col-span-4 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs sm:col-span-2"
                  />
                  <input
                    value={p.costo} onChange={(e) => setFila(i, 'costo', e.target.value)}
                    type="number" min="0" placeholder="Costo"
                    className="col-span-4 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs sm:col-span-2"
                  />
                  <input
                    value={p.stock} onChange={(e) => setFila(i, 'stock', e.target.value)}
                    type="number" min="0" placeholder="Cant."
                    className="col-span-4 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs sm:col-span-2"
                  />
                  <select
                    value={p.iva} onChange={(e) => setFila(i, 'iva', e.target.value)}
                    className="col-span-8 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs sm:col-span-1"
                  >
                    {[0, 1, 2, 4, 8, 13].map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                  <button
                    type="button" onClick={() => setProductos(prev => prev.filter((_, idx) => idx !== i))}
                    className="col-span-4 flex items-center justify-center rounded text-gray-400 hover:text-red-600 sm:col-span-1"
                    aria-label="Quitar producto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lo que el estudiante va a ver en su balance de apertura. Verlo antes
            de guardar evita el clásico "arrancaron con un número raro". */}
        {(nCapital > 0 || valorInv > 0) && (
          <div className="rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2.5 text-xs text-violet-900">
            <p className="font-semibold">Cada empresa va a abrir con:</p>
            <p className="mt-1">
              Caja {money(Math.min(nCaja, nCapital))} · Banco {money(Math.max(0, nCapital - nCaja))}
              {valorInv > 0 && <> · Inventario {money(valorInv)}</>}
              {' '}· Capital {money(Math.min(nCaja, nCapital) + Math.max(0, nCapital - nCaja) + valorInv)}
            </p>
          </div>
        )}

        <Button onClick={guardar} loading={saving} className="w-full cx-press">
          <Save className="h-4 w-4" /> Guardar configuración
        </Button>
      </div>
    </SectionCard>
  );
}
