'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SectionCard } from '@/components/ui/SectionCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { Trophy } from 'lucide-react';

interface RankRow {
  position: number; companyId: string; name: string; archetype: string;
  score: number; sharePrice: number | null; rating: string | null;
  memberCount?: number; onlineCount?: number;
  metrics: { equity: number; netIncome: number; netMargin: number; currentRatio: number; healthScore: number };
  breakdown: { salud: number; rentabilidad: number; solvencia: number };
}

/**
 * Leaderboard vivo de la sesión (Enterprise Score). Compartido por el estudiante
 * (resalta su empresa) y el profesor / mission control (`expandedMetrics` muestra
 * el desglose de todas las empresas).
 */
export function SessionLeaderboard({
  sessionId, myCompanyId, expandedMetrics = false, refreshMs = 15000,
}: {
  sessionId: string;
  myCompanyId?: string;
  expandedMetrics?: boolean;
  refreshMs?: number;
}) {
  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = () => {
      api.get<{ ranking: RankRow[] }>(`/api/v1/class-sessions/${sessionId}/ranking`)
        .then(({ data }) => { if (alive) setRows(data.ranking ?? []); })
        .catch(() => {})
        .finally(() => { if (alive) setLoading(false); });
    };
    load();
    const t = setInterval(load, refreshMs);
    return () => { alive = false; clearInterval(t); };
  }, [sessionId, refreshMs]);

  const fmt0 = (n: number) => '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 0 });
  const medal = (pos: number) => pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `${pos}`;

  return (
    <SectionCard
      icon={Trophy}
      iconTint="#D4A017"
      eyebrow="Mercado · en vivo"
      title="Ranking empresarial"
      description="Puntaje 0–1000 según la salud, rentabilidad y solvencia reales de cada empresa. Se actualiza solo."
      className="lp-in lp-in-d1"
    >
      {loading ? (
        <div className="flex justify-center py-6"><Skeleton className="h-24 w-full" /></div>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">Aún no hay datos para el ranking.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const mine = r.companyId === myCompanyId;
            const showDetail = mine || expandedMetrics;
            const pct = Math.min(100, (r.score / 1000) * 100);
            return (
              <div key={r.companyId}
                className={cn('rounded-xl border px-3 py-2.5', mine ? 'border-gold-200 bg-gold-50/60' : 'border-gray-100 bg-white')}>
                <div className="flex items-center gap-3">
                  <span className="w-7 flex-shrink-0 text-center text-lg font-bold tabular-nums">{medal(r.position)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-semibold text-gray-900">
                      <span className="truncate">{r.name}{mine && <span className="text-gold-900"> · tu empresa</span>}</span>
                      {(r.onlineCount ?? 0) > 0 && (
                        <span className="flex flex-shrink-0 items-center gap-1 text-[10px] font-medium text-emerald-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {r.onlineCount} en línea
                        </span>
                      )}
                    </p>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
                      <div className="h-1.5 rounded-full bg-gradient-to-r from-blue-600 to-[#1B2E6E]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="font-mono text-base font-bold tabular-nums text-gray-900">{r.score}</p>
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">puntos</p>
                  </div>
                </div>
                {showDetail && (
                  <div className={cn('mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-[11px] text-gray-500',
                    mine ? 'border-gold-100' : 'border-gray-100')}>
                    <span>Salud <b className="text-gray-700">{r.breakdown.salud}</b></span>
                    <span>Rentabilidad <b className="text-gray-700">{r.breakdown.rentabilidad}</b></span>
                    <span>Solvencia <b className="text-gray-700">{r.breakdown.solvencia}</b></span>
                    <span>Patrimonio <b className="text-gray-700">{fmt0(r.metrics.equity)}</b></span>
                    {r.sharePrice != null && <span>Acción <b className="text-gray-700">{fmt0(r.sharePrice)}</b></span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
