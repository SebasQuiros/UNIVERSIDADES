import { cn } from '@/lib/utils';
import type { ElementType, ReactNode } from 'react';
import { IconTile } from './IconTile';

// ── SectionCard ───────────────────────────────────────────────────────────────
// Contenedor de sección: cabecera (icono + eyebrow + título + descripción +
// acción) sobre un cuerpo de contenido. Variante clara u oscura.
//
//   <SectionCard title="Balance de comprobación" icon={Scale}
//                action={<Button variant="outline" size="sm">Exportar</Button>}>
//     <Tabla ... />
//   </SectionCard>

interface SectionCardProps {
  title?: string;
  eyebrow?: string;
  description?: string;
  icon?: ElementType;
  iconTint?: string;
  /** Slot de acción a la derecha de la cabecera. */
  action?: ReactNode;
  children: ReactNode;
  variant?: 'default' | 'onDark';
  /** Quita el padding del cuerpo (útil para tablas a sangre). */
  flushBody?: boolean;
  className?: string;
  bodyClassName?: string;
}

export function SectionCard({
  title, eyebrow, description, icon: Icon, iconTint = '#1B2E6E', action, children,
  variant = 'default', flushBody = false, className, bodyClassName,
}: SectionCardProps) {
  const dark = variant === 'onDark';
  const hasHeader = Boolean(title || eyebrow || description || Icon || action);

  return (
    <section
      className={cn(
        'rounded-card overflow-hidden',
        dark
          ? 'bg-gradient-to-br from-csq-mid to-csq-active border border-white/10 text-white shadow-soft'
          : 'bg-white border border-gray-200/70 shadow-card',
        className,
      )}
    >
      {hasHeader && (
        <div
          className={cn(
            'flex items-start justify-between gap-4 px-6 lg:px-7 pt-5 pb-4 border-b',
            dark ? 'border-white/10' : 'border-gray-100',
          )}
        >
          <div className="flex items-start gap-3.5 min-w-0">
            {Icon && <IconTile icon={Icon} tint={iconTint} size={44} onDark={dark} />}
            <div className="min-w-0">
              {eyebrow && (
                <p className={cn('text-[0.68rem] font-bold uppercase tracking-[0.13em] mb-0.5', dark ? 'text-gold-500' : 'text-gold-700')}>
                  {eyebrow}
                </p>
              )}
              {title && (
                <h3 className={cn('text-base font-bold tracking-tight', dark ? 'text-white' : 'text-gray-900')}>
                  {title}
                </h3>
              )}
              {description && (
                <p className={cn('mt-1 text-sm', dark ? 'text-blue-200/80' : 'text-gray-500')}>{description}</p>
              )}
            </div>
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn(flushBody ? '' : 'px-6 lg:px-7 py-5', bodyClassName)}>{children}</div>
    </section>
  );
}
