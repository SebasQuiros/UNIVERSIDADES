'use client';

// ── FASE 1 — Andamiaje de maqueta ────────────────────────────────────────────
// El corazón de "Sesión de Aula": el expediente de auditoría entre pares.
// Todo el estado (fichas gastadas, evidencia pedida, hallazgos, opinión) vive
// en `useState` local — no hay backend todavía. En fase 2 esto se vuelve un
// módulo real (presupuesto persistido por sesión, evidencia servida por el
// backend, hallazgos y opinión guardados para que el profesor los califique).
//
// Lenguaje: nunca se afirma "fraude" ni que alguien "hizo trampa" — un
// auditor reporta diferencias y hallazgos; probar intención (fraude) requiere
// más de lo que este ejercicio puede establecer (doctrina NIA 240).

import { useMemo, useState } from 'react';
import type { ElementType } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { cn, fmtNum } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { IconTile } from '@/components/ui/IconTile';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SceneEmptyBox } from '@/components/illustrations';
import {
  ArrowLeft, Ticket, Wallet, ChevronDown, ChevronRight, Send, Trash2,
  CheckCircle2, AlertTriangle, ClipboardList, ScrollText, ShieldCheck,
  ShieldAlert, ShieldX, ShieldQuestion, FileSearch, Scale, Receipt, Info,
  Search, Gavel,
} from 'lucide-react';
import {
  MY_AUDIT_ASSIGNMENT, AUDIT_PACKAGE, EVIDENCE_TYPES, FINDING_COST,
  SEVERITY_LABEL, OPINION_OPTIONS, getEvidenceContent,
  type EvidenceType, type EvidenceTypeDef, type EvidenceContent,
  type FindingSeverity, type AuditOpinionType, type AccountLine,
  type StatementSection, type CashFlowLine,
} from '../../_mock';

// ── Helpers de formato ──────────────────────────────────────────────────────
function moneyAcct(n: number): string {
  const formatted = `₡ ${fmtNum(Math.abs(n))}`;
  return n < 0 ? `(${formatted})` : formatted;
}

// ── Estado local ─────────────────────────────────────────────────────────────
interface RequestedEvidence {
  id: string;
  type: EvidenceType;
  optionId: string;
  label: string;
  cost: number;
  content: EvidenceContent;
}

interface Finding {
  id: string;
  accountRef: string;
  description: string;
  severity: FindingSeverity;
  citedEvidenceIds: string[];
  cost: number;
}

type DocTab = 'balance' | 'resultados' | 'flujo' | 'notas' | 'declaraciones';

const DOC_TABS: { key: DocTab; label: string; icon: ElementType }[] = [
  { key: 'balance',       label: 'Balance General',      icon: Scale },
  { key: 'resultados',    label: 'Estado de Resultados', icon: Receipt },
  { key: 'flujo',         label: 'Flujo de Efectivo',    icon: Wallet },
  { key: 'notas',         label: 'Notas',                icon: ScrollText },
  { key: 'declaraciones', label: 'Declaraciones',        icon: FileSearch },
];

const OPINION_ICON: Record<AuditOpinionType, ElementType> = {
  LIMPIA: ShieldCheck,
  SALVEDADES: ShieldAlert,
  ADVERSA: ShieldX,
  ABSTENCION: ShieldQuestion,
};

export default function ExpedienteAuditoriaPage() {
  const { id } = useParams<{ id: string }>();
  const a = MY_AUDIT_ASSIGNMENT;

  const [docTab, setDocTab] = useState<DocTab>('balance');
  const [requested, setRequested] = useState<RequestedEvidence[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedOption, setSelectedOption] = useState<Record<EvidenceType, string>>(
    () => Object.fromEntries(EVIDENCE_TYPES.map((e) => [e.type, e.options[0]?.id ?? ''])) as Record<EvidenceType, string>,
  );
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null);

  // Formulario de hallazgo
  const [fAccount, setFAccount] = useState('');
  const [fDescription, setFDescription] = useState('');
  const [fSeverity, setFSeverity] = useState<FindingSeverity>('MEDIA');
  const [fCited, setFCited] = useState<string[]>([]);

  // Opinión
  const [opinionType, setOpinionType] = useState<AuditOpinionType | null>(null);
  const [rationale, setRationale] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const spent = useMemo(
    () => requested.reduce((s, r) => s + r.cost, 0) + findings.reduce((s, f) => s + f.cost, 0),
    [requested, findings],
  );
  const remaining = a.budgetTotal - spent;

  function requestEvidence(ev: EvidenceTypeDef) {
    if (submitted) return;
    const optionId = selectedOption[ev.type];
    const option = ev.options.find((o) => o.id === optionId);
    if (!option) return;
    if (requested.some((r) => r.type === ev.type && r.optionId === optionId)) {
      toast.error('Ya tenés esa evidencia en el expediente.');
      return;
    }
    if (remaining < ev.cost) {
      toast.error('No te alcanzan las fichas para esta evidencia.');
      return;
    }
    const content = getEvidenceContent(ev.type, optionId);
    if (!content) return;
    const item: RequestedEvidence = {
      id: `${ev.type}:${optionId}`,
      type: ev.type,
      optionId,
      label: `${ev.label} — ${option.label}`,
      cost: ev.cost,
      content,
    };
    setRequested((r) => [...r, item]);
    setExpandedEvidence(item.id);
    toast.success('Evidencia agregada al expediente.');
  }

  function removeEvidence(evidenceId: string) {
    if (submitted) return;
    if (findings.some((f) => f.citedEvidenceIds.includes(evidenceId))) {
      toast.error('Primero quitá el hallazgo que cita esta evidencia.');
      return;
    }
    setRequested((r) => r.filter((x) => x.id !== evidenceId));
  }

  function toggleCite(evidenceId: string) {
    setFCited((c) => (c.includes(evidenceId) ? c.filter((x) => x !== evidenceId) : [...c, evidenceId]));
  }

  function submitFinding() {
    if (submitted) return;
    if (!fAccount.trim()) { toast.error('Indicá a qué cuenta o partida se refiere el hallazgo.'); return; }
    if (!fDescription.trim()) { toast.error('Describí la diferencia observada.'); return; }
    if (fCited.length === 0) { toast.error('Todo hallazgo necesita al menos una evidencia citada — sin evidencia, no cuenta.'); return; }
    if (remaining < FINDING_COST) { toast.error('No te alcanzan las fichas para reportar este hallazgo.'); return; }
    const finding: Finding = {
      id: `finding-${Date.now()}`,
      accountRef: fAccount.trim(),
      description: fDescription.trim(),
      severity: fSeverity,
      citedEvidenceIds: [...fCited],
      cost: FINDING_COST,
    };
    setFindings((f) => [...f, finding]);
    setFAccount(''); setFDescription(''); setFSeverity('MEDIA'); setFCited([]);
    toast.success('Hallazgo agregado al expediente.');
  }

  function removeFinding(findingId: string) {
    if (submitted) return;
    setFindings((f) => f.filter((x) => x.id !== findingId));
  }

  function submitOpinion() {
    if (submitted) return;
    if (!opinionType) { toast.error('Elegí un tipo de opinión.'); return; }
    if (!rationale.trim()) { toast.error('Justificá tu opinión en un par de líneas.'); return; }
    if (opinionType === 'LIMPIA' && findings.length > 0) {
      toast('Reportaste hallazgos pero elegís una opinión limpia — revisá tu criterio antes de emitirla.');
    }
    setSubmitted(true);
    toast.success('Opinión emitida. Expediente cerrado.');
  }

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#FBF8F1]">
      <Link
        href={`/estudiante/sesion/${id ?? ''}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a mi sesión
      </Link>

      <PageHeader
        eyebrow="Expediente de auditoría"
        title={a.auditeeCompanyName}
        subtitle={`${a.periodLabel} · comparativo contra ${a.priorPeriodLabel} · no ves los libros vivos, solo lo que la empresa entrega`}
        icon={FileSearch}
        className="mb-5"
      />

      {/* Presupuesto de auditoría: siempre visible, duele al bajar */}
      <div
        className={cn(
          'sticky top-0 z-20 -mx-6 lg:-mx-8 mb-6 px-6 lg:px-8 py-3 border-b backdrop-blur transition-colors',
          submitted
            ? 'bg-emerald-50/95 border-emerald-200'
            : remaining <= 2
              ? 'bg-red-50/95 border-red-200'
              : remaining <= 5
                ? 'bg-amber-50/95 border-amber-200'
                : 'bg-white/95 border-gray-200',
        )}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <Ticket className={cn('w-5 h-5 flex-shrink-0', submitted ? 'text-emerald-600' : remaining <= 2 ? 'text-red-600' : remaining <= 5 ? 'text-amber-600' : 'text-gold-700')} />
          <p className="text-sm font-bold text-gray-900 flex-shrink-0">Presupuesto de auditoría</p>
          <div className="flex-1 min-w-[140px] max-w-xs h-2.5 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(0, (remaining / a.budgetTotal) * 100)}%`,
                background: submitted ? '#059669' : remaining <= 2 ? '#DC2626' : remaining <= 5 ? '#D97706' : '#B8860B',
              }}
            />
          </div>
          <p className="text-sm font-mono tabular-nums font-bold flex-shrink-0">
            <span className={submitted ? 'text-emerald-700' : remaining <= 2 ? 'text-red-700' : remaining <= 5 ? 'text-amber-700' : 'text-gray-900'}>{remaining}</span>
            <span className="text-gray-400"> / {a.budgetTotal} fichas</span>
          </p>
          {!submitted && remaining <= 2 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-700 flex-shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" /> Casi sin fichas — priorizá
            </span>
          )}
          {submitted && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 flex-shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" /> Auditoría cerrada
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {/* Paquete financiero congelado */}
        <SectionCard
          icon={FileSearch}
          iconTint="#1B2E6E"
          eyebrow="Paquete congelado"
          title={`Estados financieros — ${AUDIT_PACKAGE.companyName}`}
          description="Cédula jurídica 3-101-789456. El mismo paquete que recibiría un auditor externo: no incluye acceso a los libros en vivo."
          flushBody
          className="lp-in"
        >
          <div className="flex gap-2 flex-wrap px-6 lg:px-7 pt-5">
            {DOC_TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setDocTab(t.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors',
                    docTab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  )}
                >
                  <Icon className="w-4 h-4" /> {t.label}
                </button>
              );
            })}
          </div>
          <div className="px-6 lg:px-7 py-5">
            {docTab === 'balance' && <BalanceSheetView />}
            {docTab === 'resultados' && <IncomeStatementView />}
            {docTab === 'flujo' && <CashFlowView />}
            {docTab === 'notas' && <NotesView />}
            {docTab === 'declaraciones' && <TaxFilingsView />}
          </div>
        </SectionCard>

        {/* Pedir evidencia */}
        <SectionCard
          icon={Search}
          iconTint="#B8860B"
          eyebrow="Gasta fichas"
          title="Pedir evidencia"
          description="Elegí con cuidado: cada solicitud resta del presupuesto y no se puede deshacer una vez que la citás en un hallazgo."
          className="lp-in lp-in-d1"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {EVIDENCE_TYPES.map((ev) => {
              const Icon = ev.icon;
              const optId = selectedOption[ev.type];
              const already = requested.some((r) => r.type === ev.type && r.optionId === optId);
              const affordable = remaining >= ev.cost;
              return (
                <div key={ev.type} className="rounded-xl border border-gray-100 p-4 flex flex-col gap-2.5">
                  <div className="flex items-start gap-3">
                    <IconTile icon={Icon} tint="#1B2E6E" size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{ev.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{ev.description}</p>
                    </div>
                    <Badge variant="gold" className="flex-shrink-0"><Ticket className="w-3 h-3" /> {ev.cost}</Badge>
                  </div>
                  {ev.options.length > 1 ? (
                    <select
                      value={optId}
                      onChange={(e) => setSelectedOption((s) => ({ ...s, [ev.type]: e.target.value }))}
                      disabled={submitted}
                      className="w-full text-sm rounded-lg border border-gray-200 px-2.5 py-1.5 outline-none focus:border-blue-500"
                    >
                      {ev.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  ) : (
                    <p className="text-xs text-gray-400">{ev.options[0]?.label}</p>
                  )}
                  <Button
                    size="sm"
                    variant={already ? 'secondary' : 'outline'}
                    disabled={submitted || already || !affordable}
                    onClick={() => requestEvidence(ev)}
                    className="self-start"
                  >
                    {already
                      ? <><CheckCircle2 className="w-3.5 h-3.5" /> Ya la pediste</>
                      : !affordable
                        ? 'No te alcanza'
                        : 'Pedir evidencia'}
                  </Button>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Evidencia obtenida */}
        <SectionCard
          icon={ClipboardList}
          iconTint="#2563EB"
          eyebrow={`${requested.length} obtenida${requested.length !== 1 ? 's' : ''}`}
          title="Evidencia obtenida"
          flushBody
          className="lp-in lp-in-d2"
        >
          {requested.length === 0 ? (
            <div className="px-6 lg:px-7 py-8">
              <EmptyState
                illustration={<SceneEmptyBox size={140} />}
                title="Todavía no pediste evidencia"
                description="Lo que pidas aparece acá. Solo la evidencia que aparece acá se puede citar en un hallazgo."
              />
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {requested.map((r) => {
                const isOpen = expandedEvidence === r.id;
                return (
                  <div key={r.id} className="px-6 lg:px-7 py-3.5">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setExpandedEvidence((x) => (x === r.id ? null : r.id))}
                        className="flex-1 flex items-center gap-2.5 text-left min-w-0"
                      >
                        {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                        <span className="flex-1 min-w-0 text-sm font-semibold text-gray-800 truncate">{r.label}</span>
                      </button>
                      <Badge variant="gold" className="flex-shrink-0"><Ticket className="w-3 h-3" /> {r.cost}</Badge>
                      {!submitted && (
                        <button
                          onClick={() => removeEvidence(r.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                          title="Quitar evidencia"
                          type="button"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {isOpen && <div className="mt-3 pl-6"><EvidenceContentView content={r.content} /></div>}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Reportar hallazgo */}
        <SectionCard
          icon={Gavel}
          iconTint="#B8860B"
          eyebrow={`Cuesta ${FINDING_COST} fichas`}
          title="Reportar un hallazgo"
          description="Un hallazgo es una diferencia o dificultad concreta — no una acusación. Tiene que citar al menos una evidencia obtenida."
          className="lp-in lp-in-d3"
        >
          {requested.length === 0 ? (
            <p className="text-sm text-gray-500">Primero pedí evidencia arriba: sin evidencia citada, un hallazgo no cuenta.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-gray-600 mb-1 block">Cuenta o partida</span>
                <input
                  value={fAccount}
                  onChange={(e) => setFAccount(e.target.value)}
                  disabled={submitted}
                  placeholder="Ej. Cuentas por Cobrar Comerciales — Constructora Rivas Hermanos S.A."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition disabled:opacity-60"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-600 mb-1 block">Diferencia observada</span>
                <textarea
                  value={fDescription}
                  onChange={(e) => setFDescription(e.target.value)}
                  disabled={submitted}
                  rows={3}
                  placeholder="Describí el hecho concreto: qué dice un documento y qué dice otro. Evitá afirmar fraude o intención — reportá la diferencia."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition resize-none disabled:opacity-60"
                />
              </label>
              <div>
                <span className="text-xs font-semibold text-gray-600 mb-1.5 block">Severidad</span>
                <div className="flex gap-2">
                  {(Object.keys(SEVERITY_LABEL) as FindingSeverity[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={submitted}
                      onClick={() => setFSeverity(s)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                        fSeverity === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300',
                      )}
                    >
                      {SEVERITY_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-600 mb-1.5 block">Evidencia citada (obligatoria)</span>
                <div className="flex flex-col gap-1.5">
                  {requested.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fCited.includes(r.id)}
                        disabled={submitted}
                        onChange={() => toggleCite(r.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={submitFinding} disabled={submitted} variant="outline" className="self-start">
                <Send className="w-4 h-4" /> Reportar hallazgo ({FINDING_COST} fichas)
              </Button>
            </div>
          )}

          {findings.length > 0 && (
            <div className="mt-6 pt-5 border-t border-gray-100 flex flex-col gap-3">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                {findings.length} hallazgo{findings.length !== 1 ? 's' : ''} reportado{findings.length !== 1 ? 's' : ''}
              </p>
              {findings.map((f) => (
                <div key={f.id} className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{f.accountRef}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{f.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge variant={f.severity === 'ALTA' ? 'red' : f.severity === 'MEDIA' ? 'amber' : 'slate'}>{SEVERITY_LABEL[f.severity]}</Badge>
                      {!submitted && (
                        <button onClick={() => removeFinding(f.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Quitar hallazgo" type="button">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {f.citedEvidenceIds.map((evId) => {
                      const ev = requested.find((r) => r.id === evId);
                      return ev ? (
                        <span key={evId} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-white border border-amber-200 text-amber-800">
                          <ClipboardList className="w-3 h-3" /> {ev.label}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Emitir opinión */}
        <SectionCard icon={ScrollText} iconTint="#1B2E6E" eyebrow="Conclusión formal" title="Emitir opinión" className="lp-in lp-in-d4">
          {submitted ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <p className="text-sm font-bold text-emerald-900">
                  Auditoría cerrada — {OPINION_OPTIONS.find((o) => o.type === opinionType)?.label}
                </p>
              </div>
              <p className="text-sm text-emerald-800">{rationale}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {OPINION_OPTIONS.map((o) => {
                  const Icon = OPINION_ICON[o.type];
                  const active = opinionType === o.type;
                  return (
                    <button
                      key={o.type}
                      type="button"
                      onClick={() => setOpinionType(o.type)}
                      className={cn(
                        'text-left rounded-xl border p-3.5 transition-all',
                        active ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-gray-200 hover:border-blue-300',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-blue-600' : 'text-gray-400')} />
                        <span className="text-sm font-bold text-gray-900">{o.label}</span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{o.description}</p>
                    </button>
                  );
                })}
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-gray-600 mb-1 block">Justificación de tu opinión</span>
                <textarea
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  rows={3}
                  placeholder="Resumí, en un par de líneas, por qué llegaste a esta opinión — apoyate en los hallazgos que reportaste."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition resize-none"
                />
              </label>
              <Button onClick={submitOpinion} variant="gold" className="self-start">
                <Gavel className="w-4 h-4" /> Emitir opinión y cerrar auditoría
              </Button>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ── Vistas del paquete financiero congelado ─────────────────────────────────

function ColumnHeader() {
  return (
    <div className="grid grid-cols-[1fr_7rem_7rem] gap-2 px-3.5 text-[11px] font-semibold text-gray-400">
      <span />
      <span className="text-right">Actual</span>
      <span className="text-right">Anterior</span>
    </div>
  );
}

function LineRow({ line }: { line: AccountLine }) {
  return (
    <div className="grid grid-cols-[1fr_7rem_7rem] gap-2 items-center px-3.5 py-1.5 text-sm">
      <span className="text-gray-600 truncate">
        {line.code && <span className="font-mono text-xs text-gray-400 mr-1.5">{line.code}</span>}
        {line.name}
      </span>
      <span className="text-right font-mono tabular-nums text-gray-900">{moneyAcct(line.current)}</span>
      <span className="text-right font-mono tabular-nums text-gray-400 text-xs">{moneyAcct(line.prior)}</span>
    </div>
  );
}

function TotalLine({ label, current, prior, tone }: { label: string; current: number; prior: number; tone?: 'emerald' | 'blue' | 'slate' }) {
  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_7rem_7rem] gap-2 items-center px-3.5 py-2 rounded-xl font-bold text-sm',
        tone === 'emerald' ? 'bg-emerald-50 text-emerald-900' : tone === 'blue' ? 'bg-blue-50 text-blue-900' : 'bg-gray-50 text-gray-800',
      )}
    >
      <span>{label}</span>
      <span className="text-right font-mono tabular-nums">{moneyAcct(current)}</span>
      <span className="text-right font-mono tabular-nums text-xs opacity-60">{moneyAcct(prior)}</span>
    </div>
  );
}

function SectionTable({ sections }: { sections: StatementSection[] }) {
  return (
    <div className="space-y-3">
      {sections.map((sec) => (
        <div key={sec.title} className="rounded-xl border border-gray-100 overflow-hidden">
          <p className="bg-gray-50 px-3.5 py-1.5 text-xs font-semibold text-gray-500 border-b border-gray-100">{sec.title}</p>
          <div className="divide-y divide-gray-50">
            {sec.lines.map((l) => <LineRow key={l.code} line={l} />)}
          </div>
          <div className="border-t border-gray-100">
            <TotalLine label={`Total ${sec.title.toLowerCase()}`} current={sec.totalCurrent} prior={sec.totalPrior} />
          </div>
        </div>
      ))}
    </div>
  );
}

function BalanceSheetView() {
  const bs = AUDIT_PACKAGE.balanceSheet;
  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-400">Al {bs.asOfCurrent} · comparativo al {bs.asOfPrior}</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700 mb-2">Activos</p>
          <ColumnHeader />
          <div className="mt-1.5"><SectionTable sections={bs.assetSections} /></div>
          <TotalLine label="Total activos" current={bs.totalAssetsCurrent} prior={bs.totalAssetsPrior} tone="blue" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-red-600 mb-2">Pasivos</p>
          <ColumnHeader />
          <div className="mt-1.5"><SectionTable sections={bs.liabilitySections} /></div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-600 mt-4 mb-2">Patrimonio</p>
          <SectionTable sections={bs.equitySections} />
          <TotalLine label="Total pasivo + patrimonio" current={bs.totalLiabEquityCurrent} prior={bs.totalLiabEquityPrior} tone="slate" />
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> El balance cuadra en ambos períodos: Activo = Pasivo + Patrimonio.
      </div>
    </div>
  );
}

function IncomeStatementView() {
  const inc = AUDIT_PACKAGE.incomeStatement;
  const opIncomeCurrent = inc.totalIncomeCurrent - inc.totalExpensesCurrent;
  const opIncomePrior = inc.totalIncomePrior - inc.totalExpensesPrior;
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">Período {inc.periodCurrent} · comparativo {inc.periodPrior}</p>
      <ColumnHeader />
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <p className="bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 border-b border-emerald-100">Ingresos</p>
        <div className="divide-y divide-gray-50">{inc.income.map((l) => <LineRow key={l.code} line={l} />)}</div>
      </div>
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <p className="bg-red-50 px-3.5 py-1.5 text-xs font-semibold text-red-600 border-b border-red-100">Gastos de operación</p>
        <div className="divide-y divide-gray-50">{inc.expenses.map((l) => <LineRow key={l.code} line={l} />)}</div>
        <div className="border-t border-gray-100">
          <TotalLine label="Total gastos de operación" current={inc.totalExpensesCurrent} prior={inc.totalExpensesPrior} />
        </div>
      </div>
      <TotalLine label="Utilidad de operación" current={opIncomeCurrent} prior={opIncomePrior} tone="blue" />
      <LineRow line={{ code: '', name: 'Gastos financieros', current: inc.financialExpenseCurrent, prior: inc.financialExpensePrior }} />
      <LineRow line={{ code: '', name: 'Impuesto sobre la renta (estimado)', current: inc.incomeTaxCurrent, prior: inc.incomeTaxPrior }} />
      <TotalLine label="Utilidad neta" current={inc.netIncomeCurrent} prior={inc.netIncomePrior} tone="emerald" />
    </div>
  );
}

function CashFlowBlock({ title, lines, total }: { title: string; lines: CashFlowLine[]; total: number }) {
  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <p className="bg-gray-50 px-3.5 py-1.5 text-xs font-semibold text-gray-500 border-b border-gray-100">{title}</p>
      <div className="divide-y divide-gray-50">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_7rem_7rem] gap-2 items-center px-3.5 py-1.5 text-sm">
            <span className="text-gray-600">{l.label}</span>
            <span className="text-right font-mono tabular-nums text-gray-900">{moneyAcct(l.amount)}</span>
            <span />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_7rem_7rem] gap-2 items-center px-3.5 py-2 bg-gray-50/70 font-bold text-sm">
        <span className="text-gray-800">Efectivo neto — {title.toLowerCase()}</span>
        <span className="text-right font-mono tabular-nums text-gray-900">{moneyAcct(total)}</span>
        <span />
      </div>
    </div>
  );
}

function CashFlowView() {
  const cf = AUDIT_PACKAGE.cashFlow;
  return (
    <div className="space-y-4">
      <ColumnHeader />
      <CashFlowBlock title="Actividades de operación" lines={cf.operating} total={cf.operatingTotal} />
      <CashFlowBlock title="Actividades de inversión" lines={cf.investing} total={cf.investingTotal} />
      <CashFlowBlock title="Actividades de financiamiento" lines={cf.financing} total={cf.financingTotal} />
      <div className="grid grid-cols-[1fr_7rem_7rem] gap-2 items-center px-3.5 py-2 rounded-xl bg-blue-50 text-blue-900 font-bold text-sm">
        <span>Variación neta de efectivo</span>
        <span className="text-right font-mono tabular-nums">{moneyAcct(cf.netChange)}</span>
        <span />
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-gray-50 px-3.5 py-2.5">
          <p className="text-xs text-gray-400">Efectivo al inicio</p>
          <p className="font-mono font-bold tabular-nums text-gray-800">{moneyAcct(cf.cashBeginning)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3.5 py-2.5">
          <p className="text-xs text-gray-400">Efectivo al cierre</p>
          <p className="font-mono font-bold tabular-nums text-gray-800">{moneyAcct(cf.cashEnding)}</p>
        </div>
      </div>
    </div>
  );
}

function NotesView() {
  return (
    <div className="space-y-3">
      {AUDIT_PACKAGE.notes.map((n) => (
        <div key={n.id} className="rounded-xl border border-gray-100 p-4">
          <p className="text-sm font-bold text-gray-900 mb-1">{n.title}</p>
          <p className="text-sm text-gray-600 leading-relaxed">{n.body}</p>
        </div>
      ))}
    </div>
  );
}

function TaxFilingsView() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {AUDIT_PACKAGE.taxFilings.map((t) => (
        <div key={t.id} className="rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="blue">{t.form}</Badge>
            <Badge variant={t.status === 'PRESENTADA' ? 'emerald' : 'amber'}>{t.status === 'PRESENTADA' ? 'Presentada' : 'Pendiente'}</Badge>
          </div>
          <p className="text-sm font-semibold text-gray-900">{t.label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t.period}</p>
          <p className="text-xs text-gray-400">Presentada: {t.filedAt}</p>
          <p className="mt-2 text-base font-mono font-bold tabular-nums text-gray-900">{moneyAcct(t.amount)}</p>
        </div>
      ))}
    </div>
  );
}

// ── Contenido de evidencia (renderer por tipo) ──────────────────────────────

function EvidenceNote({ note }: { note: string }) {
  return (
    <div className="flex items-start gap-2 px-3.5 py-2.5 bg-blue-50/60 border-t border-blue-100">
      <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-blue-800 leading-relaxed">{note}</p>
    </div>
  );
}

function Field({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={cn('text-gray-900', strong ? 'font-bold' : 'font-medium')}>{value}</p>
    </div>
  );
}

function EvidenceContentView({ content }: { content: EvidenceContent }) {
  if (content.kind === 'LEDGER') {
    return (
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <p className="bg-gray-50 px-3.5 py-2 text-xs font-semibold text-gray-600 border-b border-gray-100">{content.accountLabel}</p>
        <div className="divide-y divide-gray-50">
          {content.rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[6rem_1fr_7rem] gap-2 items-center px-3.5 py-1.5 text-sm">
              <span className="text-xs text-gray-400 font-mono">{row.date}</span>
              <span className="text-gray-700 truncate">{row.description}</span>
              <span className="text-right font-mono tabular-nums text-gray-900">{moneyAcct(row.debit || row.credit)}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[6rem_1fr_7rem] gap-2 items-center px-3.5 py-2 bg-gray-50/70 font-bold text-sm">
          <span />
          <span className="text-gray-800">Total</span>
          <span className="text-right font-mono tabular-nums">{moneyAcct(content.total)}</span>
        </div>
        <EvidenceNote note={content.note} />
      </div>
    );
  }

  if (content.kind === 'CONFIRMATION') {
    const diff = content.bookBalance - content.confirmedBalance;
    return (
      <div className="rounded-xl border border-gray-100 p-4 space-y-2.5">
        <p className="text-xs text-gray-400">Carta de confirmación · {content.letterDate} · firma: {content.signedBy}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-400">Según libros del auditado</p>
            <p className="font-mono font-bold tabular-nums text-gray-900">{moneyAcct(content.bookBalance)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-400">Según {content.counterparty}</p>
            <p className="font-mono font-bold tabular-nums text-gray-900">{moneyAcct(content.confirmedBalance)}</p>
          </div>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-800">Diferencia sin explicar</span>
          <span className="font-mono font-bold tabular-nums text-amber-800">{moneyAcct(diff)}</span>
        </div>
        <EvidenceNote note={content.note} />
      </div>
    );
  }

  if (content.kind === 'INVOICE') {
    return (
      <div className="rounded-xl border border-gray-100 p-4 space-y-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Field label="Comprobante" value={`#${content.number}`} />
          <Field label="Fecha" value={content.date} />
          <Field label="Cliente" value={content.client} />
          <Field label="Condición" value={content.condition} />
          <Field label="Estado en Hacienda" value={content.haciendaStatus} />
          <Field label="Monto neto" value={moneyAcct(content.netAmount)} />
          <Field label="IVA" value={moneyAcct(content.iva)} />
          <Field label="Total" value={moneyAcct(content.total)} strong />
        </div>
        <EvidenceNote note={content.note} />
      </div>
    );
  }

  // BANK_STATEMENT
  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <p className="bg-gray-50 px-3.5 py-2 text-xs font-semibold text-gray-600 border-b border-gray-100">Cuenta corriente · {content.periodLabel}</p>
      <div className="divide-y divide-gray-50">
        {content.rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[6rem_1fr_7rem] gap-2 items-center px-3.5 py-1.5 text-sm">
            <span className="text-xs text-gray-400 font-mono">{row.date}</span>
            <span className="text-gray-700 truncate">{row.description}</span>
            <span className={cn('text-right font-mono tabular-nums', row.amount < 0 ? 'text-red-600' : 'text-emerald-700')}>{moneyAcct(row.amount)}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[6rem_1fr_7rem] gap-2 items-center px-3.5 py-2 bg-gray-50/70 font-bold text-sm">
        <span />
        <span className="text-gray-800">Saldo final del período</span>
        <span className="text-right font-mono tabular-nums">{moneyAcct(content.endingBalance)}</span>
      </div>
      <EvidenceNote note={content.note} />
    </div>
  );
}
