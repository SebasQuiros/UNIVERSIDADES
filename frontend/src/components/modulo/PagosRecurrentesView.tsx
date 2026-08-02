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
import { CalendarClock, Plus, X, Repeat, Wallet, AlertCircle, Play, Pause, Trash2 } from 'lucide-react';

type Frecuencia =
  | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'BIMONTHLY'
  | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';

interface PagoRecurrente {
  id: string;
  supplierName: string;
  description: string | null;
  amount: number | string;
  taxRate: number | string;
  frequency: Frecuencia;
  nextRunAt: string;
  lastRunAt: string | null;
  timesRun: number;
  isActive: boolean;
  isDue?: boolean;
}

// Etiquetas en español de Costa Rica. El backend guarda el enum en inglés.
const FRECUENCIAS: { value: Frecuencia; label: string }[] = [
  { value: 'WEEKLY',     label: 'Semanal' },
  { value: 'BIWEEKLY',   label: 'Quincenal' },
  { value: 'MONTHLY',    label: 'Mensual' },
  { value: 'BIMONTHLY',  label: 'Bimensual' },
  { value: 'QUARTERLY',  label: 'Trimestral' },
  { value: 'SEMIANNUAL', label: 'Semestral' },
  { value: 'ANNUAL',     label: 'Anual' },
];
const etiquetaFrecuencia = (f: Frecuencia) =>
  FRECUENCIAS.find((x) => x.value === f)?.label ?? f;

// Mismas tarifas de IVA que el resto del sistema, en porcentaje.
const TASAS = [
  { value: 13, label: '13% — Tarifa general' },
  { value: 8,  label: '8% — Medicina privada / seguros' },
  { value: 4,  label: '4% — Boletos aéreos / espectáculos' },
  { value: 2,  label: '2% — Canasta básica' },
  { value: 1,  label: '1% — Medicamentos / insumos agropecuarios' },
  { value: 0,  label: '0% — Exento' },
];

const money = (n: number | string) =>
  '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fecha = (d: string | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return '—'; }
};
const round2 = (n: number) => Math.round(n * 100) / 100;

// Un pago "toca" cuando su próxima fecha ya pasó. Preferimos el campo
// derivado del backend; el cálculo local es solo respaldo.
const yaToca = (p: PagoRecurrente) =>
  p.isActive && (p.isDue ?? new Date(p.nextRunAt).getTime() <= Date.now());

/**
 * Pagos recurrentes: gastos fijos PROGRAMADOS (alquiler, internet, servicios).
 *
 * No se contabilizan solos a propósito. El estudiante ve la fecha llegar y
 * pulsa "Generar ahora"; ahí recién nace la factura de compra real con su
 * asiento y su crédito fiscal. La idea didáctica es que quede clarísimo el
 * momento en que un compromiso se vuelve un documento contable.
 */
export function PagosRecurrentesView() {
  const { companyId, estado } = useEmpresaActiva();
  const [rows, setRows] = useState<PagoRecurrente[]>([]);
  const [cargando, setCargando] = useState(false);
  const [abrir, setAbrir] = useState(false);
  const [generando, setGenerando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!companyId) return;
    setCargando(true);
    try {
      const { data } = await api.get<any>(`/api/v1/companies/${companyId}/recurring-payments`);
      setRows(Array.isArray(data) ? data : (data?.items ?? []));
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setCargando(false); }
  }, [companyId]);

  useEffect(() => { cargar(); }, [cargar]);

  async function generar(p: PagoRecurrente) {
    if (!companyId) return;
    setGenerando(p.id);
    try {
      await api.post(`/api/v1/companies/${companyId}/recurring-payments/${p.id}/generate`, {});
      toast.success('Se registró la factura de compra con su asiento contable');
      cargar();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setGenerando(null); }
  }

  async function alternar(p: PagoRecurrente) {
    if (!companyId) return;
    try {
      await api.patch(`/api/v1/companies/${companyId}/recurring-payments/${p.id}/active`, {
        isActive: !p.isActive,
      });
      toast.success(p.isActive ? 'Pago pausado' : 'Pago reactivado');
      cargar();
    } catch (e) { toast.error(getErrorMessage(e)); }
  }

  async function eliminar(p: PagoRecurrente) {
    if (!companyId) return;
    if (!confirm(`¿Eliminar el pago recurrente de ${p.supplierName}? Las facturas ya generadas se mantienen.`)) return;
    try {
      await api.delete(`/api/v1/companies/${companyId}/recurring-payments/${p.id}`);
      toast.success('Pago recurrente eliminado');
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
          description="Creá una empresa en el Espacio Contador para programar tus gastos fijos."
        />
      </div>
    );
  }

  const pendientes = rows.filter(yaToca);
  // Costo mensual estimado: normalizamos cada frecuencia a un mes para que el
  // estudiante vea cuánto se le va en gastos fijos, no solo la lista suelta.
  const VECES_AL_MES: Record<Frecuencia, number> = {
    WEEKLY: 52 / 12, BIWEEKLY: 26 / 12, MONTHLY: 1, BIMONTHLY: 1 / 2,
    QUARTERLY: 1 / 3, SEMIANNUAL: 1 / 6, ANNUAL: 1 / 12,
  };
  const mensual = rows
    .filter((r) => r.isActive)
    .reduce((s, r) => s + Number(r.amount || 0) * VECES_AL_MES[r.frequency], 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <PageHeader
          icon={CalendarClock}
          title="Pagos recurrentes"
          subtitle="Programá tus gastos fijos (alquiler, internet, servicios). Cuando llega la fecha, los generás y nace la factura de compra con su asiento."
          actions={
            <Button onClick={() => setAbrir(true)} className="cx-press">
              <Plus className="h-4 w-4" /> Nuevo pago recurrente
            </Button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Pagos programados" value={String(rows.length)} icon={Repeat} />
          <StatCard label="Ya toca generarlos" value={String(pendientes.length)} icon={AlertCircle} />
          <StatCard label="Gasto fijo mensual" value={money(round2(mensual))} icon={Wallet} />
        </div>

        <SectionCard
          icon={CalendarClock}
          eyebrow="Ciclo de egresos"
          title="Calendario de gastos fijos"
          description="Los resaltados en ámbar ya llegaron a su fecha: generalos para que entren a la contabilidad."
        >
          {cargando ? (
            <div className="grid place-items-center py-10"><Spinner /></div>
          ) : rows.length === 0 ? (
            <EmptyState
              illustration={<SceneEmptyBox />}
              title="Todavía no programaste gastos fijos"
              description="Alquiler, internet, electricidad… programalos una vez y generalos cada vez que toque."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Proveedor</th>
                    <th className="py-2 pr-3">Frecuencia</th>
                    <th className="py-2 pr-3">Próxima fecha</th>
                    <th className="py-2 pr-3 text-right">Monto</th>
                    <th className="py-2 pr-3 text-right">Total con IVA</th>
                    <th className="py-2 pr-3">Corridas</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => {
                    const toca  = yaToca(r);
                    const monto = Number(r.amount || 0);
                    const total = round2(monto * (1 + Number(r.taxRate || 0) / 100));
                    return (
                      <tr
                        key={r.id}
                        // Marca visual del que ya toca: es la única fila que
                        // pide una acción del estudiante.
                        className={toca ? 'bg-amber-50/70 hover:bg-amber-50' : 'hover:bg-gray-50/60'}
                      >
                        <td className="py-2 pr-3">
                          <div className="font-medium text-gray-900">{r.supplierName}</div>
                          {r.description && (
                            <div className="text-xs text-gray-500">{r.description}</div>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-gray-600">{etiquetaFrecuencia(r.frequency)}</td>
                        <td className="py-2 pr-3">
                          <span className={toca ? 'font-semibold text-amber-800' : 'text-gray-500'}>
                            {fecha(r.nextRunAt)}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums">{money(monto)}</td>
                        <td className="py-2 pr-3 text-right font-mono font-semibold tabular-nums">
                          {money(total)}
                          <span className="ml-1 text-[10px] text-gray-400">{Number(r.taxRate).toFixed(0)}%</span>
                        </td>
                        <td className="py-2 pr-3 text-gray-500">
                          {r.timesRun}
                          {r.lastRunAt && (
                            <span className="ml-1 text-[10px] text-gray-400">últ. {fecha(r.lastRunAt)}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {!r.isActive
                            ? <Badge variant="slate">Pausado</Badge>
                            : toca
                              ? <Badge variant="amber">Ya toca</Badge>
                              : <Badge variant="green">Al día</Badge>}
                        </td>
                        <td className="py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant={toca ? 'primary' : 'outline'}
                              loading={generando === r.id}
                              disabled={!r.isActive}
                              onClick={() => generar(r)}
                            >
                              Generar ahora
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => alternar(r)}
                              title={r.isActive ? 'Pausar' : 'Reactivar'}>
                              {r.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => eliminar(r)} title="Eliminar">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {abrir && companyId && (
        <ModalNuevoPago
          companyId={companyId}
          onCerrar={() => setAbrir(false)}
          onListo={() => { setAbrir(false); cargar(); }}
        />
      )}
    </div>
  );
}

function ModalNuevoPago({ companyId, onCerrar, onListo }: {
  companyId: string; onCerrar: () => void; onListo: () => void;
}) {
  const [proveedor, setProveedor]   = useState('');
  const [desc, setDesc]             = useState('');
  const [monto, setMonto]           = useState('');
  const [tasa, setTasa]             = useState('13');
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('MONTHLY');
  const [primera, setPrimera]       = useState(new Date().toISOString().split('T')[0]);
  const [guardando, setGuardando]   = useState(false);

  const montoNum = parseFloat(monto || '0') || 0;
  const tasaNum  = parseFloat(tasa) || 0;
  const iva      = round2(montoNum * tasaNum / 100);
  const total    = round2(montoNum + iva);

  async function guardar() {
    if (!proveedor.trim()) { toast.error('Escribí el nombre del proveedor'); return; }
    if (montoNum <= 0)     { toast.error('El monto debe ser mayor a cero'); return; }
    setGuardando(true);
    try {
      await api.post(`/api/v1/companies/${companyId}/recurring-payments`, {
        supplierName: proveedor.trim(),
        description:  desc.trim() || undefined,
        amount:       montoNum,
        taxRate:      tasaNum,
        frequency:    frecuencia,
        nextRunAt:    new Date(primera).toISOString(),
      });
      toast.success('Gasto fijo programado');
      onListo();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setGuardando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Nuevo pago recurrente</h3>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Proveedor *</label>
            <input value={proveedor} onChange={(e) => setProveedor(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Ej.: Inmobiliaria Los Robles" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Descripción</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Alquiler del local (opcional)" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Monto sin IVA *</label>
              <input type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="₡ 0.00" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Tasa de IVA *</label>
              <select value={tasa} onChange={(e) => setTasa(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                {TASAS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Frecuencia *</label>
              <select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value as Frecuencia)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                {FRECUENCIAS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Primera fecha *</label>
              <input type="date" value={primera} onChange={(e) => setPrimera(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Adelantamos lo que va a pasar cuando se genere: el asiento es lo
              que se está enseñando, no el recordatorio. */}
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-xs leading-relaxed text-amber-900">
            <div className="mb-1 flex items-center justify-between font-semibold">
              <span>Cada corrida va a registrar</span>
              <span className="font-mono text-sm">{money(total)}</span>
            </div>
            <p>Monto {money(montoNum)} + IVA {money(iva)} ({tasaNum}%).</p>
            <p className="mt-1">
              Al generarlo se crea una <b>factura de compra real</b> con su asiento, y el IVA soportado
              suma <b>crédito fiscal</b> en tu D-104.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={onCerrar}>Cancelar</Button>
            <Button size="sm" loading={guardando} onClick={guardar}>Programar gasto fijo</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
