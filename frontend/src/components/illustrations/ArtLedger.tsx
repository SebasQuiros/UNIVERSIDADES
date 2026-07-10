import { ILLO, type IllustrationProps } from './palette';

// ── ArtLedger — libro diario / mayor ───────────────────────────────────────────
// Libro abierto: página izquierda (asientos del diario) y derecha (cuenta T del
// mayor, Debe | Haber), con cinta marcadora dorada.
export function ArtLedger({ size = 180, className }: IllustrationProps) {
  const w = size;
  const h = Math.round(size * (150 / 180));
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
      <ellipse cx="90" cy="138" rx="66" ry="9" fill={ILLO.ground} />
      {/* tapa / lomo */}
      <rect x="18" y="36" width="144" height="94" rx="12" fill={ILLO.navy} />
      <rect x="86" y="36" width="8" height="94" fill={ILLO.night} />
      {/* páginas */}
      <rect x="25" y="44" width="60" height="78" rx="3" fill={ILLO.white} />
      <rect x="95" y="44" width="60" height="78" rx="3" fill={ILLO.white} />

      {/* página izquierda — asientos del diario */}
      <rect x="32" y="54" width="30" height="5" rx="2.5" fill={ILLO.blue} />
      <line x1="32" y1="68" x2="78" y2="68" stroke={ILLO.slate200} strokeWidth="2" />
      <line x1="32" y1="78" x2="78" y2="78" stroke={ILLO.slate200} strokeWidth="2" />
      <line x1="32" y1="88" x2="78" y2="88" stroke={ILLO.slate200} strokeWidth="2" />
      <line x1="32" y1="98" x2="78" y2="98" stroke={ILLO.slate200} strokeWidth="2" />
      <rect x="40" y="64" width="26" height="4" rx="2" fill={ILLO.slate300} />
      <rect x="40" y="84" width="20" height="4" rx="2" fill={ILLO.slate300} />
      <rect x="60" y="108" width="18" height="4" rx="2" fill={ILLO.goldDark} />

      {/* página derecha — cuenta T (Debe | Haber) */}
      <rect x="101" y="52" width="48" height="6" rx="3" fill={ILLO.navy} />
      <line x1="125" y1="62" x2="125" y2="114" stroke={ILLO.slate300} strokeWidth="2" />
      <line x1="103" y1="62" x2="147" y2="62" stroke={ILLO.slate200} strokeWidth="2" />
      <rect x="106" y="70" width="14" height="4" rx="2" fill={ILLO.blue} />
      <rect x="106" y="82" width="12" height="4" rx="2" fill={ILLO.blue300} />
      <rect x="130" y="76" width="14" height="4" rx="2" fill={ILLO.goldDark} />
      <rect x="130" y="88" width="11" height="4" rx="2" fill={ILLO.goldBright} />

      {/* cinta marcadora dorada */}
      <path d="M104 34 H117 V70 L110.5 63 L104 70 Z" fill={ILLO.gold} />
      <path d="M104 34 H117 V40 H104 Z" fill={ILLO.goldDark} />
    </svg>
  );
}
