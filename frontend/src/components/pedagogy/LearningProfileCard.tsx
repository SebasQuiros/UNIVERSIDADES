'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { ArtBalance } from '@/components/illustrations';
import { Target, Award, AlertTriangle, BarChart2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
// El perfil de aprendizaje es evidencia SINAES: dominio por competencia,
// fortalezas, errores recurrentes y estadísticas agregadas del estudiante.
interface LearningProfile {
  competencyMastery: Record<string, number>;
  strengths: Array<{ area: string; note?: string }>;
  recurringErrors: Array<{ type: string; count: number; lastSeen?: string }>;
  stats: {
    avgScore?: number;
    totalEvents?: number;
    exerciseHistory?: unknown[];
  };
}

function masteryColor(pct: number) {
  if (pct >= 75) return '#10B981';
  if (pct >= 50) return '#2563EB';
  if (pct >= 25) return '#F59E0B';
  return '#EF4444';
}

export function LearningProfileCard({ studentId }: { studentId?: string }) {
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    const url = studentId
      ? `/api/v1/pedagogy/students/${studentId}/profile`
      : '/api/v1/pedagogy/profile';
    setLoading(true);
    setError(false);
    api.get<LearningProfile>(url)
      .then(({ data }) => setProfile(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return (
    <div className="flex justify-center py-12"><Spinner size="lg" /></div>
  );

  if (error || !profile) return (
    <Card>
      <EmptyState
        illustration={<ArtBalance size={150} className="lp-drift" />}
        title="Perfil en construcción"
        description="No hay perfil de aprendizaje disponible todavía."
      />
    </Card>
  );

  const mastery = Object.entries(profile.competencyMastery ?? {});
  const strengths = profile.strengths ?? [];
  const recurringErrors = profile.recurringErrors ?? [];
  const stats = profile.stats ?? {};

  return (
    <div className="flex flex-col gap-4">
      {/* Stats clave */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Nota promedio"
          value={stats.avgScore != null ? `${Math.round(stats.avgScore)}%` : '—'}
          icon={Target}
          tint="#2563EB"
        />
        <StatCard
          label="Observaciones del tutor"
          value={String(stats.totalEvents ?? 0)}
          icon={BarChart2}
          tint="#4F46E5"
        />
      </div>

      {/* Dominio por competencia */}
      <SectionCard icon={BarChart2} iconTint="#2563EB" eyebrow="Evidencia SINAES" title="Dominio por competencia">
        {mastery.length === 0 ? (
          <p className="text-sm text-gray-400">Sin datos de competencias aún.</p>
        ) : (
          <div className="space-y-3">
            {mastery.map(([area, pctRaw]) => {
              const pct = Math.max(0, Math.min(100, Math.round(Number(pctRaw) || 0)));
              return (
                <div key={area}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">{area}</span>
                    <span className="text-xs font-semibold text-gray-500 font-mono tabular-nums">{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: masteryColor(pct) }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Fortalezas */}
      <SectionCard icon={Award} iconTint="#059669" title="Fortalezas">
        {strengths.length === 0 ? (
          <p className="text-sm text-gray-400">Todavía no se identificaron fortalezas.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {strengths.map((s, i) => (
              <span key={`${s.area}-${i}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                title={s.note ?? undefined}>
                <Award className="w-3 h-3" /> {s.area}
              </span>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Errores recurrentes */}
      <SectionCard icon={AlertTriangle} iconTint="#D97706" title="Errores recurrentes">
        {recurringErrors.length === 0 ? (
          <p className="text-sm text-gray-400">Sin errores recurrentes registrados. ¡Buen trabajo!</p>
        ) : (
          <div className="space-y-2">
            {recurringErrors.map((e, i) => (
              <div key={`${e.type}-${i}`}
                className="flex items-center gap-3 p-2.5 rounded-xl border border-amber-100 bg-amber-50/60">
                <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-full text-xs font-bold font-mono tabular-nums bg-amber-100 text-amber-700 flex-shrink-0">
                  {e.count}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{e.type}</p>
                  {e.lastSeen && (
                    <p className="text-[11px] text-gray-400">Último: {formatDate(e.lastSeen)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
