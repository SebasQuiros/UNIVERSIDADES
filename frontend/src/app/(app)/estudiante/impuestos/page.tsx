'use client';

import { useState, useEffect } from 'react';
import type { ElementType, ReactNode } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Receipt, FileText, AlertTriangle, CheckCircle2,
  Clock, Trash2, ChevronRight, Calendar, ListChecks,
  Building2, Info, TrendingDown, TrendingUp, X, Edit2, Download,
  ClipboardCheck, FileSpreadsheet,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { IconTile } from '@/components/ui/IconTile';
import { Skeleton } from '@/components/ui/Skeleton';
import { ArtFiscalCalendar, SceneEmptyBox } from '@/components/illustrations';
import { cn } from '@/lib/utils';
import { usePerfilTributario } from './_components/PerfilTributario';
import { downloadDeclarationPdf } from './_components/downloadPdf';

// Textura de puntos de la banda hero (lenguaje visual compartido).
const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
};

function DeleteDeclarationModal({
  onConfirm, onClose, loading,
}: {
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-csq-dark/60 backdrop-blur-sm" onClick={onClose} />
      <div className="cx-pop relative w-full max-w-sm rounded-card bg-white p-6 shadow-soft">
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="cx-press absolute right-4 top-4 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="mb-4 flex items-center gap-3">
          <IconTile icon={AlertTriangle} tint="#DC2626" size={44} />
          <h3 className="font-bold tracking-tight text-gray-900">Eliminar declaración</h3>
        </div>
        <p className="mb-2 text-sm text-gray-600">
          ¿Estás seguro de que deseas eliminar esta declaración de práctica?
        </p>
        <p className="mb-6 text-xs text-red-500">Esta acción no se puede deshacer.</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading} className="flex-1 cx-press">
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading} className="flex-1 cx-press">
            {loading ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface TaxDeclaration {
  id: string;
  type: 'D104_IVA' | 'D101_RENTA' | 'D103_RETENCION' | 'D115_DIVIDENDOS';
  period: string;
  status: 'DRAFT' | 'SUBMITTED';
  referenceNo: string | null;
  submittedAt: string | null;
  createdAt: string;
  result: Record<string, any>;
}

const TYPE_LABEL: Record<string, string> = {
  D104_IVA:        'D-104 — Declaración de IVA',
  D101_RENTA:      'D-101 — Declaración de Renta',
  D103_RETENCION:  'D-103 — Retención en la Fuente',
  D115_DIVIDENDOS: 'D-115 — Dividendos y Participaciones',
};

const TYPE_ROUTE: Record<string, string> = {
  D104_IVA:        'd104',
  D101_RENTA:      'd101',
  D103_RETENCION:  'd103',
  D115_DIVIDENDOS: 'd115',
};

const TYPE_TINT: Record<string, string> = {
  D104_IVA:        '#2563EB',
  D101_RENTA:      '#047857',
  D103_RETENCION:  '#C2410C',
  D115_DIVIDENDOS: '#475569',
};

function fmtNum(n: number) {
  return Number(n).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getD104DueDate(): { text: string; urgent: boolean; overdue: boolean } {
  const now = new Date();
  const dueYear  = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const dueMonth = (now.getMonth() + 1) % 12; // next month index (0-based)
  const due = new Date(dueYear, dueMonth, 15);
  const diffMs   = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const MONTHS   = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Set','Oct','Nov','Dic'];
  const text = `15 ${MONTHS[dueMonth]} ${dueYear}`;
  return { text, urgent: diffDays <= 5 && diffDays >= 0, overdue: diffDays < 0 };
}

function getD101DueDate(): { text: string } {
  // D-101 vence el 15 de diciembre de cada año
  const now = new Date();
  const year = now.getMonth() >= 11 && now.getDate() > 15 ? now.getFullYear() + 1 : now.getFullYear();
  return { text: `15 Dic ${year}` };
}

// ── Tarjeta de formulario disponible ──────────────────────────────────────────
function FormularioCard({
  code, route, icon, tint, subtitle, description, chips, chipClass, accentClass, badge,
}: {
  code: string;
  route: string;
  icon: ElementType;
  tint: string;
  subtitle: string;
  description: string;
  chips: string[];
  chipClass: string;
  accentClass: string;
  badge: ReactNode;
}) {
  return (
    <Link
      href={`/estudiante/impuestos/${route}`}
      className="cx-lift cx-hop-parent group block rounded-card border border-gray-200/70 bg-white p-5 shadow-card transition-colors hover:border-gray-300/70 hover:shadow-card-hover"
    >
      <div className="flex items-start justify-between">
        <IconTile icon={icon} tint={tint} size={48} className="cx-hop" />
        <ChevronRight className="mt-2 h-5 w-5 text-gray-300 transition-colors group-hover:text-gray-500" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-extrabold tracking-tight text-gray-900">{code}</h3>
        {badge}
      </div>
      <p className={cn('mt-0.5 text-sm font-semibold', accentClass)}>{subtitle}</p>
      <p className="mt-2 text-xs leading-relaxed text-gray-500">{description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips.map(t => (
          <span key={t} className={cn('rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', chipClass)}>
            {t}
          </span>
        ))}
      </div>
    </Link>
  );
}

// ── Encabezado de sección (IconTile + eyebrow dorado) ─────────────────────────
function SectionHeading({ icon: Icon, eyebrow, title }: { icon: ElementType; eyebrow: string; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <IconTile icon={Icon} tint="#1B2E6E" size={40} />
      <div>
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">{eyebrow}</p>
        <h3 className="text-base font-bold tracking-tight text-gray-900">{title}</h3>
      </div>
    </div>
  );
}

export default function ImpuestosPage() {
  const [declarations, setDeclarations] = useState<TaxDeclaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);
  const { perfil } = usePerfilTributario();

  useEffect(() => {
    api.get<TaxDeclaration[]>('/api/v1/tax-declarations')
      .then(({ data }) => setDeclarations(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/tax-declarations/${toDelete}`);
      setDeclarations(prev => prev.filter(d => d.id !== toDelete));
      toast.success('Declaración eliminada');
      setToDelete(null);
    } catch {
      toast.error('No se pudo eliminar');
    } finally {
      setDeleting(false);
    }
  }

  const d104Due = getD104DueDate();
  const d101Due = getD101DueDate();

  const presentadas = declarations.filter(d => d.status === 'SUBMITTED').length;
  const borradores  = declarations.filter(d => d.status === 'DRAFT').length;

  return (
    <div className="flex-1 overflow-y-auto bg-[#F4F6F8] p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-8">

        {toDelete && (
          <DeleteDeclarationModal
            onConfirm={handleDelete}
            onClose={() => setToDelete(null)}
            loading={deleting}
          />
        )}

        {/* ── Cabecera ── */}
        <PageHeader
          eyebrow="Tributación · TRIBU-CR"
          title="Declaraciones tributarias"
          subtitle="Prepara, revisa y presenta tus declaraciones como en el sistema del Ministerio de Hacienda — sin riesgo, con fines académicos."
          icon={Receipt}
        />

        {/* ── Aviso legal de simulación ── */}
        <div className="flex items-start gap-3 rounded-card border border-gold-100 bg-gold-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-gold-700" />
          <div className="text-sm text-gold-900">
            <span className="font-bold">SIMULACIÓN EDUCATIVA</span> — Este módulo simula el sistema{' '}
            <span className="font-semibold">TRIBU CR</span> del Ministerio de Hacienda de Costa Rica con fines académicos.{' '}
            <strong>No constituye una declaración tributaria real.</strong> Tasas y tramos: período fiscal 2025-2026.
          </div>
        </div>

        {/* ── Banda hero ── */}
        <div className="lp-in relative overflow-hidden rounded-card bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid shadow-soft">
          <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
          <div aria-hidden className="pointer-events-none absolute bottom-0 right-4 hidden opacity-95 lg:block">
            <ArtFiscalCalendar size={190} className="lp-drift" />
          </div>
          <div className="relative p-6 lg:p-8">
            <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-gold-500">
              Tu calendario fiscal
            </p>
            <h2 className="text-xl font-extrabold tracking-tight text-white lg:text-2xl">
              Del libro contable a la declaración
            </h2>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-blue-200/80">
              El IVA se liquida cada mes; la renta, una vez al año. Aquí practicas todo el ciclo:
              registrar, respaldar con facturas y presentar.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-lg">
              {loading ? (
                <>
                  <div className="h-28 animate-pulse rounded-card border border-white/10 bg-white/5" />
                  <div className="h-28 animate-pulse rounded-card border border-white/10 bg-white/5" />
                </>
              ) : (
                <>
                  <StatCard
                    variant="dark"
                    label="Presentadas"
                    value={String(presentadas)}
                    icon={CheckCircle2}
                    hint="Simulaciones completadas"
                  />
                  <StatCard
                    variant="dark"
                    label="En borrador"
                    value={String(borradores)}
                    icon={Clock}
                    hint="Pendientes de presentar"
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Perfil del contribuyente (si existe) ── */}
        {perfil && (
          <div className="flex items-center gap-3 rounded-card border border-gray-200/70 bg-white px-4 py-3 shadow-card">
            <IconTile icon={Building2} tint="#1B2E6E" size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold uppercase text-gray-900">
                {perfil.razonSocial || 'Razón social no registrada'}
              </p>
              <p className="truncate text-xs text-gray-500">
                <span className="font-mono tabular-nums">{perfil.cedula || 'Sin cédula'}</span> ·{' '}
                <span className="font-medium text-blue-700">{perfil.actividadCodigo} – {perfil.actividadNombre}</span>
              </p>
            </div>
            <Badge variant={perfil.tipoPersona === 'JURIDICA' ? 'blue' : 'slate'}>
              {perfil.tipoPersona === 'JURIDICA' ? 'Jurídica' : 'Física'}
            </Badge>
          </div>
        )}

        {/* ── Calendario de obligaciones ── */}
        <SectionCard
          eyebrow="Fechas límite"
          title="Próximas obligaciones tributarias"
          description="Presentar tarde genera intereses y multas. Anticípate a la fecha."
          icon={Calendar}
          iconTint="#B8860B"
          flushBody
        >
          <div className="grid grid-cols-1 divide-y divide-gray-100 md:grid-cols-3 md:divide-x md:divide-y-0">
            {/* D-104 */}
            <div className={cn('px-6 py-4', (d104Due.urgent || d104Due.overdue) && 'bg-red-50/60')}>
              <div className="mb-1.5 flex items-center gap-2">
                <IconTile icon={FileText} tint="#2563EB" size={32} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800">D-104 — IVA mensual</p>
                  <p className={cn(
                    'text-xs font-bold tabular-nums',
                    d104Due.urgent || d104Due.overdue ? 'text-red-600' : 'text-gray-500',
                  )}>
                    Vence: {d104Due.text}
                  </p>
                </div>
              </div>
              {(d104Due.urgent || d104Due.overdue) && (
                <Badge variant="red" className="mb-1.5 cx-wiggle-loop">
                  <AlertTriangle className="h-3 w-3" />
                  {d104Due.overdue ? 'Vencida' : 'Próxima a vencer'}
                </Badge>
              )}
              <p className="text-xs leading-relaxed text-gray-500">
                Presentar a más tardar el día 15 del mes siguiente al período declarado.
              </p>
            </div>

            {/* D-101 */}
            <div className="px-6 py-4">
              <div className="mb-1.5 flex items-center gap-2">
                <IconTile icon={FileText} tint="#047857" size={32} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800">D-101 — Renta anual</p>
                  <p className="text-xs font-bold tabular-nums text-gray-500">Vence: {d101Due.text}</p>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-gray-500">
                Período fiscal: 1 oct – 30 set. Declaración anual de personas jurídicas.
              </p>
            </div>

            {/* Facturas electrónicas */}
            <div className="bg-gray-50/70 px-6 py-4">
              <div className="mb-1.5 flex items-center gap-2">
                <IconTile icon={Info} tint="#64748B" size={32} />
                <p className="text-xs font-bold text-gray-700">Facturas electrónicas</p>
              </div>
              <p className="text-xs leading-relaxed text-gray-500">
                Toda declaración debe respaldarse con facturas electrónicas registradas en ATV
                (Administración Tributaria Virtual).
              </p>
            </div>
          </div>
        </SectionCard>

        {/* ── Flujo real de TRIBU CR ── */}
        <SectionCard
          eyebrow="Cómo funciona"
          title="El proceso real en Hacienda"
          description="Cuatro pasos que se repiten cada período fiscal."
          icon={ListChecks}
          iconTint="#2563EB"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {[
              { step: '1', title: 'Emitir facturas', desc: 'Emite y recibe facturas electrónicas en el sistema de Hacienda (ATV). Cada transacción queda registrada.' },
              { step: '2', title: 'Registrar en libro', desc: 'Contabiliza ventas y compras en los libros contables. El IVA cobrado es débito; el IVA pagado es crédito.' },
              { step: '3', title: 'Completar D-104', desc: 'Ingresa los totales por tarifa. El sistema calcula automáticamente el impuesto neto o saldo a favor.' },
              { step: '4', title: 'Presentar y pagar', desc: 'Presenta antes del día 15. Si hay impuesto a pagar, cancela en el banco o directamente en ATV.' },
            ].map(({ step, title, desc }, i) => (
              <div key={step} className={cn('cx-pop flex items-start gap-2.5', `cx-d${i + 1}`)}>
                <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-[#1B2E6E] text-xs font-black tabular-nums text-white">
                  {step}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-800">{title}</p>
                  <p className="text-xs leading-relaxed text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── Formularios disponibles ── */}
        <section>
          <SectionHeading icon={FileSpreadsheet} eyebrow="Formularios" title="Declaraciones disponibles" />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormularioCard
              code="D-104"
              route="d104"
              icon={FileText}
              tint="#2563EB"
              accentClass="text-blue-700"
              chipClass="bg-blue-50 text-blue-700"
              subtitle="Declaración IVA mensual"
              description="Impuesto al Valor Agregado. Ventas gravadas por tarifa (13%, 8%, 4%, 2%, 1%), crédito fiscal de compras e impuesto neto del período."
              chips={['13%', '8%', '4%', '2%', '1%']}
              badge={
                <Badge variant={d104Due.urgent ? 'red' : 'blue'}>
                  {d104Due.urgent ? '¡Vence pronto!' : `Vence ${d104Due.text}`}
                </Badge>
              }
            />

            <FormularioCard
              code="D-101"
              route="d101"
              icon={FileText}
              tint="#047857"
              accentClass="text-emerald-700"
              chipClass="bg-emerald-50 text-emerald-700"
              subtitle="Declaración Renta anual — personas jurídicas"
              description="Impuesto sobre la Renta. Calcula renta neta imponible, aplica tramos progresivos para PYMES o tarifa plana 30% para empresas grandes."
              chips={['5%', '10%', '15%', '20%', '25%', '30%']}
              badge={<Badge variant="emerald">Vence {d101Due.text}</Badge>}
            />

            <FormularioCard
              code="D-103"
              route="d103"
              icon={FileText}
              tint="#C2410C"
              accentClass="text-orange-700"
              chipClass="bg-orange-50 text-orange-700"
              subtitle="Retención en la fuente"
              description="Retención del 3% sobre compras de bienes y 8% sobre pagos de servicios profesionales a proveedores locales."
              chips={['3% bienes', '8% servicios']}
              badge={<Badge variant="amber">Mensual — día 15</Badge>}
            />

            <FormularioCard
              code="D-115"
              route="d115"
              icon={FileText}
              tint="#475569"
              accentClass="text-slate-600"
              chipClass="bg-slate-100 text-slate-600"
              subtitle="Dividendos y participaciones"
              description="Impuesto sobre dividendos, participaciones de utilidades y rentas de capital mobiliario. Tarifa única del 15%."
              chips={['15% dividendos', '15% participaciones', '15% capital']}
              badge={<Badge variant="slate">Anual — 15 Dic</Badge>}
            />
          </div>
        </section>

        {/* ── Historial ── */}
        <SectionCard
          eyebrow="Historial"
          title="Mis declaraciones de práctica"
          description="Borradores y declaraciones presentadas en la simulación."
          icon={ClipboardCheck}
          iconTint="#1B2E6E"
          flushBody
          bodyClassName="px-6 lg:px-7 py-5"
        >
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 rounded-2xl border border-gray-100 p-4">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              ))}
            </div>
          ) : declarations.length === 0 ? (
            <EmptyState
              illustration={<SceneEmptyBox size={200} className="lp-drift" />}
              title="Aún no has completado ninguna declaración"
              description="Elige un formulario arriba (D-104, D-101, D-103 o D-115) y presenta tu primera declaración de práctica."
              action={
                <Link
                  href="/estudiante/impuestos/d104"
                  className={buttonClasses({ variant: 'primary', className: 'cx-press' })}
                >
                  <FileText className="h-4 w-4" /> Empezar con la D-104
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {declarations.map((d, i) => {
                const pagar =
                  d.type === 'D104_IVA'        ? (d.result?.cas304_impuestoPagar ?? 0) :
                  d.type === 'D101_RENTA'      ? (d.result?.cas602_impuestoPagar ?? 0) :
                  d.type === 'D103_RETENCION'  ? (d.result?.cas304_impuestoPagar ?? 0) :
                  d.type === 'D115_DIVIDENDOS' ? (d.result?.cas305_impuestoPagar ?? 0) : 0;
                const favor =
                  d.type === 'D104_IVA'        ? (d.result?.cas305_saldoFavor ?? 0) :
                  d.type === 'D101_RENTA'      ? (d.result?.cas603_saldoFavor ?? 0) :
                  d.type === 'D103_RETENCION'  ? (d.result?.cas305_saldoFavor ?? 0) :
                  d.type === 'D115_DIVIDENDOS' ? (d.result?.cas306_saldoFavor ?? 0) : 0;

                return (
                  <div
                    key={d.id}
                    className={cn(
                      'cx-pop cx-hop-parent flex items-center gap-4 rounded-2xl border border-gray-200/70 bg-white p-4 shadow-card transition-colors hover:border-gray-300/70',
                      i < 6 && `cx-d${i + 1}`,
                    )}
                  >
                    <IconTile
                      icon={FileText}
                      tint={TYPE_TINT[d.type] ?? '#64748B'}
                      size={42}
                      className="cx-hop"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold tracking-tight text-gray-900">{TYPE_LABEL[d.type]}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" /> Período: <span className="tabular-nums">{d.period}</span>
                        </span>
                        {d.referenceNo && (
                          <span className="font-mono text-xs tabular-nums text-gray-400">Ref: {d.referenceNo}</span>
                        )}
                      </div>
                      {d.status === 'SUBMITTED' && (pagar > 0 || favor > 0) && (
                        <div className="mt-1 flex items-center gap-1.5">
                          {pagar > 0 ? (
                            <>
                              <TrendingDown className="h-3 w-3 text-red-500" />
                              <span className="font-mono text-xs font-semibold tabular-nums text-red-600">
                                A pagar: ₡{fmtNum(pagar)}
                              </span>
                            </>
                          ) : (
                            <>
                              <TrendingUp className="h-3 w-3 text-emerald-500" />
                              <span className="font-mono text-xs font-semibold tabular-nums text-emerald-600">
                                Saldo a favor: ₡{fmtNum(favor)}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-2">
                      {d.status === 'SUBMITTED' ? (
                        <Badge variant="emerald">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Presentada
                        </Badge>
                      ) : (
                        <Badge variant="amber">
                          <Clock className="h-3.5 w-3.5" /> Borrador
                        </Badge>
                      )}

                      {d.status === 'DRAFT' ? (
                        <Link
                          href={`/estudiante/impuestos/${TYPE_ROUTE[d.type] ?? 'd104'}?id=${d.id}`}
                          className="cx-press flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                        >
                          <Edit2 className="h-3 w-3" /> Editar
                        </Link>
                      ) : (
                        <>
                          <button
                            onClick={async () => {
                              try {
                                await downloadDeclarationPdf(d.id, `${d.type}-${d.period}.pdf`);
                              } catch { toast.error('No se pudo descargar el PDF'); }
                            }}
                            className="cx-press flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                            title="Descargar comprobante PDF"
                          >
                            <Download className="h-3 w-3" /> PDF
                          </button>
                          <Link
                            href={`/estudiante/impuestos/${TYPE_ROUTE[d.type] ?? 'd104'}?id=${d.id}`}
                            className="text-xs text-gray-500 transition-colors hover:text-gray-700 hover:underline"
                          >
                            Ver comprobante
                          </Link>
                        </>
                      )}

                      <button
                        onClick={() => setToDelete(d.id)}
                        aria-label="Eliminar declaración"
                        className="cx-press rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
