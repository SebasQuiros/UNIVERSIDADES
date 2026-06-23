'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Info, Send,
  Save, HelpCircle, ChevronRight, ChevronLeft, FileText,
  ShoppingCart, BarChart3, ClipboardCheck, BookOpen, Copy, Download,
} from 'lucide-react';
import Link from 'next/link';
import { AttachmentPanel, Attachment } from '../_components/AttachmentPanel';
import { PerfilTributario, usePerfilTributario } from '../_components/PerfilTributario';
import { PreSubmitModal } from '../_components/PreSubmitModal';
import { WizardStepper } from '../_components/WizardStepper';
import { TribuHeader } from '../_components/TribuHeader';
import { downloadDeclarationPdf } from '../_components/downloadPdf';
import { calcD104, type D104Result } from '../_components/calc';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface D104Form {
  ventas13: string; ventas8: string; ventas4: string;
  ventas2: string;  ventas1: string; ventasExentas: string;
  compras13: string; compras8: string; compras4: string;
  compras2: string;  compras1: string;
}

const EMPTY: D104Form = {
  ventas13: '', ventas8: '', ventas4: '', ventas2: '', ventas1: '', ventasExentas: '',
  compras13: '', compras8: '', compras4: '', compras2: '', compras1: '',
};

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Setiembre','Octubre','Noviembre','Diciembre',
];

const WIZARD_STEPS = [
  { id: 'info',     label: 'Información General', shortLabel: 'Info' },
  { id: 'ventas',   label: 'Ventas',               shortLabel: 'Ventas' },
  { id: 'compras',  label: 'Compras',              shortLabel: 'Compras' },
  { id: 'resumen',  label: 'Resumen',              shortLabel: 'Resumen' },
];

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function Casilla({
  numero, label, hint, value, onChange, readOnly = false, bold = false, children,
}: {
  numero: string; label: string; hint?: string;
  value: string | number; onChange?: (v: string) => void;
  readOnly?: boolean; bold?: boolean; children?: React.ReactNode;
}) {
  const displayVal = typeof value === 'number'
    ? value.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <span className="w-16 text-xs font-mono font-bold text-gray-400 flex-shrink-0">{numero}</span>
      <span className={`flex-1 text-sm ${bold ? 'font-semibold text-gray-800' : 'text-gray-700'}`}>
        {label}
        {hint && <span className="ml-1 text-xs text-gray-400 font-normal">({hint})</span>}
      </span>
      {readOnly ? (
        <span className={`w-40 text-right text-sm font-mono px-3 py-1 rounded-lg ${
          bold ? 'bg-blue-50 text-blue-700 font-bold' : 'bg-gray-50 text-gray-700'
        }`}>
          ₡ {displayVal}
        </span>
      ) : (
        <div className="relative w-40">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">₡</span>
          <input
            type="number" min="0" step="0.01"
            value={value as string}
            onChange={e => onChange?.(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            placeholder="0.00"
          />
        </div>
      )}
      {children}
    </div>
  );
}

function SectionHeader({ number, title, color = 'blue' }: { number: string; title: string; color?: string }) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-700 text-white',
    green:  'bg-emerald-700 text-white',
    orange: 'bg-orange-600 text-white',
    gray:   'bg-gray-700 text-white',
  };
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-t-xl ${colors[color] ?? colors.blue}`}>
      <span className="text-xs font-bold opacity-70">SECCIÓN</span>
      <span className="text-lg font-black">{number}</span>
      <span className="text-sm font-semibold tracking-wide">{title}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function D104Page() {
  const router = useRouter();
  const params = useSearchParams();
  const existingId = params.get('id');

  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [step, setStep]           = useState(0);
  const [period, setPeriod]       = useState(defaultPeriod);
  const [form, setForm]           = useState<D104Form>(EMPTY);
  // ── Cálculo LOCAL: garantiza que el resultado siempre esté en sync con el form
  // (antes esto venía de un POST /calculate por keystroke y a veces llegaba
  //  desactualizado al modal de "Presentar declaración").
  const result: D104Result = useMemo(() => calcD104(form), [form]);
  const [declId, setDeclId]       = useState<string | null>(existingId);
  const [status, setStatus]       = useState<'DRAFT' | 'SUBMITTED'>('DRAFT');
  const [refNo, setRefNo]         = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [saving, setSaving]           = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResult, setShowResult]   = useState(false);
  const [showJournalEntry, setShowJournalEntry] = useState(false);
  const { perfil, setPerfil } = usePerfilTributario();

  const topRef = useRef<HTMLDivElement>(null);

  // Load attachments
  useEffect(() => {
    if (!declId) return;
    api.get<Attachment[]>(`/api/v1/tax-declarations/${declId}/attachments`)
      .then(({ data }) => setAttachments(data))
      .catch(() => {});
  }, [declId]);

  // Load existing declaration
  useEffect(() => {
    if (!existingId) return;
    api.get<any>(`/api/v1/tax-declarations/${existingId}`)
      .then(({ data }) => {
        const fd = data.formData ?? {};
        setForm({
          ventas13: fd.ventas13 ?? '', ventas8: fd.ventas8 ?? '',
          ventas4: fd.ventas4 ?? '',   ventas2: fd.ventas2 ?? '',
          ventas1: fd.ventas1 ?? '',   ventasExentas: fd.ventasExentas ?? '',
          compras13: fd.compras13 ?? '', compras8: fd.compras8 ?? '',
          compras4: fd.compras4 ?? '',  compras2: fd.compras2 ?? '',
          compras1: fd.compras1 ?? '',
        });
        setPeriod(data.period);
        setStatus(data.status);
        setRefNo(data.referenceNo);
        if (data.status === 'SUBMITTED') {
          setStep(3);
          setShowResult(true);
        }
      })
      .catch(() => toast.error('No se pudo cargar la declaración'));
  }, [existingId]);

  function setField(key: keyof D104Form, val: string) {
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
          type: 'D104_IVA', period, formData,
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
    const ventasFields = ['ventas13', 'ventas8', 'ventas4', 'ventas2', 'ventas1', 'ventasExentas'] as const;
    const hasNegative = [...ventasFields, 'compras13', 'compras8', 'compras4', 'compras2', 'compras1'].some(
      f => parseFloat((form as any)[f] || '0') < 0,
    );
    if (hasNegative) { toast.error('Los montos no pueden ser negativos'); return; }
    setSubmitting(true);
    try {
      let id = declId;
      const formData = toNumeric(form);

      if (!id) {
        const { data } = await api.post<any>('/api/v1/tax-declarations', {
          type: 'D104_IVA', period, formData,
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

  const [year, month] = period.split('-');
  const monthName = MONTHS[parseInt(month) - 1] ?? '';
  const isSubmitted = status === 'SUBMITTED';

  // ── Validation helper ──────────────────────────────────────────────────────
  function getStepErrors(): string[] {
    const errs: string[] = [];
    if (step === 3) {
      if (!perfil?.cedula) errs.push('Completa el perfil del contribuyente (cédula jurídica/física).');
      if (!perfil?.razonSocial) errs.push('Ingresa la razón social en el perfil.');
    }
    return errs;
  }

  const stepErrors = getStepErrors();

  return (
    <div className="min-h-screen bg-gray-100" ref={topRef}>
      {/* Encabezado TRIBU-CR unificado */}
      <TribuHeader
        code="D-104"
        title="Declaración del Impuesto al Valor Agregado"
        accent="blue"
        status={status}
        refNo={refNo}
        periodLabel={`${monthName} ${year}`}
        perfil={perfil}
      />

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
                <FileText className="w-4 h-4 text-blue-600" /> Datos del período fiscal
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Período fiscal</label>
                  <select
                    value={period}
                    onChange={e => setPeriod(e.target.value)}
                    disabled={isSubmitted}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    {Array.from({ length: 24 }, (_, i) => {
                      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                      return <option key={val} value={val}>{MONTHS[d.getMonth()]} {d.getFullYear()}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Nombre del declarante</label>
                  <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 bg-gray-50">
                    Estudiante (práctica)
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

            {/* Info TRIBU flow */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> Proceso D-104 en Hacienda
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { step: '1', title: 'Emitir facturas', desc: 'Registra ventas y compras con facturas electrónicas en ATV.' },
                  { step: '2', title: 'Ingresar ventas', desc: 'Clasifica las ventas por tarifa de IVA aplicable.' },
                  { step: '3', title: 'Ingresar compras', desc: 'Registra el crédito fiscal de tus compras gravadas.' },
                  { step: '4', title: 'Presentar', desc: 'Paga el impuesto neto antes del día 15 del mes siguiente.' },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">
                      {step}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-800">{title}</p>
                      <p className="text-xs text-blue-600 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 1: Ventas ──────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <SectionHeader number="I" title="VENTAS Y DÉBITO FISCAL" color="blue" />
            <div className="px-5 py-2">
              <div className="text-xs text-gray-500 py-2 flex items-center gap-1.5 border-b border-gray-100 mb-2">
                <Info className="w-3.5 h-3.5" />
                Ingresa la <strong>base imponible</strong> (monto sin IVA) de tus ventas por tarifa. El sistema calcula el IVA cobrado automáticamente.
              </div>

              <Casilla numero="101" label="Ventas gravadas al 13% (tarifa general)" hint="base sin IVA"
                value={form.ventas13} onChange={v => setField('ventas13', v)}>
                <AttachmentPanel declarationId={declId} lineKey="ventas13" lineLabel="Ventas al 13%"
                  attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                  onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
              </Casilla>
              <Casilla numero="102" label="Ventas gravadas al 8%" hint="medicina privada, seguros"
                value={form.ventas8} onChange={v => setField('ventas8', v)}>
                <AttachmentPanel declarationId={declId} lineKey="ventas8" lineLabel="Ventas al 8%"
                  attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                  onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
              </Casilla>
              <Casilla numero="103" label="Ventas gravadas al 4%" hint="boletos aéreos, espectáculos"
                value={form.ventas4} onChange={v => setField('ventas4', v)}>
                <AttachmentPanel declarationId={declId} lineKey="ventas4" lineLabel="Ventas al 4%"
                  attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                  onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
              </Casilla>
              <Casilla numero="104" label="Ventas gravadas al 2%" hint="canasta básica tributaria"
                value={form.ventas2} onChange={v => setField('ventas2', v)}>
                <AttachmentPanel declarationId={declId} lineKey="ventas2" lineLabel="Ventas al 2%"
                  attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                  onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
              </Casilla>
              <Casilla numero="105" label="Ventas gravadas al 1%" hint="medicamentos, insumos agropecuarios"
                value={form.ventas1} onChange={v => setField('ventas1', v)}>
                <AttachmentPanel declarationId={declId} lineKey="ventas1" lineLabel="Ventas al 1%"
                  attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                  onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
              </Casilla>
              <Casilla numero="106" label="Ventas exentas (0%)" hint="educación privada, servicios exentos"
                value={form.ventasExentas} onChange={v => setField('ventasExentas', v)}>
                <AttachmentPanel declarationId={declId} lineKey="ventasExentas" lineLabel="Ventas exentas"
                  attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                  onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
              </Casilla>

              <div className="mt-3 pt-3 border-t border-blue-100 bg-blue-50 rounded-xl px-3 py-2 space-y-1">
                <div className="flex items-center gap-2 text-xs text-blue-600 font-semibold mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" /> DÉBITO FISCAL (IVA cobrado en ventas)
                </div>
                {result?.ivaVentas && [
                  { t: '13%', v: result.ivaVentas.t13 }, { t: '8%', v: result.ivaVentas.t8 },
                  { t: '4%', v: result.ivaVentas.t4 },   { t: '2%', v: result.ivaVentas.t2 },
                  { t: '1%', v: result.ivaVentas.t1 },
                ].filter(x => x.v > 0).map(({ t, v }) => (
                  <div key={t} className="flex justify-between text-xs text-blue-700">
                    <span>IVA {t}</span>
                    <span className="font-mono">₡ {fmtNum(v)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold text-blue-800 pt-1 border-t border-blue-200">
                  <span>Casilla 301 — Total débito fiscal</span>
                  <span className="font-mono">₡ {fmtNum(result?.cas301_debitoFiscal ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Compras ─────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <SectionHeader number="II" title="COMPRAS Y CRÉDITO FISCAL" color="green" />
            <div className="px-5 py-2">
              <div className="text-xs text-gray-500 py-2 flex items-center gap-1.5 border-b border-gray-100 mb-2">
                <Info className="w-3.5 h-3.5" />
                Ingresa la <strong>base imponible</strong> de tus compras gravadas. El IVA pagado se convierte en crédito fiscal.
              </div>

              <Casilla numero="201" label="Compras gravadas al 13%" hint="base sin IVA"
                value={form.compras13} onChange={v => setField('compras13', v)}>
                <AttachmentPanel declarationId={declId} lineKey="compras13" lineLabel="Compras al 13%"
                  attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                  onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
              </Casilla>
              <Casilla numero="202" label="Compras gravadas al 8%"
                value={form.compras8} onChange={v => setField('compras8', v)}>
                <AttachmentPanel declarationId={declId} lineKey="compras8" lineLabel="Compras al 8%"
                  attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                  onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
              </Casilla>
              <Casilla numero="203" label="Compras gravadas al 4%"
                value={form.compras4} onChange={v => setField('compras4', v)}>
                <AttachmentPanel declarationId={declId} lineKey="compras4" lineLabel="Compras al 4%"
                  attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                  onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
              </Casilla>
              <Casilla numero="204" label="Compras gravadas al 2%"
                value={form.compras2} onChange={v => setField('compras2', v)}>
                <AttachmentPanel declarationId={declId} lineKey="compras2" lineLabel="Compras al 2%"
                  attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                  onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
              </Casilla>
              <Casilla numero="205" label="Compras gravadas al 1%"
                value={form.compras1} onChange={v => setField('compras1', v)}>
                <AttachmentPanel declarationId={declId} lineKey="compras1" lineLabel="Compras al 1%"
                  attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                  onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
              </Casilla>

              <div className="mt-3 pt-3 border-t border-emerald-100 bg-emerald-50 rounded-xl px-3 py-2 space-y-1">
                <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" /> CRÉDITO FISCAL (IVA pagado en compras)
                </div>
                {result?.ivaCompras && [
                  { t: '13%', v: result.ivaCompras.t13 }, { t: '8%', v: result.ivaCompras.t8 },
                  { t: '4%', v: result.ivaCompras.t4 },   { t: '2%', v: result.ivaCompras.t2 },
                  { t: '1%', v: result.ivaCompras.t1 },
                ].filter(x => x.v > 0).map(({ t, v }) => (
                  <div key={t} className="flex justify-between text-xs text-emerald-700">
                    <span>Crédito {t}</span>
                    <span className="font-mono">₡ {fmtNum(v)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold text-emerald-800 pt-1 border-t border-emerald-200">
                  <span>Casilla 302 — Total crédito fiscal</span>
                  <span className="font-mono">₡ {fmtNum(result?.cas302_creditoFiscal ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Resumen ─────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Summary table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <SectionHeader number="III" title="RESULTADO DEL PERÍODO" color="gray" />
              <div className="px-5 py-4 space-y-1">
                <Casilla numero="301" label="Débito fiscal (IVA cobrado en ventas)" bold
                  value={result?.cas301_debitoFiscal ?? 0} readOnly />
                <Casilla numero="302" label="Crédito fiscal (IVA pagado en compras)" bold
                  value={result?.cas302_creditoFiscal ?? 0} readOnly />
                <div className="pt-3 border-t border-gray-200 mt-2">
                  <Casilla numero="303" label="Impuesto neto del período (301 − 302)" bold
                    value={result?.cas303_impuestoNeto ?? 0} readOnly />
                </div>
                <div className="pt-2">
                  {(result?.cas304_impuestoPagar ?? 0) > 0 ? (
                    <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl mt-2">
                      <div>
                        <p className="text-xs font-bold text-red-700 uppercase tracking-wide">Casilla 304</p>
                        <p className="text-sm font-bold text-red-800">Impuesto a pagar</p>
                        <p className="text-xs text-red-600">Monto a cancelar a Hacienda este período</p>
                      </div>
                      <span className="text-2xl font-black text-red-700 font-mono">
                        ₡ {fmtNum(result?.cas304_impuestoPagar ?? 0)}
                      </span>
                    </div>
                  ) : (result?.cas305_saldoFavor ?? 0) > 0 ? (
                    <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl mt-2">
                      <div>
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Casilla 305</p>
                        <p className="text-sm font-bold text-emerald-800">Saldo a favor</p>
                        <p className="text-xs text-emerald-600">Crédito fiscal disponible para el siguiente período</p>
                      </div>
                      <span className="text-2xl font-black text-emerald-700 font-mono">
                        ₡ {fmtNum(result?.cas305_saldoFavor ?? 0)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl mt-2">
                      <p className="text-sm text-gray-500">Ingresa valores en pasos anteriores para ver el resultado</p>
                      <span className="text-2xl font-black text-gray-400 font-mono">₡ 0.00</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Resumen de ventas/compras */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Resumen de ventas</p>
                <div className="space-y-1.5">
                  {[
                    { label: 'Total base ventas', val: result?.totalVentas ?? 0 },
                    { label: 'Débito fiscal total', val: result?.cas301_debitoFiscal ?? 0, blue: true },
                  ].map(({ label, val, blue }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className={blue ? 'font-semibold text-blue-700' : 'text-gray-600'}>{label}</span>
                      <span className={`font-mono ${blue ? 'text-blue-700 font-bold' : 'text-gray-800'}`}>₡ {fmtNum(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Resumen de compras</p>
                <div className="space-y-1.5">
                  {[
                    { label: 'Total base compras', val: result?.totalCompras ?? 0 },
                    { label: 'Crédito fiscal total', val: result?.cas302_creditoFiscal ?? 0, green: true },
                  ].map(({ label, val, green }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className={green ? 'font-semibold text-emerald-700' : 'text-gray-600'}>{label}</span>
                      <span className={`font-mono ${green ? 'text-emerald-700 font-bold' : 'text-gray-800'}`}>₡ {fmtNum(val)}</span>
                    </div>
                  ))}
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

            {/* ── Asiento de liquidación D-104 ──────────────────────────────── */}
            {result && (result.cas301_debitoFiscal > 0 || result.cas302_creditoFiscal > 0) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowJournalEntry(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-amber-100 transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-amber-800">
                    <BookOpen className="w-4 h-4" />
                    Generar asiento de liquidación D-104
                  </span>
                  <span className="text-xs text-amber-600">
                    {showJournalEntry ? 'Ocultar' : 'Ver asiento sugerido'}
                  </span>
                </button>

                {showJournalEntry && (
                  <div className="px-5 pb-5 space-y-3">
                    <p className="text-xs text-amber-700">
                      Este es el asiento contable que corresponde registrar al cierre del período para liquidar el IVA.
                      Cópialo en el módulo de <strong>Diario Contable</strong>.
                    </p>
                    <div className="bg-white rounded-lg border border-amber-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-amber-100">
                            <th className="text-left px-3 py-2 text-amber-800">Cuenta</th>
                            <th className="text-left px-3 py-2 text-amber-800">Descripción</th>
                            <th className="text-right px-3 py-2 text-amber-800">Débito</th>
                            <th className="text-right px-3 py-2 text-amber-800">Crédito</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-50">
                          {result.cas301_debitoFiscal > 0 && (
                            <tr>
                              <td className="px-3 py-2 font-mono text-amber-900 font-semibold">2.1.02.01</td>
                              <td className="px-3 py-2 text-gray-700">IVA por Pagar</td>
                              <td className="px-3 py-2 text-right font-mono text-blue-700 font-semibold">
                                ₡ {fmtNum(result.cas301_debitoFiscal)}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-300">—</td>
                            </tr>
                          )}
                          {result.cas302_creditoFiscal > 0 && (
                            <tr>
                              <td className="px-3 py-2 font-mono text-amber-900 font-semibold">1.1.04.01</td>
                              <td className="px-3 py-2 text-gray-700">IVA Crédito Fiscal</td>
                              <td className="px-3 py-2 text-right text-gray-300">—</td>
                              <td className="px-3 py-2 text-right font-mono text-emerald-700 font-semibold">
                                ₡ {fmtNum(result.cas302_creditoFiscal)}
                              </td>
                            </tr>
                          )}
                          {result.cas304_impuestoPagar > 0 && (
                            <tr className="bg-red-50">
                              <td className="px-3 py-2 font-mono text-red-800 font-semibold">2.1.02.03</td>
                              <td className="px-3 py-2 text-red-700">IVA a Pagar Hacienda</td>
                              <td className="px-3 py-2 text-right text-gray-300">—</td>
                              <td className="px-3 py-2 text-right font-mono text-red-700 font-semibold">
                                ₡ {fmtNum(result.cas304_impuestoPagar)}
                              </td>
                            </tr>
                          )}
                          {result.cas305_saldoFavor > 0 && (
                            <tr className="bg-emerald-50">
                              <td className="px-3 py-2 font-mono text-emerald-800 font-semibold">1.1.04.02</td>
                              <td className="px-3 py-2 text-emerald-700">IVA Saldo a Favor (crédito arrastrado)</td>
                              <td className="px-3 py-2 text-right font-mono text-emerald-700 font-semibold">
                                ₡ {fmtNum(result.cas305_saldoFavor)}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-300">—</td>
                            </tr>
                          )}
                          {/* Totals row */}
                          <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                            <td colSpan={2} className="px-3 py-2 text-gray-700 text-right">Totales</td>
                            <td className="px-3 py-2 text-right font-mono text-blue-800">
                              ₡ {fmtNum(
                                result.cas301_debitoFiscal +
                                (result.cas305_saldoFavor > 0 ? result.cas305_saldoFavor : 0)
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-emerald-800">
                              ₡ {fmtNum(
                                result.cas302_creditoFiscal +
                                (result.cas304_impuestoPagar > 0 ? result.cas304_impuestoPagar : 0)
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="text-xs text-amber-600 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>
                        Fecha del asiento: último día del período fiscal declarado.
                        Descripción sugerida: <em>Liquidación D-104 {monthName} {year}</em>.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Legal note */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1">
              <p className="font-bold flex items-center gap-1.5"><HelpCircle className="w-4 h-4" /> Notas sobre el IVA en Costa Rica</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-600 mt-1">
                <li>La declaración D-104 se presenta mensualmente, a más tardar el día 15 del mes siguiente.</li>
                <li>Las tasas vigentes son: 13% (general), 8% (medicina privada y seguros), 4% (boletos y espectáculos), 2% (canasta básica tributaria) y 1% (medicamentos e insumos agropecuarios).</li>
                <li>Las exportaciones y algunos servicios educativos están exentos (0%).</li>
                <li>Si el crédito fiscal supera el débito, el saldo se arrastra al período siguiente o se puede solicitar devolución.</li>
                <li>Base legal: Ley N° 6826 (Ley del IVA) y sus reformas.</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── Navigation buttons ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between pb-8">
          {/* Left: Back */}
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

          {/* Right: Save draft + Next / Submit */}
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
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl transition-colors"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === WIZARD_STEPS.length - 1 && !isSubmitted && (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={stepErrors.length > 0}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
          type="D104_IVA"
          period={`${monthName} ${year}`}
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-black text-gray-900">¡Declaración presentada!</h3>
              <p className="text-sm text-gray-500 mt-1">Simulación educativa completada</p>
            </div>

            {/* TRIBU-style receipt */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5 font-mono text-xs space-y-1">
              <div className="text-center font-bold text-gray-700 mb-3 text-sm">MINISTERIO DE HACIENDA — TRIBU CR</div>
              <div className="flex justify-between"><span>Formulario:</span><span className="font-bold">D-104</span></div>
              <div className="flex justify-between"><span>Período:</span><span>{monthName} {year}</span></div>
              <div className="flex justify-between"><span>Número de referencia:</span><span className="font-bold text-blue-700">{refNo}</span></div>
              <div className="flex justify-between border-t border-gray-300 pt-2 mt-2">
                <span className="font-bold">Débito fiscal:</span><span>₡ {fmtNum(result?.cas301_debitoFiscal ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold">Crédito fiscal:</span><span>₡ {fmtNum(result?.cas302_creditoFiscal ?? 0)}</span>
              </div>
              <div className={`flex justify-between border-t border-gray-300 pt-2 mt-2 font-black ${
                (result?.cas304_impuestoPagar ?? 0) > 0 ? 'text-red-700' : 'text-emerald-700'
              }`}>
                <span>{(result?.cas304_impuestoPagar ?? 0) > 0 ? 'IMPUESTO A PAGAR:' : 'SALDO A FAVOR:'}</span>
                <span>₡ {fmtNum(
                  (result?.cas304_impuestoPagar ?? 0) > 0
                    ? result!.cas304_impuestoPagar
                    : (result?.cas305_saldoFavor ?? 0)
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
                    await downloadDeclarationPdf(declId, `D-104-${period}.pdf`);
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

function toNumeric(form: D104Form) {
  const out: Record<string, number> = {};
  (Object.keys(form) as (keyof D104Form)[]).forEach(k => {
    out[k] = parseFloat(form[k] || '0') || 0;
  });
  return out;
}

function fmtNum(n: number) {
  return Number(n).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
