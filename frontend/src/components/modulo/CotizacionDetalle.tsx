'use client';

/**
 * Ficha de cotización.
 *
 * A diferencia de clientes y proveedores, acá lo que importa no es un
 * historial: una cotización es un documento con un ciclo de vida corto
 * (borrador → enviada → aceptada → convertida) y un detalle de líneas. La
 * ficha muestra ese estado, el detalle, y — cuando aplica — la factura en la
 * que terminó.
 *
 * Se subraya una cosa a propósito: una cotización NO mueve la contabilidad.
 * Es la confusión más común del estudiante, y verlo escrito en la pantalla
 * donde se trabaja vale más que explicarlo después.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import { X, User, Calendar, FileText, Info } from 'lucide-react';

export interface CotizacionLista {
  id: string; status: string; issueDate: string; validUntil: string;
  total: number | string; clientName?: string | null;
  client?: { id: string; name: string } | null;
  consecutiveNumber?: string; number?: string;
}

const crc = (v: any) =>
  '₡' + Number(v ?? 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fecha = (d: any) =>
  d ? new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const ESTADOS: Record<string, { texto: string; clase: string; explica: string }> = {
  DRAFT:     { texto: 'Borrador',   clase: 'bg-gray-100 text-gray-600 ring-gray-200',
               explica: 'Todavía no se le envió al cliente.' },
  SENT:      { texto: 'Enviada',    clase: 'bg-blue-50 text-blue-700 ring-blue-200',
               explica: 'Enviada al cliente, esperando respuesta.' },
  ACCEPTED:  { texto: 'Aceptada',   clase: 'bg-amber-50 text-amber-700 ring-amber-200',
               explica: 'El cliente la aceptó: ya se puede convertir en factura.' },
  REJECTED:  { texto: 'Rechazada',  clase: 'bg-rose-50 text-rose-700 ring-rose-200',
               explica: 'El cliente la rechazó.' },
  EXPIRED:   { texto: 'Vencida',    clase: 'bg-gray-100 text-gray-500 ring-gray-200',
               explica: 'Pasó su fecha de validez sin respuesta.' },
  CONVERTED: { texto: 'Convertida', clase: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
               explica: 'Se convirtió en factura: ahí es donde entró a la contabilidad.' },
};

export function CotizacionDetalle({
  companyId, cotizacion, onClose,
}: {
  companyId: string;
  cotizacion: CotizacionLista;
  onClose: () => void;
}) {
  const [datos, setDatos] = useState<any>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true);
    api.get(`/api/v1/companies/${companyId}/quotes/${cotizacion.id}`)
      .then(({ data }) => setDatos(data))
      .catch(() => toast.error('No se pudo cargar la cotización'))
      .finally(() => setCargando(false));
  }, [companyId, cotizacion.id]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onClose]);

  const q = datos ?? cotizacion;
  const numero = q.consecutiveNumber ?? q.number ?? String(q.id).slice(0, 8);
  const cliente = q.clientName ?? q.client?.name ?? '—';
  const estado = ESTADOS[q.status] ?? { texto: q.status, clase: 'bg-gray-100 text-gray-600 ring-gray-200', explica: '' };
  const lineas = q.lines ?? [];

  // El detalle se recalcula acá para poder mostrar el desglose; los totales
  // que manda el backend son los que mandan si hay diferencia de redondeo.
  const subtotal = lineas.reduce(
    (s: number, l: any) => s + Number(l.quantity ?? 0) * Number(l.unitPrice ?? 0), 0);
  const impuesto = lineas.reduce(
    (s: number, l: any) => s + Number(l.quantity ?? 0) * Number(l.unitPrice ?? 0) * (Number(l.taxRate ?? 0) / 100), 0);

  const Dato = ({ icono: Icono, etiqueta, valor }: { icono: any; etiqueta: string; valor: any }) => (
    <div className="flex items-start gap-2.5">
      <Icono className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{etiqueta}</p>
        <p className="truncate text-sm text-gray-800">{valor || <span className="text-gray-300">—</span>}</p>
      </div>
    </div>
  );

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden rounded-card border border-gray-200/70 bg-white shadow-card">
      <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700 ring-1 ring-blue-200/60">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-mono text-sm font-bold text-gray-900">{numero}</h3>
            <span className={`flex-shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${estado.clase}`}>
              {estado.texto}
            </span>
          </div>
          <p className="truncate text-xs text-gray-400">{cliente}</p>
        </div>
        <button onClick={onClose} aria-label="Cerrar ficha"
          className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-gray-50 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {cargando ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <div className="space-y-4">
            {estado.explica && (
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{estado.explica}</p>
            )}

            <div className="rounded-xl border border-gray-200/70 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Datos</p>
              <div className="grid grid-cols-2 gap-4">
                <Dato icono={User}     etiqueta="Cliente"      valor={cliente} />
                <Dato icono={Calendar} etiqueta="Emitida"      valor={fecha(q.issueDate)} />
                <Dato icono={Calendar} etiqueta="Válida hasta" valor={fecha(q.validUntil)} />
                <Dato icono={FileText} etiqueta="Moneda"       valor={q.currency ?? 'CRC'} />
              </div>
              {q.notes && (
                <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{q.notes}</p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200/70 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                Detalle ({lineas.length} línea{lineas.length === 1 ? '' : 's'})
              </p>
              {lineas.length === 0 ? (
                <p className="text-sm text-gray-400">Esta cotización no tiene líneas.</p>
              ) : (
                <div className="space-y-2.5">
                  {lineas.map((l: any, i: number) => (
                    <div key={l.id ?? i} className="flex items-start gap-3 border-b border-gray-50 pb-2.5 last:border-b-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-gray-800">{l.description}</p>
                        <p className="font-mono text-[11px] text-gray-400">
                          {Number(l.quantity)} × {crc(l.unitPrice)}
                          {Number(l.taxRate) > 0 && ` · IVA ${Number(l.taxRate)}%`}
                        </p>
                      </div>
                      <span className="flex-shrink-0 font-mono text-sm tabular-nums text-gray-900">
                        {crc(Number(l.quantity) * Number(l.unitPrice))}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 space-y-1 border-t border-gray-200 pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-mono tabular-nums text-gray-700">{crc(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Impuesto</span>
                  <span className="font-mono tabular-nums text-gray-700">{crc(impuesto)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-1.5 text-sm font-bold">
                  <span className="text-gray-900">Total</span>
                  <span className="font-mono tabular-nums text-gray-900">{crc(q.total)}</span>
                </div>
              </div>
            </div>

            {/* Lo que más cuesta entender del módulo, dicho donde se trabaja. */}
            <div className="flex items-start gap-2.5 rounded-xl border border-blue-200/70 bg-blue-50/60 p-3">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
              <p className="text-xs text-blue-900">
                Una cotización <strong>no mueve la contabilidad</strong>: es una oferta, no un
                hecho económico. El asiento aparece cuando se convierte en factura y esta se emite.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
