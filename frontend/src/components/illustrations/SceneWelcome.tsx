import { ILLO, type IllustrationProps } from './palette';
import { Head } from './_figure';

// ── SceneWelcome — bienvenida / onboarding ─────────────────────────────────────
// Figura de pie saludando junto a una tarjeta con checklist de primeros pasos.
export function SceneWelcome({ size = 260, className }: IllustrationProps) {
  const w = size;
  const h = Math.round(size * (220 / 260));
  const rows = [98, 120, 142];
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
      <circle cx="130" cy="104" r="96" fill={ILLO.blue50} />
      {/* confeti */}
      <rect x="60" y="34" width="8" height="8" rx="2" fill={ILLO.goldBright} transform="rotate(20 64 38)" />
      <rect x="150" y="30" width="7" height="7" rx="2" fill={ILLO.blue300} transform="rotate(-15 153 33)" />
      <circle cx="110" cy="26" r="4" fill={ILLO.gold} />
      <circle cx="200" cy="40" r="4" fill={ILLO.blue400} />
      <rect x="30" y="70" width="6" height="6" rx="2" fill={ILLO.blue300} transform="rotate(25 33 73)" />
      <ellipse cx="130" cy="200" rx="96" ry="10" fill={ILLO.ground} />

      {/* tarjeta de checklist */}
      <rect x="142" y="58" width="92" height="112" rx="14" fill={ILLO.white} stroke={ILLO.slate200} strokeWidth="2" />
      <path d="M142 72 Q142 58 156 58 H220 Q234 58 234 72 V80 H142 Z" fill={ILLO.navy} />
      <rect x="152" y="66" width="46" height="6" rx="3" fill="rgba(255,255,255,0.6)" />
      {rows.map((y) => (
        <g key={y}>
          <circle cx="160" cy={y} r="7" fill={ILLO.successBright} />
          <path d={`M156.5 ${y} l2.4 2.6 l4.2 -4.8`} stroke={ILLO.white} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="172" y={y - 3} width="48" height="5" rx="2.5" fill={ILLO.slate200} />
        </g>
      ))}
      {/* insignia dorada */}
      <circle cx="224" cy="56" r="14" fill={ILLO.gold} stroke={ILLO.white} strokeWidth="3" />
      <path d="M217.5 56 l4 4.5 l8 -9" stroke={ILLO.white} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* persona de pie saludando */}
      <rect x="60" y="185" width="18" height="8" rx="4" fill={ILLO.night} />
      <rect x="79" y="185" width="18" height="8" rx="4" fill={ILLO.night} />
      <line x1="70" y1="150" x2="68" y2="186" stroke={ILLO.night} strokeWidth="11" strokeLinecap="round" />
      <line x1="82" y1="150" x2="86" y2="186" stroke={ILLO.night} strokeWidth="11" strokeLinecap="round" />
      {/* brazo derecho saludando */}
      <line x1="89" y1="116" x2="101" y2="99" stroke={ILLO.blue} strokeWidth="10" strokeLinecap="round" />
      <line x1="101" y1="99" x2="110" y2="80" stroke={ILLO.skin} strokeWidth="8" strokeLinecap="round" />
      <circle cx="111" cy="77" r="6.5" fill={ILLO.skin} />
      {/* brazo izquierdo */}
      <line x1="62" y1="118" x2="58" y2="146" stroke={ILLO.blue} strokeWidth="10" strokeLinecap="round" />
      <circle cx="57" cy="149" r="6" fill={ILLO.skin} />
      {/* torso */}
      <rect x="60" y="110" width="32" height="44" rx="15" fill={ILLO.blue} />
      <rect x="70" y="102" width="12" height="12" fill={ILLO.skin} />
      <Head cx={76} cy={88} hair={ILLO.hairDark} />
    </svg>
  );
}
