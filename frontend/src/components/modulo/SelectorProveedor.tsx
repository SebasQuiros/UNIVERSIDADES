'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Selector de proveedor para los documentos de compra.
 *
 * Por qué existe: la factura de compra y las cuentas por pagar guardan el
 * NOMBRE del proveedor, no su identificador. Mientras el campo fue texto
 * libre bastaba escribirlo distinto una vez —"Distribuidora ABC" contra
 * "Distribuidora A.B.C."— para que esa compra desapareciera de la ficha del
 * proveedor y para que cuentas por pagar mostrara dos proveedores donde solo
 * hay uno. Con treinta estudiantes escribiendo a mano, pasa el primer día.
 *
 * La solución no es validar el texto: es no escribirlo. Se elige de la lista
 * de la empresa, y si de verdad es uno nuevo se da de alta ahí mismo, de modo
 * que la siguiente compra ya lo encuentre.
 */

/** Valor centinela del selector: "no está en la lista, lo escribo". */
export const PROVEEDOR_NUEVO = '__NUEVO__';

export interface ProveedorElegido {
  /** Nombre tal cual se va a guardar en el documento. */
  name: string;
  /** Cédula, si se conoce. Es la llave fiable para reconciliar después. */
  identification: string;
  /** true si hay que darlo de alta antes de guardar el documento. */
  isNew: boolean;
}

interface ProveedorLista {
  id: string;
  name: string;
  identification?: string | null;
  isActive?: boolean;
}

export const PROVEEDOR_VACIO: ProveedorElegido = { name: '', identification: '', isNew: false };

/**
 * Da de alta al proveedor si el usuario escribió uno nuevo, y devuelve el
 * nombre y la cédula definitivos para guardar en el documento.
 *
 * Si el alta falla —nombre repetido, por ejemplo— NO se propaga el error: se
 * devuelve lo que el usuario escribió. Perder el asiento contable por un dato
 * de ficha sería un mal negocio.
 */
export async function asegurarProveedor(
  companyId: string,
  elegido: ProveedorElegido,
): Promise<{ name: string; identification?: string; avisoFicha?: string }> {
  const name = elegido.name.trim();
  const identification = elegido.identification.trim();

  if (!elegido.isNew) {
    return { name, identification: identification || undefined };
  }

  try {
    const { data } = await api.post<ProveedorLista>(
      `/api/v1/companies/${companyId}/suppliers`,
      { name, identification: identification || undefined },
    );
    return {
      name: data.name ?? name,
      identification: data.identification ?? identification ?? undefined,
    };
  } catch {
    return {
      name,
      identification: identification || undefined,
      avisoFicha: 'El documento se registró, pero el proveedor no se guardó en tu lista.',
    };
  }
}

export function SelectorProveedor({
  companyId,
  valor,
  onCambio,
  etiqueta = 'Proveedor',
  requerido = true,
}: {
  companyId: string;
  valor: ProveedorElegido;
  onCambio: (v: ProveedorElegido) => void;
  etiqueta?: string;
  requerido?: boolean;
}) {
  const [proveedores, setProveedores] = useState<ProveedorLista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccion, setSeleccion] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<ProveedorLista[]>(
          `/api/v1/companies/${companyId}/suppliers`,
        );
        setProveedores(data.filter((x) => x.isActive !== false));
      } catch {
        // Sin lista se puede seguir escribiendo el nombre. Registrar la compra
        // importa más que el enlace con la ficha.
      } finally {
        setCargando(false);
      }
    })();
  }, [companyId]);

  function elegir(id: string) {
    setSeleccion(id);
    if (id === PROVEEDOR_NUEVO) { onCambio({ name: '', identification: '', isNew: true }); return; }
    if (id === '') { onCambio(PROVEEDOR_VACIO); return; }
    const p = proveedores.find((x) => x.id === id);
    if (p) onCambio({ name: p.name, identification: p.identification ?? '', isNew: false });
  }

  const esNuevo = seleccion === PROVEEDOR_NUEVO;
  const claseCampo =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          {etiqueta} {requerido && <span className="text-red-500">*</span>}
        </label>
        <select
          value={seleccion}
          onChange={(e) => elegir(e.target.value)}
          disabled={cargando}
          className={`${claseCampo} bg-white disabled:bg-gray-50`}
        >
          <option value="">{cargando ? 'Cargando proveedores…' : 'Elegí un proveedor'}</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.identification ? ` — ${p.identification}` : ''}
            </option>
          ))}
          <option value={PROVEEDOR_NUEVO}>+ Otro proveedor (escribirlo)</option>
        </select>
        {!cargando && proveedores.length === 0 && !esNuevo && (
          <p className="mt-1 text-xs text-gray-500">
            Todavía no tenés proveedores. Elegí «Otro proveedor» y se guardará en tu lista.
          </p>
        )}
      </div>

      {esNuevo && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              value={valor.name}
              onChange={(e) => onCambio({ ...valor, name: e.target.value, isNew: true })}
              placeholder="Ej. Distribuidora ABC S.A."
              className={claseCampo}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Cédula
            </label>
            <input
              value={valor.identification}
              onChange={(e) => onCambio({ ...valor, identification: e.target.value, isNew: true })}
              placeholder="Opcional"
              className={claseCampo}
            />
          </div>
          <p className="col-span-2 text-xs text-blue-800">
            Se agregará a tu lista de proveedores para que la próxima compra ya lo encuentres aquí.
          </p>
        </div>
      )}
    </div>
  );
}
