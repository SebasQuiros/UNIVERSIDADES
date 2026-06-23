'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  DollarSign, Euro, Percent, TrendingUp, RefreshCw, Wifi, WifiOff,
} from 'lucide-react';

interface RatePoint { compra: number; venta: number; fecha: string | null; }
interface MacroIndicators {
  dolar:     RatePoint;
  euro:      RatePoint;
  tbp:       { valor: number | null; fecha: string | null };
  inflacion: { valor: number | null; fecha: string | null };
  source:    'live' | 'cache' | 'fallback';
  updatedAt: string;
}

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : '₡' + n.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number | null | undefined) =>
  n == null ? '—' : `${n.toLocaleString('es-CR', { maximumFractionDigits: 2 })}%`;

export function MacroIndicatorsStrip() {
  const [data, setData]   = useState<MacroIndicators | null>(null);
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoad(true); setError(false);
    api.get<MacroIndicators>('/api/v1/macro/indicators')
      .then(({ data }) => { if (alive) setData(data); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoad(false); });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return <div className="rounded-2xl h-24 animate-pulse" style={{ background: '#0B1A2E' }} />;
  }
  if (error || !data) return null;

  const live = data.source !== 'fallback';

  return (
    <div className="rounded-2xl overflow-hidden text-white"
      style={{ background: 'linear-gradient(135deg,#03080F 0%,#0B1A2E 60%,#0F2657 100%)', border: '1px solid rgba(59,130,246,0.18)' }}>
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: '#93C5FD' }} />
          <span className="text-sm font-bold tracking-wide">Indicadores económicos · Costa Rica</span>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
          style={{ background: live ? 'rgba(16,185,129,0.15)' : 'rgba(251,191,36,0.15)', color: live ? '#34D399' : '#FBBF24' }}>
          {live ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {data.source === 'live' ? 'En vivo' : data.source === 'cache' ? 'Cache' : 'Referencia'}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px mt-1" style={{ background: 'rgba(59,130,246,0.12)' }}>
        <Cell icon={<DollarSign className="w-4 h-4" />} label="Dólar (venta)" value={fmt(data.dolar.venta)}
          sub={`compra ${fmt(data.dolar.compra)}`} color="#34D399" />
        <Cell icon={<Euro className="w-4 h-4" />} label="Euro (venta)" value={fmt(data.euro.venta)}
          sub={`compra ${fmt(data.euro.compra)}`} color="#60A5FA" />
        <Cell icon={<Percent className="w-4 h-4" />} label="Tasa básica pasiva" value={fmtPct(data.tbp.valor)}
          sub="BCCR · anual" color="#FBBF24" />
        <Cell icon={<TrendingUp className="w-4 h-4" />} label="Inflación interanual" value={fmtPct(data.inflacion.valor)}
          sub="IPC · BCCR" color="#A78BFA" />
      </div>

      <div className="px-5 py-2 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
        <RefreshCw className="w-3 h-3" />
        <span className="text-[10px]">
          Tipo de cambio: Ministerio de Hacienda. Actualizado {new Date(data.updatedAt).toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'short' })}.
        </span>
      </div>
    </div>
  );
}

function Cell({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="px-4 py-3" style={{ background: '#03080F' }}>
      <p className="text-[10px] uppercase tracking-wide mb-1 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
        <span style={{ color }}>{icon}</span> {label}
      </p>
      <p className="text-lg font-black leading-none" style={{ color }}>{value}</p>
      <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{sub}</p>
    </div>
  );
}

export default MacroIndicatorsStrip;
