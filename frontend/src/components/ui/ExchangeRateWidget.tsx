'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, ArrowRightLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ArtCoins } from '@/components/illustrations';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UsdRate {
  currency: string;
  venta: number;
  compra: number;
  fecha: string;
  label: string;
  source: string;
}

interface ExchangeRateWidgetProps {
  /** Called whenever a rate is loaded (so the parent can store it on the invoice) */
  onRateLoaded?: (venta: number, compra: number) => void;
  /** If true, shows a compact inline version (default: false = card) */
  compact?: boolean;
}

// ── Cache: share across widget instances on the same page ─────────────────────

let _cachedRate: UsdRate | null = null;
let _cachedAt = 0;
const CACHE_MS = 30 * 60 * 1000; // 30 minutes

// ── Component ─────────────────────────────────────────────────────────────────

export function ExchangeRateWidget({ onRateLoaded, compact = false }: ExchangeRateWidgetProps) {
  const [rate, setRate]       = useState<UsdRate | null>(_cachedRate);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(_cachedAt ? new Date(_cachedAt) : null);

  const fetchRate = useCallback(async (force = false) => {
    // Use in-page cache if fresh and not forced
    if (!force && _cachedRate && Date.now() - _cachedAt < CACHE_MS) {
      setRate(_cachedRate);
      setLastUpdated(new Date(_cachedAt));
      onRateLoaded?.(_cachedRate.venta, _cachedRate.compra);
      return;
    }

    setLoading(true);
    setError(false);
    try {
      const { data } = await api.get<UsdRate>('/api/v1/hacienda/exchange-rate/usd');
      _cachedRate = data;
      _cachedAt   = Date.now();
      setRate(data);
      setLastUpdated(new Date());
      onRateLoaded?.(data.venta, data.compra);
    } catch {
      setError(true);
      // If we have a stale cached value, keep showing it
      if (_cachedRate) {
        setRate(_cachedRate);
        onRateLoaded?.(_cachedRate.venta, _cachedRate.compra);
      }
    } finally {
      setLoading(false);
    }
  }, [onRateLoaded]);

  // Fetch on mount
  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

  // Auto-refresh every 30 minutes
  useEffect(() => {
    const interval = setInterval(() => fetchRate(true), CACHE_MS);
    return () => clearInterval(interval);
  }, [fetchRate]);

  // ── Format helpers ─────────────────────────────────────────────────────────
  function formatTime(d: Date | null): string {
    if (!d) return '';
    return d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
  }

  // ── Compact inline version ──────────────────────────────────────────────────
  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-800 cx-wiggle-parent">
        <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600 shrink-0 cx-wiggle" strokeWidth={1.75} />
        {loading ? (
          <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
        ) : error && !rate ? (
          <span className="text-xs font-medium text-gold-700">TC no disponible</span>
        ) : rate ? (
          <>
            <span className="text-xs font-bold font-mono tabular-nums">₡{rate.venta.toFixed(2)} / $1</span>
            <span className="text-xs text-blue-600">({rate.source})</span>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => fetchRate(true)}
          className="text-blue-500 hover:text-blue-700 ml-0.5 transition-colors cx-press"
          title="Actualizar tipo de cambio"
          aria-label="Actualizar tipo de cambio"
          disabled={loading}
        >
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
        </button>
      </div>
    );
  }

  // ── Card version ───────────────────────────────────────────────────────────
  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3.5">
      <div aria-hidden className="pointer-events-none absolute -right-3 -bottom-4 opacity-30">
        <ArtCoins size={92} className="cx-float" />
      </div>

      <div className="relative flex items-center justify-between gap-3">
        {/* Izquierda: icono + etiqueta */}
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-blue-100 shrink-0">
            <ArrowRightLeft className="w-4 h-4 text-blue-700" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-gold-900">
              Tipo de cambio
            </p>
            <p className="text-sm font-semibold text-blue-900 leading-tight">Dólar BCCR</p>
          </div>
        </div>

        {/* Derecha: valor + refrescar */}
        <div className="flex items-center gap-2">
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
          ) : error && !rate ? (
            <div className="flex items-center gap-1.5 text-gold-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-medium">No disponible</span>
            </div>
          ) : rate ? (
            <div className="text-right">
              <p className="text-base font-extrabold font-mono tabular-nums text-blue-900 cx-count">
                ₡{rate.venta.toFixed(2)} / $1
              </p>
              <p className="text-xs text-blue-600 font-mono tabular-nums">
                Compra: ₡{rate.compra.toFixed(2)}
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => fetchRate(true)}
            className="p-1.5 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-white transition-colors cx-press"
            title="Actualizar tipo de cambio"
            aria-label="Actualizar tipo de cambio"
            disabled={loading}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Aviso cuando mostramos un valor en caché (servicio caído) */}
      {error && rate && (
        <p className="relative mt-2.5 text-xs text-gold-700 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          Servicio BCCR no disponible. Puedes ingresar el tipo de cambio manualmente.
        </p>
      )}

      {/* Pie: última actualización + fuente */}
      {lastUpdated && !error && (
        <p className="relative mt-2 text-xs text-blue-500">
          Actualizado a las <span className="font-mono tabular-nums">{formatTime(lastUpdated)}</span>
          {' · '}Fuente: {rate?.source ?? 'BCCR'}
        </p>
      )}

      {/* Entrada manual cuando la API no responde */}
      {error && !rate && (
        <ManualRateInput onSubmit={(v) => {
          const fallback: UsdRate = {
            currency: 'USD', venta: v, compra: v - 5,
            fecha: new Date().toISOString().split('T')[0],
            label: `₡${v.toFixed(2)} / $1`, source: 'Manual',
          };
          setRate(fallback);
          onRateLoaded?.(fallback.venta, fallback.compra);
          setError(false);
        }} />
      )}
    </div>
  );
}

// ── Manual rate input (shown when API is unavailable) ─────────────────────────

function ManualRateInput({ onSubmit }: { onSubmit: (venta: number) => void }) {
  const [val, setVal] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(val);
    if (num > 0) onSubmit(num);
  }

  return (
    <form onSubmit={handleSubmit} className="relative mt-2.5 flex gap-2">
      <input
        type="number"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Ej: 530.00"
        min="1"
        step="0.01"
        aria-label="Tipo de cambio manual"
        className="flex-1 px-3 py-1.5 text-xs font-mono tabular-nums rounded-lg border border-gold-100 bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500"
      />
      <button
        type="submit"
        disabled={!val || parseFloat(val) <= 0}
        className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-gradient-to-br from-gold-600 to-gold-700 shadow-[0_4px_12px_rgba(184,134,11,0.28)] transition-all hover:shadow-[0_8px_20px_rgba(184,134,11,0.38)] disabled:opacity-40 disabled:shadow-none cx-press"
      >
        Usar este TC
      </button>
    </form>
  );
}
