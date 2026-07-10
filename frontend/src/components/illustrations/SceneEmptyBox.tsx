import { ILLO, type IllustrationProps } from './palette';
import { Head } from './_figure';

// ── SceneEmptyBox — estado vacío ───────────────────────────────────────────────
// Caja abierta y vacía con una figura que la señala. Para listados sin datos.
export function SceneEmptyBox({ size = 260, className }: IllustrationProps) {
  const w = size;
  const h = Math.round(size * (220 / 260));
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 260 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <circle cx="140" cy="106" r="92" fill={ILLO.blue50} />
      {/* motas flotantes (vacío) */}
      <circle cx="150" cy="58" r="4" fill={ILLO.goldBright} opacity="0.85" />
      <circle cx="176" cy="70" r="3" fill={ILLO.blue300} />
      <circle cx="126" cy="70" r="2.5" fill={ILLO.blue400} opacity="0.8" />
      <ellipse cx="140" cy="200" rx="98" ry="10" fill={ILLO.ground} />

      {/* caja abierta */}
      {/* solapas traseras */}
      <polygon points="104,120 150,98 146,82 96,104" fill={ILLO.blue100} />
      <polygon points="150,98 196,120 204,104 154,82" fill={ILLO.blue200} />
      {/* caras frontales */}
      <polygon points="104,120 150,142 150,178 104,156" fill={ILLO.blue100} />
      <polygon points="196,120 150,142 150,178 196,156" fill={ILLO.blue200} />
      {/* borde superior + interior vacío */}
      <polygon points="150,98 196,120 150,142 104,120" fill={ILLO.blue300} />
      <polygon points="150,106 188,120 150,134 112,120" fill={ILLO.night} opacity="0.18" />
      {/* cinta frontal */}
      <rect x="146" y="120" width="8" height="52" fill={ILLO.goldLight} opacity="0.9" />

      {/* persona señalando la caja */}
      <rect x="36" y="185" width="18" height="8" rx="4" fill={ILLO.night} />
      <rect x="54" y="185" width="18" height="8" rx="4" fill={ILLO.night} />
      <line x1="46" y1="150" x2="44" y2="186" stroke={ILLO.night} strokeWidth="11" strokeLinecap="round" />
      <line x1="58" y1="150" x2="62" y2="186" stroke={ILLO.night} strokeWidth="11" strokeLinecap="round" />
      {/* brazo izquierdo (al costado) */}
      <line x1="38" y1="118" x2="34" y2="146" stroke={ILLO.blue400} strokeWidth="10" strokeLinecap="round" />
      <circle cx="33" cy="149" r="6" fill={ILLO.skin} />
      {/* brazo derecho señalando la caja */}
      <line x1="66" y1="116" x2="82" y2="118" stroke={ILLO.blue400} strokeWidth="10" strokeLinecap="round" />
      <line x1="82" y1="118" x2="96" y2="117" stroke={ILLO.skin} strokeWidth="8" strokeLinecap="round" />
      <circle cx="98" cy="117" r="6" fill={ILLO.skin} />
      {/* torso */}
      <rect x="36" y="110" width="32" height="44" rx="15" fill={ILLO.blue400} />
      <rect x="46" y="102" width="12" height="12" fill={ILLO.skin} />
      <Head cx={52} cy={88} hair={ILLO.hairDark} longHair />
    </svg>
  );
}
