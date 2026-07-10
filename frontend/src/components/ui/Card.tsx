import { cn } from '@/lib/utils';
import { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

// ── Card ──────────────────────────────────────────────────────────────────────

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white border border-gray-200 rounded-xl shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between px-6 lg:px-8 pt-6 pb-5 border-b border-gray-100', className)}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-gray-900 tracking-tight">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
    </div>
  );
}

// ── KPICard ───────────────────────────────────────────────────────────────────

type Tone = 'gray' | 'red' | 'amber' | 'emerald' | 'blue' | 'violet';

interface KPICardProps {
  label:  string;
  value:  string;
  hint?:  string;
  /** Optional Lucide icon component (rendered top-right in tinted square). */
  icon?:  React.ComponentType<{ className?: string }>;
  /** Optional trend indicator (e.g. "+5.2%"). Sign drives color. */
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  /** Color accent (left bar + icon tint). */
  tone?:  Tone;
}

const TONE: Record<Tone, { iconBg: string; iconFg: string }> = {
  gray:    { iconBg: 'bg-slate-100',   iconFg: 'text-slate-600'  },
  red:     { iconBg: 'bg-red-50',      iconFg: 'text-red-600'    },
  amber:   { iconBg: 'bg-amber-50',    iconFg: 'text-amber-700'  },
  emerald: { iconBg: 'bg-teal-50',     iconFg: 'text-teal-700'   },
  blue:    { iconBg: 'bg-teal-50',     iconFg: 'text-teal-700'   },
  violet:  { iconBg: 'bg-teal-50',     iconFg: 'text-teal-700'   },
};

export function KPICard({
  label, value, hint, icon: Icon, trend, trendDirection = 'neutral', tone = 'gray',
}: KPICardProps) {
  const t = TONE[tone];

  const trendCls =
    trendDirection === 'up'   ? 'text-teal-700 bg-teal-50' :
    trendDirection === 'down' ? 'text-red-600 bg-red-50' :
                                'text-gray-500 bg-gray-50';
  const TrendIcon =
    trendDirection === 'up'   ? ArrowUpRight :
    trendDirection === 'down' ? ArrowDownRight : null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-4 transition-colors hover:border-gray-300">
      <div className="flex items-center gap-2">
        {Icon && (
          <span className={cn('flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center', t.iconBg)}>
            <Icon className={cn('w-3.5 h-3.5', t.iconFg)} />
          </span>
        )}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 font-mono truncate">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900 font-mono tabular-nums leading-none tracking-tight">{value}</p>
      {(trend || hint) && (
        <div className="mt-3 flex items-center gap-2 pt-3 border-t border-gray-100">
          {trend && (
            <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-bold rounded font-mono', trendCls)}>
              {TrendIcon && <TrendIcon className="w-3 h-3" />}
              {trend}
            </span>
          )}
          {hint && <p className="text-[11px] text-gray-500 truncate">{hint}</p>}
        </div>
      )}
    </div>
  );
}
