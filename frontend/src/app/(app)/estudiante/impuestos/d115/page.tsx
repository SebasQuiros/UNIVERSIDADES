'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  CheckCircle2, Info, Send, Save, HelpCircle,
  ChevronRight, ChevronLeft, FileText, Download,
  Coins, Receipt, Calculator, ListChecks,
} from 'lucide-react';
import Link from 'next/link';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button, buttonClasses } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/IconTile';
import { MoneyPop } from '@/components/ui/MoneyPop';
import { ArtFiscalCalendar } from '@/components/illustrations';
import { cn, fmtNum } from '@/lib/utils';
import { AttachmentPanel, Attachment } from '../_components/AttachmentPanel';
import { PerfilTributario, usePerfilTributario } from '../_components/PerfilTributario';
import { PreSubmitModal } from '../_components/PreSubmitModal';
import { WizardStepper } from '../_components/WizardStepper';
import { TribuHeader } from '../_components/TribuHeader';
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
// SUB-COMPONENTS (presentación)
// ─────────────────────────────────────────────────────────────────────────────

function Casilla({
  numero, label, hint, value, onChange, readOnly = false, bold = false, children,
}: {
  numero: string; label: string; hint?: string;
  value: string | number; onChange?: (v: string) => void;
  readOnly?: boolean; bold?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 py-2.5 last:border-0">
      <span className="w-14 flex-shrink-0 rounded-md bg-gray-50 px-1.5 py-0.5 text-center font-mono text-xs font-bold tabular-nums text-gray-500">
        {numero}
      </span>
      <span className={cn('flex-1 text-sm', bold ? 'font-semibold text-gray-800' : 'text-gray-700')}>
        {label}
        {hint && <span className="ml-1 text-xs font-normal text-gray-400">({hint})</span>}
      </span>
      {readOnly ? (
        <span className={cn(
          'w-40 rounded-lg px-3 py-1.5 text-right text-sm',
          bold ? 'bg-slate-100 font-bold text-slate-700' : 'bg-gray-50 text-gray-700',
        )}>
          <MoneyPop value={value} />
        </span>
      ) : (
        <div className="relative w-40">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₡</span>
          <input
            type="number" min="0" step="0.01"
            value={value as string}
            onChange={e => onChange?.(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-7 pr-3 text-right font-mono text-sm tabular-nums transition-colors hover:border-gray-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/50"
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
      <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
      <span>{children}</span>
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
  // companyId: se pasa desde la Sesión de Aula GROUP para anclar la declaración a
  // la empresa del grupo (cierra la fuga del snapshot de auditoría). En el portal
  // general no viene → la declaración queda anclada solo al usuario (histórico).
  const companyId = params.get('companyId');

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
        const { data } = await api.post<any>('/api/v1/tax-declarations', { type: 'D115_DIVIDENDOS', period, formData, ...(companyId ? { companyId } : {}) });
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
      topRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goPrev() {
    if (step > 0) { setStep(s => s - 1); topRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }
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
        const { data } = await api.post<any>('/api/v1/tax-declarations', { type: 'D115_DIVIDENDOS', period, formData, ...(companyId ? { companyId } : {}) });
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
    <div className="flex-1 overflow-y-auto bg-[#FBF8F1]" ref={topRef}>
      {/* Encabezado TRIBU-CR unificado */}
      <TribuHeader
        code="D-115"
        title="Dividendos y Participaciones"
        accent="purple"
        status={status}
        refNo={refNo}
        periodLabel={period}
        perfil={perfil}
        description="Grava lo que la empresa reparte: dividendos a socios, participaciones de utilidades y rentas de capital mobiliario. Se presenta junto con la declaración anual de renta."
        illustration={<ArtFiscalCalendar size={140} className="lp-drift" />}
      />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">

        <div className="rounded-card border border-gray-200/70 bg-white p-5 shadow-card">
          <WizardStepper steps={WIZARD_STEPS} currentStep={step} />
        </div>

        {/* ── STEP 0: Info ────────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-5">
            <PerfilTributario disabled={isSubmitted} onChange={p => setPerfil(p)} />

            <SectionCard
              eyebrow="Paso 1"
              title="Datos del período fiscal"
              description="Se declara con el mismo período fiscal de la renta."
              icon={FileText}
              iconTint="#475569"
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
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm transition-colors hover:border-gray-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/50 disabled:opacity-50"
                  >
                    {FISCAL_PERIODS.map(p => <option key={p} value={p}>{p} (1 oct – 30 set)</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Formulario
                  </label>
                  <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-600">
                    D-115 — Dividendos y Participaciones
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
                    Número de referencia:{' '}
                    <span className="font-mono font-bold tabular-nums text-gray-800">{refNo}</span>
                  </span>
                </div>
              )}
            </SectionCard>

            <SectionCard
              eyebrow="Cómo funciona"
              title="¿Qué declara el D-115?"
              icon={ListChecks}
              iconTint="#B8860B"
              className="cx-pop cx-d2"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  { step: '1', title: 'Dividendos', desc: 'Distribución de utilidades a socios o accionistas, tanto residentes como no residentes en Costa Rica.' },
                  { step: '2', title: 'Participaciones', desc: 'Distribución de participaciones de utilidades en sociedades de personas (SRL, etc.).' },
                  { step: '3', title: 'Rentas de capital', desc: 'Intereses, regalías y otras rentas de capital mobiliario pagadas a personas físicas.' },
                  { step: '4', title: 'Tasa única 15%', desc: 'Todos los conceptos tributan al 15% sobre el monto bruto distribuido (Art. 18 bis LISR).' },
                ].map(({ step: n, title, desc }) => (
                  <div key={n} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-500 to-slate-700 text-xs font-black tabular-nums text-white">
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

        {/* ── STEP 1: Dividendos ──────────────────────────────────────────── */}
        {step === 1 && (
          <SectionCard
            eyebrow="Sección I"
            title="Distribuciones y rentas de capital (15%)"
            description="Lo que la empresa repartió durante el período."
            icon={Coins}
            iconTint="#475569"
            className="cx-pop"
          >
            <Nota>
              Ingresa el <strong>monto bruto distribuido</strong> por cada concepto.
              El sistema aplica automáticamente la tasa del 15%.
            </Nota>

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
              <div className="mt-4 space-y-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                  Cálculo automático al 15%
                </p>
                {[
                  { label: 'Imp. dividendos residentes', val: result.impDivRes },
                  { label: 'Imp. dividendos no residentes', val: result.impDivNoRes },
                  { label: 'Imp. participaciones', val: result.impPart },
                  { label: 'Imp. rentas de capital', val: result.impCap },
                ].filter(x => x.val > 0).map(({ label, val }) => (
                  <div key={label} className="flex justify-between text-sm text-slate-600">
                    <span>{label}</span>
                    <MoneyPop value={val} className="font-semibold" />
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-700">
                  <span>Casilla 302 — Total impuesto</span>
                  <MoneyPop value={result.cas302_totalImpuesto} className="text-base" />
                </div>
              </div>
            )}
          </SectionCard>
        )}

        {/* ── STEP 2: Créditos ────────────────────────────────────────────── */}
        {step === 2 && (
          <SectionCard
            eyebrow="Sección III"
            title="Créditos de períodos anteriores"
            description="Saldos a favor reconocidos por Hacienda."
            icon={Receipt}
            iconTint="#1B2E6E"
            className="cx-pop"
          >
            <Nota>
              Si tienes saldos a favor de períodos anteriores reconocidos por Hacienda, puedes deducirlos.
            </Nota>
            <Casilla numero="303" label="Créditos reconocidos de períodos anteriores"
              value={form.creditosAnteriores} onChange={v => setField('creditosAnteriores', v)}>
              <AttachmentPanel declarationId={declId} lineKey="creditosAnteriores" lineLabel="Créditos anteriores"
                attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
            </Casilla>
          </SectionCard>
        )}

        {/* ── STEP 3: Resumen ─────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <SectionCard
              eyebrow="Sección IV"
              title="Resultado final"
              description="Impuesto del 15% menos los créditos reconocidos."
              icon={Calculator}
              iconTint="#1B2E6E"
              className="cx-pop"
            >
              <Casilla numero="301" label="Base total distribuida" bold value={result?.cas301_totalBase ?? 0} readOnly />
              <Casilla numero="302" label="Total impuesto calculado (15%)" bold value={result?.cas302_totalImpuesto ?? 0} readOnly />
              <Casilla numero="303" label="Créditos de períodos anteriores" value={result?.cas303_creditos ?? 0} readOnly />
              <div className="mt-2 border-t border-gray-200 pt-3">
                <Casilla numero="304" label="Impuesto neto del período (302 − 303)" bold value={result?.cas304_impuestoNeto ?? 0} readOnly />
              </div>

              <div className="pt-3">
                {(result?.cas305_impuestoPagar ?? 0) > 0 ? (
                  <div className="cx-pop flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-5">
                    <div className="flex items-center gap-3">
                      <IconTile icon={Send} tint="#DC2626" size={44} />
                      <div>
                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-red-700">Casilla 305</p>
                        <p className="text-sm font-bold text-red-800">Impuesto a pagar</p>
                        <p className="text-xs text-red-600">Vence el 15 de diciembre del período fiscal</p>
                      </div>
                    </div>
                    <MoneyPop value={result?.cas305_impuestoPagar ?? 0} className="text-2xl font-black text-red-700" />
                  </div>
                ) : (result?.cas306_saldoFavor ?? 0) > 0 ? (
                  <div className="cx-pop flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="flex items-center gap-3">
                      <IconTile icon={CheckCircle2} tint="#047857" size={44} />
                      <div>
                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-emerald-700">Casilla 306</p>
                        <p className="text-sm font-bold text-emerald-800">Saldo a favor</p>
                        <p className="text-xs text-emerald-600">Se imputa a períodos futuros o puede solicitarse devolución</p>
                      </div>
                    </div>
                    <MoneyPop value={result?.cas306_saldoFavor ?? 0} className="text-2xl font-black text-emerald-700" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                    <p className="text-sm text-gray-500">Ingresa los montos distribuidos para ver el resultado</p>
                    <span className="font-mono text-2xl font-black tabular-nums text-gray-400">₡ 0.00</span>
                  </div>
                )}
              </div>
            </SectionCard>

            <div className="rounded-card border border-slate-200 bg-slate-50 p-5 text-xs text-slate-600">
              <p className="flex items-center gap-1.5 font-bold">
                <HelpCircle className="h-4 w-4" /> Notas — Dividendos y Participaciones CR
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 leading-relaxed">
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
        <div className="flex items-center justify-between gap-3 pb-10">
          {step > 0 && !isSubmitted ? (
            <Button variant="secondary" onClick={goPrev} className="cx-press">
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
          ) : <div />}

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
              <Button variant="gold" onClick={() => setShowConfirm(true)} className="cx-press">
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

      {showConfirm && (
        <PreSubmitModal type="D115_DIVIDENDOS" period={period} form={form}
          attachments={attachments} perfil={perfil} result={result}
          onConfirm={handleSubmit} onCancel={() => setShowConfirm(false)} submitting={submitting} />
      )}

      {showResult && isSubmitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-csq-dark/70 p-4 backdrop-blur-sm">
          <div className="cx-pop w-full max-w-md rounded-card bg-white p-6 shadow-soft">
            <div className="mb-5 text-center">
              <div className="cx-tada mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-black tracking-tight text-gray-900">¡Declaración presentada!</h3>
              <p className="mt-1 text-sm text-gray-500">Simulación educativa completada</p>
            </div>

            <div className="mb-5 space-y-1 rounded-2xl border border-gray-200 bg-gray-50 p-4 font-mono text-xs tabular-nums">
              <div className="mb-3 text-center text-sm font-bold text-gray-700">MINISTERIO DE HACIENDA — TRIBU CR</div>
              <div className="flex justify-between"><span>Formulario:</span><span className="font-bold">D-115</span></div>
              <div className="flex justify-between"><span>Período:</span><span>{period}</span></div>
              <div className="flex justify-between"><span>Número de referencia:</span><span className="font-bold text-slate-600">{refNo}</span></div>
              <div className="mt-2 border-t border-gray-300 pt-2">
                <div className="flex justify-between"><span>Base total distribuida:</span><span>₡ {fmtNum(result?.cas301_totalBase ?? 0)}</span></div>
                <div className="flex justify-between"><span>Impuesto calculado (15%):</span><span>₡ {fmtNum(result?.cas302_totalImpuesto ?? 0)}</span></div>
              </div>
              <div className={cn(
                'mt-2 flex justify-between border-t border-gray-300 pt-2 font-black',
                (result?.cas305_impuestoPagar ?? 0) > 0 ? 'text-red-700' : 'text-emerald-700',
              )}>
                <span>{(result?.cas305_impuestoPagar ?? 0) > 0 ? 'A PAGAR:' : 'SALDO A FAVOR:'}</span>
                <span>₡ {fmtNum((result?.cas305_impuestoPagar ?? 0) > 0 ? result!.cas305_impuestoPagar : (result?.cas306_saldoFavor ?? 0))}</span>
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
                    await downloadDeclarationPdf(declId, `D-115-${period}.pdf`);
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

function toNumeric(form: D115Form) {
  return {
    dividendosResidentes:   parseFloat(form.dividendosResidentes   || '0') || 0,
    dividendosNoResidentes: parseFloat(form.dividendosNoResidentes || '0') || 0,
    participaciones:        parseFloat(form.participaciones        || '0') || 0,
    rentasCapital:          parseFloat(form.rentasCapital          || '0') || 0,
    creditosAnteriores:     parseFloat(form.creditosAnteriores     || '0') || 0,
  };
}
