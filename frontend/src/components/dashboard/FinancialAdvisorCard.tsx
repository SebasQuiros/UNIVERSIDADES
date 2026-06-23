'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  Sparkles, AlertTriangle, AlertCircle, CheckCircle2, Info, ChevronRight,
} from 'lucide-react';

type Level = 'critical' | 'warning' | 'good' | 'info';
interface Insight {
  level: Level;
  title: string;
  detail: string;
  action?: string;
}
interface Advisor {
  headline: string;
  counts: { critical: number; warnings: number; total: number };
  insights: Insight[];
  snapshot: {
    cash: number; receivables: number; payables: number; ivaPorPagar: number;
    currentRatio: number; debtRatio: number; netMargin: number; netIncome: number;
  };
  generatedAt: string;
}

const STYLES: Record<Level, { bg: string; border: string; fg: string; icon: React.ReactNode; tag: string }> = {
  critical: { bg: '#FEF2F2', border: '#FECACA', fg: '#B91C1C', icon: <AlertTriangle className="w-4 h-4" />, tag: 'Crítico' },
  warning:  { bg: '#FFFBEB', border: '#FDE68A', fg: '#B45309', icon: <AlertCircle className="w-4 h-4" />,  tag: 'Atención' },
  good:     { bg: '#ECFDF5', border: '#A7F3D0', fg: '#047857', icon: <CheckCircle2 className="w-4 h-4" />, tag: 'Bien' },
  info:     { bg: '#EFF6FF', border: '#BFDBFE', fg: '#1D4ED8', icon: <Info className="w-4 h-4" />,         tag: 'Info' },
};

export function FinancialAdvisorCard({ companyId }: { companyId: string }) {
  const [data, setData]   = useState<Advisor | null>(null);
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    let alive = true;
    setLoad(true); setError(false);
    api.get<Advisor>(`/api/v1/companies/${companyId}/advisor`)
      .then(({ data }) => { if (alive) setData(data); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoad(false); });
    return () => { alive = false; };
  }, [companyId]);

  if (loading) {
    return <div className="rounded-2xl h-64 bg-slate-100 animate-pulse" />;
  }
  if (error || !data) return null;

  const { counts } = data;
  const accent = counts.critical > 0 ? '#B91C1C' : counts.warnings > 0 ? '#B45309' : '#047857';

  return (
    <div className="rounded-2xl border bg-white overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-4" style={{ background: 'linear-gradient(135deg,#0F172A,#1E293B)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#8B5CF6,#6366F1)' }}>
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Gerente Financiero IA</p>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Análisis automático de tus libros
            </p>
          </div>
        </div>
        <p className="text-sm text-white mt-3 leading-snug">{data.headline}</p>
        {counts.total > 0 && (
          <div className="flex items-center gap-2 mt-3">
            {counts.critical > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
                {counts.critical} crítico{counts.critical > 1 ? 's' : ''}
              </span>
            )}
            {counts.warnings > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#B45309' }}>
                {counts.warnings} por vigilar
              </span>
            )}
          </div>
        )}
      </div>

      {/* Insights */}
      <div className="p-4 space-y-2.5">
        {data.insights.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-6">
            Registra movimientos para recibir recomendaciones personalizadas.
          </p>
        )}
        {data.insights.map((ins, i) => {
          const s = STYLES[ins.level];
          return (
            <div key={i} className="rounded-xl border p-3" style={{ background: s.bg, borderColor: s.border }}>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex-shrink-0" style={{ color: s.fg }}>{s.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold" style={{ color: s.fg }}>{ins.title}</p>
                  <p className="text-xs text-slate-600 mt-0.5 leading-snug">{ins.detail}</p>
                  {ins.action && (
                    <p className="text-xs font-semibold mt-1.5 flex items-start gap-1" style={{ color: s.fg }}>
                      <ChevronRight className="w-3.5 h-3.5 mt-px flex-shrink-0" /> {ins.action}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 pb-3">
        <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <Info className="w-3 h-3 flex-shrink-0" />
          Recomendaciones generadas a partir de tu contabilidad. Solo fines educativos.
        </p>
      </div>
    </div>
  );
}

export default FinancialAdvisorCard;
