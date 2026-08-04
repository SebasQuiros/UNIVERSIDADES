'use client';

/**
 * Ficha de cliente.
 *
 * Se abre al hacer clic en una fila de la lista. La lista responde "quién es
 * mi cliente"; esta ficha responde "cómo va la relación con él": cuánto le
 * facturé, cuánto me debe, cuánto crédito le queda, y qué documentos hay.
 *
 * Cuatro pestañas, en el orden en que se consultan: Resumen para la respuesta
 * corta, Información para los datos de contacto (y editarlos), Comercial para
 * las condiciones de crédito, Documentos para el detalle factura por factura.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import { X, Pencil, Mail, Phone, MapPin, CreditCard, FileText, Receipt, Check } from 'lucide-react';

export interface ClienteLista {
  id: string; name: string; email: string | null; identification: string | null;
  phone?: string | null; address?: string | null; idType?: string;
  creditDays?: number; creditLimit?: number | string; isActive: boolean; createdAt?: string;
}

const crc = (v: any) =>
  '₡' + Number(v ?? 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const crc0 = (v: any) =>
  '₡' + Number(v ?? 0).toLocaleString('es-CR', { maximumFractionDigits: 0 });
const fecha = (d: any) =>
  d ? new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const TIPOS_ID: Record<string, string> = {
  '01': 'Cédula física', '02': 'Cédula jurídica', '03': 'DIMEX', '04': 'NITE',
};

type Pestana = 'resumen' | 'informacion' | 'comercial' | 'documentos';

export function ClienteDetalle({
  companyId, cliente, onClose, onSaved, readonly,
}: {
  companyId: string;
  cliente: ClienteLista;
  onClose: () => void;
  onSaved: () => void;
  readonly?: boolean;
}) {
  const [pestana, setPestana] = useState<Pestana>('resumen');
  const [datos, setDatos]     = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({
    name: cliente.name, email: cliente.email ?? '', phone: cliente.phone ?? '',
    address: cliente.address ?? '', creditDays: String(cliente.creditDays ?? 0),
    creditLimit: String(cliente.creditLimit ?? 0),
  });

  const cargar = useCallback(() => {
    setCargando(true);
    api.get(`/api/v1/companies/${companyId}/clients/${cliente.id}/resumen`)
      .then(({ data }) => {
        setDatos(data);
        // El formulario se rearma con lo que dice el servidor, no con lo que
        // traía la fila de la lista: la lista puede estar desactualizada.
        const c = data.cliente ?? {};
        setForm({
          name: c.name ?? '', email: c.email ?? '', phone: c.phone ?? '',
          address: c.address ?? '', creditDays: String(c.creditDays ?? 0),
          creditLimit: String(c.creditLimit ?? 0),
        });
      })
      .catch(() => toast.error('No se pudo cargar la ficha del cliente'))
      .finally(() => setCargando(false));
  }, [companyId, cliente.id]);

  useEffect(() => { cargar(); }, [cargar]);

  // Cerrar con Escape: el panel tapa la tabla y hay que poder salir sin buscar
  // la X con el mouse.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape' && !editando) onClose(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onClose, editando]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('El nombre no puede quedar vacío'); return; }
    setGuardando(true);
    try {
      await api.patch(`/api/v1/companies/${companyId}/clients/${cliente.id}`, {
        name:    form.name.trim(),
        // Cadena vacía = borrar el dato. Mandar "" tal cual dejaria el campo
        // en blanco en vez de nulo, y despues "sin correo" no se distingue
        // de "correo vacio".
        email:   form.email.trim()   || null,
        phone:   form.phone.trim()   || null,
        address: form.address.trim() || null,
        creditDays:  Number(form.creditDays)  || 0,
        creditLimit: Number(form.creditLimit) || 0,
      });
      toast.success('Cliente actualizado');
      setEditando(false);
      cargar();
      onSaved();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setGuardando(false); }
  }

  const c = datos?.cliente ?? cliente;
  const com = datos?.comercial;

  const Dato = ({ icono: Icono, etiqueta, valor }: { icono: any; etiqueta: string; valor: any }) => (
    <div className="flex items-start gap-2.5">
      <Icono className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{etiqueta}</p>
        <p className="truncate text-sm text-gray-800">{valor || <span className="text-gray-300">—</span>}</p>
      </div>
    </div>
  );

  const Cifra = ({ etiqueta, valor, tono }: { etiqueta: string; valor: string; tono?: string }) => (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{etiqueta}</p>
      <p className={`font-mono text-sm font-semibold tabular-nums ${tono ?? 'text-gray-900'}`}>{valor}</p>
    </div>
  );

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden rounded-card border border-gray-200/70 bg-white shadow-card">
      {/* ── Cabecera ── */}
      <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-blue-100 text-lg font-bold text-blue-700 ring-1 ring-blue-200/60">
          {c.name?.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-bold text-gray-900">{c.name}</h3>
            <span className={`flex-shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
              c.isActive
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : 'bg-gray-100 text-gray-500 ring-gray-200'}`}>
              {c.isActive ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <p className="text-xs text-gray-400">Cliente desde {fecha(c.createdAt)}</p>
        </div>
        <button onClick={onClose} aria-label="Cerrar ficha"
          className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-gray-50 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Pestañas ── */}
      <div className="flex gap-1 border-b border-gray-100 px-3">
        {([
          ['resumen', 'Resumen'], ['informacion', 'Información'],
          ['comercial', 'Comercial'], ['documentos', 'Documentos'],
        ] as const).map(([id, texto]) => (
          <button key={id} onClick={() => setPestana(id)}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
              pestana === id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            {texto}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {cargando ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : pestana === 'resumen' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Información general</p>
                {!readonly && (
                  <button onClick={() => { setPestana('informacion'); setEditando(true); }}
                    aria-label="Editar cliente"
                    className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-700">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Dato icono={CreditCard} etiqueta="Identificación" valor={c.identification} />
                <Dato icono={Mail}   etiqueta="Correo"         valor={c.email} />
                <Dato icono={Phone}  etiqueta="Teléfono"       valor={c.phone} />
                <Dato icono={MapPin} etiqueta="Dirección"      valor={c.address} />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200/70 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                Resumen comercial
              </p>
              <div className="grid grid-cols-3 gap-4">
                <Cifra etiqueta="Facturado" valor={crc0(com?.facturadoTotal)} />
                <Cifra etiqueta="Cobrado"   valor={crc0(com?.cobradoTotal)} />
                <Cifra etiqueta="Saldo pendiente" valor={crc0(com?.saldoPendiente)}
                       tono={Number(com?.saldoPendiente) > 0 ? 'text-rose-700' : 'text-gray-900'} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <Cifra etiqueta="Documentos" valor={String(com?.documentos ?? 0)} />
                <Cifra etiqueta="Días crédito" valor={`${com?.diasCredito ?? 0} días`} />
                <Cifra etiqueta="Última compra" valor={fecha(com?.ultimaCompra)} />
              </div>
            </div>

            {(datos?.documentos ?? []).length > 0 && (
              <div className="rounded-xl border border-gray-200/70 p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Actividad reciente</p>
                <div className="space-y-2.5">
                  {datos.documentos.slice(0, 4).map((d: any) => (
                    <div key={d.id} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-gray-800">Factura {d.consecutiveNumber}</p>
                        <p className="text-[11px] text-gray-400">{fecha(d.issueDate)}</p>
                      </div>
                      <span className="flex-shrink-0 font-mono text-sm tabular-nums text-gray-700">{crc(d.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : pestana === 'informacion' ? (
          editando ? (
            <form onSubmit={guardar} className="space-y-3">
              <Input label="Nombre *" value={form.name}
                     onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Correo" type="email" value={form.email}
                     onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label="Teléfono" value={form.phone}
                     onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input label="Dirección" value={form.address}
                     onChange={(e) => setForm({ ...form, address: e.target.value })} />
              {/* La identificación NO se edita: es la llave con la que se
                  emitieron las facturas ya timbradas. Cambiarla dejaría los
                  documentos existentes a nombre de otro. */}
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                La identificación ({c.identification}) no se puede cambiar: las facturas
                ya emitidas se timbraron con ella.
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="secondary" className="flex-1"
                        onClick={() => { setEditando(false); cargar(); }}>Cancelar</Button>
                <Button type="submit" className="flex-1" loading={guardando}>
                  <Check className="h-4 w-4" /> Guardar
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <Dato icono={CreditCard} etiqueta={TIPOS_ID[c.idType ?? '01'] ?? 'Identificación'} valor={c.identification} />
                <Dato icono={Mail}   etiqueta="Correo"    valor={c.email} />
                <Dato icono={Phone}  etiqueta="Teléfono"  valor={c.phone} />
                <Dato icono={MapPin} etiqueta="Dirección" valor={c.address} />
              </div>
              {!readonly && (
                <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
                  <Pencil className="h-4 w-4" /> Editar datos
                </Button>
              )}
            </div>
          )
        ) : pestana === 'comercial' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200/70 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                Condiciones de crédito
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Cifra etiqueta="Días de crédito" valor={`${com?.diasCredito ?? 0} días`} />
                <Cifra etiqueta="Límite de crédito"
                       valor={Number(com?.limiteCredito) > 0 ? crc(com?.limiteCredito) : 'Sin límite'} />
                <Cifra etiqueta="Saldo pendiente" valor={crc(com?.saldoPendiente)}
                       tono={Number(com?.saldoPendiente) > 0 ? 'text-rose-700' : 'text-gray-900'} />
                <Cifra etiqueta="Crédito disponible"
                       valor={com?.creditoDisponible !== null && com?.creditoDisponible !== undefined
                         ? crc(com.creditoDisponible) : 'Sin límite'}
                       tono={com?.creditoDisponible !== null && Number(com?.creditoDisponible) === 0
                         ? 'text-rose-700' : 'text-emerald-700'} />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200/70 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                Movimiento del año {com?.anio}
              </p>
              <div className="grid grid-cols-3 gap-4">
                <Cifra etiqueta="Facturado" valor={crc0(com?.facturadoAnio)} />
                <Cifra etiqueta="Cobrado"   valor={crc0(com?.cobradoAnio)} />
                <Cifra etiqueta="Documentos" valor={String(com?.documentosAnio ?? 0)} />
              </div>
            </div>

            {!readonly && !editando && (
              <Button size="sm" variant="secondary"
                      onClick={() => { setPestana('informacion'); setEditando(true); }}>
                <Pencil className="h-4 w-4" /> Cambiar condiciones
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                Facturas ({datos?.documentos?.length ?? 0})
              </p>
              {(datos?.documentos ?? []).length === 0 ? (
                <p className="rounded-lg bg-gray-50 px-3 py-6 text-center text-sm text-gray-400">
                  Todavía no se le ha facturado a este cliente.
                </p>
              ) : (
                <div className="divide-y divide-gray-50 overflow-hidden rounded-xl border border-gray-200/70">
                  {datos.documentos.map((d: any) => (
                    <div key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                      <FileText className="h-4 w-4 flex-shrink-0 text-gray-300" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs text-gray-700">{d.consecutiveNumber}</p>
                        <p className="text-[11px] text-gray-400">{fecha(d.issueDate)}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="font-mono text-sm tabular-nums text-gray-900">{crc(d.total)}</p>
                        {Number(d.balanceDue) > 0 && (
                          <p className="font-mono text-[11px] tabular-nums text-rose-600">
                            debe {crc(d.balanceDue)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(datos?.cobros ?? []).length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                  Cobros recibidos ({datos.cobros.length})
                </p>
                <div className="divide-y divide-gray-50 overflow-hidden rounded-xl border border-gray-200/70">
                  {datos.cobros.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                      <Receipt className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-gray-700">{p.reference || p.method}</p>
                        <p className="text-[11px] text-gray-400">{fecha(p.paidAt)}</p>
                      </div>
                      <span className="flex-shrink-0 font-mono text-sm tabular-nums text-emerald-700">
                        {crc(p.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
