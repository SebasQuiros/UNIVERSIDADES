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
import { Tags, Plus, X, Pencil, Trash2, Layers } from 'lucide-react';

interface AttributeValue {
  id: string;
  value: string;
}

interface ProductAttribute {
  id: string;
  name: string;
  isActive: boolean;
  values: AttributeValue[];
}

/**
 * Atributos de producto: el vocabulario con el que se describen las variantes
 * (Talla → S/M/L, Color → Rojo/Azul). No mueven plata ni generan asientos, por
 * eso la vista es de catálogo puro: crear, renombrar, eliminar.
 */
export function AtributosView() {
  const { companyId, estado } = useEmpresaActiva();

  const [rows, setRows] = useState<ProductAttribute[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    if (!companyId) return;
    setCargando(true);
    try {
      const { data } = await api.get<ProductAttribute[]>(
        `/api/v1/companies/${companyId}/product-attributes`,
      );
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setCargando(false);
    }
  }, [companyId]);

  useEffect(() => { cargar(); }, [cargar]);

  async function crear() {
    const name = nuevoNombre.trim();
    if (!name) { toast.error('Escribí el nombre del atributo'); return; }
    setCreando(true);
    try {
      await api.post(`/api/v1/companies/${companyId}/product-attributes`, { name });
      setNuevoNombre('');
      toast.success(`Atributo "${name}" creado`);
      cargar();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setCreando(false); }
  }

  async function renombrar(attr: ProductAttribute) {
    // Prompt del navegador: renombrar es una acción rara y de una sola línea;
    // un modal completo sería más ceremonia de la que el caso amerita.
    const nombre = window.prompt('Nuevo nombre del atributo:', attr.name);
    if (nombre === null) return;
    const name = nombre.trim();
    if (!name || name === attr.name) return;
    try {
      await api.patch(`/api/v1/companies/${companyId}/product-attributes/${attr.id}`, { name });
      toast.success('Atributo renombrado');
      cargar();
    } catch (e) { toast.error(getErrorMessage(e)); }
  }

  async function eliminar(attr: ProductAttribute) {
    if (!window.confirm(`¿Eliminar "${attr.name}" y sus ${attr.values.length} valores?`)) return;
    try {
      await api.delete(`/api/v1/companies/${companyId}/product-attributes/${attr.id}`);
      toast.success('Atributo eliminado');
      cargar();
    } catch (e) { toast.error(getErrorMessage(e)); }
  }

  async function agregarValor(attrId: string, value: string) {
    try {
      await api.post(`/api/v1/companies/${companyId}/product-attributes/${attrId}/values`, { value });
      cargar();
    } catch (e) {
      // El backend responde 409 cuando el valor ya existe (unique en BD).
      toast.error(getErrorMessage(e));
      throw e;
    }
  }

  async function quitarValor(attrId: string, valueId: string) {
    try {
      await api.delete(
        `/api/v1/companies/${companyId}/product-attributes/${attrId}/values/${valueId}`,
      );
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
          description="Creá una empresa en el Espacio Contador, o entrá a un ejercicio, para definir atributos."
        />
      </div>
    );
  }

  const totalValores = rows.reduce((s, a) => s + a.values.length, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-5">
        <PageHeader
          icon={Tags}
          title="Atributos de producto"
          subtitle="Definí las características con las que se distinguen tus variantes: talla, color, presentación."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StatCard label="Atributos definidos" value={String(rows.length)} icon={Tags} />
          <StatCard label="Valores registrados" value={String(totalValores)} icon={Layers} />
        </div>

        <SectionCard
          icon={Plus}
          eyebrow="Catálogo"
          title="Nuevo atributo"
          description="Primero creá el atributo; después le vas agregando sus valores."
        >
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') crear(); }}
              placeholder="Ej.: Talla, Color, Material…"
              className="flex-1 min-w-[14rem] rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <Button onClick={crear} loading={creando} className="cx-press">
              <Plus className="h-4 w-4" /> Crear atributo
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          icon={Tags}
          eyebrow="Definidos"
          title="Tus atributos"
          description="Cada chip es un valor posible. Agregá o quitá valores sin salir de la lista."
        >
          {cargando ? (
            <div className="grid place-items-center py-10"><Spinner /></div>
          ) : rows.length === 0 ? (
            <EmptyState
              illustration={<SceneEmptyBox />}
              title="Todavía no definiste atributos"
              description="Empezá con uno sencillo, como Talla o Color, y agregale sus valores."
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {rows.map((attr) => (
                <FilaAtributo
                  key={attr.id}
                  attr={attr}
                  onAgregarValor={agregarValor}
                  onQuitarValor={quitarValor}
                  onRenombrar={() => renombrar(attr)}
                  onEliminar={() => eliminar(attr)}
                />
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

/**
 * Fila de un atributo con sus valores en chips. El input de "nuevo valor" vive
 * acá y no en el padre para que cada fila mantenga su propio borrador mientras
 * se edita otra.
 */
function FilaAtributo({ attr, onAgregarValor, onQuitarValor, onRenombrar, onEliminar }: {
  attr: ProductAttribute;
  onAgregarValor: (attrId: string, value: string) => Promise<void>;
  onQuitarValor: (attrId: string, valueId: string) => void;
  onRenombrar: () => void;
  onEliminar: () => void;
}) {
  const [borrador, setBorrador] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function agregar() {
    const value = borrador.trim();
    if (!value) return;
    setGuardando(true);
    try {
      await onAgregarValor(attr.id, value);
      setBorrador(''); // solo se limpia si el valor entró: si dio 409 el texto sigue ahí para corregirlo
    } catch { /* el error ya se avisó en el padre */ }
    finally { setGuardando(false); }
  }

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate">{attr.name}</h4>
          <Badge variant={attr.isActive ? 'emerald' : 'slate'}>
            {attr.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
          <Badge variant="blue">
            {attr.values.length} {attr.values.length === 1 ? 'valor' : 'valores'}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onRenombrar}>
            <Pencil className="h-3.5 w-3.5" /> Renombrar
          </Button>
          <Button variant="ghost" size="sm" onClick={onEliminar} className="text-red-600 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {attr.values.length === 0 && (
          <p className="text-sm text-gray-400">Sin valores todavía.</p>
        )}
        {attr.values.map((v) => (
          <span
            key={v.id}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700"
          >
            {v.value}
            <button
              type="button"
              onClick={() => onQuitarValor(attr.id, v.id)}
              aria-label={`Quitar ${v.value}`}
              className="text-gray-400 hover:text-red-600"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={borrador}
          onChange={(e) => setBorrador(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') agregar(); }}
          placeholder={`Nuevo valor de ${attr.name.toLowerCase()}…`}
          className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        />
        <Button variant="outline" size="sm" onClick={agregar} loading={guardando}>
          <Plus className="h-3.5 w-3.5" /> Agregar
        </Button>
      </div>
    </li>
  );
}
