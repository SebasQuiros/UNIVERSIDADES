'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  AlertTriangle, CheckCircle2, Info, Send,
  Save, HelpCircle, ChevronRight, ChevronLeft, FileText,
  ShoppingCart, Receipt, Calculator, BookOpen, Download, ListChecks,
} from 'lucide-react';
import Link from 'next/link';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button, buttonClasses } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/IconTile';
import { MoneyPop } from '@/components/ui/MoneyPop';
import { ArtInvoice } from '@/components/illustrations';
import { cn, fmtNum } from '@/lib/utils';
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

// Pasos del D-150 IVA (estructura oficial de TRIBU-CR + un paso inicial de datos).
const WIZARD_STEPS = [
  { id: 'info',           label: 'Información general',  shortLabel: 'Info' },
  { id: 'ventas',         label: 'Ventas generales',    shortLabel: 'Ventas' },
  { id: 'pago-diferido',  label: 'Pago diferido',       shortLabel: 'Pago dif.' },
  { id: 'compras',        label: 'Compras totales',     shortLabel: 'Compras' },
  { id: 'credito',        label: 'Crédito fiscal',      shortLabel: 'Crédito' },
  { id: 'calculo',        label: 'Cálculo del impuesto', shortLabel: 'Cálculo' },
];
const STEP_INFO = 0, STEP_VENTAS = 1, STEP_PAGO_DIFERIDO = 2, STEP_COMPRAS = 3, STEP_CREDITO = 4, STEP_CALCULO = 5;

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
          bold ? 'bg-blue-50 font-bold text-blue-700' : 'bg-gray-50 text-gray-700',
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
            className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-7 pr-3 text-right font-mono text-sm tabular-nums transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
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
      <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
      <span>{children}</span>
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
  // companyId: se pasa desde la Sesión de Aula GROUP para anclar la declaración a
  // la empresa del grupo (cierra la fuga del snapshot de auditoría). En el portal
  // general no viene → la declaración queda anclada solo al usuario (histórico).
  const companyId = params.get('companyId');

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
  // Pago diferido del impuesto por ventas a crédito (D-150 real). Educativo:
  // se registra la elección; no altera el cálculo simplificado del IVA neto.
  const [pagoDiferido, setPagoDiferido] = useState<'NO' | 'SI'>('NO');
  const [declType, setDeclType]   = useState<'Original' | 'Rectificativa'>('Original');
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
        if (fd.pagoDiferido === 'SI' || fd.pagoDiferido === 'NO') setPagoDiferido(fd.pagoDiferido);
        if (fd.declType === 'Rectificativa') setDeclType('Rectificativa');
        if (data.status === 'SUBMITTED') {
          setStep(STEP_CALCULO);
          setShowResult(true);
        }
      })
      .catch(() => toast.error('No se pudo cargar la declaración'));
  }, [existingId]);

  function setField(key: keyof D104Form, val: string) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  // Prellenado desde las facturas/compras REALES de la empresa del estudiante.
  // Usa el endpoint que agrega ventas y compras por tarifa (0/1/2/4/8/13%).
  // `companyId` viene por query (Sesión de Aula GROUP); si no, resolvemos la
  // empresa del estudiante (ejercicio individual) SOLO para el prellenado —
  // el anclaje de la declaración no cambia.
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(companyId);
  useEffect(() => {
    if (companyId) { setResolvedCompanyId(companyId); return; }
    api.get<any[]>('/api/v1/companies')
      .then(({ data }) => { if (Array.isArray(data) && data.length > 0) setResolvedCompanyId(data[0].id); })
      .catch(() => {});
  }, [companyId]);

  const [prefilling, setPrefilling] = useState(false);
  async function prefillFromCompany() {
    if (!resolvedCompanyId) { toast.error('No se encontró una empresa vinculada'); return; }
    if (status === 'SUBMITTED') return;
    const [y, m] = period.split('-').map((n) => parseInt(n, 10));
    setPrefilling(true);
    try {
      const { data } = await api.post<any>('/api/v1/tax-declarations/d104/calculate', {
        companyId: resolvedCompanyId, month: m, year: y,
      });
      const d = data?.debitosFiscales ?? {};
      const c = data?.creditosFiscales ?? {};
      const s = (v: any) => (v == null || Number(v) === 0 ? '' : String(v));
      setForm({
        ventas13: s(d.casilla101?.base), ventas8: s(d.casilla102?.base),
        ventas4:  s(d.casilla103?.base), ventas2: s(d.casilla104?.base),
        ventas1:  s(d.casilla105?.base), ventasExentas: s(d.casilla106?.base),
        compras13: s(c.casilla201?.base), compras8: s(c.casilla202?.base),
        compras4:  s(c.casilla203?.base), compras2: s(c.casilla204?.base),
        compras1:  s(c.casilla205?.base),
      });
      toast.success('Ventas y compras cargadas desde tu empresa');
    } catch (err) {
      toast.error('No se pudieron cargar los datos de la empresa');
    } finally {
      setPrefilling(false);
    }
  }

  async function autoSave() {
    if (status === 'SUBMITTED') return;
    const formData = { ...toNumeric(form), pagoDiferido };
    try {
      if (declId) {
        await api.patch(`/api/v1/tax-declarations/${declId}`, { formData });
      } else {
        const { data } = await api.post<any>('/api/v1/tax-declarations', {
          type: 'D104_IVA', period, formData, ...(companyId ? { companyId } : {}),
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
    const ventasFields = ['ventas13', 'ventas8', 'ventas4', 'ventas2', 'ventas1', 'ventasExentas'] as const;
    const hasNegative = [...ventasFields, 'compras13', 'compras8', 'compras4', 'compras2', 'compras1'].some(
      f => parseFloat((form as any)[f] || '0') < 0,
    );
    if (hasNegative) { toast.error('Los montos no pueden ser negativos'); return; }
    setSubmitting(true);
    try {
      let id = declId;
      const formData = { ...toNumeric(form), pagoDiferido };

      if (!id) {
        const { data } = await api.post<any>('/api/v1/tax-declarations', {
          type: 'D104_IVA', period, formData, ...(companyId ? { companyId } : {}),
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

  // Plazo de presentación del IVA en CR: del 1 al 15 del mes SIGUIENTE al período.
  const plazo = useMemo(() => {
    const y = parseInt(year, 10), m = parseInt(month, 10);
    if (!y || !m) return null;
    const inicio = new Date(y, m, 1);          // 1º del mes siguiente (m es 1-based → índice m = siguiente)
    const fin    = new Date(y, m, 15);          // día 15 del mes siguiente
    const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const fueraDePlazo = new Date() > fin && !isSubmitted;
    return { inicioLabel: fmt(inicio), finLabel: fmt(fin), fueraDePlazo };
  }, [year, month, isSubmitted]);

  // ── Validation helper ──────────────────────────────────────────────────────
  function getStepErrors(): string[] {
    const errs: string[] = [];
    if (step === STEP_CALCULO) {
      if (!perfil?.cedula) errs.push('Completa el perfil del contribuyente (cédula jurídica/física).');
      if (!perfil?.razonSocial) errs.push('Ingresa la razón social en el perfil.');
    }
    return errs;
  }

  const stepErrors = getStepErrors();

  return (
    <div className="flex-1 overflow-y-auto bg-[#FBF8F1]" ref={topRef}>
      {/* Encabezado TRIBU-CR unificado */}
      <TribuHeader
        code="D-150"
        title="Impuesto al valor agregado"
        accent="blue"
        status={status}
        refNo={refNo}
        declType={declType}
        periodLabel={`${monthName} ${year}`}
        perfil={perfil}
        description="El IVA que cobras en tus ventas es el débito fiscal; el que pagas en tus compras es el crédito fiscal. La diferencia entre ambos es lo que liquidas cada mes ante Hacienda."
        illustration={<ArtInvoice size={150} className="lp-drift" />}
      />

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[210px_minmax(0,1fr)_300px]">

        {/* ── Navegación lateral de pasos (estilo TRIBU) ── */}
        <nav className="hidden lg:block">
          <div className="sticky top-6 space-y-1">
            {WIZARD_STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { if (!isSubmitted || i <= step) setStep(i); }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors',
                  i === step ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-500 hover:bg-gray-100',
                )}
              >
                <span className={cn(
                  'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
                  i === step ? 'bg-blue-600 text-white' : i < step ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500',
                )}>
                  {i < step ? '✓' : i + 1}
                </span>
                <span className="leading-tight">{s.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* ── Columna central: contenido del paso ── */}
        <div className="min-w-0 space-y-6">

        {/* Wizard stepper (móvil) */}
        <div className="rounded-card border border-gray-200/70 bg-white p-4 shadow-card lg:hidden">
          <WizardStepper steps={WIZARD_STEPS} currentStep={step} />
        </div>

        {/* ── STEP 0: Información General ─────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-5">
            <PerfilTributario disabled={isSubmitted} onChange={p => setPerfil(p)} />

            <SectionCard
              eyebrow="Paso 1"
              title="Datos del período fiscal"
              description="El IVA se declara mes a mes. Elige el período que vas a liquidar."
              icon={FileText}
              iconTint="#2563EB"
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
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60 disabled:opacity-50"
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
                    Nombre del declarante
                  </label>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500">
                    Estudiante (práctica)
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

            {/* Info TRIBU flow */}
            <SectionCard
              eyebrow="Cómo funciona"
              title="Proceso del D-150 (IVA) en Hacienda"
              icon={ListChecks}
              iconTint="#B8860B"
              className="cx-pop cx-d2"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                {[
                  { step: '1', title: 'Emitir facturas', desc: 'Registra ventas y compras con facturas electrónicas en ATV.' },
                  { step: '2', title: 'Ingresar ventas', desc: 'Clasifica las ventas por tarifa de IVA aplicable.' },
                  { step: '3', title: 'Ingresar compras', desc: 'Registra el crédito fiscal de tus compras gravadas.' },
                  { step: '4', title: 'Presentar', desc: 'Paga el impuesto neto antes del día 15 del mes siguiente.' },
                ].map(({ step: n, title, desc }) => (
                  <div key={n} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-[#1B2E6E] text-xs font-black tabular-nums text-white">
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

        {/* ── STEP 1: Ventas ──────────────────────────────────────────────── */}
        {step === 1 && (
          <SectionCard
            eyebrow="Sección I"
            title="Ventas y débito fiscal"
            description="Lo que cobraste de IVA a tus clientes."
            icon={Receipt}
            iconTint="#2563EB"
            className="cx-pop"
          >
            <Nota>
              Ingresa la <strong>base imponible</strong> (monto sin IVA) de tus ventas por tarifa.
              El sistema calcula el IVA cobrado automáticamente.
            </Nota>

            {resolvedCompanyId && !isSubmitted && (
              <div className="mb-3 flex flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-relaxed text-blue-800">
                  <strong>Cargar desde mi empresa:</strong> trae automáticamente las ventas y compras
                  del período agrupadas por tarifa, a partir de las facturas y compras que registraste.
                </p>
                <Button type="button" variant="secondary" size="sm" loading={prefilling}
                  onClick={prefillFromCompany} className="flex-shrink-0">
                  <Download className="h-4 w-4" /> Cargar datos de mi empresa
                </Button>
              </div>
            )}

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

            {/* Débito fiscal */}
            <div className="mt-4 space-y-1 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Débito fiscal — IVA cobrado en ventas
              </div>
              {result?.ivaVentas && [
                { t: '13%', v: result.ivaVentas.t13 }, { t: '8%', v: result.ivaVentas.t8 },
                { t: '4%', v: result.ivaVentas.t4 },   { t: '2%', v: result.ivaVentas.t2 },
                { t: '1%', v: result.ivaVentas.t1 },
              ].filter(x => x.v > 0).map(({ t, v }) => (
                <div key={t} className="flex justify-between text-xs text-blue-700">
                  <span>IVA {t}</span>
                  <MoneyPop value={v} />
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-blue-200 pt-2 text-sm font-bold text-blue-800">
                <span>Casilla 301 — Total débito fiscal</span>
                <MoneyPop value={result?.cas301_debitoFiscal ?? 0} className="text-base" />
              </div>
            </div>
          </SectionCard>
        )}

        {/* ── STEP: Pago diferido ─────────────────────────────────────────── */}
        {step === STEP_PAGO_DIFERIDO && (
          <SectionCard
            eyebrow="Pago diferido"
            title="Pago diferido del impuesto por ventas a crédito"
            description="Del período a presentar o de períodos anteriores."
            icon={Calculator}
            iconTint="#7C3AED"
            className="cx-pop"
          >
            <p className="mb-4 text-sm leading-relaxed text-gray-600">
              Seleccioná “Sí lo utilizaré” si deseás acogerte al esquema del pago diferido del
              impuesto por ventas a crédito, o si requerís cancelar el impuesto de períodos
              anteriores bajo esta modalidad. De lo contrario, dejalo en “No lo utilizaré”.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 pt-4">
              <label className="text-sm font-medium text-gray-700">
                Quiero realizar el pago diferido del impuesto por ventas a crédito del período
              </label>
              <select
                value={pagoDiferido}
                onChange={(e) => setPagoDiferido(e.target.value as 'NO' | 'SI')}
                disabled={isSubmitted}
                className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60 disabled:opacity-60"
              >
                <option value="NO">No lo utilizaré</option>
                <option value="SI">Sí lo utilizaré</option>
              </select>
            </div>
          </SectionCard>
        )}

        {/* ── STEP: Compras totales ───────────────────────────────────────── */}
        {step === STEP_COMPRAS && (
          <SectionCard
            eyebrow="Sección II"
            title="Compras totales"
            description="Lo que pagaste de IVA a tus proveedores (crédito fiscal)."
            icon={ShoppingCart}
            iconTint="#047857"
            className="cx-pop"
          >
            <Nota>
              Ingresa la <strong>base imponible</strong> de tus compras gravadas.
              El IVA pagado se convierte en crédito fiscal.
            </Nota>

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
          </SectionCard>
        )}

        {/* ── STEP: Crédito fiscal ────────────────────────────────────────── */}
        {step === STEP_CREDITO && (
          <SectionCard
            eyebrow="Sección"
            title="Crédito fiscal"
            description="El IVA soportado en tus compras que podés deducir."
            icon={Receipt}
            iconTint="#047857"
            className="cx-pop"
          >
            <Nota>
              El crédito fiscal para el IVA es el impuesto soportado en las compras con derecho a
              crédito. La diferencia entre el impuesto soportado y el crédito fiscal es el importe
              de costo o gasto para utilidades.
            </Nota>

            {/* Desglose por tarifa */}
            <div className="mt-2 space-y-1 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> IVA pagado en compras, por tarifa
              </div>
              {result?.ivaCompras && [
                { t: '13%', v: result.ivaCompras.t13 }, { t: '8%', v: result.ivaCompras.t8 },
                { t: '4%', v: result.ivaCompras.t4 },   { t: '2%', v: result.ivaCompras.t2 },
                { t: '1%', v: result.ivaCompras.t1 },
              ].filter(x => x.v > 0).map(({ t, v }) => (
                <div key={t} className="flex justify-between text-xs text-emerald-700">
                  <span>Crédito {t}</span>
                  <MoneyPop value={v} />
                </div>
              ))}
              {(!result?.ivaCompras || result.cas302_creditoFiscal === 0) && (
                <p className="text-xs text-emerald-700/70">Sin crédito fiscal registrado en el período.</p>
              )}
            </div>

            {/* Totales del crédito fiscal (estilo D-150) */}
            <div className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white px-4">
              <div className="flex items-center justify-between py-3 text-sm text-gray-600">
                <span>Total importe de compras con IVA soportado</span>
                <MoneyPop value={result?.totalCompras ?? 0} className="font-medium text-gray-800" />
              </div>
              <div className="flex items-center justify-between py-3 text-sm text-gray-600">
                <span>Total impuesto soportado</span>
                <MoneyPop value={result?.cas302_creditoFiscal ?? 0} className="font-medium text-gray-800" />
              </div>
              <div className="flex items-center justify-between py-3 text-sm font-bold text-emerald-800">
                <span>Total crédito fiscal del período</span>
                <MoneyPop value={result?.cas302_creditoFiscal ?? 0} className="text-base" />
              </div>
            </div>
          </SectionCard>
        )}

        {/* ── STEP: Cálculo del impuesto ──────────────────────────────────── */}
        {step === STEP_CALCULO && (
          <div className="space-y-5">
            {/* Resultado del período */}
            <SectionCard
              eyebrow="Sección III"
              title="Resultado del período"
              description="Débito menos crédito: el impuesto que se liquida este mes."
              icon={Calculator}
              iconTint="#1B2E6E"
              className="cx-pop"
            >
              <Casilla numero="301" label="Débito fiscal (IVA cobrado en ventas)" bold
                value={result?.cas301_debitoFiscal ?? 0} readOnly />
              <Casilla numero="302" label="Crédito fiscal (IVA pagado en compras)" bold
                value={result?.cas302_creditoFiscal ?? 0} readOnly />
              <div className="mt-2 border-t border-gray-200 pt-3">
                <Casilla numero="303" label="Impuesto neto del período (301 − 302)" bold
                  value={result?.cas303_impuestoNeto ?? 0} readOnly />
              </div>

              <div className="pt-3">
                {(result?.cas304_impuestoPagar ?? 0) > 0 ? (
                  <div className="cx-pop flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-5">
                    <div className="flex items-center gap-3">
                      <IconTile icon={Send} tint="#DC2626" size={44} />
                      <div>
                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-red-700">Casilla 304</p>
                        <p className="text-sm font-bold text-red-800">Impuesto a pagar</p>
                        <p className="text-xs text-red-600">Monto a cancelar a Hacienda este período</p>
                      </div>
                    </div>
                    <MoneyPop value={result?.cas304_impuestoPagar ?? 0}
                      className="text-2xl font-black text-red-700" />
                  </div>
                ) : (result?.cas305_saldoFavor ?? 0) > 0 ? (
                  <div className="cx-pop flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="flex items-center gap-3">
                      <IconTile icon={CheckCircle2} tint="#047857" size={44} />
                      <div>
                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-emerald-700">Casilla 305</p>
                        <p className="text-sm font-bold text-emerald-800">Saldo a favor</p>
                        <p className="text-xs text-emerald-600">Crédito fiscal disponible para el siguiente período</p>
                      </div>
                    </div>
                    <MoneyPop value={result?.cas305_saldoFavor ?? 0}
                      className="text-2xl font-black text-emerald-700" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                    <p className="text-sm text-gray-500">Ingresa valores en pasos anteriores para ver el resultado</p>
                    <span className="font-mono text-2xl font-black tabular-nums text-gray-400">₡ 0.00</span>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Resumen de ventas / compras */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="cx-pop cx-d1 rounded-card border border-gray-200/70 bg-white p-5 shadow-card">
                <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">
                  Resumen de ventas
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total base ventas</span>
                    <MoneyPop value={result?.totalVentas ?? 0} className="text-gray-800" />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-blue-700">Débito fiscal total</span>
                    <MoneyPop value={result?.cas301_debitoFiscal ?? 0} className="font-bold text-blue-700" />
                  </div>
                </div>
              </div>

              <div className="cx-pop cx-d2 rounded-card border border-gray-200/70 bg-white p-5 shadow-card">
                <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">
                  Resumen de compras
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total base compras</span>
                    <MoneyPop value={result?.totalCompras ?? 0} className="text-gray-800" />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-emerald-700">Crédito fiscal total</span>
                    <MoneyPop value={result?.cas302_creditoFiscal ?? 0} className="font-bold text-emerald-700" />
                  </div>
                </div>
              </div>
            </div>

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

            {/* ── Asiento de liquidación D-104 ──────────────────────────────── */}
            {result && (result.cas301_debitoFiscal > 0 || result.cas302_creditoFiscal > 0) && (
              <div className="overflow-hidden rounded-card border border-gold-100 bg-gold-50">
                <button
                  type="button"
                  onClick={() => setShowJournalEntry(v => !v)}
                  className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-gold-100/60"
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-gold-900">
                    <BookOpen className="h-4 w-4" />
                    Generar asiento de liquidación del IVA (D-150)
                  </span>
                  <span className="text-xs font-semibold text-gold-700">
                    {showJournalEntry ? 'Ocultar' : 'Ver asiento sugerido'}
                  </span>
                </button>

                {showJournalEntry && (
                  <div className="cx-pop space-y-3 px-5 pb-5">
                    <p className="text-xs leading-relaxed text-gold-900">
                      Este es el asiento contable que corresponde registrar al cierre del período para liquidar el IVA.
                      Cópialo en el módulo de <strong>Diario Contable</strong>.
                    </p>
                    <div className="overflow-hidden rounded-xl border border-gold-100 bg-white">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gold-50">
                            <th className="px-3 py-2 text-left text-gold-900">Cuenta</th>
                            <th className="px-3 py-2 text-left text-gold-900">Descripción</th>
                            <th className="px-3 py-2 text-right text-gold-900">Débito</th>
                            <th className="px-3 py-2 text-right text-gold-900">Crédito</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {result.cas301_debitoFiscal > 0 && (
                            <tr>
                              <td className="px-3 py-2 font-mono font-semibold tabular-nums text-gray-800">2.1.02.01</td>
                              <td className="px-3 py-2 text-gray-700">IVA por Pagar</td>
                              <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-blue-700">
                                ₡ {fmtNum(result.cas301_debitoFiscal)}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-300">—</td>
                            </tr>
                          )}
                          {result.cas302_creditoFiscal > 0 && (
                            <tr>
                              <td className="px-3 py-2 font-mono font-semibold tabular-nums text-gray-800">1.1.04.01</td>
                              <td className="px-3 py-2 text-gray-700">IVA Crédito Fiscal</td>
                              <td className="px-3 py-2 text-right text-gray-300">—</td>
                              <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-emerald-700">
                                ₡ {fmtNum(result.cas302_creditoFiscal)}
                              </td>
                            </tr>
                          )}
                          {result.cas304_impuestoPagar > 0 && (
                            <tr className="bg-red-50">
                              <td className="px-3 py-2 font-mono font-semibold tabular-nums text-red-800">2.1.02.03</td>
                              <td className="px-3 py-2 text-red-700">IVA a Pagar Hacienda</td>
                              <td className="px-3 py-2 text-right text-gray-300">—</td>
                              <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-red-700">
                                ₡ {fmtNum(result.cas304_impuestoPagar)}
                              </td>
                            </tr>
                          )}
                          {result.cas305_saldoFavor > 0 && (
                            <tr className="bg-emerald-50">
                              <td className="px-3 py-2 font-mono font-semibold tabular-nums text-emerald-800">1.1.04.02</td>
                              <td className="px-3 py-2 text-emerald-700">IVA Saldo a Favor (crédito arrastrado)</td>
                              <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-emerald-700">
                                ₡ {fmtNum(result.cas305_saldoFavor)}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-300">—</td>
                            </tr>
                          )}
                          {/* Totals row */}
                          <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                            <td colSpan={2} className="px-3 py-2 text-right text-gray-700">Totales</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-blue-800">
                              ₡ {fmtNum(
                                result.cas301_debitoFiscal +
                                (result.cas305_saldoFavor > 0 ? result.cas305_saldoFavor : 0)
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-800">
                              ₡ {fmtNum(
                                result.cas302_creditoFiscal +
                                (result.cas304_impuestoPagar > 0 ? result.cas304_impuestoPagar : 0)
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-start gap-1.5 text-xs text-gold-700">
                      <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                      <span>
                        Fecha del asiento: último día del período fiscal declarado.
                        Descripción sugerida: <em>Liquidación IVA (D-150) {monthName} {year}</em>.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Legal note */}
            <div className="rounded-card border border-blue-100 bg-blue-50 p-5 text-xs text-blue-700">
              <p className="flex items-center gap-1.5 font-bold">
                <HelpCircle className="h-4 w-4" /> Notas sobre el IVA en Costa Rica
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 leading-relaxed">
                <li>La declaración del IVA (formulario D-150) se presenta mensualmente, a más tardar el día 15 del mes siguiente.</li>
                <li>Las tasas vigentes son: 13% (general), 8% (medicina privada y seguros), 4% (boletos y espectáculos), 2% (canasta básica tributaria) y 1% (medicamentos e insumos agropecuarios).</li>
                <li>Las exportaciones y algunos servicios educativos están exentos (0%).</li>
                <li>Si el crédito fiscal supera el débito, el saldo se arrastra al período siguiente o se puede solicitar devolución.</li>
                <li>Base legal: Ley N° 6826 (Ley del IVA) y sus reformas.</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── Navigation buttons ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 pb-10">
          {/* Left: Back */}
          {step > 0 && !isSubmitted ? (
            <Button variant="secondary" onClick={goPrev} className="cx-press">
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
          ) : (
            <div />
          )}

          {/* Right: Save draft + Next / Submit */}
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
        </div>{/* fin columna central */}

        {/* ── Panel Resumen (estilo TRIBU D-150) ── */}
        <aside className="h-fit rounded-card border border-gray-200/70 bg-white p-5 shadow-card lg:sticky lg:top-6">
          <p className="mb-3 text-base font-bold text-gray-900">Resumen</p>
          <dl className="space-y-2.5 text-sm">
            <div>
              <dt className="text-xs text-gray-400">Identificación</dt>
              <dd className="font-medium text-gray-800">{perfil?.cedula || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Nombre</dt>
              <dd className="font-medium text-gray-800">{perfil?.razonSocial || 'Estudiante (práctica)'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Período</dt>
              <dd className="font-medium text-gray-800">{monthName} {year}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Declaración</dt>
              <dd className="font-medium text-gray-800">150 - Impuesto al valor agregado</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Tipo de declaración</dt>
              <dd className="font-medium text-gray-800">Autoliquidativa {declType}</dd>
            </div>
            {plazo && (
              <div className="flex items-end justify-between gap-2">
                <div>
                  <dt className="text-xs text-gray-400">Fecha inicio</dt>
                  <dd className="font-medium tabular-nums text-gray-800">{plazo.inicioLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Fecha fin</dt>
                  <dd className="font-medium tabular-nums text-gray-800">{plazo.finLabel}</dd>
                </div>
                {plazo.fueraDePlazo && (
                  <span className="pb-0.5 text-xs font-semibold text-red-600">Fuera de plazo</span>
                )}
              </div>
            )}
          </dl>

          <div className="my-4 border-t border-dashed border-gray-200" />

          <dl className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Total monto del impuesto</dt>
              <dd><MoneyPop value={result?.cas301_debitoFiscal ?? 0} className="font-semibold text-gray-800" /></dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Total crédito fiscal</dt>
              <dd><MoneyPop value={result?.cas302_creditoFiscal ?? 0} className="font-semibold text-gray-800" /></dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-600">Total gasto para utilidades</dt>
              <dd><MoneyPop value={Math.max(0, (result?.totalCompras ?? 0) - (result?.cas302_creditoFiscal ?? 0))} className="font-semibold text-gray-800" /></dd>
            </div>
          </dl>

          <p className="mt-4 rounded-lg bg-gold-50 px-3 py-2 text-[0.68rem] leading-relaxed text-gold-900">
            Simulación educativa · no es una presentación real ante Hacienda.
          </p>
        </aside>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-csq-dark/70 p-4 backdrop-blur-sm">
          <div className="cx-pop w-full max-w-md rounded-card bg-white p-6 shadow-soft">
            <div className="mb-5 text-center">
              <div className="cx-tada mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-black tracking-tight text-gray-900">¡Declaración presentada!</h3>
              <p className="mt-1 text-sm text-gray-500">Simulación educativa completada</p>
            </div>

            {/* TRIBU-style receipt */}
            <div className="mb-5 space-y-1 rounded-2xl border border-gray-200 bg-gray-50 p-4 font-mono text-xs tabular-nums">
              <div className="mb-3 text-center text-sm font-bold text-gray-700">MINISTERIO DE HACIENDA — TRIBU CR</div>
              <div className="flex justify-between"><span>Formulario:</span><span className="font-bold">D-150 (IVA)</span></div>
              <div className="flex justify-between"><span>Período:</span><span>{monthName} {year}</span></div>
              <div className="flex justify-between"><span>Número de referencia:</span><span className="font-bold text-blue-700">{refNo}</span></div>
              <div className="mt-2 flex justify-between border-t border-gray-300 pt-2">
                <span className="font-bold">Débito fiscal:</span><span>₡ {fmtNum(result?.cas301_debitoFiscal ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold">Crédito fiscal:</span><span>₡ {fmtNum(result?.cas302_creditoFiscal ?? 0)}</span>
              </div>
              <div className={cn(
                'mt-2 flex justify-between border-t border-gray-300 pt-2 font-black',
                (result?.cas304_impuestoPagar ?? 0) > 0 ? 'text-red-700' : 'text-emerald-700',
              )}>
                <span>{(result?.cas304_impuestoPagar ?? 0) > 0 ? 'IMPUESTO A PAGAR:' : 'SALDO A FAVOR:'}</span>
                <span>₡ {fmtNum(
                  (result?.cas304_impuestoPagar ?? 0) > 0
                    ? result!.cas304_impuestoPagar
                    : (result?.cas305_saldoFavor ?? 0)
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
                    await downloadDeclarationPdf(declId, `D-104-${period}.pdf`);
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

function toNumeric(form: D104Form) {
  const out: Record<string, number> = {};
  (Object.keys(form) as (keyof D104Form)[]).forEach(k => {
    out[k] = parseFloat(form[k] || '0') || 0;
  });
  return out;
}
