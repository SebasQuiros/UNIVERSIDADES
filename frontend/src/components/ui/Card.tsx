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
        'bg-white border border-gray-200/70 rounded-2xl shadow-sm overflow-hidden',
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

const TONE: Record<Tone, { bar: string; iconBg: string; iconFg: string }> = {
  gray:    { bar: 'bg-gray-200',    iconBg: 'bg-gray-50',    iconFg: 'text-gray-500'    },
  red:     { bar: 'bg-red-500',     iconBg: 'bg-red-50',     iconFg: 'text-red-600'     },
  amber:   { bar: 'bg-amber-500',   iconBg: 'bg-amber-50',   iconFg: 'text-amber-600'   },
  emerald: { bar: 'bg-emerald-500', iconBg: 'bg-emerald-50', iconFg: 'text-emerald-600' },
  blue:    { bar: 'bg-blue-500',    iconBg: 'bg-blue-50',    iconFg: 'text-blue-600'    },
  violet:  { bar: 'bg-violet-500',  iconBg: 'bg-violet-50',  iconFg: 'text-violet-600'  },
};

export function KPICard({
  label, value, hint, icon: Icon, trend, trendDirection = 'neutral', tone = 'gray',
}: KPICardProps) {
  const t = TONE[tone];

  const trendCls =
    trendDirection === 'up'   ? 'text-emerald-600 bg-emerald-50' :
    trendDirection === 'down' ? 'text-red-600 bg-red-50' :
                                'text-gray-500 bg-gray-50';
  const TrendIcon =
    trendDirection === 'up'   ? ArrowUpRight :
    trendDirection === 'down' ? ArrowDownRight : null;

  return (
    <div className="relative bg-white border border-gray-200/70 rounded-2xl shadow-sm p-6 transition-all hover:shadow-md hover:border-gray-300/70">
      {/* Left accent bar */}
      <span className={cn('absolute left-0 top-6 bottom-6 w-1 rounded-r-full', t.bar)} aria-hidden />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 tabular-nums leading-tight">{value}</p>
          <div className="mt-2 flex items-center gap-2">
            {trend && (
              <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold rounded-md', trendCls)}>
                {TrendIcon && <TrendIcon className="w-3 h-3" />}
                {trend}
              </span>
            )}
            {hint && <p className="text-xs text-gray-500 truncate">{hint}</p>}
          </div>
        </div>
        {Icon && (
          <div className={cn('flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center', t.iconBg)}>
            <Icon className={cn('w-5 h-5', t.iconFg)} />
          </div>
        )}
      </div>
    </div>
  );
}
