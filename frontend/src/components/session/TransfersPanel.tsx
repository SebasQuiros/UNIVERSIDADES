'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { getErrorMessage, cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/Button';
import { ArrowLeftRight, Send, X, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface Concept { key: string; label: string; envia: string; recibe: string; }
interface Transfer {
  id: string; amount: string; concept: string; conceptLabel: string;
  note: string | null; createdAt: string;
  fromName: string; toName: string; direction: 'IN' | 'OUT';
}
interface Company { companyId: string; name: string; }

const fmt = (n: string | number) => '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 2 });
const date = (d: string) => { try { return new Date(d).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: '2-digit' }); } catch { return ''; } };

/**
 * Transferencias de dinero entre empresas. El CONCEPTO define el asiento que se
 * genera en ambas empresas, así que se elige explícitamente.
 */
export function TransfersPanel({ sessionId, myCompanyId }: { sessionId: string; myCompanyId?: string }) {
  const [rows, setRows] = useState<Transfer[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(() => {
    if (!myCompanyId) return;
    api.get<Transfer[]>(`/api/v1/transfers/company/${myCompanyId}`)
      .then(({ data }) => setRows(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [myCompanyId]);

  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  useEffect(() => {
    api.get<Concept[]>('/api/v1/transfers/concepts').then(({ data }) => setConcepts(data)).catch(() => {});
    api.get<{ groups: Company[] }>(`/api/v1/class-sessions/${sessionId}/live`)
      .then(({ data }) => setCompanies((data.groups ?? []).filter((g) => g.companyId !== myCompanyId)))
      .catch(() => {});
  }, [sessionId, myCompanyId]);

  return (
    <SectionCard
      icon={ArrowLeftRight} iconTint="#0891B2" eyebrow="Tesorería"
      title="Transferencias entre empresas"
      description="Mové dinero a otra empresa. El concepto define el asiento contable que se registra en ambas."
      action={myCompanyId ? <Button size="sm" onClick={() => setShowNew(true)}><Send className="h-4 w-4" /> Transferir</Button> : undefined}
      className="lp-in"
    >
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">Todavía no hay transferencias.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((t) => {
            const out = t.direction === 'OUT';
            return (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <span className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
                  out ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600')}>
                  {out ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {out ? `Enviaste a ${t.toName}` : `Recibiste de ${t.fromName}`}
                  </p>
                  <p className="truncate text-xs text-gray-500">{t.conceptLabel}{t.note ? ` · ${t.note}` : ''}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className={cn('font-mono text-sm font-bold tabular-nums', out ? 'text-red-600' : 'text-emerald-600')}>
                    {out ? '−' : '+'}{fmt(t.amount)}
                  </p>
                  <p className="text-[10px] text-gray-400">{date(t.createdAt)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showNew && myCompanyId && (
        <NewTransferModal
          sessionId={sessionId} fromCompanyId={myCompanyId}
          companies={companies} concepts={concepts}
          onClose={() => setShowNew(false)}
          onDone={() => { setShowNew(false); load(); }}
        />
      )}
    </SectionCard>
  );
}

function NewTransferModal({ sessionId, fromCompanyId, companies, concepts, onClose, onDone }: {
  sessionId: string; fromCompanyId: string; companies: Company[]; concepts: Concept[];
  onClose: () => void; onDone: () => void;
}) {
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const sel = concepts.find((c) => c.key === concept);

  async function submit() {
    if (!toId)   { toast.error('Elegí la empresa destino'); return; }
    if (!concept) { toast.error('Elegí el concepto de la transferencia'); return; }
    const n = Number(amount);
    if (!n || n <= 0) { toast.error('Ingresá un monto válido'); return; }
    setBusy(true);
    try {
      await api.post('/api/v1/transfers', {
        fromCompanyId, toCompanyId: toId, amount: n, concept,
        classSessionId: sessionId, note: note || undefined,
      });
      toast.success('Transferencia registrada en ambas empresas');
      onDone();
    } catch (e) { toast.error(getErrorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Transferir dinero</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Empresa destino</label>
            <select value={toId} onChange={(e) => setToId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Elegí una empresa…</option>
              {companies.map((c) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Concepto</label>
            <select value={concept} onChange={(e) => setConcept(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Elegí el concepto…</option>
              {concepts.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          {/* Explica el asiento que se va a generar: es lo que se está enseñando */}
          {sel && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs leading-relaxed text-blue-900">
              <p className="mb-1 font-semibold">Asiento que se registrará:</p>
              <p>· En tu empresa: <b>{sel.envia}</b> contra Banco.</p>
              <p>· En la empresa destino: Banco contra <b>{sel.recibe}</b>.</p>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Monto</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01"
              placeholder="₡ 0.00" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200}
            placeholder="Nota (opcional)" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" loading={busy} onClick={submit}>Transferir</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
