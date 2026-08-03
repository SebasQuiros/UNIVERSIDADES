'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getErrorMessage, cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { EntrySkeleton } from '@/components/ui/Skeleton';
import { ArtLedger, SceneEmptyBox } from '@/components/illustrations';
import {
  ArrowLeft, ChevronRight, CheckCircle2, X, Lock,
  ShoppingCart, ShoppingBag, ArrowDownToLine, ArrowUpFromLine, Wallet,
  Sparkles, Search, Pencil, BookOpen, ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────
type Status = 'PENDING' | 'CONFIRMED' | 'REJECTED';

interface JournalLine {
  id:        string;
  debit:     string | number;
  credit:    string | number;
  description: string | null;
  account: { id: string; code: string; name: string };
}

interface JournalEntry {
  id:           string;
  entryNumber:  number;
  description:  string;
  entryDate:    string;
  reference:    string | null;
  source:       string;
  sourceType:   string | null;
  sourceId:     string | null;
  status:       Status;
  isPending:    boolean;
  isReversed:   boolean;
  createdAt:    string;
  lines:        JournalLine[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtCRC = (n: number) => n.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });

const SOURCE_META: Record<string, { label: string; icon: any; cls: string }> = {
  sale:       { label: 'Venta',     icon: ShoppingCart,    cls: 'bg-blue-50 text-blue-700' },
  purchase:   { label: 'Compra',    icon: ShoppingBag,     cls: 'bg-slate-50 text-slate-700' },
  collection: { label: 'Cobro',     icon: ArrowDownToLine, cls: 'bg-emerald-50 text-emerald-700' },
  payment:    { label: 'Pago',      icon: ArrowUpFromLine, cls: 'bg-amber-50 text-amber-700' },
  payroll:    { label: 'Planilla',  icon: Wallet,          cls: 'bg-fuchsia-50 text-fuchsia-700' },
};

const STATUS_META: Record<Status, { label: string; cls: string; dot: string }> = {
  PENDING:   { label: 'Por confirmar', cls: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500'   },
  CONFIRMED: { label: 'Confirmado',    cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  REJECTED:  { label: 'Rechazado',     cls: 'bg-gray-100 text-gray-500',       dot: 'bg-gray-400'    },
};

// ── Source chip ───────────────────────────────────────────────────────────────
function SourceChip({ type }: { type: string | null }) {
  if (!type) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-gray-50 text-gray-500">
        <Pencil className="w-3 h-3" />
        Manual
      </span>
    );
  }
  const meta = SOURCE_META[type] ?? { label: type, icon: Sparkles, cls: 'bg-gray-50 text-gray-600' };
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md', meta.cls)}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

function StatusChip({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium', m.cls)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

// ── Reject modal ──────────────────────────────────────────────────────────────
function RejectModal({
  entry, companyId, onClose, onDone,
}: {
  entry: JournalEntry;
  companyId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/api/v1/companies/${companyId}/journal/${entry.id}/reject`, { reason });
      toast.success('Asiento rechazado');
      onDone();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally       { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-csq-dark/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-card shadow-card-hover w-full max-w-md ring-1 ring-gray-900/5 cx-pop">
        <div className="flex items-center justify-between px-7 pt-6 pb-5 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900 mb-0.5">Libro diario</p>
            <h3 className="text-base font-bold text-gray-900 tracking-tight">
              Rechazar asiento <span className="font-mono tabular-nums">#{entry.entryNumber}</span>
            </h3>
            <p className="text-sm text-gray-500 mt-1 truncate max-w-[280px]">{entry.description}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cx-press">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="px-7 py-6 space-y-5">
          <p className="text-sm text-gray-600 leading-relaxed">
            El asiento quedará marcado como rechazado y no afectará los saldos.
            Conservarás la línea de auditoría para revisión.
          </p>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Motivo <span className="text-gray-400 font-normal">(opcional)</span></span>
            <textarea
              value={reason} onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Ej.: cuentas incorrectas, monto errado, duplicado…"
              className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300 resize-none transition-colors"
            />
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 cx-press">Cancelar</Button>
            <Button type="submit" variant="danger" loading={saving} className="flex-1 cx-press">
              Rechazar asiento
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Entry row (expandable) ────────────────────────────────────────────────────
function EntryRow({
  entry, companyId, onChanged, onReject,
}: {
  entry: JournalEntry;
  companyId: string;
  onChanged: () => void;
  onReject: (e: JournalEntry) => void;
}) {
  const [open,    setOpen]    = useState(false);
  const [working, setWorking] = useState<'confirm' | 'reject' | null>(null);

  const totalDebit  = (entry.lines ?? []).reduce((s, l) => s + Number(l.debit),  0);
  const totalCredit = (entry.lines ?? []).reduce((s, l) => s + Number(l.credit), 0);

  async function confirm() {
    setWorking('confirm');
    try {
      await api.patch(`/api/v1/companies/${companyId}/journal/${entry.id}/confirm`);
      toast.success('Asiento confirmado');
      onChanged();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally       { setWorking(null); }
  }

  const isLocked = entry.status === 'CONFIRMED' || entry.status === 'REJECTED';
  const isPending = entry.status === 'PENDING';

  return (
    <div className={cn(
      'group cx-hop-parent transition-colors border-l-2',
      isPending ? 'bg-gold-50/60 border-l-gold-500' : 'border-l-transparent',
      open ? 'bg-blue-50/40' : 'hover:bg-blue-50/30',
    )}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-6 lg:px-8 py-4 text-left cx-press"
      >
        <span className={cn(
          'text-gray-400 transition-transform duration-200 cx-hop',
          open && 'rotate-90 text-blue-700',
        )}>
          <ChevronRight className="w-4 h-4" />
        </span>
        <span className="font-mono text-xs text-gray-500 w-12 flex-shrink-0">
          #{entry.entryNumber}
        </span>
        <span className="text-xs text-gray-500 w-24 flex-shrink-0">{fmtDate(entry.entryDate)}</span>
        <span className={cn(
          'flex-1 text-sm font-medium truncate',
          // Un asiento revertido sigue en el diario (es parte del registro),
          // pero ya no cuenta para los saldos: tiene que verse distinto o el
          // estudiante lo suma mentalmente y no le cuadra con el balance.
          entry.isReversed ? 'text-gray-400 line-through' : 'text-gray-900',
        )}>{entry.description}</span>
        {entry.isReversed && (
          <span className="hidden sm:inline-flex flex-shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200"
                title="Anulado por una reversión: no afecta los saldos">
            Revertido
          </span>
        )}
        <span className="hidden md:inline-flex flex-shrink-0">
          <SourceChip type={entry.sourceType} />
        </span>
        <span className="hidden lg:inline-block flex-shrink-0 text-xs text-gray-500 tabular-nums w-32 text-right font-mono">
          ₡ {fmtCRC(totalDebit)}
        </span>
        <span className="flex-shrink-0">
          <StatusChip status={entry.status} />
        </span>
      </button>

      {/* Animated expand */}
      <div
        className={cn(
          'grid transition-all duration-300 ease-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="px-6 lg:px-8 pb-6">
            <div className="bg-white border border-gray-200/70 rounded-2xl overflow-hidden shadow-card">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/70 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="text-left  px-5 py-3">Cuenta</th>
                    <th className="text-left  px-5 py-3">Detalle</th>
                    <th className="text-right px-5 py-3">Débito</th>
                    <th className="text-right px-5 py-3">Crédito</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(entry.lines ?? []).map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs text-gray-500 mr-2">{l.account?.code ?? '—'}</span>
                        <span className="text-gray-900 font-medium">{l.account?.name}</span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{l.description ?? '—'}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums font-mono text-gray-900">
                        {Number(l.debit) > 0 ? fmtCRC(Number(l.debit)) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums font-mono text-gray-900">
                        {Number(l.credit) > 0 ? fmtCRC(Number(l.credit)) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50/70 border-t border-gray-200/70">
                  <tr className="text-xs font-semibold text-gray-700">
                    <td className="px-5 py-3" colSpan={2}>Totales</td>
                    <td className="px-5 py-3 text-right tabular-nums font-mono">{fmtCRC(totalDebit)}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-mono">{fmtCRC(totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between mt-5 gap-3 flex-wrap">
              <div className="text-xs text-gray-400">
                {entry.reference && <span className="mr-3">Ref: <span className="font-mono text-gray-500">{entry.reference}</span></span>}
                <span>Fuente: <span className="text-gray-600">{entry.source}</span></span>
              </div>
              {isPending ? (
                <div className="flex items-center gap-2">
                  <button
                    disabled
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-400 rounded-lg cursor-not-allowed"
                    title="Edición avanzada — próximamente"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </button>
                  <button
                    onClick={() => onReject(entry)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cx-press"
                  >
                    <X className="w-3.5 h-3.5" />
                    Rechazar
                  </button>
                  <button
                    onClick={confirm}
                    disabled={working === 'confirm'}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-60 disabled:cursor-wait cx-press"
                  >
                    {working === 'confirm'
                      ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      : <CheckCircle2 className="w-3.5 h-3.5" />
                    }
                    Confirmar
                  </button>
                </div>
              ) : isLocked ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                  <Lock className="w-3.5 h-3.5" />
                  {entry.status === 'CONFIRMED' ? 'Asiento bloqueado · solo lectura' : 'Asiento rechazado'}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DiarioPage() {
  const { attemptId } = useParams<{ attemptId: string }>();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [entries,   setEntries]   = useState<JournalEntry[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<'ALL' | Status>('PENDING');
  const [search,    setSearch]    = useState('');
  const [rejectTarget, setRejectTarget] = useState<JournalEntry | null>(null);

  useEffect(() => {
    api.get(`/api/v1/attempts/${attemptId}`)
      .then(({ data }) => setCompanyId((data as any)?.company?.id ?? null))
      .catch(() => toast.error('No se pudo cargar el ejercicio'));
  }, [attemptId]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data } = await api.get<any>(`/api/v1/companies/${companyId}/journal?limit=200`);
      const list: JournalEntry[] = Array.isArray(data) ? data : (data?.entries ?? []);
      setEntries(list);
    } catch { toast.error('Error al cargar el diario'); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { if (companyId) load(); }, [companyId, load]);

  const counts = useMemo(() => ({
    ALL:       entries.length,
    PENDING:   entries.filter((e) => e.status === 'PENDING').length,
    CONFIRMED: entries.filter((e) => e.status === 'CONFIRMED').length,
    REJECTED:  entries.filter((e) => e.status === 'REJECTED').length,
  }), [entries]);

  const filtered = useMemo(() => {
    return entries
      .filter((e) => filter === 'ALL' ? true : e.status === filter)
      .filter((e) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return e.description.toLowerCase().includes(q)
          || String(e.entryNumber).includes(q)
          || (e.reference?.toLowerCase().includes(q) ?? false);
      });
  }, [entries, filter, search]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/60">
      {rejectTarget && companyId && (
        <RejectModal
          entry={rejectTarget}
          companyId={companyId}
          onClose={() => setRejectTarget(null)}
          onDone={() => { setRejectTarget(null); load(); }}
        />
      )}

      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8 lg:py-10 space-y-7">
        {/* Volver */}
        <Link
          href={`/estudiante/ejercicio/${attemptId}`}
          className="inline-flex items-center gap-2 -ml-1 text-sm font-medium text-gray-500 hover:text-blue-700 transition-colors cx-press"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al ejercicio
        </Link>

        {/* Encabezado */}
        <PageHeader
          eyebrow="Ciclo contable"
          title="Libro diario"
          subtitle="Asientos generados desde eventos de negocio. Confirma los pendientes para que afecten el saldo."
          icon={BookOpen}
          iconTint="#1B2E6E"
          className="lp-in"
          actions={
            counts.PENDING > 0 ? (
              <span className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold bg-gold-50 text-gold-900 border border-gold-100 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-gold-500 cx-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-gold-600" />
                </span>
                {counts.PENDING} {counts.PENDING === 1 ? 'asiento por revisar' : 'asientos por revisar'}
              </span>
            ) : undefined
          }
        />

        {/* Banda del módulo */}
        <Card variant="onDark" className="cx-pop">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-6 lg:px-7 py-6">
            <div className="flex-1 min-w-0">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-1.5">
                Partida doble
              </p>
              <h2 className="text-lg font-bold leading-snug">Todo asiento debe cuadrar: débitos = créditos.</h2>
              <p className="mt-1.5 text-sm text-blue-200/80 max-w-xl">
                Revisa cada asiento antes de confirmarlo. Una vez confirmado queda bloqueado y afecta los saldos
                del libro mayor.
              </p>
            </div>
            <ArtLedger size={140} className="lp-drift flex-shrink-0" />
          </div>
        </Card>

        {/* Asientos */}
        <SectionCard
          eyebrow="Registros"
          title="Asientos del período"
          description="Filtra por estado o busca por número, descripción o referencia."
          icon={BookOpen}
          iconTint="#2563EB"
          flushBody
          className="cx-pop cx-d1"
        >
          {/* Filtros + búsqueda */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 lg:px-7 py-5 border-b border-gray-100">
            <div className="flex items-center gap-1 bg-gray-100/80 rounded-xl p-1">
              {([
                { key: 'ALL',       label: 'Todos'      },
                { key: 'PENDING',   label: 'Pendientes' },
                { key: 'CONFIRMED', label: 'Confirmados'},
                { key: 'REJECTED',  label: 'Rechazados' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    'flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cx-press',
                    filter === key
                      ? 'text-white bg-gradient-to-br from-blue-600 to-csq-mid shadow-[0_6px_20px_rgba(27,46,110,0.28)]'
                      : 'text-gray-500 hover:text-blue-700 hover:bg-white',
                  )}
                >
                  {label}
                  <span className={cn(
                    'inline-flex items-center justify-center min-w-[22px] px-1.5 py-px text-[10px] font-mono tabular-nums rounded-md',
                    filter === key ? 'bg-white/20 text-white' : 'bg-white text-gray-600',
                  )}>
                    {counts[key]}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative flex-1 max-w-md sm:ml-auto">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por número, descripción o referencia…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white transition-colors"
              />
            </div>
          </div>

          {loading ? (
            <div>
              <EntrySkeleton />
              <EntrySkeleton />
              <EntrySkeleton />
              <EntrySkeleton />
              <EntrySkeleton />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              illustration={
                filter === 'PENDING'
                  ? <ArtLedger size={190} className="lp-drift" />
                  : <SceneEmptyBox size={200} className="lp-drift" />
              }
              title={filter === 'PENDING' ? 'Todo al día' : 'Sin asientos'}
              description={
                filter === 'PENDING'
                  ? 'No hay asientos pendientes de confirmación. El sistema se generó al día.'
                  : 'No hay asientos con los filtros aplicados. Cambia los criterios para ver más resultados.'
              }
              action={
                filter !== 'ALL' ? (
                  <Button variant="outline" onClick={() => setFilter('ALL')} className="cx-press">
                    {filter === 'PENDING'
                      ? <><ShieldCheck className="w-4 h-4" /> Ver todos los asientos</>
                      : <>Ver todos los asientos</>}
                  </Button>
                ) : undefined
              }
              className="py-16"
            />
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((e) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  companyId={companyId!}
                  onChanged={load}
                  onReject={setRejectTarget}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
