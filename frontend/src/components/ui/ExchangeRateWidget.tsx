'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';

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
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800">
        <span className="text-sm">💱</span>
        {loading ? (
          <RefreshCw className="w-3 h-3 animate-spin text-teal-600" />
        ) : error && !rate ? (
          <span className="text-xs text-amber-600">TC no disponible</span>
        ) : rate ? (
          <>
            <span className="text-xs font-semibold font-mono tabular-nums">₡{rate.venta.toFixed(2)} / $1</span>
            <span className="text-xs text-teal-700">({rate.source})</span>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => fetchRate(true)}
          className="text-teal-500 hover:text-teal-700 ml-0.5"
          title="Actualizar tipo de cambio"
          disabled={loading}
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    );
  }

  // ── Card version ───────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        {/* Left: icon + label */}
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-teal-700 shrink-0" />
          <span className="text-sm font-medium text-teal-800">Tipo de cambio BCCR</span>
        </div>

        {/* Right: rate value + refresh */}
        <div className="flex items-center gap-2">
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
          ) : error && !rate ? (
            <div className="flex items-center gap-1.5 text-amber-600">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs">No disponible</span>
            </div>
          ) : rate ? (
            <div className="text-right">
              <p className="text-base font-bold font-mono tabular-nums text-teal-900">
                ₡{rate.venta.toFixed(2)} / $1
              </p>
              <p className="text-xs text-teal-600">
                Compra: ₡{rate.compra.toFixed(2)}
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => fetchRate(true)}
            className="p-1.5 rounded-lg text-teal-500 hover:text-teal-700 hover:bg-teal-100 transition-colors"
            title="Actualizar tipo de cambio"
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error warning when showing stale data */}
      {error && rate && (
        <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          Servicio BCCR no disponible. Puede ingresar el tipo de cambio manualmente.
        </p>
      )}

      {/* Footer: last updated + source */}
      {lastUpdated && !error && (
        <p className="mt-1.5 text-xs text-teal-500">
          Actualizado a las {formatTime(lastUpdated)} · Fuente: {rate?.source ?? 'BCCR'}
        </p>
      )}

      {/* Manual override input shown when API is down */}
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
    <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
      <input
        type="number"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Ej: 530.00"
        min="1"
        step="0.01"
        className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
      <button
        type="submit"
        disabled={!val || parseFloat(val) <= 0}
        className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40"
      >
        Usar este TC
      </button>
    </form>
  );
}
