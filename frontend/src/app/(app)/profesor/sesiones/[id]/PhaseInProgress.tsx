'use client';

/**
 * Fase EN CURSO — panel en vivo de las empresas operando.
 *
 * El backend no expone métricas operativas por empresa en vivo (facturas,
 * asientos, comercio B2B) — solo participantes, grupos y su estado de
 * conexión (`GET class-sessions/:id/dashboard`). Este panel muestra lo que
 * hay: quién está conectado ahora mismo, por empresa.
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { ARCHETYPE_ICON, ARCHETYPE_LABELS, ARCHETYPE_TINT } from '@/lib/classSession';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/IconTile';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { SessionLeaderboard } from '@/components/session/SessionLeaderboard';
import type { DashboardResponse } from './types';
import {
  Users, Building2, Wifi, ShieldCheck, ArrowRight, CheckCircle2, AlertTriangle,
} from 'lucide-react';

export function PhaseInProgress({ session, onChanged }: { session: DashboardResponse; onChanged: () => void }) {
  const [closing, setClosing] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annKind, setAnnKind] = useState<'INFO' | 'EVENTO' | 'ALERTA'>('INFO');
  const [publishing, setPublishing] = useState(false);
  const [closeAt, setCloseAt] = useState('');
  const [savingCfg, setSavingCfg] = useState(false);

  const onlineNow = session.participants.filter((p) => p.onlineStatus === 'ACTIVE').length;

  async function patchClose(iso: string | null) {
    setSavingCfg(true);
    try {
      await api.patch(`/api/v1/class-sessions/${session.id}/config`, { commercialCloseAt: iso });
      toast.success(iso ? 'Cierre comercial programado' : 'Cronómetro quitado');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingCfg(false);
    }
  }
  const setInMinutes = (m: number) => patchClose(new Date(Date.now() + m * 60000).toISOString());
  const setFromInput = () => patchClose(closeAt ? new Date(closeAt).toISOString() : null);

  async function publishAnnouncement() {
    if (!annTitle.trim()) { toast.error('Escribí un título para el anuncio'); return; }
    setPublishing(true);
    try {
      await api.post(`/api/v1/class-sessions/${session.id}/announcements`, {
        title: annTitle.trim(), body: annBody.trim() || undefined, kind: annKind,
      });
      toast.success('Anuncio publicado a la sesión');
      setAnnTitle(''); setAnnBody(''); setAnnKind('INFO');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPublishing(false);
    }
  }

  async function closeOperations() {
    setClosing(true);
    try {
      const { data } = await api.post<{ disabledCompanies: number }>(`/api/v1/class-sessions/${session.id}/close-operations`);
      toast.success(`Periodo cerrado — ${data.disabledCompanies} empresa${data.disabledCompanies !== 1 ? 's' : ''} congelada${data.disabledCompanies !== 1 ? 's' : ''}`);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Publicar anuncio/noticia a la sesión */}
      <SectionCard icon={AlertTriangle} iconTint="#7C3AED" eyebrow="Mission control" title="Publicar anuncio a la sesión"
        description="Novedades del mercado, eventos económicos o instrucciones. Aparecen en vivo a todos los estudiantes.">
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-2">
            {(['INFO', 'EVENTO', 'ALERTA'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setAnnKind(k)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                  annKind === k ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {k}
              </button>
            ))}
          </div>
          <input value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} maxLength={200}
            placeholder="Título del anuncio (ej: Sube el precio del combustible 15%)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <textarea value={annBody} onChange={(e) => setAnnBody(e.target.value)} rows={2} maxLength={2000}
            placeholder="Detalle (opcional)"
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <div className="flex justify-end">
            <Button onClick={publishAnnouncement} loading={publishing} size="sm">Publicar anuncio</Button>
          </div>
        </div>
      </SectionCard>

      {/* Cierre del período comercial (cronómetro para los estudiantes) */}
      <SectionCard icon={AlertTriangle} iconTint="#2563EB" eyebrow="Economía" title="Cierre del período comercial"
        description="Programá un cronómetro visible para todos: da urgencia y marca cuándo dejan de negociar.">
        <div className="flex flex-wrap items-center gap-2">
          {[15, 30, 60].map((m) => (
            <Button key={m} size="sm" variant="secondary" loading={savingCfg} onClick={() => setInMinutes(m)}>
              En {m} min
            </Button>
          ))}
          <input type="datetime-local" value={closeAt} onChange={(e) => setCloseAt(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
          <Button size="sm" loading={savingCfg} onClick={setFromInput}>Fijar</Button>
          <button onClick={() => patchClose(null)}
            className="text-xs text-gray-400 hover:text-gray-600">Quitar cronómetro</button>
        </div>
      </SectionCard>

      {/* Ranking en vivo — mission control ve la competencia entre empresas */}
      <SessionLeaderboard sessionId={session.id} expandedMetrics refreshMs={12000} />

      {/* Resumen global */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Participantes" value={String(session.participantsCount)} icon={Users} tint="#2563EB" className="cx-pop cx-d1" />
        <StatCard label="Empresas" value={String(session.groups.length)} icon={Building2} tint="#1B2E6E" className="cx-pop cx-d2" />
        <StatCard label="Conectados ahora" value={String(onlineNow)} icon={Wifi} tint="#059669" hint="En línea en este momento" className="cx-pop cx-d3" />
        <StatCard label="Hallazgos" value={String(session.findingsTotal)} icon={ShieldCheck} tint="#B8860B" hint="Se habilitan en auditoría" className="cx-pop cx-d4" />
      </div>

      {/* Empresas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {session.groups.map((g, i) => {
          const members = session.participants.filter((p) => p.companyId === g.companyId);
          const online = members.filter((p) => p.onlineStatus === 'ACTIVE').length;
          const Icon = ARCHETYPE_ICON[g.archetype];
          return (
            <div key={g.companyId} className={`overflow-hidden rounded-card border bg-white shadow-card transition-all cx-lift cx-pop cx-d${Math.min(i + 1, 6)} ${online > 0 ? 'border-emerald-100' : 'border-gray-200/70'}`}>
              <div className={`flex items-center justify-between gap-2 border-b px-4 py-3 ${online > 0 ? 'border-emerald-100 bg-emerald-50/60' : 'border-gray-100 bg-gray-50/70'}`}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <IconTile icon={Icon} tint={ARCHETYPE_TINT[g.archetype]} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">{g.name}</p>
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">{ARCHETYPE_LABELS[g.archetype]}</p>
                  </div>
                </div>
                {online > 0 ? (
                  <span className="flex flex-shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> {online} en línea
                  </span>
                ) : (
                  <span className="flex flex-shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500">
                    Sin conexión
                  </span>
                )}
              </div>
              <div className="p-4 text-xs">
                <p className="mb-2 text-gray-500">{g.legalId || 'Sin cédula jurídica'}</p>
                <div className="space-y-1">
                  {members.length === 0 ? (
                    <p className="italic text-gray-400">Sin integrantes.</p>
                  ) : members.map((m) => (
                    <div key={m.participantId} className="flex items-center justify-between gap-2">
                      <span className="truncate text-gray-700">{m.name}</span>
                      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${m.onlineStatus === 'ACTIVE' ? 'bg-emerald-500' : m.onlineStatus === 'IDLE' ? 'bg-gold-600' : 'bg-gray-300'}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-3 rounded-card border border-gray-200/70 bg-white p-5 shadow-card sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3">
          <IconTile icon={AlertTriangle} tint="#B8860B" size={40} />
          <p className="text-sm text-gray-600">
            Al cerrar el periodo, los libros de cada empresa se congelan (no admiten más escritura) y pasan a la fase de tributación.
          </p>
        </div>
        <Button onClick={closeOperations} loading={closing} className="w-full cx-press sm:w-auto">
          Cerrar periodo y tributar <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
