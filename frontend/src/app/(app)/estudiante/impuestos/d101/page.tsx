'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Info, Send,
  Save, HelpCircle, TrendingUp, Building2,
  ChevronRight, ChevronLeft, FileText, Download,
} from 'lucide-react';
import Link from 'next/link';
import { AttachmentPanel, Attachment } from '../_components/AttachmentPanel';
import { PerfilTributario, usePerfilTributario } from '../_components/PerfilTributario';
import { PreSubmitModal } from '../_components/PreSubmitModal';
import { WizardStepper } from '../_components/WizardStepper';
import { downloadDeclarationPdf } from '../_components/downloadPdf';
import { calcD101, type D101Result, type TramoDetalle } from '../_components/calc';

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
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function Casilla({
  numero, label, hint, note, value, onChange, readOnly = false, bold = false, children,
}: {
  numero: string; label: string; hint?: string; note?: string;
  value: string | number; onChange?: (v: string) => void;
  readOnly?: boolean; bold?: boolean; children?: React.ReactNode;
}) {
  const displayVal = typeof value === 'number'
    ? value.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value;

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <span className="w-16 text-xs font-mono font-bold text-gray-400 flex-shrink-0 pt-1.5">{numero}</span>
      <div className="flex-1">
        <span className={`text-sm ${bold ? 'font-semibold text-gray-800' : 'text-gray-700'}`}>{label}</span>
        {hint && <span className="ml-1 text-xs text-gray-400">({hint})</span>}
        {note && <p className="text-xs text-amber-600 mt-0.5">{note}</p>}
      </div>
      {readOnly ? (
        <span className={`w-44 text-right text-sm font-mono px-3 py-1 rounded-lg flex-shrink-0 ${
          bold ? 'bg-blue-50 text-blue-700 font-bold' : 'bg-gray-50 text-gray-700'
        }`}>
          ₡ {displayVal}
        </span>
      ) : (
        <div className="relative w-44 flex-shrink-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">₡</span>
          <input
            type="number" min="0" step="0.01"
            value={value as string}
            onChange={e => onChange?.(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
            placeholder="0.00"
          />
        </div>
      )}
      {children}
    </div>
  );
}

function SectionHeader({ number, title, color = 'emerald' }: { number: string; title: string; color?: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-700 text-white',
    blue:    'bg-blue-700 text-white',
    orange:  'bg-orange-600 text-white',
    red:     'bg-red-700 text-white',
    gray:    'bg-gray-700 text-white',
    purple:  'bg-purple-700 text-white',
  };
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-t-xl ${colors[color] ?? colors.emerald}`}>
      <span className="text-xs font-bold opacity-70">SECCIÓN</span>
      <span className="text-lg font-black">{number}</span>
      <span className="text-sm font-semibold tracking-wide">{title}</span>
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
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function goPrev() {
    if (step > 0) {
      setStep(s => s - 1);
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    <div className="min-h-screen bg-gray-100" ref={topRef}>
      {/* Header TRIBU CR */}
      <div className="bg-emerald-900 text-white">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/estudiante/impuestos" className="text-emerald-300 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">Ministerio de Hacienda</span>
                <span className="text-emerald-600">|</span>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">TRIBU CR</span>
              </div>
              <h1 className="text-lg font-black">D-101 — Declaración del Impuesto sobre la Renta</h1>
              <p className="text-xs text-emerald-300">Personas Jurídicas — Régimen Tradicional</p>
            </div>
          </div>
          {isSubmitted && (
            <span className="flex items-center gap-1.5 text-xs font-bold bg-emerald-500 text-white px-3 py-1.5 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" /> PRESENTADA
            </span>
          )}
        </div>
      </div>

      {/* Educational banner */}
      <div className="bg-amber-400 text-amber-900">
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-2 text-xs font-bold">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          SIMULACIÓN EDUCATIVA — Esta declaración NO se envía a Hacienda. Solo tiene fines de práctica académica. Tramos y tasas: período fiscal 2025-2026.
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Wizard stepper */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <WizardStepper steps={WIZARD_STEPS} currentStep={step} />
        </div>

        {/* ── STEP 0: Información General ─────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-4">
            <PerfilTributario disabled={isSubmitted} onChange={p => setPerfil(p)} />

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" /> Datos del período fiscal
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Período fiscal</label>
                  <select
                    value={period}
                    onChange={e => setPeriod(e.target.value)}
                    disabled={isSubmitted}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  >
                    {FISCAL_PERIODS.map(p => (
                      <option key={p} value={p}>{p} (1 oct – 30 set)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Tipo de contribuyente</label>
                  <div className={`border rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-2 ${
                    result?.tipoEmpresa === 'PYME'
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : result?.tipoEmpresa === 'GRANDE'
                      ? 'border-purple-300 bg-purple-50 text-purple-700'
                      : 'border-gray-200 bg-gray-50 text-gray-400'
                  }`}>
                    <Building2 className="w-4 h-4" />
                    {result?.tipoEmpresa === 'PYME'
                      ? 'Pequeña empresa (PYME)'
                      : result?.tipoEmpresa === 'GRANDE'
                      ? 'Empresa grande (≥ ₡122.1M)'
                      : 'Se calcula con ingresos'}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Estado</label>
                  <div className={`border rounded-lg px-3 py-2 text-sm font-semibold ${
                    isSubmitted
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-amber-300 bg-amber-50 text-amber-700'
                  }`}>
                    {isSubmitted ? 'Presentada (simulación)' : 'Borrador'}
                  </div>
                </div>
              </div>
              {refNo && (
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Número de referencia simulado: <span className="font-mono font-bold text-gray-800">{refNo}</span></span>
                </div>
              )}
            </div>

            {/* How D-101 works */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> Proceso D-101 en Hacienda
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { step: '1', title: 'Ingresos del año', desc: 'Registra todos los ingresos brutos del período fiscal (1 oct a 30 set).' },
                  { step: '2', title: 'Gastos deducibles', desc: 'Deduce gastos útiles, necesarios y pertinentes para generar renta.' },
                  { step: '3', title: 'Créditos', desc: 'Resta retenciones sufridas y pagos parciales ya realizados.' },
                  { step: '4', title: 'Pagar o saldo a favor', desc: 'Cancela el impuesto neto antes del 15 de diciembre.' },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">
                      {step}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-800">{title}</p>
                      <p className="text-xs text-emerald-600 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 1: Ingresos ────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <SectionHeader number="I" title="INGRESOS DEL PERÍODO FISCAL" color="emerald" />
            <div className="px-5 py-2">
              <div className="text-xs text-gray-500 py-2 flex items-center gap-1.5 border-b border-gray-100 mb-2">
                <Info className="w-3.5 h-3.5" />
                Incluye todos los ingresos del período fiscal (1 oct a 30 set).
              </div>
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
              <div className="pt-2 pb-1">
                <Casilla numero="103" label="Total ingresos gravables (101 − 102)" bold
                  value={result?.cas103_ingresosGravables ?? 0} readOnly />
              </div>

              {result?.tipoEmpresa && (
                <div className={`mt-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                  result.tipoEmpresa === 'PYME'
                    ? 'text-blue-700 bg-blue-50'
                    : 'text-purple-700 bg-purple-50'
                }`}>
                  <Building2 className="w-4 h-4 flex-shrink-0" />
                  {result.tipoEmpresa === 'PYME'
                    ? 'Clasificado como PYME — Se aplicarán tramos progresivos (5% – 30%).'
                    : 'Clasificado como empresa grande — Tarifa plana del 30%.'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2: Gastos ──────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <SectionHeader number="II" title="GASTOS DEDUCIBLES" color="blue" />
            <div className="px-5 py-2">
              <div className="text-xs text-gray-500 py-2 flex items-center gap-1.5 border-b border-gray-100 mb-2">
                <Info className="w-3.5 h-3.5" />
                Solo son deducibles los gastos <strong>útiles, necesarios y pertinentes</strong> para generar la renta gravable (Art. 8 LISR).
              </div>
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
              <div className="pt-2 pb-1">
                <Casilla numero="210" label="TOTAL GASTOS DEDUCIBLES" bold
                  value={result?.cas210_totalGastos ?? 0} readOnly />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Créditos y retenciones ──────────────────────────────── */}
        {step === 3 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <SectionHeader number="V" title="CRÉDITOS Y RETENCIONES EN LA FUENTE" color="gray" />
            <div className="px-5 py-2">
              <div className="text-xs text-gray-500 py-2 flex items-center gap-1.5 border-b border-gray-100 mb-2">
                <Info className="w-3.5 h-3.5" />
                Deduce los pagos ya realizados durante el año fiscal para evitar pagar dos veces.
              </div>
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
              <div className="pt-2 pb-1">
                <Casilla numero="503" label="TOTAL CRÉDITOS" bold
                  value={result?.cas503_totalCreditos ?? 0} readOnly />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: Resumen ─────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-4">
            {/* Renta neta */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <SectionHeader number="III" title="RENTA NETA IMPONIBLE" color="orange" />
              <div className="px-5 py-4">
                <Casilla numero="103" label="Total ingresos gravables" readOnly
                  value={result?.cas103_ingresosGravables ?? 0} />
                <Casilla numero="210" label="Total gastos deducibles" readOnly
                  value={result?.cas210_totalGastos ?? 0} />
                <div className="pt-2 border-t border-gray-200 mt-2">
                  <Casilla numero="301" label="Renta neta imponible (103 − 210)" bold
                    value={result?.cas301_rentaNeta ?? 0} readOnly />
                </div>
                {(result?.cas301_rentaNeta ?? 0) === 0 && (parseFloat(form.ingresosBrutos) || 0) > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Los gastos superan o igualan los ingresos. No hay impuesto sobre la renta en este período.
                  </div>
                )}
              </div>
            </div>

            {/* Cálculo del impuesto con tramos */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <SectionHeader number="IV" title="CÁLCULO DEL IMPUESTO SOBRE LA RENTA" color="purple" />
              <div className="px-5 py-4">
                {result && (result.cas301_rentaNeta ?? 0) > 0 && result.detalleTramos.length > 0 && (
                  <div className="mb-4 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2 bg-gray-100 border-b border-gray-200">
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                        {result.tipoEmpresa === 'PYME'
                          ? 'Tramos progresivos PYME — Decreto Ejecutivo 2025-2026'
                          : 'Tarifa plana empresa grande — 30%'}
                      </p>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b border-gray-200">
                          <th className="text-left px-4 py-2">Tramo</th>
                          <th className="text-right px-4 py-2">Base gravada</th>
                          <th className="text-right px-4 py-2">Tasa</th>
                          <th className="text-right px-4 py-2">Impuesto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.detalleTramos.map((t, i) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0">
                            <td className="px-4 py-2 text-gray-600">{t.tramo}</td>
                            <td className="px-4 py-2 font-mono text-right">₡ {fmtNum(t.base)}</td>
                            <td className="px-4 py-2 text-right font-semibold text-purple-700">{t.tasa}%</td>
                            <td className="px-4 py-2 font-mono text-right font-semibold">₡ {fmtNum(t.impuesto)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-100 font-bold">
                          <td className="px-4 py-2 text-gray-700" colSpan={3}>Total impuesto calculado</td>
                          <td className="px-4 py-2 font-mono text-right text-purple-800">₡ {fmtNum(result.cas402_impuestoCalculado)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
                <Casilla numero="301" label="Renta neta imponible" readOnly value={result?.cas301_rentaNeta ?? 0} />
                <div className="pt-2 border-t border-gray-200 mt-2">
                  <Casilla numero="402" label="Impuesto sobre la renta calculado" bold
                    value={result?.cas402_impuestoCalculado ?? 0} readOnly />
                </div>
                {result && (
                  <div className={`mt-2 flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                    result.tipoEmpresa === 'PYME' ? 'text-purple-700 bg-purple-50' : 'text-purple-700 bg-purple-50'
                  }`}>
                    <TrendingUp className="w-4 h-4 flex-shrink-0" />
                    {result.tipoEmpresa === 'PYME'
                      ? 'Aplican tramos progresivos para empresas con ingresos brutos ≤ ₡122.145.000 (Art. 15 LISR).'
                      : 'Empresa grande: tarifa plana del 30% sobre renta neta imponible (Art. 15 bis LISR).'}
                  </div>
                )}
              </div>
            </div>

            {/* Resultado final */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <SectionHeader number="VI" title="RESULTADO FINAL" color="red" />
              <div className="px-5 py-4 space-y-1">
                <Casilla numero="402" label="Impuesto calculado" readOnly value={result?.cas402_impuestoCalculado ?? 0} />
                <Casilla numero="503" label="Total créditos y retenciones" readOnly value={result?.cas503_totalCreditos ?? 0} />
                <div className="pt-2 border-t border-gray-200 mt-2">
                  <Casilla numero="601" label="Impuesto neto del período (402 − 503)" bold
                    value={result?.cas601_impuestoNeto ?? 0} readOnly />
                </div>
                <div className="pt-2">
                  {(result?.cas602_impuestoPagar ?? 0) > 0 ? (
                    <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl mt-2">
                      <div>
                        <p className="text-xs font-bold text-red-700 uppercase tracking-wide">Casilla 602</p>
                        <p className="text-sm font-bold text-red-800">Impuesto sobre la renta a pagar</p>
                        <p className="text-xs text-red-600">Vence 15 de diciembre del año siguiente al período</p>
                      </div>
                      <span className="text-2xl font-black text-red-700 font-mono">
                        ₡ {fmtNum(result?.cas602_impuestoPagar ?? 0)}
                      </span>
                    </div>
                  ) : (result?.cas603_saldoFavor ?? 0) > 0 ? (
                    <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl mt-2">
                      <div>
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Casilla 603</p>
                        <p className="text-sm font-bold text-emerald-800">Saldo a favor</p>
                        <p className="text-xs text-emerald-600">Puede solicitarse devolución o imputarse a períodos futuros</p>
                      </div>
                      <span className="text-2xl font-black text-emerald-700 font-mono">
                        ₡ {fmtNum(result?.cas603_saldoFavor ?? 0)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl mt-2">
                      <p className="text-sm text-gray-500">Ingresa los ingresos y gastos del período para ver el resultado</p>
                      <span className="text-2xl font-black text-gray-400 font-mono">₡ 0.00</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Validation errors */}
            {stepErrors.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Por favor completa antes de presentar
                </p>
                {stepErrors.map((e, i) => (
                  <p key={i} className="text-sm text-amber-700">• {e}</p>
                ))}
              </div>
            )}

            {/* Legal notes */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-xs text-emerald-700 space-y-1">
              <p className="font-bold flex items-center gap-1.5"><HelpCircle className="w-4 h-4" /> Información clave — Impuesto sobre la Renta CR</p>
              <ul className="list-disc list-inside space-y-0.5 text-emerald-600 mt-1">
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
        <div className="flex items-center justify-between pb-8">
          {step > 0 && !isSubmitted ? (
            <button
              onClick={goPrev}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            {!isSubmitted && (
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar borrador'}
              </button>
            )}

            {step < WIZARD_STEPS.length - 1 && !isSubmitted && (
              <button
                onClick={goNext}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === WIZARD_STEPS.length - 1 && !isSubmitted && (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={stepErrors.length > 0}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" /> Presentar declaración
              </button>
            )}

            {isSubmitted && (
              <Link
                href="/estudiante/impuestos"
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
              >
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-black text-gray-900">¡Declaración presentada!</h3>
              <p className="text-sm text-gray-500 mt-1">Simulación educativa completada</p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5 font-mono text-xs space-y-1">
              <div className="text-center font-bold text-gray-700 mb-3 text-sm">MINISTERIO DE HACIENDA — TRIBU CR</div>
              <div className="flex justify-between"><span>Formulario:</span><span className="font-bold">D-101</span></div>
              <div className="flex justify-between"><span>Período fiscal:</span><span>{period}</span></div>
              <div className="flex justify-between"><span>Tipo empresa:</span><span>{result?.tipoEmpresa}</span></div>
              <div className="flex justify-between"><span>Número de referencia:</span><span className="font-bold text-emerald-700">{refNo}</span></div>
              <div className="border-t border-gray-300 mt-2 pt-2 space-y-1">
                <div className="flex justify-between"><span>Ingresos gravables:</span><span>₡ {fmtNum(result?.cas103_ingresosGravables ?? 0)}</span></div>
                <div className="flex justify-between"><span>Gastos deducibles:</span><span>₡ {fmtNum(result?.cas210_totalGastos ?? 0)}</span></div>
                <div className="flex justify-between font-bold"><span>Renta neta:</span><span>₡ {fmtNum(result?.cas301_rentaNeta ?? 0)}</span></div>
              </div>
              {result?.detalleTramos.map((t, i) => (
                <div key={i} className="flex justify-between text-gray-500">
                  <span>{t.tramo} ({t.tasa}%)</span><span>₡ {fmtNum(t.impuesto)}</span>
                </div>
              ))}
              <div className={`flex justify-between border-t border-gray-300 pt-2 mt-2 font-black ${
                (result?.cas602_impuestoPagar ?? 0) > 0 ? 'text-red-700' : 'text-emerald-700'
              }`}>
                <span>{(result?.cas602_impuestoPagar ?? 0) > 0 ? 'IMPUESTO A PAGAR:' : 'SALDO A FAVOR:'}</span>
                <span>₡ {fmtNum(
                  (result?.cas602_impuestoPagar ?? 0) > 0
                    ? result!.cas602_impuestoPagar
                    : (result?.cas603_saldoFavor ?? 0)
                )}</span>
              </div>
              <div className="text-center text-gray-400 text-xs mt-3 pt-2 border-t border-gray-200">
                ** SIMULACIÓN EDUCATIVA — NO TIENE VALIDEZ LEGAL **
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={async () => {
                  if (!declId) return;
                  try {
                    await downloadDeclarationPdf(declId, `D-101-${period}.pdf`);
                  } catch { toast.error('No se pudo descargar el PDF'); }
                }}
                disabled={!declId}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> Descargar comprobante PDF
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResult(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Ver declaración
                </button>
                <button
                  onClick={() => router.push('/estudiante/impuestos')}
                  className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
                >
                  Ir al historial
                </button>
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

function fmtNum(n: number) {
  return Number(n).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
