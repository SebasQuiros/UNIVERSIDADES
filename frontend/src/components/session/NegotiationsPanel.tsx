'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { getErrorMessage, cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Handshake, Plus, Send, Tag, X, ArrowLeft, CheckCircle2 } from 'lucide-react';

interface Entry {
  id: string; authorCompanyId: string; kind: string;
  message: string | null; qty: number | null; unitPrice: string | null; createdAt: string;
}
interface Negotiation {
  id: string; buyerCompanyId: string; sellerCompanyId: string; buyerName: string; sellerName: string;
  subject: string; status: string; agreedQty: number | null; agreedUnitPrice: string | null;
  mySide: 'buyer' | 'seller' | null; updatedAt: string; entries?: Entry[];
}
interface Company { companyId: string; name: string; }

const STATUS_VARIANT: Record<string, any> = {
  ABIERTA: 'blue', CONTRAOFERTA: 'amber', ACEPTADA: 'green', RECHAZADA: 'red', CANCELADA: 'slate',
};
const fmt = (n: number | string | null) => n == null ? '—' : '₡' + Number(n).toLocaleString('es-CR', { minimumFractionDigits: 2 });

export function NegotiationsPanel({ sessionId, myCompanyId }: { sessionId: string; myCompanyId?: string }) {
  const [list, setList] = useState<Negotiation[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Negotiation | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showNew, setShowNew] = useState(false);

  const loadList = useCallback(() => {
    api.get<Negotiation[]>(`/api/v1/negotiations?sessionId=${sessionId}`)
      .then(({ data }) => setList(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => { loadList(); const t = setInterval(loadList, 15000); return () => clearInterval(t); }, [loadList]);

  useEffect(() => {
    api.get<{ groups: Company[] }>(`/api/v1/class-sessions/${sessionId}/live`)
      .then(({ data }) => setCompanies((data.groups ?? []).filter((g) => g.companyId !== myCompanyId)))
      .catch(() => {});
  }, [sessionId, myCompanyId]);

  const loadDetail = useCallback((id: string) => {
    api.get<Negotiation>(`/api/v1/negotiations/${id}`).then(({ data }) => setDetail(data)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!openId) { setDetail(null); return; }
    loadDetail(openId);
    const t = setInterval(() => loadDetail(openId), 8000);
    return () => clearInterval(t);
  }, [openId, loadDetail]);

  // ── Vista detalle (hilo) ──
  if (openId && detail) {
    return <NegotiationThread neg={detail} myCompanyId={myCompanyId}
      onBack={() => { setOpenId(null); loadList(); }}
      onChanged={() => { loadDetail(openId); loadList(); }} />;
  }

  return (
    <SectionCard icon={Handshake} iconTint="#7C3AED" eyebrow="Mercado" title="Negociaciones"
      description="Pedí cotizaciones a otras empresas, ofertá y contraofertá hasta cerrar el trato."
      action={myCompanyId ? <Button size="sm" onClick={() => setShowNew(true)}><Plus className="w-4 h-4" /> Nueva</Button> : undefined}
      className="lp-in lp-in-d2">
      {list.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">Todavía no hay negociaciones. Iniciá una con “Nueva”.</p>
      ) : (
        <div className="space-y-2">
          {list.map((n) => (
            <button key={n.id} onClick={() => setOpenId(n.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2.5 text-left transition-colors hover:border-gray-300">
              <Tag className="h-4 w-4 flex-shrink-0 text-purple-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{n.subject}</p>
                <p className="truncate text-xs text-gray-500">
                  {n.mySide === 'buyer' ? `Le pedís a ${n.sellerName}` : `Te pide ${n.buyerName}`}
                  {n.status === 'ACEPTADA' && n.agreedQty != null && ` · ${n.agreedQty} u. a ${fmt(n.agreedUnitPrice)}`}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[n.status] ?? 'slate'}>{n.status}</Badge>
            </button>
          ))}
        </div>
      )}

      {showNew && myCompanyId && (
        <NewNegotiationModal sessionId={sessionId} buyerCompanyId={myCompanyId} companies={companies}
          onClose={() => setShowNew(false)}
          onCreated={(id) => { setShowNew(false); loadList(); setOpenId(id); }} />
      )}
    </SectionCard>
  );
}

function NegotiationThread({ neg, myCompanyId, onBack, onChanged }: {
  neg: Negotiation; myCompanyId?: string; onBack: () => void; onChanged: () => void;
}) {
  const [msg, setMsg] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const closed = ['ACEPTADA', 'RECHAZADA', 'CANCELADA'].includes(neg.status);
  const lastOffer = [...(neg.entries ?? [])].reverse().find((e) => e.kind === 'OFERTA');
  const canAccept = neg.status === 'CONTRAOFERTA' && lastOffer &&
    ((lastOffer.authorCompanyId === neg.buyerCompanyId) ? neg.mySide === 'seller' : neg.mySide === 'buyer');

  async function act(fn: () => Promise<any>) {
    setBusy(true);
    try { await fn(); onChanged(); } catch (e) { toast.error(getErrorMessage(e)); } finally { setBusy(false); }
  }
  const sendMsg = () => { if (!msg.trim()) return; act(async () => { await api.post(`/api/v1/negotiations/${neg.id}/entries`, { kind: 'MENSAJE', message: msg }); setMsg(''); }); };
  const sendOffer = () => {
    if (!qty || !price) { toast.error('Cantidad y precio para ofertar'); return; }
    act(async () => { await api.post(`/api/v1/negotiations/${neg.id}/entries`, { kind: 'OFERTA', qty: Number(qty), unitPrice: Number(price), message: msg || undefined }); setMsg(''); setQty(''); setPrice(''); });
  };

  return (
    <SectionCard icon={Handshake} iconTint="#7C3AED" eyebrow="Negociación" title={neg.subject}
      description={`${neg.buyerName} (compra) ↔ ${neg.sellerName} (vende)`}
      action={<button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="w-4 h-4" /> Volver</button>}
      className="lp-in">
      <div className="mb-3 flex items-center gap-2">
        <Badge variant={STATUS_VARIANT[neg.status] ?? 'slate'}>{neg.status}</Badge>
        {neg.status === 'ACEPTADA' && neg.agreedQty != null && (
          <span className="text-xs font-semibold text-emerald-700">Acuerdo: {neg.agreedQty} u. a {fmt(neg.agreedUnitPrice)} c/u</span>
        )}
      </div>

      {/* Hilo */}
      <div className="mb-4 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/50 p-3">
        {(neg.entries ?? []).map((e) => {
          const mine = e.authorCompanyId === myCompanyId;
          if (e.kind === 'SISTEMA') return <p key={e.id} className="text-center text-xs italic text-gray-400">{e.message}</p>;
          return (
            <div key={e.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                e.kind === 'OFERTA' ? 'border border-amber-200 bg-amber-50' : mine ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-800')}>
                {e.kind === 'OFERTA' && (
                  <p className={cn('mb-0.5 text-xs font-bold uppercase', mine ? 'text-amber-700' : 'text-amber-700')}>
                    Oferta · {e.qty} u. a {fmt(e.unitPrice)} c/u · total {fmt((e.qty ?? 0) * Number(e.unitPrice ?? 0))}
                  </p>
                )}
                {e.message && <p className={cn(e.kind === 'OFERTA' ? 'text-gray-700' : '')}>{e.message}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {closed ? (
        <p className="text-center text-sm text-gray-400">Negociación cerrada.</p>
      ) : (
        <div className="space-y-2">
          {canAccept && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <span className="text-sm text-emerald-800">Hay una oferta sobre la mesa. ¿La aceptás?</span>
              <Button size="sm" variant="gold" loading={busy} onClick={() => act(() => api.post(`/api/v1/negotiations/${neg.id}/accept`))}>
                <CheckCircle2 className="w-4 h-4" /> Aceptar trato
              </Button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Escribí un mensaje…"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <Button size="sm" variant="secondary" loading={busy} onClick={sendMsg}><Send className="w-4 h-4" /></Button>
          </div>
          <div className="flex flex-wrap items-end gap-2 rounded-xl bg-amber-50/60 p-2">
            <input value={qty} onChange={(e) => setQty(e.target.value)} type="number" min="1" placeholder="Cant."
              className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
            <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="₡ precio unit."
              className="w-32 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
            <Button size="sm" loading={busy} onClick={sendOffer}><Tag className="w-4 h-4" /> Ofertar</Button>
            <button onClick={() => act(() => api.post(`/api/v1/negotiations/${neg.id}/reject`))} className="ml-auto text-xs text-red-500 hover:underline">Rechazar / cancelar</button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function NewNegotiationModal({ sessionId, buyerCompanyId, companies, onClose, onCreated }: {
  sessionId: string; buyerCompanyId: string; companies: Company[]; onClose: () => void; onCreated: (id: string) => void;
}) {
  const [sellerId, setSellerId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!sellerId) { toast.error('Elegí a qué empresa le pedís'); return; }
    if (!subject.trim()) { toast.error('Describí qué querés negociar'); return; }
    setBusy(true);
    try {
      const { data } = await api.post<{ id: string }>(`/api/v1/negotiations`, {
        buyerCompanyId, sellerCompanyId: sellerId, classSessionId: sessionId,
        subject, message: message || undefined,
        qty: qty ? Number(qty) : undefined, unitPrice: price ? Number(price) : undefined,
      });
      toast.success('Negociación iniciada');
      onCreated(data.id);
    } catch (e) { toast.error(getErrorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Nueva negociación</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Empresa a la que le pedís</label>
            <select value={sellerId} onChange={(e) => setSellerId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Elegí una empresa…</option>
              {companies.map((c) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
            </select>
          </div>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200}
            placeholder="Qué negociás (ej: 100 unidades de café en grano)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2}
            placeholder="Mensaje inicial (opcional)"
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <input value={qty} onChange={(e) => setQty(e.target.value)} type="number" min="1" placeholder="Cant. (opc.)"
              className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-sm" />
            <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="₡ precio unit. (opc.)"
              className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm" />
          </div>
          <p className="text-xs text-gray-400">Si ponés cantidad y precio, se envía como oferta inicial; si no, es solo una consulta (RFQ).</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" loading={busy} onClick={submit}>Iniciar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
