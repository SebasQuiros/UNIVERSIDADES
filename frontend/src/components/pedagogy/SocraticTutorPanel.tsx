'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatDateTime, getErrorMessage } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconTile } from '@/components/ui/IconTile';
import { EmptyState } from '@/components/ui/EmptyState';
import { SceneWelcome } from '@/components/illustrations';
import toast from 'react-hot-toast';
import { GraduationCap, MessageCircleQuestion, Check, Sparkles } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
// El motor pedagógico detecta situaciones de aprendizaje (eventos determinísticos).
// El estudiante le pide al Tutor una pregunta socrática que construye criterio —
// nunca entrega la respuesta directamente.
type Severity = 'INFO' | 'WARNING' | 'CRITICAL';

interface PedagogyEvent {
  id: string;
  type: string;
  severity: Severity;
  area?: string | null;
  context?: unknown;
  message: string;
  resolved: boolean;
  createdAt: string;
}

interface TutorResponse {
  level: 'TUTOR';
  question: string;
  explanation: string;
}

// Chip de severidad: INFO gris, WARNING ámbar, CRITICAL rojo.
const SEVERITY_STYLE: Record<Severity, { bg: string; color: string; label: string }> = {
  INFO:     { bg: '#F1F5F9', color: '#475569', label: 'Info' },
  WARNING:  { bg: '#FEF3C7', color: '#B45309', label: 'Atención' },
  CRITICAL: { bg: '#FEE2E2', color: '#B91C1C', label: 'Crítico' },
};

export function SocraticTutorPanel({ attemptId, companyId }: { attemptId?: string; companyId?: string }) {
  const [events, setEvents]     = useState<PedagogyEvent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const [asking, setAsking]     = useState(false);
  const [tutor, setTutor]       = useState<TutorResponse | null>(null);

  const load = useCallback(async () => {
    if (!attemptId) { setEvents([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await api.get<PedagogyEvent[]>(
        `/api/v1/pedagogy/events?attemptId=${attemptId}&unresolvedOnly=true`,
      );
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Error al cargar las observaciones del tutor');
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => { load(); }, [load]);

  const handleAsk = async (eventId?: string) => {
    setAsking(true);
    setTutor(null);
    try {
      const { data } = await api.post<TutorResponse>('/api/v1/pedagogy/tutor', {
        attemptId, companyId, eventId,
      });
      setTutor(data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAsking(false);
    }
  };

  const handleResolve = async (ev: PedagogyEvent) => {
    setResolvingId(ev.id);
    try {
      await api.post(`/api/v1/pedagogy/events/${ev.id}/resolve`);
      toast.success('Observación marcada como resuelta');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header explicativo */}
      <div className="flex items-start gap-3.5 lp-in">
        <IconTile icon={GraduationCap} tint="#4F46E5" size={46} className="mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold-900 mb-0.5">Tutor IA</p>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">Profe socrático</h2>
          <p className="text-gray-500 text-sm mt-1 max-w-prose">
            El tutor detecta situaciones de aprendizaje mientras registrás operaciones y te
            hace preguntas que construyen criterio contable, en lugar de darte la respuesta.
          </p>
        </div>
      </div>

      {/* Panel prominente: preguntar al tutor */}
      <Card variant="onDark" className="lp-in lp-in-d1">
        <div className="p-5 lg:p-6">
          <div className="flex items-start gap-4 flex-wrap">
            <IconTile icon={MessageCircleQuestion} onDark size={48} className="mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-1">Consultá cuando quieras</p>
              <p className="text-sm font-semibold text-white">¿Tenés una duda o querés repasar?</p>
              <p className="text-xs text-blue-200/80 mt-0.5">
                Preguntale al tutor y te devuelve una pregunta guía para que llegues vos al razonamiento.
              </p>
            </div>
            <Button variant="gold" onClick={() => handleAsk()} loading={asking} className="flex-shrink-0">
              <Sparkles className="w-4 h-4" /> Preguntá al tutor
            </Button>
          </div>

          {/* Respuesta del tutor */}
          {tutor && (
            <div className="mt-4 rounded-card bg-white p-4 lp-pop border-l-4 border-gold-500 shadow-soft">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gold-900 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" /> El tutor te pregunta
              </p>
              <p className="text-base font-bold text-gray-900 mt-1.5 leading-snug">{tutor.question}</p>
              {tutor.explanation && (
                <p className="text-sm text-gray-600 mt-2.5 leading-relaxed whitespace-pre-wrap">{tutor.explanation}</p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Observaciones (eventos) */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : events.length === 0 ? (
        <Card className="lp-in">
          <EmptyState
            illustration={<SceneWelcome size={210} className="lp-drift" />}
            title="Sin observaciones del tutor por ahora"
            description="Seguí registrando operaciones — el tutor te avisará cuando detecte algo para repasar. Igual podés preguntarle lo que quieras cuando gustes."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-semibold text-gold-900 uppercase tracking-wide">
            Observaciones del tutor <span className="text-gray-400 font-normal">({events.length})</span>
          </p>
          {events.map((ev, ei) => {
            const sev  = SEVERITY_STYLE[ev.severity] ?? SEVERITY_STYLE.INFO;
            const busy = resolvingId === ev.id;
            return (
              <div key={ev.id} className={`bg-white border border-gray-200/70 shadow-card rounded-card p-4 flex flex-col gap-3 lp-in lp-in-d${Math.min(ei + 1, 5)}`}>
                <div className="flex items-start gap-3">
                  <span
                    className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                    style={{ background: sev.bg, color: sev.color }}
                  >
                    {sev.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{ev.message}</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {ev.area ? `${ev.area} · ` : ''}{formatDateTime(ev.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                  <Button size="sm" variant="outline" onClick={() => handleAsk(ev.id)} disabled={asking}>
                    <MessageCircleQuestion className="w-3.5 h-3.5" /> Preguntá al tutor
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleResolve(ev)} loading={busy}>
                    <Check className="w-3.5 h-3.5" /> Marcá como resuelto
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
