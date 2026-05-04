'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Info, Send,
  Save, HelpCircle, ChevronRight, ChevronLeft, FileText, Download,
} from 'lucide-react';
import Link from 'next/link';
import { AttachmentPanel, Attachment } from '../_components/AttachmentPanel';
import { PerfilTributario, usePerfilTributario } from '../_components/PerfilTributario';
import { PreSubmitModal } from '../_components/PreSubmitModal';
import { WizardStepper } from '../_components/WizardStepper';
import { downloadDeclarationPdf } from '../_components/downloadPdf';
import { calcD115, type D115Result } from '../_components/calc';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface D115Form {
  dividendosResidentes:   string; // dividendos a personas físicas residentes (15%)
  dividendosNoResidentes: string; // dividendos a no residentes (15%)
  participaciones:        string; // participaciones de utilidades (15%)
  rentasCapital:          string; // rentas de capital mobiliario (15%)
  creditosAnteriores:     string; // créditos de períodos anteriores
}

const EMPTY: D115Form = {
  dividendosResidentes: '', dividendosNoResidentes: '',
  participaciones: '', rentasCapital: '', creditosAnteriores: '',
};

const FISCAL_PERIODS = ['2025-2026', '2024-2025', '2023-2024', '2022-2023'];

const WIZARD_STEPS = [
  { id: 'info',         label: 'Información General', shortLabel: 'Info'    },
  { id: 'dividendos',   label: 'Dividendos',          shortLabel: 'Divid.'  },
  { id: 'creditos',     label: 'Créditos',            shortLabel: 'Crédito' },
  { id: 'resumen',      label: 'Resumen',             shortLabel: 'Resumen' },
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
        <span className={`w-40 text-right text-sm font-mono px-3 py-1 rounded-lg ${bold ? 'bg-purple-50 text-purple-700 font-bold' : 'bg-gray-50 text-gray-700'}`}>
          ₡ {displayVal}
        </span>
      ) : (
        <div className="relative w-40">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">₡</span>
          <input
            type="number" min="0" step="0.01"
            value={value as string}
            onChange={e => onChange?.(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
            placeholder="0.00"
          />
        </div>
      )}
      {children}
    </div>
  );
}

function SectionHeader({ title, color = 'purple' }: { title: string; color?: string }) {
  const colors: Record<string, string> = {
    purple: 'bg-purple-700 text-white',
    gray:   'bg-gray-700 text-white',
  };
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-t-xl ${colors[color] ?? colors.purple}`}>
      <span className="text-sm font-semibold tracking-wide">{title}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function D115Page() {
  const router = useRouter();
  const params = useSearchParams();
  const existingId = params.get('id');

  const [step, setStep]       = useState(0);
  const [period, setPeriod]   = useState('2025-2026');
  const [form, setForm]       = useState<D115Form>(EMPTY);
  // Cálculo LOCAL en sync con el form (evita race con la API).
  const result: D115Result = useMemo(() => calcD115(form), [form]);
  const [declId, setDeclId]   = useState<string | null>(existingId);
  const [status, setStatus]   = useState<'DRAFT' | 'SUBMITTED'>('DRAFT');
  const [refNo, setRefNo]     = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [saving, setSaving]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResult, setShowResult]   = useState(false);
  const { perfil, setPerfil } = usePerfilTributario();
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!declId) return;
    api.get<Attachment[]>(`/api/v1/tax-declarations/${declId}/attachments`)
      .then(({ data }) => setAttachments(data)).catch(() => {});
  }, [declId]);

  useEffect(() => {
    if (!existingId) return;
    api.get<any>(`/api/v1/tax-declarations/${existingId}`)
      .then(({ data }) => {
        const fd = data.formData ?? {};
        setForm({
          dividendosResidentes:   fd.dividendosResidentes   ?? '',
          dividendosNoResidentes: fd.dividendosNoResidentes ?? '',
          participaciones:        fd.participaciones        ?? '',
          rentasCapital:          fd.rentasCapital          ?? '',
          creditosAnteriores:     fd.creditosAnteriores     ?? '',
        });
        setPeriod(data.period);
        setStatus(data.status);
        setRefNo(data.referenceNo);
        if (data.status === 'SUBMITTED') { setStep(3); setShowResult(true); }
      })
      .catch(() => toast.error('No se pudo cargar la declaración'));
  }, [existingId]);

  function setField(k: keyof D115Form, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function autoSave() {
    if (status === 'SUBMITTED') return;
    const formData = toNumeric(form);
    try {
      if (declId) {
        await api.patch(`/api/v1/tax-declarations/${declId}`, { formData });
      } else {
        const { data } = await api.post<any>('/api/v1/tax-declarations', { type: 'D115_DIVIDENDOS', period, formData });
        setDeclId(data.id);
      }
    } catch { /* silent */ }
  }

  async function handleSaveDraft() {
    setSaving(true);
    try { await autoSave(); toast.success('Borrador guardado'); }
    catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  }

  async function goNext() {
    if (step < WIZARD_STEPS.length - 1) {
      // Validate step 1 (Dividendos) before advancing
      if (step === 1) {
        const fields = ['dividendosResidentes', 'dividendosNoResidentes', 'participaciones', 'rentasCapital'] as const;
        const hasNegative = fields.some(f => parseFloat(form[f] || '0') < 0);
        if (hasNegative) { toast.error('Los montos no pueden ser negativos'); return; }
      }
      await autoSave();
      setStep(s => s + 1);
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function goPrev() {
    if (step > 0) { setStep(s => s - 1); topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }

  async function handleSubmit() {
    const fields = ['dividendosResidentes', 'dividendosNoResidentes', 'participaciones', 'rentasCapital'] as const;
    const hasNegative = fields.some(f => parseFloat(form[f] || '0') < 0);
    if (hasNegative) { toast.error('Los montos no pueden ser negativos'); return; }
    const totalBase = fields.reduce((s, f) => s + (parseFloat(form[f] || '0') || 0), 0);
    if (totalBase === 0) {
      toast.error('Debes ingresar al menos un monto de dividendos o participaciones'); return;
    }
    setSubmitting(true);
    try {
      let id = declId;
      const formData = toNumeric(form);
      if (!id) {
        const { data } = await api.post<any>('/api/v1/tax-declarations', { type: 'D115_DIVIDENDOS', period, formData });
        id = data.id; setDeclId(id);
      } else {
        await api.patch(`/api/v1/tax-declarations/${id}`, { formData });
      }
      const { data } = await api.post<any>(`/api/v1/tax-declarations/${id}/submit`);
      setStatus('SUBMITTED'); setRefNo(data.referenceNo);
      setShowConfirm(false); setShowResult(true);
      toast.success('Declaración presentada (simulación)');
    } catch { toast.error('Error al presentar la declaración'); }
    finally { setSubmitting(false); }
  }

  const isSubmitted = status === 'SUBMITTED';

  return (
    <div className="min-h-screen bg-gray-100" ref={topRef}>
      {/* Header */}
      <div className="bg-purple-900 text-white">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/estudiante/impuestos" className="text-purple-300 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-purple-300">Ministerio de Hacienda</span>
                <span className="text-purple-600">|</span>
                <span className="text-xs font-bold uppercase tracking-widest text-purple-300">TRIBU CR</span>
              </div>
              <h1 className="text-lg font-black">D-115 — Dividendos y Participaciones</h1>
              <p className="text-xs text-purple-300">Declaración anual de distribución de utilidades y rentas de capital</p>
            </div>
          </div>
          {isSubmitted && (
            <span className="flex items-center gap-1.5 text-xs font-bold bg-emerald-500 text-white px-3 py-1.5 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" /> PRESENTADA
            </span>
          )}
        </div>
      </div>

      <div className="bg-amber-400 text-amber-900">
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-2 text-xs font-bold">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          SIMULACIÓN EDUCATIVA — Esta declaración NO se envía a Hacienda. Solo tiene fines de práctica académica.
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <WizardStepper steps={WIZARD_STEPS} currentStep={step} />
        </div>

        {/* ── STEP 0: Info ────────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-4">
            <PerfilTributario disabled={isSubmitted} onChange={p => setPerfil(p)} />

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" /> Datos del período fiscal
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Período fiscal</label>
                  <select value={period} onChange={e => setPeriod(e.target.value)} disabled={isSubmitted}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
                    {FISCAL_PERIODS.map(p => <option key={p} value={p}>{p} (1 oct – 30 set)</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Formulario</label>
                  <div className="border border-purple-200 bg-purple-50 rounded-lg px-3 py-2 text-sm font-semibold text-purple-700">
                    D-115 — Dividendos y Participaciones
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Estado</label>
                  <div className={`border rounded-lg px-3 py-2 text-sm font-semibold ${
                    isSubmitted ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-700'
                  }`}>
                    {isSubmitted ? 'Presentada (simulación)' : 'Borrador'}
                  </div>
                </div>
              </div>
              {refNo && (
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Número de referencia: <span className="font-mono font-bold text-gray-800">{refNo}</span></span>
                </div>
              )}
            </div>

            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
              <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> ¿Qué declara el D-115?
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { step: '1', title: 'Dividendos', desc: 'Distribución de utilidades a socios o accionistas, tanto residentes como no residentes en Costa Rica.' },
                  { step: '2', title: 'Participaciones', desc: 'Distribución de participaciones de utilidades en sociedades de personas (SRL, etc.).' },
                  { step: '3', title: 'Rentas de capital', desc: 'Intereses, regalías y otras rentas de capital mobiliario pagadas a personas físicas.' },
                  { step: '4', title: 'Tasa única 15%', desc: 'Todos los conceptos tributan al 15% sobre el monto bruto distribuido (Art. 18 bis LISR).' },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">{step}</div>
                    <div>
                      <p className="text-xs font-bold text-purple-800">{title}</p>
                      <p className="text-xs text-purple-600 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 1: Dividendos ──────────────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <SectionHeader title="SECCIÓN I — DISTRIBUCIONES Y RENTAS DE CAPITAL (15%)" color="purple" />
            <div className="px-5 py-2">
              <div className="text-xs text-gray-500 py-2 flex items-center gap-1.5 border-b border-gray-100 mb-2">
                <Info className="w-3.5 h-3.5" />
                Ingresa el <strong>monto bruto distribuido</strong> por cada concepto. El sistema aplica automáticamente la tasa del 15%.
              </div>

              <Casilla numero="101" label="Dividendos a personas físicas residentes" hint="15%"
                value={form.dividendosResidentes} onChange={v => setField('dividendosResidentes', v)}>
                <AttachmentPanel declarationId={declId} lineKey="dividendosResidentes" lineLabel="Dividendos residentes"
                  attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                  onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
              </Casilla>

              <Casilla numero="102" label="Dividendos a personas no residentes" hint="15%"
                value={form.dividendosNoResidentes} onChange={v => setField('dividendosNoResidentes', v)}>
                <AttachmentPanel declarationId={declId} lineKey="dividendosNoResidentes" lineLabel="Dividendos no residentes"
                  attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                  onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
              </Casilla>

              <Casilla numero="103" label="Participaciones de utilidades" hint="SRL u otras sociedades — 15%"
                value={form.participaciones} onChange={v => setField('participaciones', v)}>
                <AttachmentPanel declarationId={declId} lineKey="participaciones" lineLabel="Participaciones utilidades"
                  attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                  onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
              </Casilla>

              <Casilla numero="104" label="Rentas de capital mobiliario" hint="intereses, regalías — 15%"
                value={form.rentasCapital} onChange={v => setField('rentasCapital', v)}>
                <AttachmentPanel declarationId={declId} lineKey="rentasCapital" lineLabel="Rentas de capital"
                  attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                  onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
              </Casilla>

              {result && (
                <div className="mt-3 pt-3 border-t border-purple-100 bg-purple-50 rounded-xl px-3 py-3 space-y-1.5">
                  <p className="text-xs font-bold text-purple-700 mb-2">CÁLCULO AUTOMÁTICO AL 15%</p>
                  {[
                    { label: 'Imp. dividendos residentes', val: result.impDivRes },
                    { label: 'Imp. dividendos no residentes', val: result.impDivNoRes },
                    { label: 'Imp. participaciones', val: result.impPart },
                    { label: 'Imp. rentas de capital', val: result.impCap },
                  ].filter(x => x.val > 0).map(({ label, val }) => (
                    <div key={label} className="flex justify-between text-sm text-purple-700">
                      <span>{label}</span>
                      <span className="font-mono font-semibold">₡ {fmtNum(val)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold text-purple-800 pt-1 border-t border-purple-200">
                    <span>Casilla 302 — Total impuesto</span>
                    <span className="font-mono">₡ {fmtNum(result.cas302_totalImpuesto)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2: Créditos ────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <SectionHeader title="SECCIÓN III — CRÉDITOS DE PERÍODOS ANTERIORES" color="gray" />
            <div className="px-5 py-2">
              <div className="text-xs text-gray-500 py-2 flex items-center gap-1.5 border-b border-gray-100 mb-2">
                <Info className="w-3.5 h-3.5" />
                Si tienes saldos a favor de períodos anteriores reconocidos por Hacienda, puedes deducirlos.
              </div>
              <Casilla numero="303" label="Créditos reconocidos de períodos anteriores"
                value={form.creditosAnteriores} onChange={v => setField('creditosAnteriores', v)}>
                <AttachmentPanel declarationId={declId} lineKey="creditosAnteriores" lineLabel="Créditos anteriores"
                  attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                  onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
              </Casilla>
            </div>
          </div>
        )}

        {/* ── STEP 3: Resumen ─────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <SectionHeader title="SECCIÓN IV — RESULTADO FINAL" color="gray" />
              <div className="px-5 py-4 space-y-1">
                <Casilla numero="301" label="Base total distribuida" bold value={result?.cas301_totalBase ?? 0} readOnly />
                <Casilla numero="302" label="Total impuesto calculado (15%)" bold value={result?.cas302_totalImpuesto ?? 0} readOnly />
                <Casilla numero="303" label="Créditos de períodos anteriores" value={result?.cas303_creditos ?? 0} readOnly />
                <div className="pt-3 border-t border-gray-200 mt-2">
                  <Casilla numero="304" label="Impuesto neto del período (302 − 303)" bold value={result?.cas304_impuestoNeto ?? 0} readOnly />
                </div>
                <div className="pt-2">
                  {(result?.cas305_impuestoPagar ?? 0) > 0 ? (
                    <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl mt-2">
                      <div>
                        <p className="text-xs font-bold text-red-700 uppercase tracking-wide">Casilla 305</p>
                        <p className="text-sm font-bold text-red-800">Impuesto a pagar</p>
                        <p className="text-xs text-red-600">Vence el 15 de diciembre del período fiscal</p>
                      </div>
                      <span className="text-2xl font-black text-red-700 font-mono">
                        ₡ {fmtNum(result?.cas305_impuestoPagar ?? 0)}
                      </span>
                    </div>
                  ) : (result?.cas306_saldoFavor ?? 0) > 0 ? (
                    <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl mt-2">
                      <div>
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Casilla 306</p>
                        <p className="text-sm font-bold text-emerald-800">Saldo a favor</p>
                        <p className="text-xs text-emerald-600">Se imputa a períodos futuros o puede solicitarse devolución</p>
                      </div>
                      <span className="text-2xl font-black text-emerald-700 font-mono">
                        ₡ {fmtNum(result?.cas306_saldoFavor ?? 0)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl mt-2">
                      <p className="text-sm text-gray-500">Ingresa los montos distribuidos para ver el resultado</p>
                      <span className="text-2xl font-black text-gray-400 font-mono">₡ 0.00</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-xs text-purple-700 space-y-1">
              <p className="font-bold flex items-center gap-1.5"><HelpCircle className="w-4 h-4" /> Notas — Dividendos y Participaciones CR</p>
              <ul className="list-disc list-inside space-y-0.5 text-purple-600 mt-1">
                <li>La tasa del <strong>15%</strong> aplica a dividendos de acciones y participaciones en sociedades costarricenses.</li>
                <li>Las utilidades generadas antes del 1 de julio de 2019 tributan al <strong>5%</strong> (régimen transitorio).</li>
                <li>Los dividendos de empresas bajo el régimen de zona franca pueden estar <strong>exentos</strong>.</li>
                <li>Rentas de capital mobiliario (intereses, regalías): tarifa del <strong>15%</strong>.</li>
                <li>La declaración se presenta junto con la D-101, antes del <strong>15 de diciembre</strong>.</li>
                <li>Base legal: Art. 18 bis Ley N° 7092 y Ley de Fortalecimiento de las Finanzas Públicas (N° 9635).</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── Navigation ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pb-8">
          {step > 0 && !isSubmitted ? (
            <button onClick={goPrev}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
          ) : <div />}

          <div className="flex items-center gap-3">
            {!isSubmitted && (
              <button onClick={handleSaveDraft} disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50">
                <Save className="w-4 h-4" />{saving ? 'Guardando...' : 'Guardar borrador'}
              </button>
            )}
            {step < WIZARD_STEPS.length - 1 && !isSubmitted && (
              <button onClick={goNext}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl transition-colors">
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === WIZARD_STEPS.length - 1 && !isSubmitted && (
              <button onClick={() => setShowConfirm(true)}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl transition-colors">
                <Send className="w-4 h-4" /> Presentar declaración
              </button>
            )}
            {isSubmitted && (
              <Link href="/estudiante/impuestos"
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors">
                Volver al historial
              </Link>
            )}
          </div>
        </div>
      </div>

      {showConfirm && (
        <PreSubmitModal type={'D115_DIVIDENDOS' as any} period={period} form={form}
          attachments={attachments} perfil={perfil} result={result}
          onConfirm={handleSubmit} onCancel={() => setShowConfirm(false)} submitting={submitting} />
      )}

      {showResult && isSubmitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-black text-gray-900">¡Declaración presentada!</h3>
              <p className="text-sm text-gray-500 mt-1">Simulación educativa completada</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5 font-mono text-xs space-y-1">
              <div className="text-center font-bold text-gray-700 mb-3 text-sm">MINISTERIO DE HACIENDA — TRIBU CR</div>
              <div className="flex justify-between"><span>Formulario:</span><span className="font-bold">D-115</span></div>
              <div className="flex justify-between"><span>Período:</span><span>{period}</span></div>
              <div className="flex justify-between"><span>Número de referencia:</span><span className="font-bold text-purple-700">{refNo}</span></div>
              <div className="border-t border-gray-300 mt-2 pt-2">
                <div className="flex justify-between"><span>Base total distribuida:</span><span>₡ {fmtNum(result?.cas301_totalBase ?? 0)}</span></div>
                <div className="flex justify-between"><span>Impuesto calculado (15%):</span><span>₡ {fmtNum(result?.cas302_totalImpuesto ?? 0)}</span></div>
              </div>
              <div className={`flex justify-between border-t border-gray-300 pt-2 mt-2 font-black ${(result?.cas305_impuestoPagar ?? 0) > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                <span>{(result?.cas305_impuestoPagar ?? 0) > 0 ? 'A PAGAR:' : 'SALDO A FAVOR:'}</span>
                <span>₡ {fmtNum((result?.cas305_impuestoPagar ?? 0) > 0 ? result!.cas305_impuestoPagar : (result?.cas306_saldoFavor ?? 0))}</span>
              </div>
              <div className="text-center text-gray-400 text-xs mt-3 pt-2 border-t border-gray-200">** SIMULACIÓN EDUCATIVA — NO TIENE VALIDEZ LEGAL **</div>
            </div>
            <div className="space-y-2">
              <button
                onClick={async () => {
                  if (!declId) return;
                  try {
                    await downloadDeclarationPdf(declId, `D-115-${period}.pdf`);
                  } catch { toast.error('No se pudo descargar el PDF'); }
                }}
                disabled={!declId}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> Descargar comprobante PDF
              </button>
              <div className="flex gap-3">
                <button onClick={() => setShowResult(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  Ver declaración
                </button>
                <button onClick={() => router.push('/estudiante/impuestos')}
                  className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors">
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

function toNumeric(form: D115Form) {
  return {
    dividendosResidentes:   parseFloat(form.dividendosResidentes   || '0') || 0,
    dividendosNoResidentes: parseFloat(form.dividendosNoResidentes || '0') || 0,
    participaciones:        parseFloat(form.participaciones        || '0') || 0,
    rentasCapital:          parseFloat(form.rentasCapital          || '0') || 0,
    creditosAnteriores:     parseFloat(form.creditosAnteriores     || '0') || 0,
  };
}

function fmtNum(n: number) {
  return Number(n).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
