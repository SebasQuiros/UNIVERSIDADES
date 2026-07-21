'use client';

// El expediente de auditoría entre pares. Doctrina NIA 240: el sistema (y el
// estudiante) reportan *diferencias*, nunca "fraude" ni "trampa" — probar
// intención requiere más de lo que este ejercicio puede establecer. El
// vocabulario de esta pantalla es deliberadamente neutral y descriptivo.

import { useState, useEffect, useCallback, type ElementType } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { cn, fmtNum, formatDateTime, getErrorMessage } from '@/lib/utils';
import {
  FINDING_SECTIONS, FINDING_SECTION_LABELS, ARCHETYPE_LABELS, type FindingSection,
} from '@/lib/classSession';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { IconTile } from '@/components/ui/IconTile';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { SceneEmptyBox } from '@/components/illustrations';
import {
  ArrowLeft, Send, Trash2, Pencil, CheckCircle2, XCircle, HelpCircle,
  ClipboardList, ScrollText, FileSearch, Scale, Receipt, Info, Gavel, Lock,
} from 'lucide-react';
import type {
  MeResponse, AuditAssignment, AuditSnapshot, AuditFinding,
  AccountRow, BalanceSheetReport, IncomeStatementReport, TrialBalanceReport, TaxDeclarationsReport,
} from '../../types';

function moneyAcct(n: number | string): string {
  const num = Number(n);
  const formatted = `₡ ${fmtNum(Math.abs(num))}`;
  return num < 0 ? `(${formatted})` : formatted;
}

type DocTab = 'balance' | 'resultados' | 'comprobacion' | 'declaraciones';

const DOC_TABS: { key: DocTab; label: string; icon: ElementType }[] = [
  { key: 'balance',        label: 'Balance General',           icon: Scale },
  { key: 'resultados',     label: 'Estado de Resultados',      icon: Receipt },
  { key: 'comprobacion',   label: 'Balance de Comprobación',   icon: ScrollText },
  { key: 'declaraciones',  label: 'Declaraciones',              icon: FileSearch },
];

const TAX_FORM_LABEL: Record<string, string> = {
  D101_RENTA:     'D-101 · Renta',
  D104_IVA:       'D-104 · IVA',
  D103_RETENCION: 'D-103 · Retenciones',
  D115_DIVIDENDOS:'D-115 · Dividendos',
};

export default function ExpedienteAuditoriaPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [assignment, setAssignment] = useState<AuditAssignment | null>(null);
  const [snapshot, setSnapshot] = useState<AuditSnapshot | null>(null);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  const [docTab, setDocTab] = useState<DocTab>('balance');

  // Formulario de hallazgo (crear o editar)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fSection, setFSection] = useState<FindingSection>('BALANCE_SHEET');
  const [fAccountCode, setFAccountCode] = useState('');
  const [fDescription, setFDescription] = useState('');
  const [fAmount, setFAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setSnapshotError(null);
    try {
      const [meRes, assignmentRes, findingsRes] = await Promise.all([
        api.get<MeResponse>(`/api/v1/class-sessions/${id}/me`),
        api.get<AuditAssignment>(`/api/v1/class-sessions/${id}/audit/assignment`),
        api.get<AuditFinding[]>(`/api/v1/class-sessions/${id}/audit/findings`),
      ]);
      setMe(meRes.data);
      setAssignment(assignmentRes.data);
      setFindings(findingsRes.data);
      try {
        const { data } = await api.get<AuditSnapshot>(`/api/v1/class-sessions/${id}/audit/snapshot`);
        setSnapshot(data);
      } catch (err) {
        setSnapshotError(getErrorMessage(err));
      }
    } catch (err) {
      setLoadError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const canWrite = me?.status === 'AUDITORIA';

  function resetForm() {
    setEditingId(null);
    setFSection('BALANCE_SHEET');
    setFAccountCode('');
    setFDescription('');
    setFAmount('');
  }

  function startEdit(f: AuditFinding) {
    setEditingId(f.id);
    setFSection((f.section as FindingSection) ?? 'OTHER');
    setFAccountCode(f.accountCode ?? '');
    setFDescription(f.description);
    setFAmount(f.claimedAmount != null ? String(f.claimedAmount) : '');
  }

  async function submitFinding() {
    if (!fDescription.trim()) { toast.error('Describí la diferencia observada.'); return; }
    setSubmitting(true);
    const body = {
      section: fSection,
      accountCode: fAccountCode.trim() || undefined,
      description: fDescription.trim(),
      claimedAmount: fAmount.trim() ? Number(fAmount) : undefined,
    };
    try {
      if (editingId) {
        await api.patch(`/api/v1/class-sessions/${id}/audit/findings/${editingId}`, body);
        toast.success('Hallazgo actualizado.');
      } else {
        await api.post(`/api/v1/class-sessions/${id}/audit/findings`, body);
        toast.success('Hallazgo reportado.');
      }
      resetForm();
      const { data } = await api.get<AuditFinding[]>(`/api/v1/class-sessions/${id}/audit/findings`);
      setFindings(data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteFinding(findingId: string) {
    try {
      await api.delete(`/api/v1/class-sessions/${id}/audit/findings/${findingId}`);
      setFindings((prev) => prev.filter((f) => f.id !== findingId));
      toast.success('Hallazgo eliminado.');
      if (editingId === findingId) resetForm();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  if (loading) {
    return (
      <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#F4F6F8]">
        <div className="space-y-6">
          <Skeleton className="h-16 w-full rounded-card" />
          <Skeleton className="h-72 w-full rounded-card" />
          <Skeleton className="h-56 w-full rounded-card" />
        </div>
      </div>
    );
  }

  if (loadError || !assignment) {
    return (
      <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#F4F6F8]">
        <div className="rounded-card border border-gray-200/70 bg-white shadow-card">
          <EmptyState
            illustration={<SceneEmptyBox size={180} />}
            title="El expediente no está disponible"
            description={loadError ?? 'No se pudo cargar la auditoría.'}
            action={
              <Link href={`/estudiante/sesion/${id}`}>
                <Button variant="secondary"><ArrowLeft className="w-4 h-4" /> Volver a mi sesión</Button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#F4F6F8]">
      <Link
        href={`/estudiante/sesion/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a mi sesión
      </Link>

      <PageHeader
        eyebrow="Expediente de auditoría"
        title={assignment.auditeeName}
        subtitle={`${ARCHETYPE_LABELS[assignment.archetype]} · no ves los libros vivos, solo lo que la empresa entrega`}
        icon={FileSearch}
        className="mb-5"
        actions={!canWrite ? <Badge variant="slate"><Lock className="w-3 h-3" /> Solo lectura</Badge> : undefined}
      />

      {/* Doctrina */}
      <div className="mb-6 flex items-start gap-3.5 rounded-card border border-blue-200 bg-blue-50/70 p-5 shadow-card">
        <IconTile icon={Info} tint="#2563EB" size={44} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-blue-900">Cómo reportar un hallazgo</p>
          <p className="mt-1.5 text-sm leading-relaxed text-blue-900/80">
            Un hallazgo es una diferencia concreta entre lo que dice el paquete financiero y lo que esperarías —
            no una acusación. Describí el hecho, indicá la cuenta o sección afectada y, si aplica, el monto en
            disputa. El profesor revisa cada hallazgo antes de calificar.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {/* Paquete financiero congelado */}
        <SectionCard
          icon={FileSearch}
          iconTint="#1B2E6E"
          eyebrow="Paquete congelado"
          title={`Estados financieros — ${assignment.auditeeName}`}
          description="El mismo paquete que recibiría un auditor externo: no incluye acceso a los libros en vivo."
          flushBody
          className="lp-in"
        >
          {!snapshot ? (
            <div className="px-6 py-8 lg:px-7">
              <EmptyState
                illustration={<SceneEmptyBox size={140} />}
                title="El snapshot todavía no está listo"
                description={snapshotError ?? 'Tu profesor todavía no publicó los estados financieros de esta empresa.'}
                action={<Button variant="secondary" onClick={load}>Reintentar</Button>}
              />
            </div>
          ) : (
            <>
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
                <p className="mb-4 text-xs text-gray-400">Publicado {formatDateTime(snapshot.publishedAt)}</p>
                {docTab === 'balance' && <BalanceSheetView data={snapshot.balanceSheet} />}
                {docTab === 'resultados' && <IncomeStatementView data={snapshot.incomeStatement} />}
                {docTab === 'comprobacion' && <TrialBalanceView data={snapshot.trialBalance} />}
                {docTab === 'declaraciones' && <TaxFilingsView data={snapshot.taxDeclarations} />}
              </div>
            </>
          )}
        </SectionCard>

        {/* Reportar hallazgo */}
        <SectionCard
          icon={Gavel}
          iconTint="#B8860B"
          eyebrow={editingId ? 'Editando hallazgo' : 'Nuevo hallazgo'}
          title="Reportar un hallazgo"
          description="Citá la sección afectada y describí el hecho concreto — evitá afirmar intención."
          className="lp-in lp-in-d1"
        >
          {!canWrite ? (
            <p className="text-sm text-gray-500">
              Esta auditoría ya cerró — podés ver los hallazgos reportados, pero no agregar ni editar.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600 mb-1 block">Sección</span>
                  <select
                    value={fSection}
                    onChange={(e) => setFSection(e.target.value as FindingSection)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  >
                    {FINDING_SECTIONS.map((s) => <option key={s} value={s}>{FINDING_SECTION_LABELS[s]}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600 mb-1 block">Cuenta (opcional)</span>
                  <input
                    value={fAccountCode}
                    onChange={(e) => setFAccountCode(e.target.value)}
                    placeholder="Ej. 1103"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-gray-600 mb-1 block">Diferencia observada</span>
                <textarea
                  value={fDescription}
                  onChange={(e) => setFDescription(e.target.value)}
                  rows={3}
                  placeholder="Describí el hecho concreto: qué dice el paquete y qué esperarías ver. Evitá afirmar fraude o intención — reportá la diferencia."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition resize-none"
                />
              </label>
              <label className="block max-w-xs">
                <span className="text-xs font-semibold text-gray-600 mb-1 block">Monto en disputa (opcional, ₡)</span>
                <input
                  type="number"
                  value={fAmount}
                  onChange={(e) => setFAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                />
              </label>
              <div className="flex gap-2">
                <Button onClick={submitFinding} loading={submitting} variant="outline" className="self-start">
                  <Send className="w-4 h-4" /> {editingId ? 'Guardar cambios' : 'Reportar hallazgo'}
                </Button>
                {editingId && (
                  <Button variant="ghost" onClick={resetForm} className="self-start">Cancelar edición</Button>
                )}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Hallazgos reportados */}
        <SectionCard
          icon={ClipboardList}
          iconTint="#2563EB"
          eyebrow={`${findings.length} hallazgo${findings.length !== 1 ? 's' : ''}`}
          title="Hallazgos reportados"
          flushBody
          className="lp-in lp-in-d2"
        >
          {findings.length === 0 ? (
            <div className="px-6 lg:px-7 py-8">
              <EmptyState
                illustration={<SceneEmptyBox size={140} />}
                title="Todavía no reportaste hallazgos"
                description="Revisá el paquete financiero de arriba y reportá lo que encuentres."
              />
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {findings.map((f) => {
                const mine = f.createdById === user?.id;
                return (
                  <div key={f.id} className="px-6 lg:px-7 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge variant="blue">{FINDING_SECTION_LABELS[f.section as FindingSection] ?? f.section}</Badge>
                          {f.accountCode && <Badge variant="slate">Cuenta {f.accountCode}</Badge>}
                          {f.matched === true && <Badge variant="emerald"><CheckCircle2 className="w-3 h-3" /> Coincide con el sistema</Badge>}
                          {f.matched === false && <Badge variant="red"><XCircle className="w-3 h-3" /> No coincide</Badge>}
                          {f.matched == null && <Badge variant="slate"><HelpCircle className="w-3 h-3" /> Pendiente de revisión</Badge>}
                        </div>
                        <p className="text-sm text-gray-700">{f.description}</p>
                        {f.claimedAmount != null && (
                          <p className="mt-1 text-xs font-mono font-semibold text-gray-500 tabular-nums">
                            Monto en disputa: {moneyAcct(f.claimedAmount)}
                          </p>
                        )}
                        {f.matchDetail && (
                          <p className="mt-1 text-xs italic text-gray-400">{f.matchDetail}</p>
                        )}
                      </div>
                      {canWrite && mine && (
                        <div className="flex flex-shrink-0 items-center gap-1">
                          <button onClick={() => startEdit(f)} className="rounded-lg p-1.5 text-gray-300 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Editar">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteFinding(f.id)} className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors" title="Eliminar">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
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

// ── Vistas del paquete financiero congelado ─────────────────────────────────

function ColumnHeader() {
  return (
    <div className="grid grid-cols-[1fr_7rem] gap-2 px-3.5 text-[11px] font-semibold text-gray-400">
      <span />
      <span className="text-right">Saldo</span>
    </div>
  );
}

function LineRow({ row }: { row: AccountRow }) {
  return (
    <div className="grid grid-cols-[1fr_7rem] gap-2 items-center px-3.5 py-1.5 text-sm">
      <span className="text-gray-600 truncate">
        <span className="font-mono text-xs text-gray-400 mr-1.5">{row.code}</span>
        {row.name}
      </span>
      <span className="text-right font-mono tabular-nums text-gray-900">{moneyAcct(row.balance)}</span>
    </div>
  );
}

function TotalLine({ label, value, tone }: { label: string; value: number | string; tone?: 'emerald' | 'blue' | 'slate' | 'red' }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl font-bold text-sm',
        tone === 'emerald' ? 'bg-emerald-50 text-emerald-900'
          : tone === 'blue' ? 'bg-blue-50 text-blue-900'
          : tone === 'red' ? 'bg-red-50 text-red-700'
          : 'bg-gray-50 text-gray-800',
      )}
    >
      <span>{label}</span>
      <span className="text-right font-mono tabular-nums">{moneyAcct(value)}</span>
    </div>
  );
}

function AccountSection({ title, rows, total }: { title: string; rows: AccountRow[]; total: string }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <p className="bg-gray-50 px-3.5 py-1.5 text-xs font-semibold text-gray-500 border-b border-gray-100">{title}</p>
      <div className="divide-y divide-gray-50">
        {rows.map((r) => <LineRow key={r.id} row={r} />)}
      </div>
      <div className="border-t border-gray-100 p-1.5">
        <TotalLine label={`Total ${title.toLowerCase()}`} value={total} />
      </div>
    </div>
  );
}

function BalanceSheetView({ data }: { data: BalanceSheetReport | null }) {
  if (!data) return <p className="text-sm text-gray-400">Sin datos.</p>;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700 mb-2">Activos</p>
          <ColumnHeader />
          <div className="mt-1.5"><AccountSection title="Activo" rows={data.assets.accounts} total={data.assets.total} /></div>
          <div className="mt-2"><TotalLine label="Total activos" value={data.totals.totalAssets} tone="blue" /></div>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-red-600 mb-2">Pasivos</p>
            <ColumnHeader />
            <div className="mt-1.5"><AccountSection title="Pasivo" rows={data.liabilities.accounts} total={data.liabilities.total} /></div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Patrimonio</p>
            <AccountSection title="Patrimonio" rows={data.equity.accounts} total={data.equity.total} />
          </div>
          <TotalLine label="Total pasivo + patrimonio" value={data.totals.totalLiabEquity} tone="slate" />
        </div>
      </div>
      <div className={cn(
        'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm',
        data.totals.isBalanced ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-red-100 bg-red-50 text-red-700',
      )}>
        {data.totals.isBalanced ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
        {data.totals.isBalanced
          ? 'El balance cuadra: Activo = Pasivo + Patrimonio.'
          : `El balance no cuadra: diferencia de ${moneyAcct(data.totals.difference)}.`}
      </div>
    </div>
  );
}

function IncomeStatementView({ data }: { data: IncomeStatementReport | null }) {
  if (!data) return <p className="text-sm text-gray-400">Sin datos.</p>;
  return (
    <div className="space-y-3">
      <ColumnHeader />
      <AccountSection title="Ingresos" rows={data.income.accounts} total={data.income.total} />
      <AccountSection title="Gastos" rows={data.expenses.accounts} total={data.expenses.total} />
      <TotalLine label="Utilidad neta" value={data.totals.netIncome} tone={data.totals.isProfit ? 'emerald' : 'red'} />
    </div>
  );
}

function TrialBalanceView({ data }: { data: TrialBalanceReport | null }) {
  if (!data) return <p className="text-sm text-gray-400">Sin datos.</p>;
  const rows = data.rows.filter((r) => Number(r.totalDebit) !== 0 || Number(r.totalCredit) !== 0);
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <th className="p-2.5 text-left">Cuenta</th>
              <th className="p-2.5 text-right">Débito</th>
              <th className="p-2.5 text-right">Crédito</th>
              <th className="p-2.5 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-2.5 text-gray-700"><span className="font-mono text-xs text-gray-400 mr-1.5">{r.code}</span>{r.name}</td>
                <td className="p-2.5 text-right font-mono tabular-nums">{moneyAcct(r.totalDebit)}</td>
                <td className="p-2.5 text-right font-mono tabular-nums">{moneyAcct(r.totalCredit)}</td>
                <td className="p-2.5 text-right font-mono font-semibold tabular-nums">{moneyAcct(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={cn(
        'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm',
        data.totals.isBalanced ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-red-100 bg-red-50 text-red-700',
      )}>
        {data.totals.isBalanced ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
        {data.totals.isBalanced
          ? 'Débitos y créditos cuadran.'
          : `Diferencia de ${moneyAcct(data.totals.difference)} entre débitos y créditos.`}
      </div>
    </div>
  );
}

function TaxFilingsView({ data }: { data: TaxDeclarationsReport | null }) {
  const list = data?.declaraciones ?? [];
  if (list.length === 0) {
    return <p className="text-sm text-gray-400">{data?.nota ?? 'Sin declaraciones registradas.'}</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {list.map((t) => (
        <div key={t.type} className="rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="blue">{TAX_FORM_LABEL[t.type] ?? t.type}</Badge>
            <Badge variant={t.presentada ? 'emerald' : 'amber'}>{t.presentada ? 'Presentada' : 'Pendiente'}</Badge>
          </div>
          {t.presentada ? (
            <>
              {t.period && <p className="text-xs text-gray-400">Período: {t.period}</p>}
              {t.referenceNo && <p className="text-xs text-gray-400">Referencia: {t.referenceNo}</p>}
              {t.submittedAt && <p className="text-xs text-gray-400">Presentada: {formatDateTime(t.submittedAt)}</p>}
            </>
          ) : (
            <p className="text-xs text-gray-400">Esta empresa todavía no la presentó.</p>
          )}
        </div>
      ))}
    </div>
  );
}
