/**
 * Constantes centrales de SEO para ContaSJ.
 *
 * Fuente única de verdad para metadata, robots.ts, sitemap.ts, manifest.ts,
 * opengraph-image y datos estructurados (JSON-LD). Todo dirigido por env para
 * no atar nada a un dominio concreto ni a una universidad específica.
 *
 * ⚠️ El dominio real debe fijarse en `NEXT_PUBLIC_SITE_URL` (ver .env.example).
 * El fallback `https://contasj.cr` es solo un valor sensato de reserva.
 */

/** URL base absoluta del sitio (sin barra final). Usada para canonical, OG y sitemap. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://contasj.cr'
).replace(/\/$/, '');

/** Marca de cara al usuario. Multi-universidad: nada atado a una institución. */
export const SITE_NAME = 'ContaSJ';

/** Título por defecto (también se usa como plantilla base). */
export const SITE_TITLE_DEFAULT =
  'ContaSJ — Simulador contable y fiscal universitario de Costa Rica';

/** Descripción rica en palabras clave del dominio, honesta y sin institución. */
export const SITE_DESCRIPTION =
  'Simulador contable y fiscal universitario de Costa Rica. Practicá contabilidad ' +
  'por partida doble bajo NIIF PYMES, facturación electrónica de Hacienda, ' +
  'declaraciones TRIBU-CR (D-104 IVA, D-101 Renta, D-103, D-115) y libros contables ' +
  'con calificación automática. Educación contable con casos reales costarricenses.';

/** Palabras clave del dominio (nada de universidades específicas). */
export const SITE_KEYWORDS = [
  'simulador contable',
  'contabilidad universitaria',
  'educación contable Costa Rica',
  'facturación electrónica Costa Rica',
  'Ministerio de Hacienda',
  'comprobantes electrónicos',
  'NIIF PYMES',
  'partida doble',
  'TRIBU-CR',
  'declaración de IVA D-104',
  'declaración de renta D-101',
  'retenciones D-103',
  'estados financieros',
  'plan de estudios contabilidad',
  'software educativo contable',
  'ContaSJ',
];

/** Locale principal para OpenGraph / html lang. */
export const SITE_LOCALE = 'es_CR';

/** Ruta del logo dentro de /public (existe y está optimizado). */
export const SITE_LOGO = '/logo.png';
