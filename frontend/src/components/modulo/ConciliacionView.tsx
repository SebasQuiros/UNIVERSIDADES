'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { getErrorMessage, cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SceneEmptyBox } from '@/components/illustrations';
import { Landmark, Plus, X, Wand2, Check, EyeOff, Scale } from 'lucide-react';
import { useEmpresaActiva } from './ModuloWorkspace';

interface CuentaBanco { id: string; name: string; bankName: string; accountNumber?: string | null; currency?: string }
interface Extracto   { id: string; periodStart: string; periodEnd: string; status: string; closingBalance?: number | string }
interface Linea {
  id: string; date: string; description: string; amount: number | string;
  type: string; isIgnored?: boolean;
  matchedTransaction?: { id: string; description: string; amount: number | string } | null;
}
interface Resumen {
  totalLines: number; matched: number; unmatched: number; ignored: number;
  systemBalance: number | string; bankBalance: number | string;
  difference: number | string; isReconciled: boolean;
}

const money = (n: number | string) =>
  '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fecha = (d: string) => {
  try { return new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
  catch { return '—'; }
};

/**
 * Conciliación bancaria: cruzar el extracto del banco contra los movimientos
 * de los libros.
 *
 * El backend de este módulo estaba completo —cuentas, carga de extractos,
 * cruce automático y manual, cierre— pero no tenía ninguna pantalla: 9
 * endpoints que nadie podía alcanzar. El menú "Conciliaciones bancarias"
 * llevaba en realidad al módulo de movimientos, que es otra cosa.
 */
export function ConciliacionView() {
  const { companyId, estado } = useEmpresaActiva();
  const [cuentas, setCuentas]   = useState<CuentaBanco[]>([]);
  const [cuentaId, setCuentaId] = useState('');
  const [extractos, setExtractos] = useState<Extracto[]>([]);
  const [extractoId, setExtractoId] = useState('');
  const [lineas, setLineas]     = useState<Linea[]>([]);
  const [resumen, setResumen]   = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(false);
  const [nuevaCuenta, setNuevaCuenta] = useState(false);

  // Cuentas bancarias de la empresa.
  const cargarCuentas = useCallback(async () => {
    if (!companyId) return;
    try {
      const { data } = await api.get<CuentaBanco[]>(`/api/v1/companies/${companyId}/bank-accounts`);
      const lista = Array.isArray(data) ? data : [];
      setCuentas(lista);
      if (lista[0] && !cuentaId) setCuentaId(lista[0].id);
    } catch (e) { toast.error(getErrorMessage(e)); }
  }, [companyId, cuentaId]);

  useEffect(() => { cargarCuentas(); }, [cargarCuentas]);

  // Extractos de la cuenta elegida.
  useEffect(() => {
    if (!companyId || !cuentaId) { setExtractos([]); return; }
    api.get<Extracto[]>(`/api/v1/companies/${companyId}/bank-accounts/${cuentaId}/statements`)
      .then(({ data }) => {
        const lista = Array.isArray(data) ? data : [];
        setExtractos(lista);
        setExtractoId(lista[0]?.id ?? '');
      })
      .catch(() => setExtractos([]));
  }, [companyId, cuentaId]);

  // Estado de la conciliación del extracto elegido.
  const cargarEstado = useCallback(async () => {
    if (!companyId || !extractoId) { setLineas([]); setResumen(null); return; }
    setCargando(true);
    try {
      const { data } = await api.get<any>(`/api/v1/companies/${companyId}/bank-statements/${extractoId}/status`);
      setLineas(data?.lines ?? []);
      setResumen(data?.summary ?? null);
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setCargando(false); }
  }, [companyId, extractoId]);

  useEffect(() => { cargarEstado(); }, [cargarEstado]);

  async function cruzarAuto() {
    try {
      const { data } = await api.post<any>(`/api/v1/companies/${companyId}/bank-statements/${extractoId}/auto-match`, {});
      toast.success(`Se cruzaron ${data?.matched ?? 0} movimiento(s) automáticamente`);
      cargarEstado();
    } catch (e) { toast.error(getErrorMessage(e)); }
  }

  async function ignorar(lineaId: string) {
    try {
      await api.post(`/api/v1/companies/${companyId}/bank-statements/${extractoId}/ignore/${lineaId}`, {});
      cargarEstado();
    } catch (e) { toast.error(getErrorMessage(e)); }
  }

  async function cerrar() {
    try {
      await api.post(`/api/v1/companies/${companyId}/bank-statements/${extractoId}/complete`, {});
      toast.success('Conciliación cerrada');
      cargarEstado();
    } catch (e) { toast.error(getErrorMessage(e)); }
  }

  if (estado === 'cargando') return <div className="flex-1 grid place-items-center p-12"><Spinner /></div>;
  if (estado === 'sin-empresa' || !companyId) {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <EmptyState illustration={<SceneEmptyBox />} title="Todavía no tenés una empresa"
          description="Creá una empresa en el Espacio Contador para conciliar sus cuentas." />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <PageHeader
          icon={Scale} title="Conciliación bancaria"
          subtitle="Cruzá el extracto que te da el banco contra los movimientos de tus libros."
          actions={<Button onClick={() => setNuevaCuenta(true)} className="cx-press"><Plus className="h-4 w-4" /> Nueva cuenta</Button>}
        />

        {cuentas.length === 0 ? (
          <SectionCard icon={Landmark} eyebrow="Bancos" title="Sin cuentas bancarias"
            description="Registrá la cuenta antes de conciliar.">
            <EmptyState illustration={<SceneEmptyBox />} title="Todavía no hay cuentas"
              description="Creá la cuenta del banco con la que trabaja tu empresa." />
          </SectionCard>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.bankName}</option>
                ))}
              </select>
              {extractos.length > 0 && (
                <select value={extractoId} onChange={(e) => setExtractoId(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                  {extractos.map((x) => (
                    <option key={x.id} value={x.id}>
                      {fecha(x.periodStart)} – {fecha(x.periodEnd)} · {x.status}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {resumen && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Movimientos" value={String(resumen.totalLines)} icon={Landmark} />
                <StatCard label="Cruzados" value={String(resumen.matched)} icon={Check} />
                <StatCard label="Sin cruzar" value={String(resumen.unmatched)} icon={EyeOff} />
                <StatCard label="Diferencia" value={money(resumen.difference)} icon={Scale} />
              </div>
            )}

            {resumen && (
              <div className={cn(
                'rounded-xl border p-3 text-sm',
                resumen.isReconciled
                  ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                  : 'border-amber-200 bg-amber-50/60 text-amber-900',
              )}>
                {resumen.isReconciled ? (
                  <p><b>Conciliado.</b> El saldo del banco coincide con el de tus libros.</p>
                ) : (
                  <>
                    <p className="font-semibold">Todavía no cuadra.</p>
                    <p className="mt-1">
                      Banco: <b>{money(resumen.bankBalance)}</b> · Libros: <b>{money(resumen.systemBalance)}</b> ·
                      Diferencia: <b>{money(resumen.difference)}</b>
                    </p>
                    <p className="mt-1 text-xs">
                      La diferencia son movimientos que están en un lado y no en el otro: cheques sin
                      cobrar, depósitos en tránsito o comisiones que el banco cobró y no registraste.
                    </p>
                  </>
                )}
              </div>
            )}

            <SectionCard
              icon={Landmark} eyebrow="Extracto" title="Movimientos del banco"
              description="Cruzá cada movimiento con el de tus libros. Los que no correspondan, ignoralos."
              action={extractoId ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={cruzarAuto} className="cx-press">
                    <Wand2 className="h-4 w-4" /> Cruzar automático
                  </Button>
                  {resumen?.isReconciled && (
                    <Button size="sm" onClick={cerrar} className="cx-press">Cerrar conciliación</Button>
                  )}
                </div>
              ) : undefined}
            >
              {cargando ? (
                <div className="grid place-items-center py-10"><Spinner /></div>
              ) : lineas.length === 0 ? (
                <EmptyState illustration={<SceneEmptyBox />} title="Sin movimientos"
                  description="Cargá el extracto que te entregó el banco para empezar a conciliar." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className="py-2 pr-3">Fecha</th>
                        <th className="py-2 pr-3">Descripción del banco</th>
                        <th className="py-2 pr-3 text-right">Monto</th>
                        <th className="py-2 pr-3">Cruzado con</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lineas.map((l) => (
                        <tr key={l.id} className={cn('hover:bg-gray-50/60', l.isIgnored && 'opacity-50')}>
                          <td className="py-2 pr-3 text-gray-500">{fecha(l.date)}</td>
                          <td className="py-2 pr-3">{l.description}</td>
                          <td className="py-2 pr-3 text-right font-mono tabular-nums">{money(l.amount)}</td>
                          <td className="py-2 pr-3">
                            {l.matchedTransaction ? (
                              <Badge variant="green">{l.matchedTransaction.description}</Badge>
                            ) : l.isIgnored ? (
                              <Badge variant="slate">Ignorado</Badge>
                            ) : (
                              <Badge variant="amber">Sin cruzar</Badge>
                            )}
                          </td>
                          <td className="py-2 text-right">
                            {!l.matchedTransaction && !l.isIgnored && (
                              <button onClick={() => ignorar(l.id)}
                                className="text-xs text-gray-500 underline hover:text-gray-700">
                                ignorar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </>
        )}
      </div>

      {nuevaCuenta && (
        <ModalCuenta companyId={companyId}
          onCerrar={() => setNuevaCuenta(false)}
          onListo={() => { setNuevaCuenta(false); cargarCuentas(); }} />
      )}
    </div>
  );
}

function ModalCuenta({ companyId, onCerrar, onListo }: {
  companyId: string; onCerrar: () => void; onListo: () => void;
}) {
  const [name, setName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!name.trim() || !bankName.trim()) { toast.error('Completá el nombre y el banco'); return; }
    setGuardando(true);
    try {
      await api.post(`/api/v1/companies/${companyId}/bank-accounts`, {
        name: name.trim(), bankName: bankName.trim(),
        accountNumber: accountNumber.trim() || undefined, currency: 'CRC',
      });
      toast.success('Cuenta bancaria creada');
      onListo();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setGuardando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Nueva cuenta bancaria</h3>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Nombre *</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Cuenta corriente principal" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Banco *</label>
            <input value={bankName} onChange={(e) => setBankName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Banco Nacional" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Número de cuenta</label>
            <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Opcional" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={onCerrar}>Cancelar</Button>
            <Button size="sm" loading={guardando} onClick={guardar}>Crear cuenta</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
