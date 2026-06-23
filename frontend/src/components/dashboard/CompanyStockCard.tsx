'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Activity, Info, Building2,
} from 'lucide-react';

interface Valuation {
  ticker: string;
  sharePrice: number;
  marketCap: number;
  sharesOutstanding: number;
  change: { abs: number; pct: number };
  rating: string;
  healthScore: number;
  financials: {
    totalAssets: number; totalLiabilities: number; equity: number;
    totalIncome: number; totalExpenses: number; netIncome: number;
  };
  ratios: { netMargin: number; currentRatio: number; debtRatio: number; roe: number };
  priceHistory: Array<{ label: string; price: number }>;
}

const fmtCRC = (n: number) =>
  '₡' + (n ?? 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtBig = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return '₡' + (n / 1_000_000).toLocaleString('es-CR', { maximumFractionDigits: 2 }) + 'M';
  if (Math.abs(n) >= 1_000)     return '₡' + (n / 1_000).toLocaleString('es-CR', { maximumFractionDigits: 1 }) + 'K';
  return fmtCRC(n);
};

function ratingColor(r: string) {
  if (r.startsWith('AAA') || r.startsWith('AA')) return { bg: '#ECFDF5', fg: '#047857' };
  if (r.startsWith('A'))   return { bg: '#EFF6FF', fg: '#1D4ED8' };
  if (r.startsWith('BBB') || r.startsWith('BB')) return { bg: '#FFFBEB', fg: '#B45309' };
  return { bg: '#FEF2F2', fg: '#B91C1C' };
}

function deriveTicker(name?: string) {
  if (!name) return 'EMPR';
  const letters = name.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim().split(/\s+/);
  if (letters.length >= 2) return (letters[0][0] + letters[1][0] + (letters[2]?.[0] ?? letters[0][1] ?? 'X')).toUpperCase().slice(0, 4);
  return name.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'EMPR';
}

export function CompanyStockCard({ companyId, companyName }: { companyId: string; companyName?: string }) {
  const [val, setVal]     = useState<Valuation | null>(null);
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    setLoad(true); setError(false);
    api.get<Valuation>(`/api/v1/companies/${companyId}/valuation`)
      .then(({ data }) => setVal(data))
      .catch(() => setError(true))
      .finally(() => setLoad(false));
  }, [companyId]);

  if (loading) {
    return <div className="rounded-2xl h-64 animate-pulse" style={{ background: '#0B1A2E' }} />;
  }
  if (error || !val) return null;

  const up = val.change.abs >= 0;
  const trendColor = up ? '#10B981' : '#EF4444';
  const rc = ratingColor(val.rating);
  const ticker = deriveTicker(companyName);

  return (
    <div className="rounded-2xl overflow-hidden text-white"
      style={{ background: 'linear-gradient(135deg,#03080F 0%,#0B1A2E 60%,#0F2657 100%)', border: '1px solid rgba(59,130,246,0.18)' }}>

      {/* Encabezado tipo bolsa */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#3B82F6,#1E3A8A)' }}>
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold tracking-wider text-sm" style={{ color: '#93C5FD' }}>{ticker}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
                style={{ background: rc.bg, color: rc.fg }}>{val.rating}</span>
            </div>
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {companyName ?? 'Valoración de mi empresa'}
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-black leading-none">{fmtCRC(val.sharePrice)}</p>
          <p className="text-xs font-bold flex items-center gap-1 justify-end mt-1" style={{ color: trendColor }}>
            {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {up ? '+' : ''}{fmtCRC(val.change.abs)} ({up ? '+' : ''}{val.change.pct}%)
          </p>
        </div>
      </div>

      {/* Gráfico de precio */}
      <div className="px-1 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={val.priceHistory} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="stockArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={trendColor} stopOpacity={0.4} />
                <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.35)' }} axisLine={false} tickLine={false} />
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Tooltip
              formatter={(v: any) => [fmtCRC(Number(v)), 'Precio']}
              contentStyle={{ background: '#03080F', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, fontSize: 12, color: '#fff' }}
              labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
            />
            <Area type="monotone" dataKey="price" stroke={trendColor} strokeWidth={2.5}
              fill="url(#stockArea)" dot={false} activeDot={{ r: 4, fill: trendColor }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-px mt-2" style={{ background: 'rgba(59,130,246,0.12)' }}>
        <Metric label="Capitalización" value={fmtBig(val.marketCap)} />
        <Metric label="Patrimonio" value={fmtBig(val.financials.equity)} />
        <Metric label="Utilidad neta" value={fmtBig(val.financials.netIncome)}
          color={val.financials.netIncome >= 0 ? '#34D399' : '#F87171'} />
      </div>

      {/* Salud financiera + ratios */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <Activity className="w-3.5 h-3.5" /> Salud financiera
          </span>
          <span className="text-sm font-black" style={{ color: trendColor }}>{val.healthScore}/100</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${val.healthScore}%`, background: `linear-gradient(90deg,#EF4444,#FBBF24 50%,#10B981)` }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Ratio label="Margen neto" value={`${val.ratios.netMargin}%`} good={val.ratios.netMargin >= 5} />
          <Ratio label="Liquidez" value={`${val.ratios.currentRatio}x`} good={val.ratios.currentRatio >= 1} />
          <Ratio label="Endeudamiento" value={`${val.ratios.debtRatio}%`} good={val.ratios.debtRatio <= 60} />
          <Ratio label="ROE" value={`${val.ratios.roe}%`} good={val.ratios.roe > 0} />
        </div>
      </div>

      {/* Aviso educativo */}
      <div className="px-5 pb-4">
        <p className="text-[11px] flex items-start gap-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
          Valoración simulada calculada a partir de tu contabilidad ({val.sharesOutstanding.toLocaleString('es-CR')} acciones). Solo fines educativos.
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="px-4 py-3" style={{ background: '#03080F' }}>
      <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
      <p className="text-sm font-bold" style={{ color: color ?? '#fff' }}>{value}</p>
    </div>
  );
}

function Ratio({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="rounded-lg px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
      <p className="text-[10px] mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
      <p className="text-sm font-bold" style={{ color: good ? '#34D399' : '#FBBF24' }}>{value}</p>
    </div>
  );
}

export default CompanyStockCard;
