import { ILLO, type IllustrationProps } from './palette';

// ── ArtCoins — monedas con el colón ₡ ──────────────────────────────────────────
// Pila de monedas doradas y una moneda frontal con el símbolo del colón.
// Metáfora de efectivo / caja / valor.
export function ArtCoins({ size = 160, className }: IllustrationProps) {
  const w = size;
  const h = Math.round(size * (150 / 160));

  // Una moneda vista de canto (cara + grosor) apilable en (cx, topY).
  const Coin = ({ cx, ty, face }: { cx: number; ty: number; face: string }) => (
    <g>
      <ellipse cx={cx} cy={ty + 11} rx="32" ry="9" fill={ILLO.goldDark} />
      <rect x={cx - 32} y={ty} width="64" height="11" fill={ILLO.goldDark} />
      <ellipse cx={cx} cy={ty} rx="32" ry="9" fill={face} />
      <ellipse cx={cx} cy={ty} rx="24" ry="6" fill="none" stroke={ILLO.goldBright} strokeWidth="1.5" opacity="0.6" />
    </g>
  );

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
      <ellipse cx="80" cy="138" rx="58" ry="9" fill={ILLO.ground} />
      {/* pila de monedas a la izquierda */}
      <Coin cx={54} ty={116} face={ILLO.gold} />
      <Coin cx={54} ty={102} face={ILLO.gold} />
      <Coin cx={54} ty={88} face={ILLO.goldLight} />
      {/* moneda frontal con el colón */}
      <circle cx="106" cy="86" r="34" fill={ILLO.gold} />
      <circle cx="106" cy="86" r="34" fill="none" stroke={ILLO.goldDark} strokeWidth="3" />
      <circle cx="106" cy="86" r="26" fill="none" stroke={ILLO.goldBright} strokeWidth="2" opacity="0.7" />
      <text
        x="106"
        y="87"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="34"
        fontWeight="800"
        fill={ILLO.navy}
      >
        ₡
      </text>
      {/* destellos */}
      <circle cx="140" cy="60" r="3" fill={ILLO.goldBright} />
      <circle cx="30" cy="66" r="2.5" fill={ILLO.goldBright} opacity="0.8" />
    </svg>
  );
}
