import { cn } from '@/lib/utils';
import type { ElementType, ReactNode } from 'react';
import { IconTile } from './IconTile';

// ── PageHeader ────────────────────────────────────────────────────────────────
// Encabezado de página del sistema interno: eyebrow dorado opcional + título
// display + subtítulo + slot de acciones. Lenguaje visual del landing.
//
//   <PageHeader
//     eyebrow="Impuestos"
//     title="Declaración D-104"
//     subtitle="Resumen del IVA del período"
//     icon={Receipt}
//     actions={<Button>Nueva</Button>}
//   />

interface PageHeaderProps {
  title: string;
  /** Texto corto en mayúsculas, color dorado (kicker sobre el título). */
  eyebrow?: string;
  subtitle?: string;
  /** Slot de acciones a la derecha (botones, filtros). */
  actions?: ReactNode;
  /** Icono lucide opcional, mostrado en un IconTile a la izquierda. */
  icon?: ElementType;
  /** Tinte del IconTile (hex). */
  iconTint?: string;
  className?: string;
}

export function PageHeader({
  title, eyebrow, subtitle, actions, icon: Icon, iconTint = '#1B2E6E', className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="flex items-start gap-4 min-w-0">
        {Icon && <IconTile icon={Icon} tint={iconTint} size={52} className="mt-0.5" />}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold-700 mb-1">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 leading-tight">
            {title}
          </h1>
          {subtitle && <p className="mt-1.5 text-sm text-gray-500 max-w-prose">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
