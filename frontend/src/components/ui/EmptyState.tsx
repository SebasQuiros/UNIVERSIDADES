import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

// ── EmptyState ────────────────────────────────────────────────────────────────
// Estado vacío / sin resultados: ilustración de personaje + título + texto + CTA.
// Pensado para consumir la librería de ilustraciones de marca.
//
//   import { SceneEmptyBox } from '@/components/illustrations';
//   <EmptyState
//     illustration={<SceneEmptyBox size={220} />}
//     title="Aún no hay movimientos"
//     description="Registra tu primer asiento para verlo aquí."
//     action={<Button>Nuevo asiento</Button>}
//   />

interface EmptyStateProps {
  /** Ilustración de marca (p. ej. <SceneEmptyBox />). */
  illustration?: ReactNode;
  title: string;
  description?: string;
  /** CTA opcional (normalmente un <Button>). */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ illustration, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-6 py-12', className)}>
      {illustration && <div className="mb-5">{illustration}</div>}
      <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-gray-500">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
