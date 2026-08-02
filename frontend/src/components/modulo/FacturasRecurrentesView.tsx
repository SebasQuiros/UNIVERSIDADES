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
import { Repeat, Plus, X, CalendarClock, Zap, Play, Pause, Trash2 } from 'lucide-react';

interface ClienteLite { id: string; name: string; identification?: string | null }

interface Recurrente {
  id: string;
  clientId: string;
  description: string | null;
  amount: number | string;
  taxRate: number | string;
  frequency: string;
  nextRunAt: string;
  lastRunAt: string | null;
  timesRun: number;
  isActive: boolean;
  client?: ClienteLite | null;
}

// Etiquetas de la frecuencia — deben coincidir con enum RecurrenceFrequency.
const FRECUENCIAS: { value: string; label: string }[] = [
  { value: 'WEEKLY',     label: 'Semanal' },
  { value: 'BIWEEKLY',   label: 'Quincenal' },
  { value: 'MONTHLY',    label: 'Mensual' },
  { value: 'BIMONTHLY',  label: 'Bimensual' },
  { value: 'QUARTERLY',  label: 'Trimestral' },
  { value: 'SEMIANNUAL', label: 'Semestral' },
  { value: 'ANNUAL',     label: 'Anual' },
];
const etiquetaFrecuencia = (f: string) =>
  FRECUENCIAS.find((x) => x.value === f)?.label ?? f;

// Mismas tarifas que acepta el backend (porcentaje, no fracción).
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

/** Comparación por día (no por hora): "toca hoy" debe contar como vencida. */
const yaToca = (r: Recurrente) => {
  const hoy = new Date(); hoy.setHours(23, 59, 59, 999);
  return r.isActive && new Date(r.nextRunAt) <= hoy;
};

/**
 * Facturas recurrentes: ventas PROGRAMADAS. No hay cron — el estudiante pulsa
 * "Generar ahora" y ve nacer la factura real con su asiento. Automatizarlo en
 * segundo plano escondería justamente lo que el módulo enseña.
 */
export function FacturasRecurrentesView() {
  const { companyId, estado } = useEmpresaActiva();
  const [rows, setRows]       = useState<Recurrente[]>([]);
  const [cargando, setCargando] = useState(false);
  const [abrir, setAbrir]     = useState(false);
  const [generando, setGenerando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!companyId) return;
    setCargando(true);
    try {
      const { data } = await api.get<any>(`/api/v1/companies/${companyId}/recurring-invoices`);
      setRows(Array.isArray(data) ? data : (data?.items ?? []));
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setCargando(false); }
  }, [companyId]);

  useEffect(() => { cargar(); }, [cargar]);

  async function generar(r: Recurrente) {
    if (!companyId) return;
    setGenerando(r.id);
    try {
      await api.post(`/api/v1/companies/${companyId}/recurring-invoices/${r.id}/generate`, {});
      toast.success('Factura generada y emitida con su asiento contable');
      cargar();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setGenerando(null); }
  }

  async function alternar(r: Recurrente) {
    if (!companyId) return;
    try {
      await api.patch(`/api/v1/companies/${companyId}/recurring-invoices/${r.id}/toggle`, { isActive: !r.isActive });
      toast.success(r.isActive ? 'Programación pausada' : 'Programación activada');
      cargar();
    } catch (e) { toast.error(getErrorMessage(e)); }
  }

  async function eliminar(r: Recurrente) {
    if (!companyId) return;
    if (!confirm('¿Eliminar esta programación? Las facturas ya generadas no se tocan.')) return;
    try {
      await api.delete(`/api/v1/companies/${companyId}/recurring-invoices/${r.id}`);
      toast.success('Programación eliminada');
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
          description="Creá una empresa en el Espacio Contador para programar tus facturas recurrentes."
        />
      </div>
    );
  }

  const pendientes  = rows.filter(yaToca);
  const activas     = rows.filter((r) => r.isActive);
  // Ingreso mensual estimado: solo tiene sentido normalizar las mensuales,
  // así que se muestra el total programado activo con su IVA incluido.
  const totalActivo = activas.reduce(
    (s, r) => s + round2(Number(r.amount || 0) * (1 + Number(r.taxRate || 0) / 100)), 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <PageHeader
          icon={Repeat}
          title="Facturas recurrentes"
          subtitle="Programá las ventas que se repiten. Cuando llega la fecha, generás la factura real con un clic y se emite con su asiento."
          actions={<Button onClick={() => setAbrir(true)} className="cx-press"><Plus className="h-4 w-4" /> Nueva programación</Button>}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Programaciones activas" value={String(activas.length)} icon={Repeat} />
          <StatCard label="Listas para generar"    value={String(pendientes.length)} icon={CalendarClock} />
          <StatCard label="Monto activo con IVA"   value={money(totalActivo)} icon={Zap} />
        </div>

        <SectionCard
          icon={CalendarClock}
          eyebrow="Ciclo de ingresos"
          title="Ventas programadas"
          description="Las marcadas en ámbar ya llegaron a su fecha: generalas para que entren al Diario."
        >
          {cargando ? (
            <div className="grid place-items-center py-10"><Spinner /></div>
          ) : rows.length === 0 ? (
            <EmptyState
              illustration={<SceneEmptyBox />}
              title="Todavía no programaste ninguna factura"
              description="Ideal para alquileres, mensualidades o servicios fijos: se cobra lo mismo cada período."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Cliente</th>
                    <th className="py-2 pr-3">Concepto</th>
                    <th className="py-2 pr-3">Frecuencia</th>
                    <th className="py-2 pr-3">Próxima</th>
                    <th className="py-2 pr-3 text-right">Monto + IVA</th>
                    <th className="py-2 pr-3 text-center">Corridas</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => {
                    const toca  = yaToca(r);
                    const conIva = round2(Number(r.amount || 0) * (1 + Number(r.taxRate || 0) / 100));
                    return (
                      <tr key={r.id} className={toca ? 'bg-amber-50/70' : 'hover:bg-gray-50/60'}>
                        <td className="py-2 pr-3 font-medium text-gray-900">{r.client?.name ?? '—'}</td>
                        <td className="py-2 pr-3 text-gray-600">{r.description || 'Servicio recurrente'}</td>
                        <td className="py-2 pr-3">{etiquetaFrecuencia(r.frequency)}</td>
                        <td className="py-2 pr-3">
                          <span className={toca ? 'font-semibold text-amber-800' : 'text-gray-500'}>
                            {fecha(r.nextRunAt)}
                          </span>
                          {toca && <Badge variant="amber" className="ml-2">Ya toca</Badge>}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono font-semibold tabular-nums">
                          {money(conIva)}
                          <span className="ml-1 text-[10px] text-gray-400">{Number(r.taxRate).toFixed(0)}%</span>
                        </td>
                        <td className="py-2 pr-3 text-center tabular-nums text-gray-600">{r.timesRun}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={r.isActive ? 'green' : 'slate'}>
                            {r.isActive ? 'Activa' : 'Pausada'}
                          </Badge>
                        </td>
                        <td className="py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            {r.isActive && (
                              <Button
                                size="sm"
                                variant={toca ? 'gold' : 'outline'}
                                loading={generando === r.id}
                                onClick={() => generar(r)}
                              >
                                <Zap className="h-3.5 w-3.5" /> Generar ahora
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => alternar(r)}
                              title={r.isActive ? 'Pausar' : 'Activar'}>
                              {r.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => eliminar(r)} title="Eliminar">
                              <Trash2 className="h-3.5 w-3.5" />
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
        <ModalNuevaRecurrente
          companyId={companyId}
          onCerrar={() => setAbrir(false)}
          onListo={() => { setAbrir(false); cargar(); }}
        />
      )}
    </div>
  );
}

function ModalNuevaRecurrente({ companyId, onCerrar, onListo }: {
  companyId: string; onCerrar: () => void; onListo: () => void;
}) {
  const [clientes, setClientes] = useState<ClienteLite[]>([]);
  const [clientId, setClientId] = useState('');
  const [desc, setDesc]         = useState('');
  const [monto, setMonto]       = useState('');
  const [tasa, setTasa]         = useState('13');
  const [frecuencia, setFrecuencia] = useState('MONTHLY');
  const [primera, setPrimera]   = useState(new Date().toISOString().split('T')[0]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<any>(`/api/v1/companies/${companyId}/clients`);
        const lista: ClienteLite[] = Array.isArray(data) ? data : (data?.clients ?? []);
        setClientes(lista);
        if (lista[0]) setClientId(lista[0].id);
      } catch (e) { toast.error(getErrorMessage(e)); }
    })();
  }, [companyId]);

  const montoNum = parseFloat(monto || '0') || 0;
  const tasaNum  = parseFloat(tasa) || 0;
  const iva      = round2(montoNum * tasaNum / 100);
  const total    = round2(montoNum + iva);

  async function guardar() {
    if (!clientId)     { toast.error('Elegí el cliente al que le vas a facturar'); return; }
    if (montoNum <= 0) { toast.error('El monto debe ser mayor a cero'); return; }
    setGuardando(true);
    try {
      await api.post(`/api/v1/companies/${companyId}/recurring-invoices`, {
        clientId,
        description: desc.trim() || undefined,
        amount:      montoNum,
        taxRate:     tasaNum,
        frequency:   frecuencia,
        nextRunAt:   primera,
      });
      toast.success('Programación creada');
      onListo();
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setGuardando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Nueva factura recurrente</h3>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Cliente *</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
              {clientes.length === 0 && <option value="">No tenés clientes registrados</option>}
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Concepto</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Alquiler de local, mensualidad, mantenimiento…" />
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
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                {TASAS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Frecuencia *</label>
              <select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                {FRECUENCIAS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Primera fecha *</label>
              <input type="date" value={primera} onChange={(e) => setPrimera(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Se muestra el efecto contable antes de confirmar: la recurrente no
              contabiliza nada por sí sola, solo programa. */}
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-xs leading-relaxed text-amber-900">
            <div className="mb-1 flex items-center justify-between font-semibold">
              <span>Cada corrida facturará</span>
              <span className="font-mono text-sm">{money(total)}</span>
            </div>
            <p>Monto {money(montoNum)} + IVA {money(iva)} ({tasaNum}%).</p>
            <p className="mt-1">Programar <b>no</b> genera asiento. El asiento nace cuando pulsás <b>Generar ahora</b>.</p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={onCerrar}>Cancelar</Button>
            <Button size="sm" loading={guardando} onClick={guardar}>Crear programación</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
