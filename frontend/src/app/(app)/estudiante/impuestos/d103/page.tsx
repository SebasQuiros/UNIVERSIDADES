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
import { ArtCoins } from '@/components/illustrations';
import { cn, fmtNum } from '@/lib/utils';
import { AttachmentPanel, Attachment } from '../_components/AttachmentPanel';
import { PerfilTributario, usePerfilTributario } from '../_components/PerfilTributario';
import { PreSubmitModal } from '../_components/PreSubmitModal';
import { WizardStepper } from '../_components/WizardStepper';
import { TribuHeader } from '../_components/TribuHeader';
import { downloadDeclarationPdf } from '../_components/downloadPdf';
import { calcD103, type D103Result } from '../_components/calc';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface D103Form {
  bienes3:               string; // base imponible bienes (3%)
  servicios8:            string; // base imponible servicios (8%)
  creditosCertificados:  string; // certificados de retención recibidos
}

const EMPTY: D103Form = { bienes3: '', servicios8: '', creditosCertificados: '' };

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Setiembre','Octubre','Noviembre','Diciembre',
];

const WIZARD_STEPS = [
  { id: 'info',     label: 'Información General', shortLabel: 'Info'     },
  { id: 'bienes',   label: 'Bienes y Servicios',  shortLabel: 'Bienes'   },
  { id: 'creditos', label: 'Créditos',            shortLabel: 'Créditos' },
  { id: 'resumen',  label: 'Resumen',             shortLabel: 'Resumen'  },
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
          bold ? 'bg-orange-50 font-bold text-orange-700' : 'bg-gray-50 text-gray-700',
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
            className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-7 pr-3 text-right font-mono text-sm tabular-nums transition-colors hover:border-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
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
      <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-orange-500" />
      <span>{children}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function D103Page() {
  const router = useRouter();
  const params = useSearchParams();
  const existingId = params.get('id');
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [step, setStep]       = useState(0);
  const [period, setPeriod]   = useState(defaultPeriod);
  const [form, setForm]       = useState<D103Form>(EMPTY);
  // Cálculo LOCAL en sync con el form (evita race con la API).
  const result: D103Result = useMemo(() => calcD103(form), [form]);
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
          bienes3:              fd.bienes3              ?? '',
          servicios8:           fd.servicios8           ?? '',
          creditosCertificados: fd.creditosCertificados ?? '',
        });
        setPeriod(data.period);
        setStatus(data.status);
        setRefNo(data.referenceNo);
        if (data.status === 'SUBMITTED') { setStep(3); setShowResult(true); }
      })
      .catch(() => toast.error('No se pudo cargar la declaración'));
  }, [existingId]);

  function setField(k: keyof D103Form, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function autoSave() {
    if (status === 'SUBMITTED') return;
    const formData = toNumeric(form);
    try {
      if (declId) {
        await api.patch(`/api/v1/tax-declarations/${declId}`, { formData });
      } else {
        const { data } = await api.post<any>('/api/v1/tax-declarations', { type: 'D103_RETENCION', period, formData });
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
      // Validate step 1 (Bienes y Servicios) before advancing
      if (step === 1) {
        const bienes   = parseFloat(form.bienes3)   || 0;
        const servicios = parseFloat(form.servicios8) || 0;
        if (bienes < 0 || servicios < 0) {
          toast.error('Los montos no pueden ser negativos'); return;
        }
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
    const bienes   = parseFloat(form.bienes3)   || 0;
    const servicios = parseFloat(form.servicios8) || 0;
    if (bienes < 0 || servicios < 0) {
      toast.error('Los montos no pueden ser negativos'); return;
    }
    if (bienes === 0 && servicios === 0) {
      toast.error('Debes ingresar al menos un monto de retención (bienes o servicios)'); return;
    }
    setSubmitting(true);
    try {
      let id = declId;
      const formData = toNumeric(form);
      if (!id) {
        const { data } = await api.post<any>('/api/v1/tax-declarations', { type: 'D103_RETENCION', period, formData });
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

  const [year, month] = period.split('-');
  const monthName = MONTHS[parseInt(month) - 1] ?? '';
  const isSubmitted = status === 'SUBMITTED';

  return (
    <div className="flex-1 overflow-y-auto bg-[#F4F6F8]" ref={topRef}>
      {/* Encabezado TRIBU-CR unificado */}
      <TribuHeader
        code="D-103"
        title="Retención en la Fuente"
        accent="orange"
        status={status}
        refNo={refNo}
        periodLabel={`${monthName} ${year}`}
        perfil={perfil}
        description="Cuando le pagas a un proveedor, retienes una parte del pago y la entregas a Hacienda a nombre de él. Aquí declaras y liquidas las retenciones del mes."
        illustration={<ArtCoins size={140} className="lp-drift" />}
      />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">

        {/* Wizard */}
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
              description="Las retenciones se declaran mes a mes."
              icon={FileText}
              iconTint="#C2410C"
              className="cx-pop"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Período
                  </label>
                  <select
                    value={period}
                    onChange={e => setPeriod(e.target.value)}
                    disabled={isSubmitted}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm transition-colors hover:border-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 disabled:opacity-50"
                  >
                    {Array.from({ length: 24 }, (_, i) => {
                      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                      return <option key={val} value={val}>{MONTHS[d.getMonth()]} {d.getFullYear()}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Formulario
                  </label>
                  <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm font-semibold text-orange-700">
                    D-103 — Retención en la Fuente
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

            {/* Explanation */}
            <SectionCard
              eyebrow="Cómo funciona"
              title="¿Qué es la retención en la fuente?"
              icon={ListChecks}
              iconTint="#B8860B"
              className="cx-pop cx-d2"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  { step: '1', title: '¿Quién retiene?', desc: 'El agente de retención (comprador) cuando paga a un proveedor/prestador de servicios.' },
                  { step: '2', title: 'Tasas', desc: '3% sobre compras de bienes. 8% sobre pagos por servicios profesionales o técnicos.' },
                  { step: '3', title: 'Declarar y pagar', desc: 'Se presenta mensualmente antes del día 15 del mes siguiente y se paga la retención acumulada.' },
                ].map(({ step: n, title, desc }) => (
                  <div key={n} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-700 text-xs font-black tabular-nums text-white">
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

        {/* ── STEP 1: Bienes y Servicios ──────────────────────────────────── */}
        {step === 1 && (
          <SectionCard
            eyebrow="Sección I"
            title="Retenciones efectuadas"
            description="Lo que retuviste al pagarle a tus proveedores."
            icon={Coins}
            iconTint="#C2410C"
            className="cx-pop"
          >
            <Nota>
              Ingresa la <strong>base imponible</strong> (monto pagado al proveedor, sin incluir la retención).
              El sistema calcula la retención automáticamente.
            </Nota>

            <Casilla numero="101" label="Compras de bienes a proveedores locales" hint="retención 3%"
              value={form.bienes3} onChange={v => setField('bienes3', v)}>
              <AttachmentPanel declarationId={declId} lineKey="bienes3" lineLabel="Compras bienes (3%)"
                attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
            </Casilla>

            <Casilla numero="102" label="Pagos por servicios profesionales y técnicos" hint="retención 8%"
              value={form.servicios8} onChange={v => setField('servicios8', v)}>
              <AttachmentPanel declarationId={declId} lineKey="servicios8" lineLabel="Servicios (8%)"
                attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
            </Casilla>

            {/* Live preview */}
            {result && (
              <div className="mt-4 space-y-1.5 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-orange-700">
                  Cálculo automático de retenciones
                </p>
                {result.retencionBienes > 0 && (
                  <div className="flex justify-between text-sm text-orange-700">
                    <span>Retención bienes (3%)</span>
                    <MoneyPop value={result.retencionBienes} className="font-semibold" />
                  </div>
                )}
                {result.retencionServicios > 0 && (
                  <div className="flex justify-between text-sm text-orange-700">
                    <span>Retención servicios (8%)</span>
                    <MoneyPop value={result.retencionServicios} className="font-semibold" />
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-orange-200 pt-2 text-sm font-bold text-orange-800">
                  <span>Casilla 301 — Total retenciones</span>
                  <MoneyPop value={result.cas301_totalRetencion} className="text-base" />
                </div>
              </div>
            )}
          </SectionCard>
        )}

        {/* ── STEP 2: Créditos ────────────────────────────────────────────── */}
        {step === 2 && (
          <SectionCard
            eyebrow="Sección II"
            title="Créditos y certificados"
            description="Retenciones que tus clientes te aplicaron a ti."
            icon={Receipt}
            iconTint="#475569"
            className="cx-pop"
          >
            <Nota>
              Si tienes certificados de retención recibidos de tus clientes, puedes deducirlos del total a pagar.
            </Nota>
            <Casilla numero="302" label="Certificados de retención recibidos" hint="retenciones que te han aplicado"
              value={form.creditosCertificados} onChange={v => setField('creditosCertificados', v)}>
              <AttachmentPanel declarationId={declId} lineKey="creditosCertificados" lineLabel="Certificados retención"
                attachments={attachments} onAttachmentAdded={a => setAttachments(p => [...p, a])}
                onAttachmentRemoved={id => setAttachments(p => p.filter(a => a.id !== id))} disabled={isSubmitted} />
            </Casilla>
          </SectionCard>
        )}

        {/* ── STEP 3: Resumen ─────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <SectionCard
              eyebrow="Sección III"
              title="Resultado del período"
              description="Retenciones efectuadas menos los créditos que tenías."
              icon={Calculator}
              iconTint="#1B2E6E"
              className="cx-pop"
            >
              <Casilla numero="301" label="Total retenciones efectuadas" bold value={result?.cas301_totalRetencion ?? 0} readOnly />
              <Casilla numero="302" label="Certificados de retención recibidos" bold value={result?.cas302_creditosCertificados ?? 0} readOnly />
              <div className="mt-2 border-t border-gray-200 pt-3">
                <Casilla numero="303" label="Impuesto neto del período (301 − 302)" bold value={result?.cas303_impuestoNeto ?? 0} readOnly />
              </div>

              <div className="pt-3">
                {(result?.cas304_impuestoPagar ?? 0) > 0 ? (
                  <div className="cx-pop flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-5">
                    <div className="flex items-center gap-3">
                      <IconTile icon={Send} tint="#DC2626" size={44} />
                      <div>
                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-red-700">Casilla 304</p>
                        <p className="text-sm font-bold text-red-800">Retención a pagar a Hacienda</p>
                        <p className="text-xs text-red-600">Vence el día 15 del mes siguiente</p>
                      </div>
                    </div>
                    <MoneyPop value={result?.cas304_impuestoPagar ?? 0} className="text-2xl font-black text-red-700" />
                  </div>
                ) : (result?.cas305_saldoFavor ?? 0) > 0 ? (
                  <div className="cx-pop flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="flex items-center gap-3">
                      <IconTile icon={CheckCircle2} tint="#047857" size={44} />
                      <div>
                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-emerald-700">Casilla 305</p>
                        <p className="text-sm font-bold text-emerald-800">Saldo a favor</p>
                        <p className="text-xs text-emerald-600">Se imputa al siguiente período</p>
                      </div>
                    </div>
                    <MoneyPop value={result?.cas305_saldoFavor ?? 0} className="text-2xl font-black text-emerald-700" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                    <p className="text-sm text-gray-500">Ingresa los montos para ver el resultado</p>
                    <span className="font-mono text-2xl font-black tabular-nums text-gray-400">₡ 0.00</span>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Legal note */}
            <div className="rounded-card border border-orange-100 bg-orange-50 p-5 text-xs text-orange-700">
              <p className="flex items-center gap-1.5 font-bold">
                <HelpCircle className="h-4 w-4" /> Notas — Retención en la Fuente CR
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 leading-relaxed">
                <li>El agente retenedor descuenta la retención del pago al proveedor y la entrega a Hacienda.</li>
                <li>Tasa del <strong>3%</strong> sobre compras de bienes a personas físicas o jurídicas.</li>
                <li>Tasa del <strong>8%</strong> sobre honorarios y servicios profesionales o técnicos.</li>
                <li>Se declara mensualmente a más tardar el <strong>día 15</strong> del mes siguiente.</li>
                <li>El proveedor recibe un <strong>certificado de retención</strong> que puede usar como crédito en su D-101.</li>
                <li>Base legal: Art. 23 Ley N° 7092 (Ley del Impuesto sobre la Renta).</li>
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
        <PreSubmitModal type="D103_RETENCION" period={`${monthName} ${year}`} form={form}
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
              <div className="flex justify-between"><span>Formulario:</span><span className="font-bold">D-103</span></div>
              <div className="flex justify-between"><span>Período:</span><span>{monthName} {year}</span></div>
              <div className="flex justify-between"><span>Número de referencia:</span><span className="font-bold text-orange-700">{refNo}</span></div>
              <div className="mt-2 border-t border-gray-300 pt-2">
                <div className="flex justify-between"><span>Total retenciones:</span><span>₡ {fmtNum(result?.cas301_totalRetencion ?? 0)}</span></div>
                <div className="flex justify-between"><span>Créditos:</span><span>₡ {fmtNum(result?.cas302_creditosCertificados ?? 0)}</span></div>
              </div>
              <div className={cn(
                'mt-2 flex justify-between border-t border-gray-300 pt-2 font-black',
                (result?.cas304_impuestoPagar ?? 0) > 0 ? 'text-red-700' : 'text-emerald-700',
              )}>
                <span>{(result?.cas304_impuestoPagar ?? 0) > 0 ? 'A PAGAR:' : 'SALDO A FAVOR:'}</span>
                <span>₡ {fmtNum((result?.cas304_impuestoPagar ?? 0) > 0 ? result!.cas304_impuestoPagar : (result?.cas305_saldoFavor ?? 0))}</span>
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
                    await downloadDeclarationPdf(declId, `D-103-${period}.pdf`);
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

function toNumeric(form: D103Form) {
  return {
    bienes3:              parseFloat(form.bienes3              || '0') || 0,
    servicios8:           parseFloat(form.servicios8           || '0') || 0,
    creditosCertificados: parseFloat(form.creditosCertificados || '0') || 0,
  };
}
