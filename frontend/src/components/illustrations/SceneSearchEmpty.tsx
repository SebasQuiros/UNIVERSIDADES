import { ILLO, type IllustrationProps } from './palette';
import { Head } from './_figure';

// ── SceneSearchEmpty — sin resultados ──────────────────────────────────────────
// Figura con una lupa sobre una lista de resultados vacía (filas punteadas).
export function SceneSearchEmpty({ size = 260, className }: IllustrationProps) {
  const w = size;
  const h = Math.round(size * (220 / 260));
  const emptyRows = [98, 114, 130];
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
      <circle cx="122" cy="104" r="94" fill={ILLO.blue50} />
      <circle cx="40" cy="48" r="4.5" fill={ILLO.blue300} opacity="0.75" />
      <circle cx="212" cy="44" r="5" fill={ILLO.goldBright} opacity="0.8" />
      <ellipse cx="130" cy="200" rx="96" ry="10" fill={ILLO.ground} />

      {/* tarjeta de resultados (vacía) */}
      <rect x="40" y="64" width="108" height="94" rx="12" fill={ILLO.white} stroke={ILLO.slate200} strokeWidth="2" />
      <path d="M40 76 Q40 64 52 64 H136 Q148 64 148 76 V84 H40 Z" fill={ILLO.navy} />
      <rect x="50" y="71" width="40" height="6" rx="3" fill="rgba(255,255,255,0.6)" />
      {emptyRows.map((y) => (
        <line key={y} x1="52" y1={y} x2="120" y2={y} stroke={ILLO.slate300} strokeWidth="3" strokeLinecap="round" strokeDasharray="4 7" />
      ))}
      <text
        x="94"
        y="150"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="8"
        fontWeight="700"
        letterSpacing="0.08em"
        fill={ILLO.slate400}
      >
        SIN RESULTADOS
      </text>

      {/* lupa */}
      <line x1="132" y1="138" x2="164" y2="162" stroke={ILLO.goldDark} strokeWidth="9" strokeLinecap="round" />
      <circle cx="112" cy="118" r="30" fill={ILLO.blue50} fillOpacity="0.5" stroke={ILLO.navy} strokeWidth="6" />
      <path d="M96 108 A18 18 0 0 1 118 100" stroke={ILLO.white} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.8" />

      {/* persona sosteniendo la lupa */}
      <rect x="180" y="185" width="18" height="8" rx="4" fill={ILLO.night} />
      <rect x="199" y="185" width="18" height="8" rx="4" fill={ILLO.night} />
      <line x1="190" y1="150" x2="188" y2="186" stroke={ILLO.night} strokeWidth="11" strokeLinecap="round" />
      <line x1="202" y1="150" x2="206" y2="186" stroke={ILLO.night} strokeWidth="11" strokeLinecap="round" />
      {/* brazo derecho (al costado) */}
      <line x1="216" y1="118" x2="220" y2="146" stroke={ILLO.blue} strokeWidth="10" strokeLinecap="round" />
      <circle cx="221" cy="149" r="6" fill={ILLO.skin} />
      {/* brazo izquierdo sosteniendo el mango */}
      <line x1="186" y1="118" x2="176" y2="140" stroke={ILLO.blue} strokeWidth="10" strokeLinecap="round" />
      <line x1="176" y1="140" x2="166" y2="158" stroke={ILLO.skin} strokeWidth="8" strokeLinecap="round" />
      <circle cx="165" cy="160" r="6.5" fill={ILLO.skin} />
      {/* torso */}
      <rect x="180" y="110" width="32" height="44" rx="15" fill={ILLO.blue} />
      <rect x="190" y="102" width="12" height="12" fill={ILLO.skin} />
      <Head cx={196} cy={88} hair={ILLO.hairMid} />
    </svg>
  );
}
