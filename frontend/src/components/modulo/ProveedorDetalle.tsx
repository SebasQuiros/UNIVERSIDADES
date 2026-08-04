'use client';

/**
 * Ficha de proveedor.
 *
 * El espejo de la ficha de cliente, del otro lado del negocio: cuánto le
 * compré, cuánto le debo, qué órdenes tengo abiertas con él.
 *
 * Un detalle del modelo que se nota acá: las órdenes de compra apuntan al
 * proveedor por id, pero las facturas de compra guardan el nombre y la cédula
 * como texto. El backend arma el historial por los dos lados; si un proveedor
 * se cargó sin identificación, sus facturas se encuentran por nombre.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import { X, Pencil, Mail, Phone, MapPin, CreditCard, FileText, Banknote, ShoppingCart, Check } from 'lucide-react';

export interface ProveedorLista {
  id: string; name: string; email?: string | null; identification?: string | null;
  phone?: string | null; address?: string | null; isActive: boolean; createdAt?: string;
}

const crc = (v: any) =>
  '₡' + Number(v ?? 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const crc0 = (v: any) =>
  '₡' + Number(v ?? 0).toLocaleString('es-CR', { maximumFractionDigits: 0 });
const fecha = (d: any) =>
  d ? new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const ESTADO_ORDEN: Record<string, { texto: string; clase: string }> = {
  DRAFT:     { texto: 'Borrador',  clase: 'bg-gray-100 text-gray-600 ring-gray-200' },
  ISSUED:    { texto: 'Emitida',   clase: 'bg-blue-50 text-blue-700 ring-blue-200' },
  RECEIVED:  { texto: 'Recibida',  clase: 'bg-amber-50 text-amber-700 ring-amber-200' },
  INVOICED:  { texto: 'Facturada', clase: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  CANCELLED: { texto: 'Anulada',   clase: 'bg-rose-50 text-rose-700 ring-rose-200' },
};

type Pestana = 'resumen' | 'informacion' | 'comercial' | 'documentos';

export function ProveedorDetalle({
  companyId, proveedor, onClose, onSaved, readonly,
}: {
  companyId: string;
  proveedor: ProveedorLista;
  onClose: () => void;
  onSaved: () => void;
  readonly?: boolean;
}) {
  const [pestana, setPestana] = useState<Pestana>('resumen');
  const [datos, setDatos] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({
    name: proveedor.name, email: proveedor.email ?? '', phone: proveedor.phone ?? '',
    address: proveedor.address ?? '', identification: proveedor.identification ?? '',
  });

  const cargar = useCallback(() => {
    setCargando(true);
    api.get(`/api/v1/companies/${companyId}/suppliers/${proveedor.id}/resumen`)
      .then(({ data }) => {
        setDatos(data);
        const p = data.proveedor ?? {};
        setForm({
          name: p.name ?? '', email: p.email ?? '', phone: p.phone ?? '',
          address: p.address ?? '', identification: p.identification ?? '',
        });
      })
      .catch(() => toast.error('No se pudo cargar la ficha del proveedor'))
      .finally(() => setCargando(false));
  }, [companyId, proveedor.id]);

  useEffect(() => { cargar(); }, [cargar]);

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
      await api.patch(`/api/v1/companies/${companyId}/suppliers/${proveedor.id}`, {
        name:    form.name.trim(),
        email:   form.email.trim()   || null,
        phone:   form.phone.trim()   || null,
        address: form.address.trim() || null,
        identification: form.identification.trim() || null,
      });
      toast.success('Proveedor actualizado');
      setEditando(false);
      cargar();
      onSaved();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setGuardando(false); }
  }

  const p = datos?.proveedor ?? proveedor;
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
      <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-50 to-amber-100 text-lg font-bold text-amber-700 ring-1 ring-amber-200/60">
          {p.name?.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-bold text-gray-900">{p.name}</h3>
            <span className={`flex-shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
              p.isActive
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : 'bg-gray-100 text-gray-500 ring-gray-200'}`}>
              {p.isActive ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <p className="text-xs text-gray-400">Proveedor desde {fecha(p.createdAt)}</p>
        </div>
        <button onClick={onClose} aria-label="Cerrar ficha"
          className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-gray-50 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

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
                    aria-label="Editar proveedor"
                    className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-700">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Dato icono={CreditCard} etiqueta="Identificación" valor={p.identification} />
                <Dato icono={Mail}       etiqueta="Correo"         valor={p.email} />
                <Dato icono={Phone}      etiqueta="Teléfono"       valor={p.phone} />
                <Dato icono={MapPin}     etiqueta="Dirección"      valor={p.address} />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200/70 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Resumen comercial</p>
              <div className="grid grid-cols-3 gap-4">
                <Cifra etiqueta="Comprado" valor={crc0(com?.compradoTotal)} />
                <Cifra etiqueta="Pagado"   valor={crc0(com?.pagadoTotal)} />
                <Cifra etiqueta="Saldo por pagar" valor={crc0(com?.saldoPorPagar)}
                       tono={Number(com?.saldoPorPagar) > 0 ? 'text-rose-700' : 'text-gray-900'} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <Cifra etiqueta="Facturas" valor={String(com?.documentos ?? 0)} />
                <Cifra etiqueta="Órdenes abiertas" valor={String(com?.ordenesPendientes ?? 0)} />
                <Cifra etiqueta="Última compra" valor={fecha(com?.ultimaCompra)} />
              </div>
            </div>

            {(datos?.facturas ?? []).length > 0 && (
              <div className="rounded-xl border border-gray-200/70 p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Actividad reciente</p>
                <div className="space-y-2.5">
                  {datos.facturas.slice(0, 4).map((f: any) => (
                    <div key={f.id} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-gray-800">Factura {f.invoiceNumber}</p>
                        <p className="text-[11px] text-gray-400">{fecha(f.date)}</p>
                      </div>
                      <span className="flex-shrink-0 font-mono text-sm tabular-nums text-gray-700">{crc(f.total)}</span>
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
              <Input label="Identificación" value={form.identification}
                     onChange={(e) => setForm({ ...form, identification: e.target.value })} />
              <Input label="Correo" type="email" value={form.email}
                     onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label="Teléfono" value={form.phone}
                     onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input label="Dirección" value={form.address}
                     onChange={(e) => setForm({ ...form, address: e.target.value })} />
              {/* Las facturas de compra guardan la cédula como texto: cambiarla
                  acá NO reescribe las que ya están registradas, y el historial
                  se arma con ese dato. Se avisa en vez de dejar que sorprenda. */}
              {(datos?.facturas ?? []).length > 0 && (
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Este proveedor tiene {datos.facturas.length} factura(s) registradas con la
                  identificación actual. Si la cambiás, esas facturas dejan de aparecer en su historial.
                </div>
              )}
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
                <Dato icono={CreditCard} etiqueta="Identificación" valor={p.identification} />
                <Dato icono={Mail}       etiqueta="Correo"    valor={p.email} />
                <Dato icono={Phone}      etiqueta="Teléfono"  valor={p.phone} />
                <Dato icono={MapPin}     etiqueta="Dirección" valor={p.address} />
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
                Movimiento del año {com?.anio}
              </p>
              <div className="grid grid-cols-3 gap-4">
                <Cifra etiqueta="Comprado" valor={crc0(com?.compradoAnio)} />
                <Cifra etiqueta="Pagado"   valor={crc0(com?.pagadoAnio)} />
                <Cifra etiqueta="Facturas" valor={String(com?.documentosAnio ?? 0)} />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200/70 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                Órdenes de compra ({datos?.ordenes?.length ?? 0})
              </p>
              {(datos?.ordenes ?? []).length === 0 ? (
                <p className="text-sm text-gray-400">Sin órdenes de compra con este proveedor.</p>
              ) : (
                <div className="space-y-2">
                  {datos.ordenes.map((o: any) => {
                    const e = ESTADO_ORDEN[o.status] ?? { texto: o.status, clase: 'bg-gray-100 text-gray-600 ring-gray-200' };
                    return (
                      <div key={o.id} className="flex items-center gap-3">
                        <ShoppingCart className="h-4 w-4 flex-shrink-0 text-gray-300" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-xs text-gray-700">OC-{o.orderNumber}</p>
                          <p className="text-[11px] text-gray-400">{fecha(o.issueDate)}</p>
                        </div>
                        <span className={`flex-shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${e.clase}`}>
                          {e.texto}
                        </span>
                        <span className="flex-shrink-0 font-mono text-sm tabular-nums text-gray-900">{crc(o.total)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                Facturas de compra ({datos?.facturas?.length ?? 0})
              </p>
              {(datos?.facturas ?? []).length === 0 ? (
                <p className="rounded-lg bg-gray-50 px-3 py-6 text-center text-sm text-gray-400">
                  Todavía no hay compras registradas a este proveedor.
                </p>
              ) : (
                <div className="divide-y divide-gray-50 overflow-hidden rounded-xl border border-gray-200/70">
                  {datos.facturas.map((f: any) => {
                    const saldo = Number(f.total) - Number(f.paidAmount ?? 0);
                    return (
                      <div key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                        <FileText className="h-4 w-4 flex-shrink-0 text-gray-300" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-xs text-gray-700">{f.invoiceNumber}</p>
                          <p className="text-[11px] text-gray-400">{fecha(f.date)}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="font-mono text-sm tabular-nums text-gray-900">{crc(f.total)}</p>
                          {saldo > 0.01 && (
                            <p className="font-mono text-[11px] tabular-nums text-rose-600">
                              debo {crc(saldo)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {(datos?.pagos ?? []).length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                  Pagos realizados ({datos.pagos.length})
                </p>
                <div className="divide-y divide-gray-50 overflow-hidden rounded-xl border border-gray-200/70">
                  {datos.pagos.map((g: any) => (
                    <div key={g.id} className="flex items-center gap-3 px-3 py-2.5">
                      <Banknote className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-gray-700">{g.reference || g.method}</p>
                        <p className="text-[11px] text-gray-400">{fecha(g.paymentDate)}</p>
                      </div>
                      <span className="flex-shrink-0 font-mono text-sm tabular-nums text-emerald-700">
                        {crc(g.amount)}
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
