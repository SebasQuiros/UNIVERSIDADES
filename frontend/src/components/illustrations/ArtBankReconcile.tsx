import { ILLO, type IllustrationProps } from './palette';

// ── ArtBankReconcile — conciliación bancaria ───────────────────────────────────
// Dos estados enfrentados (Banco vs. Libros) con partidas casadas y un disco
// central de cotejo (flechas de intercambio). Metáfora de conciliación.
export function ArtBankReconcile({ size = 180, className }: IllustrationProps) {
  const w = size;
  const h = Math.round(size * (150 / 180));

  // Documento con encabezado tintado y filas con casilla de cotejo.
  const Statement = ({ x, header, checkX, lineX }: {
    x: number; header: string; checkX: number; lineX: number;
  }) => (
    <g>
      <rect x={x} y="24" width="60" height="104" rx="8" fill={ILLO.white} stroke={ILLO.slate200} strokeWidth="2" />
      <path d={`M${x} 34 Q${x} 24 ${x + 10} 24 H${x + 50} Q${x + 60} 24 ${x + 60} 34 V44 H${x} Z`} fill={header} />
      {[58, 74, 90, 106].map((y, i) => (
        <g key={y}>
          <circle cx={checkX} cy={y} r="5" fill={i < 3 ? ILLO.successBright : ILLO.blue100} />
          {i < 3 && (
            <path
              d={`M${checkX - 2.4} ${y} l1.8 1.9 l3.2 -3.6`}
              stroke={ILLO.white}
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          <rect x={lineX} y={y - 2} width="28" height="4" rx="2" fill={ILLO.slate200} />
        </g>
      ))}
    </g>
  );

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 180 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <ellipse cx="90" cy="140" rx="70" ry="8" fill={ILLO.ground} />
      {/* conectores de partidas casadas (detrás del disco) */}
      <line x1="74" y1="72" x2="106" y2="88" stroke={ILLO.slate300} strokeWidth="1.5" strokeDasharray="3 4" />
      <line x1="74" y1="90" x2="106" y2="74" stroke={ILLO.slate300} strokeWidth="1.5" strokeDasharray="3 4" />

      {/* estado del banco (izquierda) */}
      <Statement x={14} header={ILLO.navy} checkX={26} lineX={38} />
      {/* estado de libros (derecha) */}
      <Statement x={106} header={ILLO.goldDark} checkX={118} lineX={130} />

      {/* disco central de cotejo */}
      <circle cx="90" cy="80" r="21" fill={ILLO.white} stroke={ILLO.blue200} strokeWidth="2.5" />
      {/* flechas de intercambio ⇄ */}
      <g stroke={ILLO.goldDark} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M80 75 H99" />
        <path d="M96 71 l4 4 l-4 4" />
        <path d="M100 85 H81" />
        <path d="M84 81 l-4 4 l4 4" />
      </g>
    </svg>
  );
}
