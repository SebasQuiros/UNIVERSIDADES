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
        <span className={`w-40 text-right text-sm font-mono px-3 py-1 rounded-lg ${bold ? 'bg-orange-50 text-orange-700 font-bold' : 'bg-gray-50 text-gray-700'}`}>
          ₡ {displayVal}
        </span>
      ) : (
        <div className="relative w-40">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">₡</span>
          <input
            type="number" min="0" step="0.01"
            value={value as string}
            onChange={e => onChange?.(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
            placeholder="0.00"
          />
        </div>
      )}
      {children}
    </div>
  );
}

function SectionHeader({ title, color = 'orange' }: { title: string; color?: string }) {
  const colors: Record<string, string> = {
    orange: 'bg-orange-600 text-white',
    gray:   'bg-gray-700 text-white',
    blue:   'bg-blue-700 text-white',
  };
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-t-xl ${colors[color] ?? colors.orange}`}>
      <span className="text-sm font-semibold tracking-wide">{title}</span>
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
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function goPrev() {
    if (step > 0) { setStep(s => s - 1); topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
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
    <div className="min-h-screen bg-gray-100" ref={topRef}>
      {/* Encabezado TRIBU-CR unificado */}
      <TribuHeader
        code="D-103"
        title="Retención en la Fuente"
        accent="orange"
        status={status}
        refNo={refNo}
        periodLabel={`${monthName} ${year}`}
        perfil={perfil}
      />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Wizard */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <WizardStepper steps={WIZARD_STEPS} currentStep={step} />
        </div>

        {/* ── STEP 0: Información General ─────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-4">
            <PerfilTributario disabled={isSubmitted} onChange={p => setPerfil(p)} />

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-600" /> Datos del período fiscal
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Período</label>
                  <select value={period} onChange={e => setPeriod(e.target.value)} disabled={isSubmitted}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300">
                    {Array.from({ length: 24 }, (_, i) => {
                      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                      return <option key={val} value={val}>{MONTHS[d.getMonth()]} {d.getFullYear()}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Formulario</label>
                  <div className="border border-orange-200 bg-orange-50 rounded-lg px-3 py-2 text-sm font-semibold text-orange-700">
                    D-103 — Retención en la Fuente
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
                  <span>Número de referencia simulado: <span className="font-mono font-bold text-gray-800">{refNo}</span></span>
                </div>
              )}
            </div>

            {/* Explanation */}
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
              <p className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> ¿Qué es la retención en la fuente?
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { step: '1', title: '¿Quién retiene?', desc: 'El agente de retención (comprador) cuando paga a un proveedor/prestador de servicios.' },
                  { step: '2', title: 'Tasas', desc: '3% sobre compras de bienes. 8% sobre pagos por servicios profesionales o técnicos.' },
                  { step: '3', title: 'Declarar y pagar', desc: 'Se presenta mensualmente antes del día 15 del mes siguiente y se paga la retención acumulada.' },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">{step}</div>
                    <div>
                      <p className="text-xs font-bold text-orange-800">{title}</p>
                      <p className="text-xs text-orange-600 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 1: Bienes y Servicios ──────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <SectionHeader title="SECCIÓN I — RETENCIONES EFECTUADAS" color="orange" />
            <div className="px-5 py-2">
              <div className="text-xs text-gray-500 py-2 flex items-center gap-1.5 border-b border-gray-100 mb-2">
                <Info className="w-3.5 h-3.5" />
                Ingresa la <strong>base imponible</strong> (monto pagado al proveedor, sin incluir la retención). El sistema calcula la retención automáticamente.
              </div>

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
                <div className="mt-3 pt-3 border-t border-orange-100 bg-orange-50 rounded-xl px-3 py-3 space-y-1.5">
                  <p className="text-xs font-bold text-orange-700 mb-2">CÁLCULO AUTOMÁTICO DE RETENCIONES</p>
                  {result.retencionBienes > 0 && (
                    <div className="flex justify-between text-sm text-orange-700">
                      <span>Retención bienes (3%)</span>
                      <span className="font-mono font-semibold">₡ {fmtNum(result.retencionBienes)}</span>
                    </div>
                  )}
                  {result.retencionServicios > 0 && (
                    <div className="flex justify-between text-sm text-orange-700">
                      <span>Retención servicios (8%)</span>
                      <span className="font-mono font-semibold">₡ {fmtNum(result.retencionServicios)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-orange-800 pt-1 border-t border-orange-200">
                    <span>Casilla 301 — Total retenciones</span>
                    <span className="font-mono">₡ {fmtNum(result.cas301_totalRetencion)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2: Créditos ────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <SectionHeader title="SECCIÓN II — CRÉDITOS Y CERTIFICADOS" color="gray" />
            <div className="px-5 py-2">
              <div className="text-xs text-gray-500 py-2 flex items-center gap-1.5 border-b border-gray-100 mb-2">
                <Info className="w-3.5 h-3.5" />
                Si tienes certificados de retención recibidos de tus clientes, puedes deducirlos del total a pagar.
              </div>
              <Casilla numero="302" label="Certificados de retención recibidos" hint="retenciones que te han aplicado"
                value={form.creditosCertificados} onChange={v => setField('creditosCertificados', v)}>
                <AttachmentPanel declarationId={declId} lineKey="creditosCertificados" lineLabel="Certificados retención"
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
              <SectionHeader title="SECCIÓN III — RESULTADO DEL PERÍODO" color="gray" />
              <div className="px-5 py-4 space-y-1">
                <Casilla numero="301" label="Total retenciones efectuadas" bold value={result?.cas301_totalRetencion ?? 0} readOnly />
                <Casilla numero="302" label="Certificados de retención recibidos" bold value={result?.cas302_creditosCertificados ?? 0} readOnly />
                <div className="pt-3 border-t border-gray-200 mt-2">
                  <Casilla numero="303" label="Impuesto neto del período (301 − 302)" bold value={result?.cas303_impuestoNeto ?? 0} readOnly />
                </div>

                <div className="pt-2">
                  {(result?.cas304_impuestoPagar ?? 0) > 0 ? (
                    <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl mt-2">
                      <div>
                        <p className="text-xs font-bold text-red-700 uppercase tracking-wide">Casilla 304</p>
                        <p className="text-sm font-bold text-red-800">Retención a pagar a Hacienda</p>
                        <p className="text-xs text-red-600">Vence el día 15 del mes siguiente</p>
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
                        <p className="text-xs text-emerald-600">Se imputa al siguiente período</p>
                      </div>
                      <span className="text-2xl font-black text-emerald-700 font-mono">
                        ₡ {fmtNum(result?.cas305_saldoFavor ?? 0)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl mt-2">
                      <p className="text-sm text-gray-500">Ingresa los montos para ver el resultado</p>
                      <span className="text-2xl font-black text-gray-400 font-mono">₡ 0.00</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Legal note */}
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-xs text-orange-700 space-y-1">
              <p className="font-bold flex items-center gap-1.5"><HelpCircle className="w-4 h-4" /> Notas — Retención en la Fuente CR</p>
              <ul className="list-disc list-inside space-y-0.5 text-orange-600 mt-1">
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
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors">
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === WIZARD_STEPS.length - 1 && !isSubmitted && (
              <button onClick={() => setShowConfirm(true)}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors">
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
        <PreSubmitModal type={'D103_RETENCION' as any} period={`${monthName} ${year}`} form={form}
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
              <div className="flex justify-between"><span>Formulario:</span><span className="font-bold">D-103</span></div>
              <div className="flex justify-between"><span>Período:</span><span>{monthName} {year}</span></div>
              <div className="flex justify-between"><span>Número de referencia:</span><span className="font-bold text-orange-700">{refNo}</span></div>
              <div className="border-t border-gray-300 mt-2 pt-2">
                <div className="flex justify-between"><span>Total retenciones:</span><span>₡ {fmtNum(result?.cas301_totalRetencion ?? 0)}</span></div>
                <div className="flex justify-between"><span>Créditos:</span><span>₡ {fmtNum(result?.cas302_creditosCertificados ?? 0)}</span></div>
              </div>
              <div className={`flex justify-between border-t border-gray-300 pt-2 mt-2 font-black ${(result?.cas304_impuestoPagar ?? 0) > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                <span>{(result?.cas304_impuestoPagar ?? 0) > 0 ? 'A PAGAR:' : 'SALDO A FAVOR:'}</span>
                <span>₡ {fmtNum((result?.cas304_impuestoPagar ?? 0) > 0 ? result!.cas304_impuestoPagar : (result?.cas305_saldoFavor ?? 0))}</span>
              </div>
              <div className="text-center text-gray-400 text-xs mt-3 pt-2 border-t border-gray-200">** SIMULACIÓN EDUCATIVA — NO TIENE VALIDEZ LEGAL **</div>
            </div>
            <div className="space-y-2">
              <button
                onClick={async () => {
                  if (!declId) return;
                  try {
                    await downloadDeclarationPdf(declId, `D-103-${period}.pdf`);
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

function toNumeric(form: D103Form) {
  return {
    bienes3:              parseFloat(form.bienes3              || '0') || 0,
    servicios8:           parseFloat(form.servicios8           || '0') || 0,
    creditosCertificados: parseFloat(form.creditosCertificados || '0') || 0,
  };
}

function fmtNum(n: number) {
  return Number(n).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
