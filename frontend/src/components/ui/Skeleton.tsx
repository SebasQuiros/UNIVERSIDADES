import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

/**
 * Bloque de carga. El brillo que recorre la superficie es `.cx-shimmer`
 * (globals.css); se desactiva solo con `prefers-reduced-motion`, dejando el
 * fondo gris estático.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('cx-shimmer rounded-lg bg-gray-200/70', className)}
      aria-hidden
    />
  );
}

export function KPICardSkeleton() {
  return (
    <div className="relative bg-white border border-gray-200/70 rounded-card shadow-card p-6">
      <span className="absolute left-0 top-6 bottom-6 w-1 rounded-r-full bg-gray-200" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="w-10 h-10 rounded-xl" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 7 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-8 py-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn(
                'h-4',
                c === 0 ? 'w-40' : c === cols - 1 ? 'w-20' : 'w-24',
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EntrySkeleton() {
  return (
    <div className="border-b border-gray-100 px-6 lg:px-8 py-5">
      <div className="flex items-center gap-4">
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 flex-1 max-w-md" />
        <Skeleton className="h-6 w-20 rounded-md" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
    </div>
  );
}
