'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  AlertTriangle, CheckCircle2, Info, Send,
  Save, HelpCircle, TrendingUp, Building2,
  ChevronRight, ChevronLeft, FileText, Download,
  Wallet, Receipt, Calculator, Scale, Landmark, ListChecks,
} from 'lucide-react';
import Link from 'next/link';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button, buttonClasses } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/IconTile';
import { MoneyPop } from '@/components/ui/MoneyPop';
import { ArtReport } from '@/components/illustrations';
import { cn, fmtNum } from '@/lib/utils';
import { AttachmentPanel, Attachment } from '../_components/AttachmentPanel';
import { PerfilTributario, usePerfilTributario } from '../_components/PerfilTributario';
import { PreSubmitModal } from '../_components/PreSubmitModal';
import { WizardStepper } from '../_components/WizardStepper';
import { TribuHeader } from '../_components/TribuHeader';
import { downloadDeclarationPdf } from '../_components/downloadPdf';
import { calcD101, type D101Result } from '../_components/calc';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface D101Form {
  ingresosBrutos: string; ingresosExentos: string;
  gastosSueldos: string; gastosCargas: string; gastosAlquileres: string;
  gastosServicios: string; gastosDepreciacion: string; gastosPublicidad: string;
  gastosSerPublicos: string; gastosRepresentacion: string; gastosOtros: string;
  retencionesSource: string; pagosParciales: string;
}

const EMPTY: D101Form = {
  ingresosBrutos: '', ingresosExentos: '',
  gastosSueldos: '', gastosCargas: '', gastosAlquileres: '',
  gastosServicios: '', gastosDepreciacion: '', gastosPublicidad: '',
  gastosSerPublicos: '', gastosRepresentacion: '', gastosOtros: '',
  retencionesSource: '', pagosParciales: '',
};

const FISCAL_PERIODS = ['2025-2026', '2024-2025', '2023-2024', '2022-2023'];

const WIZARD_STEPS = [
  { id: 'info',      label: 'Información General', shortLabel: 'Info'     },
  { id: 'ingresos',  label: 'Ingresos',            shortLabel: 'Ingresos' },
  { id: 'gastos',    label: 'Gastos',              shortLabel: 'Gastos'   },
  { id: 'creditos',  label: 'Créditos',            shortLabel: 'Créditos' },
  { id: 'resumen',   label: 'Resumen',             shortLabel: 'Resumen'  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS (presentación)
// ─────────────────────────────────────────────────────────────────────────────

function Casilla({
  numero, label, hint, note, value, onChange, readOnly = false, bold = false, children,
}: {
  numero: string; label: string; hint?: string; note?: string;
  value: string | number; onChange?: (v: string) => void;
  readOnly?: boolean; bold?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-gray-100 py-2.5 last:border-0">
      <span className="mt-1 w-14 flex-shrink-0 rounded-md bg-gray-50 px-1.5 py-0.5 text-center font-mono text-xs font-bold tabular-nums text-gray-500">
        {numero}
      </span>
      <div className="flex-1">
        <span className={cn('text-sm', bold ? 'font-semibold text-gray-800' : 'text-gray-700')}>{label}</span>
        {hint && <span className="ml-1 text-xs text-gray-400">({hint})</span>}
        {note && <p className="mt-0.5 text-xs font-medium text-gold-700">{note}</p>}
      </div>
      {readOnly ? (
        <span className={cn(
          'w-44 flex-shrink-0 rounded-lg px-3 py-1.5 text-right text-sm',
          bold ? 'bg-emerald-50 font-bold text-emerald-700' : 'bg-gray-50 text-gray-700',
        )}>
          <MoneyPop value={value} />
        </span>
      ) : (
        <div className="relative w-44 flex-shrink-0">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₡</span>
          <input
            type="number" min="0" step="0.01"
            value={value as string}
            onChange={e => onChange?.(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-7 pr-3 text-right font-mono text-sm tabular-nums transition-colors hover:border-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            placeholder="0.00"
          />
        </div>
      )}
      {children}
    </div>
  );
}

/** Nota explicativa dentro de una sección del formulario. */
function Nota({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-start gap-1.5 border-b border-gray-100 py-2 text-xs leading-relaxed text-gray-500">
      <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
      <span>{children}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function D101Page() {
  const router = useRouter();
  const params = useSearchParams();
  const existingId = params.get('id');

  const [step, setStep]     = useState(0);
  const [period, setPeriod] = useState('2025-2026');
  const [form, setForm]     = useState<D101Form>(EMPTY);
  // Cálculo LOCAL en sync con el form (evita race con la API que dejaba el modal en 0).
  const result: D101Result = useMemo(() => calcD101(form), [form]);
  const [declId, setDeclId] = useState<string | null>(existingId);
  const [status, setStatus] = useState<'DRAFT' | 'SUBMITTED'>('DRAFT');
  const [refNo, setRefNo]   = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [saving, setSaving]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResult, setShowResult]   = useState(false);
  const { perfil, setPerfil } = usePerfilTributario();
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!declId) return;
    api.get<Attachment[]>(`/api/v1/tax-declarations/${declId}/attachments`)
      .then(({ data }) => setAttachments(data))
      .catch(() => {});
  }, [declId]);

  useEffect(() => {
    if (!existingId) return;
    api.get<any>(`/api/v1/tax-declarations/${existingId}`)
      .then(({ data }) => {
        const fd = data.formData ?? {};
        setForm({
          ingresosBrutos: fd.ingresosBrutos ?? '',
          ingresosExentos: fd.ingresosExentos ?? '',
          gastosSueldos: fd.gastosSueldos ?? '',
          gastosCargas: fd.gastosCargas ?? '',
          gastosAlquileres: fd.gastosAlquileres ?? '',
          gastosServicios: fd.gastosServicios ?? '',
          gastosDepreciacion: fd.gastosDepreciacion ?? '',
          gastosPublicidad: fd.gastosPublicidad ?? '',
          gastosSerPublicos: fd.gastosSerPublicos ?? '',
          gastosRepresentacion: fd.gastosRepresentacion ?? '',
          gastosOtros: fd.gastosOtros ?? '',
          retencionesSource: fd.retencionesSource ?? '',
          pagosParciales: fd.pagosParciales ?? '',
        });
        setPeriod(data.period);
        setStatus(data.status);
        setRefNo(data.referenceNo);
        if (data.status === 'SUBMITTED') {
          setStep(4);
          setShowResult(true);
        }
      })
      .catch(() => toast.error('No se pudo cargar la declaración'));
  }, [existingId]);

  function setField(key: keyof D101Form, val: string) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function autoSave() {
    if (status === 'SUBMITTED') return;
    const formData = toNumeric(form);
    try {
      if (declId) {
        await api.patch(`/api/v1/tax-declarations/${declId}`, { formData });
      } else {
        const { data } = await api.post<any>('/api/v1/tax-declarations', {
          type: 'D101_RENTA', period, formData,
        });
        setDeclId(data.id);
      }
    } catch { /* silent */ }
  }

  async function handleSaveDraft() {
    setSaving(true);
    try {
      await autoSave();
      toast.success('Borrador guardado');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function goNext() {
    if (step < WIZARD_STEPS.length - 1) {
      await autoSave();
      setStep(s => s + 1);
      topRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goPrev() {
    if (step > 0) {
      setStep(s => s - 1);
      topRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      let id = declId;
      const formData = toNumeric(form);
      if (!id) {
        const { data } = await api.post<any>('/api/v1/tax-declarations', {
          type: 'D101_RENTA', period, formData,
        });
        id = data.id;
        setDeclId(id);
      } else {
        await api.patch(`/api/v1/tax-declarations/${id}`, { formData });
      }
      const { data } = await api.post<any>(`/api/v1/tax-declarations/${id}/submit`);
      setStatus('SUBMITTED');
      setRefNo(data.referenceNo);
      setShowConfirm(false);
      setShowResult(true);
      toast.success('Declaración presentada (simulación)');
    } catch {
      toast.error('Error al presentar la declaración');
    } finally {
      setSubmitting(false);
    }
  }

  const isSubmitted = status === 'SUBMITTED';
  const repMax = result?.gastoRepresentacionMaximo ?? 0;

  function getStepErrors(): string[] {
    const errs: string[] = [];
    if (step === 4) {
      if (!perfil?.cedula) errs.push('Completa el perfil del contribuyente (cédula jurídica/física).');
      if (!perfil?.razonSocial) errs.push('Ingresa la razón social en el perfil.');
    }
    return errs;
  }
  const stepErrors = getStepErrors();

  return (
    <div className="flex-1 overflow-y-auto bg-[#F4F6F8]" ref={topRef}>
      {/* Encabezado TRIBU-CR unificado */}
      <TribuHeader
        code="D-101"
        title="Declaración del Impuesto sobre la Renta"
        accent="emerald"
        status={status}
        refNo={refNo}
        periodLabel={period}
        perfil={perfil}
        description="Es el impuesto anual sobre las utilidades: a los ingresos gravables les restas los gastos deducibles y sobre la renta neta que queda se calcula el impuesto del período fiscal."
        illustration={<ArtReport size={150} className="lp-drift" />}
      />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">

        {/* Wizard stepper */}
        <div className="rounded-card border border-gray-200/70 bg-white p-5 shadow-card">
          <WizardStepper steps={WIZARD_STEPS} currentStep={step} />
        </div>

        {/* ── STEP 0: Información General ─────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-5">
            <PerfilTributario disabled={isSubmitted} onChange={p => setPerfil(p)} />

            <SectionCard
              eyebrow="Paso 1"
              title="Datos del período fiscal"
              description="El período de renta va del 1 de octubre al 30 de setiembre."
              icon={FileText}
              iconTint="#047857"
              className="cx-pop"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Período fiscal
                  </label>
                  <select
                    value={period}
                    onChange={e => setPeriod(e.target.value)}
                    disabled={isSubmitted}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm transition-colors hover:border-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
                  >
                    {FISCAL_PERIODS.map(p => (
                      <option key={p} value={p}>{p} (1 oct – 30 set)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Tipo de contribuyente
                  </label>
                  <div className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold',
                    result?.tipoEmpresa === 'PYME'
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : result?.tipoEmpresa === 'GRANDE'
                      ? 'border-slate-200 bg-slate-100 text-slate-600'
                      : 'border-gray-200 bg-gray-50 text-gray-400',
                  )}>
                    <Building2 className="h-4 w-4" />
                    {result?.tipoEmpresa === 'PYME'
                      ? 'Pequeña empresa (PYME)'
                      : result?.tipoEmpresa === 'GRANDE'
                      ? 'Empresa grande (≥ ₡122.1M)'
                      : 'Se calcula con ingresos'}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Estado
                  </label>
                  <div className={cn(
                    'rounded-xl border px-3 py-2.5 text-sm font-semibold',
                    isSubmitted
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-gold-100 bg-gold-50 text-gold-900',
                  )}>
                    {isSubmitted ? 'Presentada (simulación)' : 'Borrador'}
                  </div>
                </div>
              </div>
              {refNo && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>
                    Número de referencia simulado:{' '}
                    <span className="font-mono font-bold tabular-nums text-gray-800">{refNo}</span>
                  </span>
                </div>
              )}
            </SectionCard>

            {/* How D-101 works */}
            <SectionCard
              eyebrow="Cómo funciona"
              title="Proceso D-101 en Hacienda"
              icon={ListChecks}
              iconTint="#B8860B"
              className="cx-pop cx-d2"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                {[
                  { step: '1', title: 'Ingresos del año', desc: 'Registra todos los ingresos brutos del período fiscal (1 oct a 30 set).' },
                  { step: '2', title: 'Gastos deducibles', desc: 'Deduce gastos útiles, necesarios y pertinentes para generar renta.' },
                  { step: '3', title: 'Créditos', desc: 'Resta retenciones sufridas y pagos parciales ya realizados.' },
                  { step: '4', title: 'Pagar o saldo a favor', desc: 'Cancela el impuesto neto antes del 15 de diciembre.' },
                ].map(({ step: n, title, desc }) => (
                  <div key={n} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 text-xs font-black tabular-nums text-white">
                      {n}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800">{title}</p>
                      <p className="text-xs leading-relaxed text-gray-500">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── STEP 1: Ingresos ────────────────────────────────────────────── */}
        {step === 1 && (
          <SectionCard
            eyebrow="Sección I"
            title="Ingresos del período fiscal"
            description="Todo lo que la empresa ganó durante el año."
            icon={TrendingUp}
            iconTint="#047857"
            className="cx-pop"
          >
            <Nota>Incluye todos los ingresos del período fiscal (1 oct a 30 set).</Nota>

            <Casilla numero="101" label="Ingresos brutos totales del período"
              hint="ventas, servicios y demás ingresos"
              value={form.ingresosBrutos} onChange={v => setField('ingresosBrutos', v)}>
              <AttachmentPanel declarationId={declId} lineKey="ingresosBrutos" lineLabel="Ingresos brutos"
                attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
            </Casilla>
            <Casilla numero="102" label="Ingresos exentos o no gravables"
              hint="dividendos de empresas CFL, ganancias de capital exentas"
              value={form.ingresosExentos} onChange={v => setField('ingresosExentos', v)}>
              <AttachmentPanel declarationId={declId} lineKey="ingresosExentos" lineLabel="Ingresos exentos"
                attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
            </Casilla>
            <div className="pb-1 pt-2">
              <Casilla numero="103" label="Total ingresos gravables (101 − 102)" bold
                value={result?.cas103_ingresosGravables ?? 0} readOnly />
            </div>

            {result?.tipoEmpresa && (
              <div className={cn(
                'mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs',
                result.tipoEmpresa === 'PYME' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600',
              )}>
                <Building2 className="h-4 w-4 flex-shrink-0" />
                {result.tipoEmpresa === 'PYME'
                  ? 'Clasificado como PYME — Se aplicarán tramos progresivos (5% – 30%).'
                  : 'Clasificado como empresa grande — Tarifa plana del 30%.'}
              </div>
            )}
          </SectionCard>
        )}

        {/* ── STEP 2: Gastos ──────────────────────────────────────────────── */}
        {step === 2 && (
          <SectionCard
            eyebrow="Sección II"
            title="Gastos deducibles"
            description="Lo que la empresa gastó para generar esa renta."
            icon={Wallet}
            iconTint="#2563EB"
            className="cx-pop"
          >
            <Nota>
              Solo son deducibles los gastos <strong>útiles, necesarios y pertinentes</strong> para
              generar la renta gravable (Art. 8 LISR).
            </Nota>

            <Casilla numero="201" label="Sueldos y salarios" hint="personal empleado en planilla CCSS"
              value={form.gastosSueldos} onChange={v => setField('gastosSueldos', v)}>
              <AttachmentPanel declarationId={declId} lineKey="gastosSueldos" lineLabel="Sueldos y salarios"
                attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
            </Casilla>
            <Casilla numero="202" label="Cargas sociales patronales" hint="CCSS 26.33%, INS, asignaciones familiares"
              value={form.gastosCargas} onChange={v => setField('gastosCargas', v)}>
              <AttachmentPanel declarationId={declId} lineKey="gastosCargas" lineLabel="Cargas sociales"
                attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
            </Casilla>
            <Casilla numero="203" label="Arrendamientos" hint="alquileres de local, equipo, vehículos"
              value={form.gastosAlquileres} onChange={v => setField('gastosAlquileres', v)}>
              <AttachmentPanel declarationId={declId} lineKey="gastosAlquileres" lineLabel="Arrendamientos"
                attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
            </Casilla>
            <Casilla numero="204" label="Servicios profesionales" hint="honorarios, consultoría, contabilidad"
              value={form.gastosServicios} onChange={v => setField('gastosServicios', v)}>
              <AttachmentPanel declarationId={declId} lineKey="gastosServicios" lineLabel="Servicios profesionales"
                attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
            </Casilla>
            <Casilla numero="205" label="Depreciaciones" hint="activos fijos según vida útil LISR"
              value={form.gastosDepreciacion} onChange={v => setField('gastosDepreciacion', v)}>
              <AttachmentPanel declarationId={declId} lineKey="gastosDepreciacion" lineLabel="Depreciaciones"
                attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
            </Casilla>
            <Casilla numero="206" label="Publicidad y mercadeo"
              value={form.gastosPublicidad} onChange={v => setField('gastosPublicidad', v)}>
              <AttachmentPanel declarationId={declId} lineKey="gastosPublicidad" lineLabel="Publicidad y mercadeo"
                attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
            </Casilla>
            <Casilla numero="207" label="Servicios públicos" hint="electricidad, agua, teléfono, internet"
              value={form.gastosSerPublicos} onChange={v => setField('gastosSerPublicos', v)}>
              <AttachmentPanel declarationId={declId} lineKey="gastosSerPublicos" lineLabel="Servicios públicos"
                attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
            </Casilla>
            <Casilla numero="208" label="Gastos de representación" hint="máx. 1% de ingresos brutos"
              note={repMax > 0 ? `Límite deducible: ₡${fmtNum(repMax)}` : undefined}
              value={form.gastosRepresentacion} onChange={v => setField('gastosRepresentacion', v)}>
              <AttachmentPanel declarationId={declId} lineKey="gastosRepresentacion" lineLabel="Gastos de representación"
                attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
            </Casilla>
            <Casilla numero="209" label="Otros gastos deducibles"
              value={form.gastosOtros} onChange={v => setField('gastosOtros', v)}>
              <AttachmentPanel declarationId={declId} lineKey="gastosOtros" lineLabel="Otros gastos deducibles"
                attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
            </Casilla>
            <div className="pb-1 pt-2">
              <Casilla numero="210" label="TOTAL GASTOS DEDUCIBLES" bold
                value={result?.cas210_totalGastos ?? 0} readOnly />
            </div>
          </SectionCard>
        )}

        {/* ── STEP 3: Créditos y retenciones ──────────────────────────────── */}
        {step === 3 && (
          <SectionCard
            eyebrow="Sección V"
            title="Créditos y retenciones en la fuente"
            description="Impuesto que ya adelantaste durante el año."
            icon={Receipt}
            iconTint="#475569"
            className="cx-pop"
          >
            <Nota>Deduce los pagos ya realizados durante el año fiscal para evitar pagar dos veces.</Nota>

            <Casilla numero="501" label="Retenciones en la fuente sufridas"
              hint="pagos de clientes que retuvieron renta"
              value={form.retencionesSource} onChange={v => setField('retencionesSource', v)}>
              <AttachmentPanel declarationId={declId} lineKey="retencionesSource" lineLabel="Retenciones en la fuente"
                attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
            </Casilla>
            <Casilla numero="502" label="Pagos parciales realizados a Hacienda"
              hint="adelantos trimestrales o semestrales"
              value={form.pagosParciales} onChange={v => setField('pagosParciales', v)}>
              <AttachmentPanel declarationId={declId} lineKey="pagosParciales" lineLabel="Pagos parciales"
                attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
            </Casilla>
            <div className="pb-1 pt-2">
              <Casilla numero="503" label="TOTAL CRÉDITOS" bold
                value={result?.cas503_totalCreditos ?? 0} readOnly />
            </div>
          </SectionCard>
        )}

        {/* ── STEP 4: Resumen ─────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-5">
            {/* Renta neta */}
            <SectionCard
              eyebrow="Sección III"
              title="Renta neta imponible"
              description="Ingresos gravables menos gastos deducibles."
              icon={Scale}
              iconTint="#C2410C"
              className="cx-pop"
            >
              <Casilla numero="103" label="Total ingresos gravables" readOnly
                value={result?.cas103_ingresosGravables ?? 0} />
              <Casilla numero="210" label="Total gastos deducibles" readOnly
                value={result?.cas210_totalGastos ?? 0} />
              <div className="mt-2 border-t border-gray-200 pt-2">
                <Casilla numero="301" label="Renta neta imponible (103 − 210)" bold
                  value={result?.cas301_rentaNeta ?? 0} readOnly />
              </div>
              {(result?.cas301_rentaNeta ?? 0) === 0 && (parseFloat(form.ingresosBrutos) || 0) > 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  Los gastos superan o igualan los ingresos. No hay impuesto sobre la renta en este período.
                </div>
              )}
            </SectionCard>

            {/* Cálculo del impuesto con tramos */}
            <SectionCard
              eyebrow="Sección IV"
              title="Cálculo del impuesto sobre la renta"
              description="Los tramos se aplican en escalera: cada porción de renta paga su tasa."
              icon={Calculator}
              iconTint="#475569"
              className="cx-pop cx-d1"
            >
              {result && (result.cas301_rentaNeta ?? 0) > 0 && result.detalleTramos.length > 0 && (
                <div className="mb-4 overflow-hidden rounded-2xl border border-gray-200">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5">
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">
                      {result.tipoEmpresa === 'PYME'
                        ? 'Tramos progresivos PYME — Decreto Ejecutivo 2025-2026'
                        : 'Tarifa plana empresa grande — 30%'}
                    </p>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500">
                        <th className="px-4 py-2 text-left font-semibold">Tramo</th>
                        <th className="px-4 py-2 text-right font-semibold">Base gravada</th>
                        <th className="px-4 py-2 text-right font-semibold">Tasa</th>
                        <th className="px-4 py-2 text-right font-semibold">Impuesto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.detalleTramos.map((t, i) => (
                        <tr key={i} className="border-b border-gray-100 last:border-0">
                          <td className="px-4 py-2.5 text-gray-600">{t.tramo}</td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums">₡ {fmtNum(t.base)}</td>
                          <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-600">{t.tasa}%</td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">₡ {fmtNum(t.impuesto)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-bold">
                        <td className="px-4 py-2.5 text-gray-700" colSpan={3}>Total impuesto calculado</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                          ₡ {fmtNum(result.cas402_impuestoCalculado)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <Casilla numero="301" label="Renta neta imponible" readOnly value={result?.cas301_rentaNeta ?? 0} />
              <div className="mt-2 border-t border-gray-200 pt-2">
                <Casilla numero="402" label="Impuesto sobre la renta calculado" bold
                  value={result?.cas402_impuestoCalculado ?? 0} readOnly />
              </div>
              {result && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5 text-xs text-slate-600">
                  <TrendingUp className="h-4 w-4 flex-shrink-0" />
                  {result.tipoEmpresa === 'PYME'
                    ? 'Aplican tramos progresivos para empresas con ingresos brutos ≤ ₡122.145.000 (Art. 15 LISR).'
                    : 'Empresa grande: tarifa plana del 30% sobre renta neta imponible (Art. 15 bis LISR).'}
                </div>
              )}
            </SectionCard>

            {/* Resultado final */}
            <SectionCard
              eyebrow="Sección VI"
              title="Resultado final"
              description="Impuesto calculado menos lo que ya pagaste."
              icon={Landmark}
              iconTint="#DC2626"
              className="cx-pop cx-d2"
            >
              <Casilla numero="402" label="Impuesto calculado" readOnly value={result?.cas402_impuestoCalculado ?? 0} />
              <Casilla numero="503" label="Total créditos y retenciones" readOnly value={result?.cas503_totalCreditos ?? 0} />
              <div className="mt-2 border-t border-gray-200 pt-2">
                <Casilla numero="601" label="Impuesto neto del período (402 − 503)" bold
                  value={result?.cas601_impuestoNeto ?? 0} readOnly />
              </div>

              <div className="pt-3">
                {(result?.cas602_impuestoPagar ?? 0) > 0 ? (
                  <div className="cx-pop flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-5">
                    <div className="flex items-center gap-3">
                      <IconTile icon={Send} tint="#DC2626" size={44} />
                      <div>
                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-red-700">Casilla 602</p>
                        <p className="text-sm font-bold text-red-800">Impuesto sobre la renta a pagar</p>
                        <p className="text-xs text-red-600">Vence 15 de diciembre del año siguiente al período</p>
                      </div>
                    </div>
                    <MoneyPop value={result?.cas602_impuestoPagar ?? 0} className="text-2xl font-black text-red-700" />
                  </div>
                ) : (result?.cas603_saldoFavor ?? 0) > 0 ? (
                  <div className="cx-pop flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="flex items-center gap-3">
                      <IconTile icon={CheckCircle2} tint="#047857" size={44} />
                      <div>
                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-emerald-700">Casilla 603</p>
                        <p className="text-sm font-bold text-emerald-800">Saldo a favor</p>
                        <p className="text-xs text-emerald-600">Puede solicitarse devolución o imputarse a períodos futuros</p>
                      </div>
                    </div>
                    <MoneyPop value={result?.cas603_saldoFavor ?? 0} className="text-2xl font-black text-emerald-700" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                    <p className="text-sm text-gray-500">Ingresa los ingresos y gastos del período para ver el resultado</p>
                    <span className="font-mono text-2xl font-black tabular-nums text-gray-400">₡ 0.00</span>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Validation errors */}
            {stepErrors.length > 0 && (
              <div className="cx-shake space-y-1.5 rounded-card border border-gold-100 bg-gold-50 p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gold-900">
                  <AlertTriangle className="h-4 w-4" /> Por favor completa antes de presentar
                </p>
                {stepErrors.map((e, i) => (
                  <p key={i} className="text-sm text-gold-900">• {e}</p>
                ))}
              </div>
            )}

            {/* Legal notes */}
            <div className="rounded-card border border-emerald-100 bg-emerald-50 p-5 text-xs text-emerald-700">
              <p className="flex items-center gap-1.5 font-bold">
                <HelpCircle className="h-4 w-4" /> Información clave — Impuesto sobre la Renta CR
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 leading-relaxed">
                <li>El período fiscal va del <strong>1 de octubre al 30 de setiembre</strong> del año siguiente.</li>
                <li>La declaración D-101 debe presentarse a más tardar el <strong>15 de diciembre</strong>.</li>
                <li>Empresas PYME (ingresos brutos ≤ ₡122.145.000): tramos progresivos 5%, 10%, 15%, 20%, 25%, 30%.</li>
                <li>Empresas grandes (ingresos brutos &gt; ₡122.145.000): tarifa única del <strong>30%</strong>.</li>
                <li>Gastos de representación deducibles: máximo 1% de los ingresos brutos (Art. 8 inciso n) LISR).</li>
                <li>Pueden hacerse <strong>pagos parciales</strong> trimestrales del 25% del impuesto estimado.</li>
                <li>Base legal: Ley N° 7092 (Ley del Impuesto sobre la Renta) y decretos ejecutivos vigentes.</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── Navigation buttons ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 pb-10">
          {step > 0 && !isSubmitted ? (
            <Button variant="secondary" onClick={goPrev} className="cx-press">
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            {!isSubmitted && (
              <Button variant="secondary" onClick={handleSaveDraft} loading={saving} className="cx-press">
                {!saving && <Save className="h-4 w-4" />}
                {saving ? 'Guardando...' : 'Guardar borrador'}
              </Button>
            )}

            {step < WIZARD_STEPS.length - 1 && !isSubmitted && (
              <Button variant="primary" onClick={goNext} className="cx-press">
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            )}

            {step === WIZARD_STEPS.length - 1 && !isSubmitted && (
              <Button
                variant="gold"
                onClick={() => setShowConfirm(true)}
                disabled={stepErrors.length > 0}
                className="cx-press"
              >
                <Send className="h-4 w-4" /> Presentar declaración
              </Button>
            )}

            {isSubmitted && (
              <Link href="/estudiante/impuestos" className={buttonClasses({ variant: 'primary', className: 'cx-press' })}>
                Volver al historial
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* PreSubmit modal */}
      {showConfirm && (
        <PreSubmitModal
          type="D101_RENTA"
          period={period}
          form={form}
          attachments={attachments}
          perfil={perfil}
          result={result}
          onConfirm={handleSubmit}
          onCancel={() => setShowConfirm(false)}
          submitting={submitting}
        />
      )}

      {/* Success receipt modal */}
      {showResult && status === 'SUBMITTED' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-csq-dark/70 p-4 backdrop-blur-sm">
          <div className="cx-pop w-full max-w-lg rounded-card bg-white p-6 shadow-soft">
            <div className="mb-5 text-center">
              <div className="cx-tada mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-black tracking-tight text-gray-900">¡Declaración presentada!</h3>
              <p className="mt-1 text-sm text-gray-500">Simulación educativa completada</p>
            </div>

            <div className="mb-5 space-y-1 rounded-2xl border border-gray-200 bg-gray-50 p-4 font-mono text-xs tabular-nums">
              <div className="mb-3 text-center text-sm font-bold text-gray-700">MINISTERIO DE HACIENDA — TRIBU CR</div>
              <div className="flex justify-between"><span>Formulario:</span><span className="font-bold">D-101</span></div>
              <div className="flex justify-between"><span>Período fiscal:</span><span>{period}</span></div>
              <div className="flex justify-between"><span>Tipo empresa:</span><span>{result?.tipoEmpresa}</span></div>
              <div className="flex justify-between"><span>Número de referencia:</span><span className="font-bold text-emerald-700">{refNo}</span></div>
              <div className="mt-2 space-y-1 border-t border-gray-300 pt-2">
                <div className="flex justify-between"><span>Ingresos gravables:</span><span>₡ {fmtNum(result?.cas103_ingresosGravables ?? 0)}</span></div>
                <div className="flex justify-between"><span>Gastos deducibles:</span><span>₡ {fmtNum(result?.cas210_totalGastos ?? 0)}</span></div>
                <div className="flex justify-between font-bold"><span>Renta neta:</span><span>₡ {fmtNum(result?.cas301_rentaNeta ?? 0)}</span></div>
              </div>
              {result?.detalleTramos.map((t, i) => (
                <div key={i} className="flex justify-between text-gray-500">
                  <span>{t.tramo} ({t.tasa}%)</span><span>₡ {fmtNum(t.impuesto)}</span>
                </div>
              ))}
              <div className={cn(
                'mt-2 flex justify-between border-t border-gray-300 pt-2 font-black',
                (result?.cas602_impuestoPagar ?? 0) > 0 ? 'text-red-700' : 'text-emerald-700',
              )}>
                <span>{(result?.cas602_impuestoPagar ?? 0) > 0 ? 'IMPUESTO A PAGAR:' : 'SALDO A FAVOR:'}</span>
                <span>₡ {fmtNum(
                  (result?.cas602_impuestoPagar ?? 0) > 0
                    ? result!.cas602_impuestoPagar
                    : (result?.cas603_saldoFavor ?? 0)
                )}</span>
              </div>
              <div className="mt-3 border-t border-gray-200 pt-2 text-center text-xs text-gray-400">
                ** SIMULACIÓN EDUCATIVA — NO TIENE VALIDEZ LEGAL **
              </div>
            </div>

            <div className="space-y-2">
              <Button
                variant="primary"
                onClick={async () => {
                  if (!declId) return;
                  try {
                    await downloadDeclarationPdf(declId, `D-101-${period}.pdf`);
                  } catch { toast.error('No se pudo descargar el PDF'); }
                }}
                disabled={!declId}
                className="w-full cx-press"
              >
                <Download className="h-4 w-4" /> Descargar comprobante PDF
              </Button>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowResult(false)} className="flex-1 cx-press">
                  Ver declaración
                </Button>
                <Button variant="gold" onClick={() => router.push('/estudiante/impuestos')} className="flex-1 cx-press">
                  Ir al historial
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function toNumeric(form: D101Form) {
  const out: Record<string, number> = {};
  (Object.keys(form) as (keyof D101Form)[]).forEach(k => {
    out[k] = parseFloat(form[k] || '0') || 0;
  });
  return out;
}
