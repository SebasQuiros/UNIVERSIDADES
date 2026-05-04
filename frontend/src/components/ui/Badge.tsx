import { cn } from '@/lib/utils';
import type { ExerciseStatus, ExerciseDifficulty } from '@/types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'green' | 'amber' | 'red' | 'slate' | 'purple' | 'emerald';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ children, variant = 'slate', size = 'sm', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded-full',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        {
          'bg-blue-50 text-blue-700 border border-blue-200':      variant === 'blue',
          'bg-emerald-50 text-emerald-700 border border-emerald-200': variant === 'emerald',
          'bg-green-50 text-green-700 border border-green-200':   variant === 'green',
          'bg-amber-50 text-amber-700 border border-amber-200':   variant === 'amber',
          'bg-red-50 text-red-700 border border-red-200':         variant === 'red',
          'bg-gray-100 text-gray-600 border border-gray-200':     variant === 'slate',
          'bg-purple-50 text-purple-700 border border-purple-200': variant === 'purple',
        },
        className,
      )}
    >
      {children}
    </span>
  );
}

// ── Convenience: status badge ──────────────────────────────────────────────
const STATUS_CONFIG: Record<ExerciseStatus, { label: string; variant: BadgeProps['variant']; dot: string }> = {
  NOT_STARTED: { label: 'Sin iniciar',   variant: 'slate',   dot: 'bg-gray-400' },
  IN_PROGRESS: { label: 'En progreso',   variant: 'blue',    dot: 'bg-blue-500 animate-pulse' },
  SUBMITTED:   { label: 'Entregado',     variant: 'amber',   dot: 'bg-amber-500' },
  GRADED:      { label: 'Calificado',    variant: 'emerald', dot: 'bg-emerald-500' },
};

export function StatusBadge({ status }: { status: ExerciseStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <Badge variant={cfg.variant}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </Badge>
  );
}

// ── Difficulty badge ───────────────────────────────────────────────────────
const DIFF_CONFIG: Record<ExerciseDifficulty, { label: string; variant: BadgeProps['variant'] }> = {
  BASIC:        { label: 'Básico',        variant: 'green'  },
  INTERMEDIATE: { label: 'Intermedio',    variant: 'amber'  },
  ADVANCED:     { label: 'Avanzado',      variant: 'red'    },
};

export function DifficultyBadge({ difficulty }: { difficulty: ExerciseDifficulty }) {
  const cfg = DIFF_CONFIG[difficulty];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
