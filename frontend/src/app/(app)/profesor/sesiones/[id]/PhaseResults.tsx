'use client';

/**
 * Fases CALIFICACIÓN / FINALIZADA — corre el oráculo, muestra el podio y
 * permite finalizar (irreversible).
 */

import { useState, type ElementType } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { ARCHETYPE_ICON, ARCHETYPE_TINT } from '@/lib/classSession';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/IconTile';
import { SectionCard } from '@/components/ui/SectionCard';
import type { DashboardResponse } from './types';
import { combinedScore } from './types';
import {
  Trophy, Crown, Medal, X, AlertTriangle, PartyPopper, CheckCircle2, ArrowRight, Sparkles,
} from 'lucide-react';

const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
  backgroundSize: '22px 22px',
};

const PLACE_STYLE: Record<1 | 2 | 3, { height: string; bg: string; icon: ElementType }> = {
  1: { height: 'h-44 sm:h-52', bg: 'linear-gradient(180deg,#FBBF24,#B8860B)', icon: Crown },
  2: { height: 'h-32 sm:h-40', bg: 'linear-gradient(180deg,#E2E8F0,#94A3B8)', icon: Medal },
  3: { height: 'h-24 sm:h-32', bg: 'linear-gradient(180deg,#D4A017,#8A6608)', icon: Medal },
};

function scoreBar(v: number) {
  if (v >= 85) return 'bg-emerald-500';
  if (v >= 70) return 'bg-blue-600';
  return 'bg-gold-600';
}

function FinalizeModal({ onConfirm, onClose, loading }: { onConfirm: () => void; onClose: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-csq-dark/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-card border border-gray-200/70 bg-white p-6 shadow-card-hover cx-pop">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600" aria-label="Cerrar">
          <X className="w-5 h-5" />
        </button>
        <div className="mb-4 flex items-center gap-3">
          <IconTile icon={AlertTriangle} tint="#DC2626" size={44} />
          <h3 className="font-bold tracking-tight text-gray-900">Finalizar sesión</h3>
        </div>
        <p className="mb-2 text-sm text-gray-600">
          Esto publica el podio final, congela los puntajes y cierra la sesión de forma permanente.
        </p>
        <p className="mb-6 text-xs text-red-600">Esta acción no se puede deshacer.</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={loading}>Cancelar</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading} className="flex-1 cx-press">Finalizar</Button>
        </div>
      </div>
    </div>
  );
}

export function PhaseResults({ session, onChanged }: { session: DashboardResponse; onChanged: () => void }) {
  const [grading, setGrading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const finalized = session.status === 'FINALIZADA';
  const hasScores = session.groups.some((g) => g.accountingScore != null);

  async function grade() {
    setGrading(true);
    try {
      await api.post(`/api/v1/class-sessions/${session.id}/grade`);
      toast.success('Calificación calculada');
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setGrading(false);
    }
  }

  async function finish() {
    setFinishing(true);
    try {
      await api.post(`/api/v1/class-sessions/${session.id}/finish`);
      toast.success('Sesión finalizada');
      setShowConfirm(false);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setFinishing(false);
    }
  }

  const ranked = [...session.groups]
    .map((g) => ({ ...g, combined: combinedScore(g.accountingScore, g.auditScore) }))
    .sort((a, b) => (b.combined ?? -1) - (a.combined ?? -1));
  const top3 = ranked.slice(0, 3);
  const podiumOrder = [
    { place: 2 as const, row: top3[1] },
    { place: 1 as const, row: top3[0] },
    { place: 3 as const, row: top3[2] },
  ].filter((p): p is { place: 1 | 2 | 3; row: typeof ranked[number] } => Boolean(p.row));

  if (!hasScores) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-card border border-gray-200/70 bg-white p-8 text-center shadow-card cx-pop">
        <IconTile icon={Sparkles} tint="#B8860B" size={56} />
        <div>
          <h3 className="text-base font-bold text-gray-900">Todavía no hay calificación</h3>
          <p className="mt-1.5 max-w-md text-sm text-gray-500">
            Corré el oráculo para calcular el puntaje de contabilidad y de auditoría de cada empresa a partir de
            los hallazgos recibidos.
          </p>
        </div>
        <Button onClick={grade} loading={grading} className="cx-press">
          Calificar automáticamente <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showConfirm && (
        <FinalizeModal onClose={() => setShowConfirm(false)} onConfirm={finish} loading={finishing} />
      )}

      {podiumOrder.length > 0 && (
        <div className="relative overflow-hidden rounded-card shadow-soft cx-pop bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
          <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
          <div className="relative flex flex-col items-center px-6 py-10">
            <div className="mb-6 flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5">
              <PartyPopper className="h-4 w-4 text-gold-500" />
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-gold-100">
                Combinado: 60% contabilidad + 40% auditoría
              </span>
            </div>
            <div className="flex items-end justify-center gap-4 sm:gap-8">
              {podiumOrder.map(({ row, place }) => {
                const style = PLACE_STYLE[place];
                const PlaceIcon = style.icon;
                const Icon = ARCHETYPE_ICON[row.archetype];
                return (
                  <div key={row.companyId} className={`flex flex-col items-center cx-pop cx-d${place}`}>
                    <IconTile icon={Icon} tint={ARCHETYPE_TINT[row.archetype]} size={52} className="mb-2 cx-bounce" onDark />
                    <p className="max-w-[9rem] truncate text-center text-sm font-bold text-white">{row.name}</p>
                    <p className="mb-2 text-xs text-blue-100/80 tabular-nums">{row.combined?.toFixed(1)} pts</p>
                    <div className={`flex w-24 flex-col items-center justify-start rounded-t-2xl pt-3 shadow-lg sm:w-32 ${style.height}`} style={{ background: style.bg }}>
                      <PlaceIcon className="mb-1 h-6 w-6 text-white sm:h-7 sm:w-7" />
                      <span className="text-2xl font-black text-white sm:text-3xl">{place}°</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <SectionCard icon={Trophy} iconTint="#B8860B" eyebrow="Desglose" title="Tabla de posiciones" flushBody className="cx-pop cx-d2">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-gray-500">
                <th className="p-4 text-left">Posición</th>
                <th className="p-4 text-left">Empresa</th>
                <th className="p-4 text-right">Contabilidad</th>
                <th className="p-4 text-right">Auditoría</th>
                <th className="p-4 text-right">Combinado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ranked.map((r, i) => {
                const rank = i + 1;
                const Icon = ARCHETYPE_ICON[r.archetype];
                const accounting = r.accountingScore != null ? Number(r.accountingScore) : null;
                const audit = r.auditScore != null ? Number(r.auditScore) : null;
                return (
                  <tr key={r.companyId} className="transition-colors hover:bg-blue-50/50">
                    <td className="p-4">
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${
                        rank === 1 ? 'bg-gold-500 text-csq-dark' : rank === 2 ? 'bg-gray-300 text-gray-700' : rank === 3 ? 'bg-gold-700 text-white' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {rank}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2.5">
                        <IconTile icon={Icon} tint={ARCHETYPE_TINT[r.archetype]} size={32} />
                        <span className="truncate font-semibold text-gray-800">{r.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      {accounting != null ? (
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-gray-100">
                            <div className={`h-1.5 rounded-full ${scoreBar(accounting)}`} style={{ width: `${accounting}%` }} />
                          </div>
                          <span className="w-8 text-right text-xs font-semibold tabular-nums text-gray-600">{accounting.toFixed(0)}</span>
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="p-4 text-right">
                      {audit != null ? (
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-gray-100">
                            <div className={`h-1.5 rounded-full ${scoreBar(audit)}`} style={{ width: `${audit}%` }} />
                          </div>
                          <span className="w-8 text-right text-xs font-semibold tabular-nums text-gray-600">{audit.toFixed(0)}</span>
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="p-4 text-right font-mono text-base font-extrabold tabular-nums text-csq-mid">
                      {r.combined != null ? r.combined.toFixed(1) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {finalized ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-emerald-200 bg-emerald-50/70 p-5 shadow-card sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <IconTile icon={CheckCircle2} tint="#059669" size={40} />
            <p className="text-sm text-emerald-800">Esta sesión quedó finalizada. El podio y los puntajes ya son definitivos.</p>
          </div>
          <Link href="/profesor/sesiones">
            <Button variant="secondary" className="w-full cx-press sm:w-auto">
              Volver a sesiones <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-card border border-gray-200/70 bg-white p-5 shadow-card sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <IconTile icon={AlertTriangle} tint="#DC2626" size={40} />
            <p className="text-sm text-gray-600">
              Podés recalificar cuantas veces quieras. Finalizar cierra la sesión de forma permanente.
            </p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button variant="secondary" onClick={grade} loading={grading} className="flex-1 cx-press sm:flex-none">
              Recalificar
            </Button>
            <Button variant="danger" onClick={() => setShowConfirm(true)} className="flex-1 cx-press sm:flex-none">
              Finalizar sesión
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
