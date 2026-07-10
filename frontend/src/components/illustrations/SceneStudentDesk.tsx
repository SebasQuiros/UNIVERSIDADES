import { ILLO, type IllustrationProps } from './palette';
import { Head } from './_figure';

// ── SceneStudentDesk — estudiante operando su empresa ──────────────────────────
// Figura sentada tras un escritorio con laptop (gráfico), pila de libros y una
// moneda. Escena principal de "trabajo en la plataforma".
export function SceneStudentDesk({ size = 260, className }: IllustrationProps) {
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
      {/* fondo suave */}
      <circle cx="130" cy="98" r="94" fill={ILLO.blue50} />
      <circle cx="42" cy="44" r="5" fill={ILLO.goldBright} opacity="0.8" />
      <circle cx="222" cy="52" r="6" fill={ILLO.blue300} opacity="0.7" />
      <ellipse cx="130" cy="198" rx="98" ry="10" fill={ILLO.ground} />

      {/* respaldo de silla */}
      <rect x="106" y="92" width="48" height="66" rx="16" fill={ILLO.blue100} />

      {/* persona sentada */}
      <rect x="124" y="88" width="12" height="14" fill={ILLO.skin} />
      {/* brazos (mangas) */}
      <path d="M110 116 Q100 134 114 150 L122 148 Q112 130 118 114 Z" fill={ILLO.blue} />
      <path d="M150 116 Q160 134 146 150 L138 148 Q148 130 142 114 Z" fill={ILLO.blue} />
      <circle cx="117" cy="150" r="6" fill={ILLO.skin} />
      <circle cx="143" cy="150" r="6" fill={ILLO.skin} />
      {/* torso */}
      <rect x="106" y="102" width="48" height="52" rx="18" fill={ILLO.blue} />
      <path d="M130 102 v40" stroke={ILLO.blue400} strokeWidth="2" opacity="0.5" />
      <Head cx={130} cy={76} hair={ILLO.hairMid} />

      {/* escritorio */}
      <rect x="38" y="152" width="184" height="10" rx="5" fill={ILLO.navy} />
      <rect x="52" y="162" width="156" height="36" fill={ILLO.night} />

      {/* laptop con gráfico */}
      <polygon points="42,152 100,152 106,160 36,160" fill={ILLO.slate300} />
      <rect x="46" y="150" width="50" height="3" fill={ILLO.slate400} />
      <rect x="48" y="120" width="46" height="32" rx="3" fill={ILLO.night} />
      <rect x="52" y="124" width="38" height="24" rx="2" fill={ILLO.blue50} />
      <line x1="54" y1="145" x2="88" y2="145" stroke={ILLO.slate300} strokeWidth="1.5" />
      <rect x="56" y="137" width="5" height="8" rx="1" fill={ILLO.blue300} />
      <rect x="64" y="132" width="5" height="13" rx="1" fill={ILLO.blue} />
      <rect x="72" y="134" width="5" height="11" rx="1" fill={ILLO.goldDark} />
      <rect x="80" y="128" width="5" height="17" rx="1" fill={ILLO.blue400} />

      {/* pila de libros */}
      <rect x="150" y="141" width="42" height="11" rx="2" fill={ILLO.goldDark} />
      <rect x="192" y="143" width="4" height="9" fill={ILLO.goldLight} />
      <rect x="154" y="131" width="38" height="10" rx="2" fill={ILLO.blue} />
      <rect x="188" y="133" width="4" height="8" fill={ILLO.blue100} />
      <rect x="150" y="121" width="42" height="10" rx="2" fill={ILLO.blue400} />
      <rect x="188" y="123" width="4" height="8" fill={ILLO.blue100} />
      {/* moneda sobre los libros */}
      <circle cx="171" cy="112" r="8" fill={ILLO.gold} stroke={ILLO.goldDark} strokeWidth="1.6" />
      <text
        x="171"
        y="112.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="9"
        fontWeight="800"
        fill={ILLO.navy}
      >
        ₡
      </text>
    </svg>
  );
}
