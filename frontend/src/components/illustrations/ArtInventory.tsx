import { ILLO, type IllustrationProps } from './palette';

// ── ArtInventory — inventario / FIFO ───────────────────────────────────────────
// Cajas apiladas en isometría plana con una flecha de flujo y la etiqueta FIFO
// (primeras entradas, primeras salidas).
export function ArtInventory({ size = 170, className }: IllustrationProps) {
  const w = size;
  const h = Math.round(size * (150 / 170));
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 170 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <ellipse cx="88" cy="138" rx="66" ry="9" fill={ILLO.ground} />

      {/* flecha de flujo (dorada) sobre las cajas */}
      <path d="M32 40 Q88 14 148 40" stroke={ILLO.goldDark} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="1 0" />
      <path d="M141 34 l8 6 l-9 5" stroke={ILLO.goldDark} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* caja trasera (más pequeña) */}
      <polygon points="30,60 44,49 90,49 76,60" fill={ILLO.blue300} />
      <polygon points="76,60 90,49 90,80 76,91" fill={ILLO.blue100} />
      <polygon points="30,60 76,60 76,91 30,91" fill={ILLO.blue200} />
      <rect x="49" y="60" width="9" height="31" fill={ILLO.goldLight} />

      {/* caja frontal (más grande) */}
      <polygon points="74,80 92,64 156,64 138,80" fill={ILLO.blue300} />
      <polygon points="138,80 156,64 156,108 138,124" fill={ILLO.blue200} />
      <polygon points="74,80 138,80 138,124 74,124" fill={ILLO.blue100} />
      {/* cinta */}
      <rect x="100" y="80" width="12" height="44" fill={ILLO.goldLight} />
      <polygon points="100,80 112,80 118,73 106,73" fill={ILLO.gold} />
      {/* etiqueta de envío */}
      <rect x="82" y="90" width="14" height="12" rx="2" fill={ILLO.white} />
      <rect x="84" y="93" width="10" height="2" rx="1" fill={ILLO.slate300} />
      <rect x="84" y="97" width="7" height="2" rx="1" fill={ILLO.slate300} />

      {/* etiqueta FIFO */}
      <rect x="60" y="128" width="56" height="14" rx="7" fill={ILLO.night} />
      <text
        x="88"
        y="135.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="8.5"
        fontWeight="800"
        letterSpacing="0.12em"
        fill={ILLO.goldLight}
      >
        FIFO
      </text>
    </svg>
  );
}
