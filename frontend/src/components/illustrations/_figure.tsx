import { ILLO } from './palette';

// ── Helpers internos de personaje (NO se exportan en el barrel) ─────────────────
// Garantizan que todas las escenas compartan la misma proporción de cabeza,
// el mismo rostro minimalista y la misma paleta de piel/cabello.

interface HeadProps {
  cx: number;
  cy: number;
  /** Radio de la cabeza. Mantener consistente (16) entre escenas. */
  r?: number;
  hair?: string;
  /** Añade mechones laterales (cabello más largo) para variar personajes. */
  longHair?: boolean;
}

/** Cabeza + cabello + rostro minimalista (ojos, sonrisa y mejillas suaves). */
export function Head({ cx, cy, r = 16, hair = ILLO.hairDark, longHair = false }: HeadProps) {
  const yB = cy - r * 0.15; // borde inferior del cabello, sobre las cejas
  const xE = r * 0.985;
  const hairPath =
    `M ${cx - xE} ${yB} A ${r} ${r} 0 0 1 ${cx + xE} ${yB} ` +
    `Q ${cx + r * 0.5} ${yB - 2} ${cx + r * 0.22} ${yB + 3} ` +
    `Q ${cx} ${yB - 1} ${cx - r * 0.22} ${yB + 3} ` +
    `Q ${cx - r * 0.5} ${yB - 2} ${cx - xE} ${yB} Z`;
  return (
    <g>
      {/* mechones largos (opcional) */}
      {longHair && (
        <>
          <rect x={cx - r * 1.02} y={cy - r * 0.2} width={r * 0.42} height={r * 1.35} rx={r * 0.21} fill={hair} />
          <rect x={cx + r * 0.6} y={cy - r * 0.2} width={r * 0.42} height={r * 1.35} rx={r * 0.21} fill={hair} />
        </>
      )}
      {/* orejas */}
      <circle cx={cx - r * 0.96} cy={cy + r * 0.12} r={r * 0.2} fill={ILLO.skin} />
      <circle cx={cx + r * 0.96} cy={cy + r * 0.12} r={r * 0.2} fill={ILLO.skin} />
      {/* rostro */}
      <circle cx={cx} cy={cy} r={r} fill={ILLO.skin} />
      {/* cabello */}
      <path d={hairPath} fill={hair} />
      {/* ojos */}
      <circle cx={cx - r * 0.32} cy={cy + r * 0.1} r={r * 0.11} fill={ILLO.ink} />
      <circle cx={cx + r * 0.32} cy={cy + r * 0.1} r={r * 0.11} fill={ILLO.ink} />
      {/* sonrisa */}
      <path
        d={`M ${cx - r * 0.26} ${cy + r * 0.45} Q ${cx} ${cy + r * 0.68} ${cx + r * 0.26} ${cy + r * 0.45}`}
        stroke={ILLO.skinShadow}
        strokeWidth={r * 0.1}
        fill="none"
        strokeLinecap="round"
      />
      {/* mejillas */}
      <circle cx={cx - r * 0.52} cy={cy + r * 0.36} r={r * 0.13} fill="#F2A98C" opacity="0.45" />
      <circle cx={cx + r * 0.52} cy={cy + r * 0.36} r={r * 0.13} fill="#F2A98C" opacity="0.45" />
    </g>
  );
}
