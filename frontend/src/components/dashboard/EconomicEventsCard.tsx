'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Zap, ChevronDown, ChevronUp, BookOpen, Lightbulb } from 'lucide-react';

interface EntryLine { debit: string; credit: string; amount: number; }
interface EconomicEvent {
  id: string;
  category: 'riesgo' | 'fiscal' | 'mercado' | 'operativo' | 'oportunidad';
  severity: 'alta' | 'media' | 'baja';
  icon: string;
  title: string;
  story: string;
  amount: number;
  impact: string;
  suggestedEntry: EntryLine[];
  learn: string;
}
interface EventsResponse {
  periodLabel: string;
  intro: string;
  events: EconomicEvent[];
  generatedAt: string;
}

const CAT_COLOR: Record<EconomicEvent['category'], { bg: string; fg: string; label: string }> = {
  riesgo:     { bg: '#FEF2F2', fg: '#B91C1C', label: 'Riesgo' },
  fiscal:     { bg: '#EFF6FF', fg: '#1D4ED8', label: 'Fiscal' },
  mercado:    { bg: '#FFFBEB', fg: '#B45309', label: 'Mercado' },
  operativo:  { bg: '#F5F3FF', fg: '#6D28D9', label: 'Operativo' },
  oportunidad:{ bg: '#ECFDF5', fg: '#047857', label: 'Oportunidad' },
};

const fmt = (n: number) => '₡' + (n ?? 0).toLocaleString('es-CR');

export function EconomicEventsCard({ companyId }: { companyId: string }) {
  const [data, setData]   = useState<EventsResponse | null>(null);
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen]   = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let alive = true;
    setLoad(true); setError(false);
    api.get<EventsResponse>(`/api/v1/companies/${companyId}/events`)
      .then(({ data }) => { if (alive) setData(data); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoad(false); });
    return () => { alive = false; };
  }, [companyId]);

  if (loading) return <div className="rounded-2xl h-56 bg-slate-100 animate-pulse" />;
  if (error || !data) return null;

  return (
    <div className="rounded-2xl border bg-white overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-4" style={{ background: 'linear-gradient(135deg,#7C2D12,#9A3412)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#EF4444)' }}>
              <Zap className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Eventos económicos</p>
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{data.periodLabel}</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-white mt-3 leading-snug" style={{ color: 'rgba(255,255,255,0.85)' }}>{data.intro}</p>
      </div>

      {/* Events */}
      <div className="p-4 space-y-3">
        {data.events.map((ev) => {
          const c = CAT_COLOR[ev.category];
          const isOpen = open === ev.id;
          return (
            <div key={ev.id} className="rounded-xl border overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
              <button onClick={() => setOpen(isOpen ? null : ev.id)}
                className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors">
                <span className="text-2xl flex-shrink-0 mt-0.5">{ev.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-800">{ev.title}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
                      style={{ background: c.bg, color: c.fg }}>{c.label}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-snug">{ev.story}</p>
                </div>
                <span className="flex-shrink-0 text-slate-400 mt-1">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: '#F1F5F9' }}>
                  <p className="text-xs font-semibold text-slate-500 mt-3 mb-2">Impacto: {ev.impact}</p>

                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5 flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> Asiento sugerido
                  </p>
                  <div className="rounded-lg overflow-hidden border" style={{ borderColor: '#E2E8F0' }}>
                    {ev.suggestedEntry.map((l, i) => (
                      <div key={i} className="flex items-center text-xs px-3 py-1.5"
                        style={{ background: i % 2 ? '#F8FAFC' : '#fff' }}>
                        <span className="flex-1 text-slate-700">
                          {l.debit ? l.debit : <span className="pl-5 text-slate-500">{l.credit}</span>}
                        </span>
                        <span className="w-24 text-right font-mono text-slate-500">{l.debit ? fmt(l.amount) : ''}</span>
                        <span className="w-24 text-right font-mono text-slate-500">{l.credit ? fmt(l.amount) : ''}</span>
                      </div>
                    ))}
                    <div className="flex items-center text-[10px] px-3 py-1 bg-slate-100 text-slate-400 font-bold uppercase tracking-wide">
                      <span className="flex-1">Cuenta</span>
                      <span className="w-24 text-right">Debe</span>
                      <span className="w-24 text-right">Haber</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 mt-3 flex items-start gap-1.5 rounded-lg p-2.5"
                    style={{ background: '#FFFBEB' }}>
                    <Lightbulb className="w-3.5 h-3.5 mt-px flex-shrink-0" style={{ color: '#B45309' }} />
                    <span><b style={{ color: '#B45309' }}>Aprende:</b> {ev.learn}</span>
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 pb-3">
        <p className="text-[11px] text-slate-400">
          Eventos simulados que rotan cada semana. Practica registrando el asiento en tu Diario. Solo fines educativos.
        </p>
      </div>
    </div>
  );
}

export default EconomicEventsCard;
