import { ILLO, type IllustrationProps } from './palette';

// ── ArtGrowth — curva de crecimiento / aprendizaje ─────────────────────────────
// Mini-panel con una línea ascendente y nodos; el punto final es dorado (meta).
// Portada del landing.
export function ArtGrowth({ size = 130, className }: IllustrationProps) {
  const w = size;
  const h = Math.round(size * 0.625);
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 160 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <rect x="10" y="8" width="140" height="84" rx="12" fill={ILLO.white} stroke={ILLO.slate200} strokeWidth="2" />
      <line x1="26" y1="78" x2="140" y2="78" stroke={ILLO.slate200} strokeWidth="2" />
      <path d="M28 70 L60 52 L86 60 L132 26" stroke={ILLO.blue} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="28" cy="70" r="4" fill={ILLO.navy} />
      <circle cx="60" cy="52" r="4" fill={ILLO.blue} />
      <circle cx="86" cy="60" r="4" fill={ILLO.blue300} />
      <circle cx="132" cy="26" r="5" fill={ILLO.goldDark} />
      <path d="M123 26 L132 26 L132 35" stroke={ILLO.goldDark} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
