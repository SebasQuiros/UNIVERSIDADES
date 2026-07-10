import { ILLO, type IllustrationProps } from './palette';

// ── ArtFiscalCalendar — vencimientos fiscales (D-104 / D-101) ───────────────────
// Calendario con un día resaltado en dorado (fecha límite) y una etiqueta de la
// declaración. Metáfora de obligaciones tributarias / plazos.
export function ArtFiscalCalendar({ size = 160, className }: IllustrationProps) {
  const w = size;
  const h = Math.round(size * (150 / 160));
  const cols = [32, 52, 72, 92, 112];
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
      <ellipse cx="80" cy="140" rx="56" ry="8" fill={ILLO.ground} />
      {/* anillas */}
      <rect x="45" y="22" width="6" height="16" rx="3" fill={ILLO.goldBright} />
      <rect x="109" y="22" width="6" height="16" rx="3" fill={ILLO.goldBright} />
      {/* cuerpo */}
      <rect x="22" y="30" width="116" height="104" rx="12" fill={ILLO.white} stroke={ILLO.slate200} strokeWidth="2" />
      {/* encabezado */}
      <path d="M22 42 Q22 30 34 30 H126 Q138 30 138 42 V56 H22 Z" fill={ILLO.navy} />
      <rect x="34" y="40" width="44" height="6" rx="3" fill="rgba(255,255,255,0.6)" />
      <circle cx="120" cy="43" r="3" fill={ILLO.goldBright} />
      {/* fila de días de la semana */}
      {cols.map((x) => (
        <rect key={x} x={x - 5} y="64" width="10" height="3" rx="1.5" fill={ILLO.slate300} />
      ))}
      {/* celdas — fila 1 */}
      {cols.map((x) => {
        const isDeadline = x === 72;
        return (
          <g key={`r1-${x}`}>
            <rect
              x={x - 8}
              y="74"
              width="16"
              height="16"
              rx="3"
              fill={isDeadline ? ILLO.gold : ILLO.blue50}
              stroke={isDeadline ? ILLO.goldDark : 'none'}
              strokeWidth="2"
            />
            {isDeadline && (
              <text
                x={x}
                y="83"
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="Inter, system-ui, sans-serif"
                fontSize="9"
                fontWeight="800"
                fill={ILLO.night}
              >
                15
              </text>
            )}
          </g>
        );
      })}
      {/* celdas — fila 2 */}
      {cols.map((x) => (
        <rect key={`r2-${x}`} x={x - 8} y="96" width="16" height="16" rx="3" fill={ILLO.blue50} />
      ))}
      {/* marca de alerta sobre la fecha límite */}
      <circle cx="82" cy="72" r="6" fill={ILLO.goldBright} stroke={ILLO.white} strokeWidth="2" />
      <path d="M82 69 v3 M82 74.5 v0.5" stroke={ILLO.night} strokeWidth="1.6" strokeLinecap="round" />
      {/* etiqueta de la declaración */}
      <rect x="46" y="116" width="68" height="13" rx="6.5" fill={ILLO.night} />
      <text
        x="80"
        y="123"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="8"
        fontWeight="700"
        letterSpacing="0.06em"
        fill={ILLO.goldLight}
      >
        D-104 · IVA
      </text>
    </svg>
  );
}
