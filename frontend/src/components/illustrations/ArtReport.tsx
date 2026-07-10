import { ILLO, type IllustrationProps } from './palette';

// ── ArtReport — estados financieros ────────────────────────────────────────────
// Documento con gráfico de barras (resultados) y anillo de composición.
// Metáfora de balance general / estado de resultados.
export function ArtReport({ size = 160, className }: IllustrationProps) {
  const w = size;
  const h = Math.round(size * (150 / 160));
  // Anillo (donut): circunferencia = 2·π·13 ≈ 81.7; segmento dorado ≈ 33%.
  const r = 13;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 160 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <ellipse cx="80" cy="140" rx="58" ry="8" fill={ILLO.ground} />
      {/* documento */}
      <rect x="24" y="18" width="112" height="120" rx="12" fill={ILLO.white} stroke={ILLO.slate200} strokeWidth="2" />
      {/* encabezado */}
      <path d="M24 30 Q24 18 36 18 H124 Q136 18 136 30 V42 H24 Z" fill={ILLO.navy} />
      <rect x="34" y="26" width="46" height="6" rx="3" fill="rgba(255,255,255,0.6)" />
      <circle cx="120" cy="30" r="4" fill={ILLO.goldBright} />
      {/* subtítulos */}
      <rect x="34" y="52" width="72" height="4" rx="2" fill={ILLO.slate200} />
      <rect x="34" y="60" width="50" height="4" rx="2" fill={ILLO.slate200} />
      {/* barras */}
      <line x1="30" y1="120" x2="102" y2="120" stroke={ILLO.slate200} strokeWidth="2" />
      <rect x="34" y="98" width="11" height="22" rx="2" fill={ILLO.blue200} />
      <rect x="50" y="90" width="11" height="30" rx="2" fill={ILLO.blue300} />
      <rect x="66" y="80" width="11" height="40" rx="2" fill={ILLO.blue} />
      <rect x="82" y="72" width="11" height="48" rx="2" fill={ILLO.goldDark} />
      {/* anillo de composición */}
      <circle cx="116" cy="98" r={r} fill="none" stroke={ILLO.blue100} strokeWidth="7" />
      <circle
        cx="116"
        cy="98"
        r={r}
        fill="none"
        stroke={ILLO.goldDark}
        strokeWidth="7"
        strokeDasharray={`${c * 0.33} ${c}`}
        transform="rotate(-90 116 98)"
        strokeLinecap="butt"
      />
      <circle cx="116" cy="98" r="4.5" fill={ILLO.white} />
    </svg>
  );
}
