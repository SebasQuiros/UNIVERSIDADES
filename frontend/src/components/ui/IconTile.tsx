import type { ElementType } from 'react';

// ── IconTile ────────────────────────────────────────────────────────────────
// Portado del landing. Un icono lucide (strokeWidth 1.75) dentro de un tile
// redondeado con tinte/degradado de marca. Lenguaje único de iconos del sistema.
//
//   import { IconTile } from '@/components/ui/IconTile';
//   import { Receipt } from 'lucide-react';
//   <IconTile icon={Receipt} tint="#B8860B" size={50} />

interface IconTileProps {
  /** Componente de icono de lucide-react. */
  icon: ElementType;
  /** Color de tinte (hex). Genera el degradado y el borde. Ignorado si onDark. */
  tint?: string;
  /** Lado del tile en px. */
  size?: number;
  /** Variante para fondos oscuros (usa blancos translúcidos y azul claro). */
  onDark?: boolean;
  className?: string;
}

export function IconTile({ icon: Icon, tint = '#1B2E6E', size = 52, onDark = false, className }: IconTileProps) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: onDark
          ? 'rgba(255,255,255,0.08)'
          : `linear-gradient(145deg, ${tint}1F, ${tint}0A)`,
        border: onDark ? '1px solid rgba(255,255,255,0.16)' : `1px solid ${tint}26`,
        boxShadow: onDark
          ? 'inset 0 1px 0 rgba(255,255,255,0.08)'
          : 'inset 0 1px 0 rgba(255,255,255,0.7)',
      }}
    >
      <Icon size={Math.round(size * 0.44)} color={onDark ? '#93C5FD' : tint} strokeWidth={1.75} />
    </div>
  );
}
