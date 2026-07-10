import { ILLO, type IllustrationProps } from './palette';

// ── ArtBalance — balanza contable (partida doble) ──────────────────────────────
// Portada del landing. Metáfora del equilibrio débito/crédito: platillo azul
// (activo) y platillo dorado (pasivo/capital) sobre un fiel dorado.
export function ArtBalance({ size = 220, className }: IllustrationProps) {
  const w = size;
  const h = Math.round(size * (200 / 220));
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 220 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <circle cx="110" cy="104" r="92" fill={ILLO.blue} opacity="0.06" />
      {/* base */}
      <rect x="82" y="170" width="56" height="12" rx="6" fill={ILLO.navy} />
      <rect x="98" y="150" width="24" height="22" rx="4" fill={ILLO.night} />
      {/* poste + viga */}
      <rect x="106" y="54" width="8" height="98" rx="4" fill={ILLO.navy} />
      <rect x="30" y="50" width="160" height="8" rx="4" fill={ILLO.blue} />
      {/* fiel */}
      <path d="M110 34 L99 54 L121 54 Z" fill={ILLO.goldDark} />
      <circle cx="110" cy="50" r="5" fill={ILLO.goldBright} />
      {/* platillo izquierdo (activo) */}
      <path d="M38 56 L50 96 M62 56 L50 96" stroke={ILLO.slate400} strokeWidth="2" strokeLinecap="round" />
      <path d="M26 96 Q50 120 74 96 Z" fill={ILLO.blue200} />
      <circle cx="50" cy="92" r="7" fill={ILLO.blue} />
      {/* platillo derecho (pasivo + capital) */}
      <path d="M158 56 L170 96 M182 56 L170 96" stroke={ILLO.slate400} strokeWidth="2" strokeLinecap="round" />
      <path d="M146 96 Q170 120 194 96 Z" fill={ILLO.goldLight} />
      <circle cx="170" cy="92" r="7" fill={ILLO.goldDark} />
    </svg>
  );
}
