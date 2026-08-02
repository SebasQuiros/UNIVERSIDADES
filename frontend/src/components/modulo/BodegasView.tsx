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
import { useEmpresaActiva } from './ModuloWorkspace';
import { Warehouse, Plus, X, MapPin, Star, Search, Pencil, Trash2 } from 'lucide-react';

interface Bodega {
  id: string;
  name: string;
  code: string | null;
  location: string | null;
  isDefault: boolean;
  isActive: boolean;
}

/**
 * Bodegas del Espacio Contador. Son el lugar físico donde vive el inventario:
 * sin al menos una, los movimientos de existencias no tienen dónde apoyarse.
 */
export function BodegasView() {
  const { companyId, estado } = useEmpresaActiva();
  const [rows, setRows] = useState<Bodega[]>([]);
  const [cargando, setCargando] = useState(false);
  const [editando, setEditando] = useState<Bodega | null>(null);
  const [abrir, setAbrir] = useState(false);
  const [q, setQ] = useState('');

  const cargar = useCallback(async () => {
    if (!companyId) return;
    setCargando(true);
    try {
      const { data } = await api.get<any>(`/api/v1/companies/${companyId}/warehouses`);
      setRows(Array.isArray(data) ? data : (data?.warehouses ?? []));
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setCargando(false); }
  }, [companyId]);

  useEffect(() => { cargar(); }, [cargar]);

  async function eliminar(b: Bodega) {
    if (!companyId) return;
    if (!confirm(`¿Eliminar la bodega "${b.name}"?`)) return;
    try {
      await api.delete(`/api/v1/companies/${companyId}/warehouses/${b.id}`);
      toast.success('Bodega eliminada');
      cargar();
    } catch (e) { toast.error(getErrorMessage(e)); }
  }

  async function marcarPredeterminada(b: Bodega) {
    if (!companyId || b.isDefault) return;
    try {
      await api.patch(`/api/v1/companies/${companyId}/warehouses/${b.id}`, { isDefault: true });
      toast.success(`"${b.name}" es ahora la bodega predeterminada`);
      cargar();
    } catch (e) { toast.error(getErrorMessage(e)); }
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
          description="Creá una empresa en el Espacio Contador para administrar tus bodegas."
        />
      </div>
    );
  }

  const filtradas = rows.filter((r) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return r.name.toLowerCase().includes(t)
      || (r.code ?? '').toLowerCase().includes(t)
      || (r.location ?? '').toLowerCase().includes(t);
  });

  const activas = rows.filter((r) => r.isActive).length;
  const predeterminada = rows.find((r) => r.isDefault);

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <PageHeader
          icon={Warehouse}
          title="Bodegas"
          subtitle="Los lugares donde guardás tus existencias. La bodega predeterminada es la que se usa cuando no elegís otra."
          actions={
            <Button onClick={() => { setEditando(null); setAbrir(true); }} className="cx-press">
              <Plus className="h-4 w-4" /> Nueva bodega
            </Button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Bodegas registradas" value={String(rows.length)} icon={Warehouse} />
          <StatCard label="Activas" value={String(activas)} icon={MapPin} />
          <StatCard label="Predeterminada" value={predeterminada?.name ?? '—'} icon={Star} />
        </div>

        <SectionCard
          icon={Warehouse} eyebrow="Inventario" title="Listado de bodegas"
          description="Podés tener varias, pero solo una queda marcada como predeterminada."
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar nombre, código o ubicación…"
                className="w-64 rounded-lg border border-gray-300 py-1.5 pl-8 pr-3 text-sm"
              />
            </div>
          }
        >
          {cargando ? (
            <div className="grid place-items-center py-10"><Spinner /></div>
          ) : filtradas.length === 0 ? (
            <EmptyState
              illustration={<SceneEmptyBox />}
              title={rows.length === 0 ? '¡Creá tu primera bodega!' : 'Sin resultados'}
              description={rows.length === 0
                ? 'Con al menos una bodega vas a poder registrar entradas y salidas de inventario.'
                : 'Probá con otro nombre, código o ubicación.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 pr-3">Nombre</th>
                    <th className="py-2 pr-3">Ubicación</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtradas.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50/60">
                      <td className="py-2 pr-3 font-mono text-xs">{b.code || '—'}</td>
                      <td className="py-2 pr-3">
                        <span className="font-medium text-gray-900">{b.name}</span>
                        {b.isDefault && <Badge variant="gold" className="ml-2">Predeterminada</Badge>}
                      </td>
                      <td className="py-2 pr-3 text-gray-500">{b.location || '—'}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={b.isActive ? 'green' : 'slate'}>
                          {b.isActive ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </td>
                      <td className="py-2">
                        <div className="flex items-center justify-end gap-1">
                          {!b.isDefault && (
                            <button
                              onClick={() => marcarPredeterminada(b)}
                              title="Marcar como predeterminada"
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gold-50 hover:text-gold-900"
                            >
                              <Star className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => { setEditando(b); setAbrir(true); }}
                            title="Editar"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => eliminar(b)}
                            title="Eliminar"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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

      {abrir && companyId && (
        <ModalBodega
          companyId={companyId}
          bodega={editando}
          onCerrar={() => { setAbrir(false); setEditando(null); }}
          onListo={() => { setAbrir(false); setEditando(null); cargar(); }}
        />
      )}
    </div>
  );
}

function ModalBodega({ companyId, bodega, onCerrar, onListo }: {
  companyId: string; bodega: Bodega | null; onCerrar: () => void; onListo: () => void;
}) {
  const [nombre, setNombre]         = useState(bodega?.name ?? '');
  const [codigo, setCodigo]         = useState(bodega?.code ?? '');
  const [ubicacion, setUbicacion]   = useState(bodega?.location ?? '');
  const [predeterminada, setPredeterminada] = useState(bodega?.isDefault ?? false);
  const [activa, setActiva]         = useState(bodega?.isActive ?? true);
  const [guardando, setGuardando]   = useState(false);

  const esEdicion = Boolean(bodega);

  async function guardar() {
    if (!nombre.trim()) { toast.error('Ingresá el nombre de la bodega'); return; }
    setGuardando(true);
    try {
      const cuerpo = {
        name:     nombre.trim(),
        code:     codigo.trim() || undefined,
        location: ubicacion.trim() || undefined,
        isDefault: predeterminada,
      };
      if (esEdicion && bodega) {
        await api.patch(`/api/v1/companies/${companyId}/warehouses/${bodega.id}`, { ...cuerpo, isActive: activa });
        toast.success('Bodega actualizada');
      } else {
        await api.post(`/api/v1/companies/${companyId}/warehouses`, cuerpo);
        toast.success('Bodega creada');
      }
      onListo();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setGuardando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{esEdicion ? 'Editar bodega' : 'Nueva bodega'}</h3>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Nombre *</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Bodega central" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Código</label>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="BOD-01" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Ubicación</label>
            <input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} maxLength={200}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Alajuela, San Carlos" />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={predeterminada} onChange={(e) => setPredeterminada(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300" />
            Usar como bodega predeterminada
          </label>

          {esEdicion && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300" />
              Bodega activa
            </label>
          )}

          {/* Solo una predeterminada por empresa: conviene decirlo antes de guardar. */}
          {predeterminada && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-xs leading-relaxed text-amber-900">
              Al marcarla como predeterminada, la bodega que lo estaba antes deja de serlo.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={onCerrar}>Cancelar</Button>
            <Button size="sm" loading={guardando} onClick={guardar}>
              {esEdicion ? 'Guardar cambios' : 'Crear bodega'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
