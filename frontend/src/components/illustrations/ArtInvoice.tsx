import { ILLO, type IllustrationProps } from './palette';

// ── ArtInvoice — factura electrónica validada (Hacienda v4.4) ───────────────────
// Documento con encabezado azul, líneas de detalle, total resaltado, código QR
// y sello de validación. Portada del landing.
export function ArtInvoice({ size = 120, className }: IllustrationProps) {
  const w = size;
  const h = Math.round(size * 1.25);
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 160 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <rect x="22" y="14" width="116" height="172" rx="12" fill={ILLO.white} stroke={ILLO.slate200} strokeWidth="2" />
      {/* encabezado */}
      <path d="M22 26 Q22 14 34 14 H126 Q138 14 138 26 V44 H22 Z" fill={ILLO.navy} />
      <circle cx="42" cy="29" r="6" fill={ILLO.goldBright} />
      <rect x="54" y="26" width="56" height="6" rx="3" fill="rgba(255,255,255,0.55)" />
      {/* líneas de detalle */}
      <rect x="38" y="60" width="84" height="5" rx="2.5" fill={ILLO.slate300} />
      <rect x="38" y="74" width="62" height="5" rx="2.5" fill={ILLO.slate300} />
      <rect x="38" y="88" width="76" height="5" rx="2.5" fill={ILLO.slate300} />
      {/* total */}
      <rect x="38" y="104" width="84" height="22" rx="6" fill={ILLO.blue100} />
      <rect x="46" y="112" width="40" height="6" rx="3" fill={ILLO.blue} />
      <rect x="98" y="112" width="16" height="6" rx="3" fill={ILLO.goldDark} />
      {/* QR */}
      <rect x="38" y="140" width="34" height="34" rx="5" fill={ILLO.night} />
      <rect x="44" y="146" width="8" height="8" fill={ILLO.goldBright} />
      <rect x="58" y="146" width="8" height="8" fill={ILLO.blue300} />
      <rect x="44" y="160" width="8" height="8" fill={ILLO.blue300} />
      <rect x="58" y="160" width="8" height="8" fill={ILLO.goldBright} />
      {/* sello validado */}
      <circle cx="104" cy="157" r="15" fill={ILLO.blue50} />
      <path d="M97 157 l5 5 l9 -10" stroke={ILLO.blue} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
