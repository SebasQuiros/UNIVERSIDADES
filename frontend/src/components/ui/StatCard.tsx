import { cn } from '@/lib/utils';
import type { ElementType } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { IconTile } from './IconTile';

// ── StatCard ──────────────────────────────────────────────────────────────────
// Tarjeta de KPI: etiqueta, valor grande, delta opcional y un IconTile.
// Variante clara (por defecto) u oscura (fondo azul noche) para dashboards.
//
//   <StatCard label="Ventas del mes" value="₡ 1.240.500" delta="+8,2%"
//             deltaDirection="up" icon={TrendingUp} tint="#2563EB" />

interface StatCardProps {
  label: string;
  /** Valor ya formateado (p. ej. moneda en es-CR con ₡). */
  value: string;
  /** Variación, p. ej. "+8,2%". El signo/`deltaDirection` define el color. */
  delta?: string;
  deltaDirection?: 'up' | 'down' | 'neutral';
  /** Texto auxiliar pequeño junto al delta. */
  hint?: string;
  /** Icono lucide opcional (IconTile arriba a la derecha). */
  icon?: ElementType;
  /** Tinte del IconTile / acento (hex). */
  tint?: string;
  variant?: 'light' | 'dark';
  className?: string;
}

export function StatCard({
  label, value, delta, deltaDirection = 'neutral', hint, icon: Icon, tint = '#1B2E6E',
  variant = 'light', className,
}: StatCardProps) {
  const dark = variant === 'dark';

  const deltaCls = dark
    ? (deltaDirection === 'up' ? 'text-emerald-300 bg-white/10'
      : deltaDirection === 'down' ? 'text-red-300 bg-white/10'
      : 'text-blue-100 bg-white/10')
    : (deltaDirection === 'up' ? 'text-emerald-600 bg-emerald-50'
      : deltaDirection === 'down' ? 'text-red-600 bg-red-50'
      : 'text-gray-500 bg-gray-50');

  const DeltaIcon =
    deltaDirection === 'up' ? ArrowUpRight :
    deltaDirection === 'down' ? ArrowDownRight : null;

  return (
    <div
      className={cn(
        'rounded-card p-5 transition-all',
        dark
          ? 'bg-gradient-to-br from-csq-mid to-csq-active border border-white/10 text-white shadow-soft'
          : 'bg-white border border-gray-200/70 shadow-card hover:shadow-card-hover hover:border-gray-300/70',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={cn('text-xs font-medium uppercase tracking-wider', dark ? 'text-blue-200/80' : 'text-gray-500')}>
            {label}
          </p>
          <p className={cn('mt-2 text-3xl font-extrabold tabular-nums leading-tight', dark ? 'text-white' : 'text-gray-900')}>
            {value}
          </p>
          {(delta || hint) && (
            <div className="mt-2 flex items-center gap-2">
              {delta && (
                <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold rounded-md', deltaCls)}>
                  {DeltaIcon && <DeltaIcon className="w-3 h-3" />}
                  {delta}
                </span>
              )}
              {hint && <p className={cn('text-xs truncate', dark ? 'text-blue-200/70' : 'text-gray-500')}>{hint}</p>}
            </div>
          )}
        </div>
        {Icon && <IconTile icon={Icon} tint={tint} size={46} onDark={dark} />}
      </div>
    </div>
  );
}
