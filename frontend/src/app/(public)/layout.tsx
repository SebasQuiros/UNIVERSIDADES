import type { Metadata } from 'next';
import {
  SITE_URL, SITE_NAME, SITE_TITLE_DEFAULT, SITE_DESCRIPTION, SITE_LOGO,
} from '@/lib/seo';

// Metadata del grupo público (landing). La página `page.tsx` es un Client
// Component y no puede exportar `metadata`, así que la define este layout server.
// No fijamos `title` aquí a propósito: el home hereda el `title.default` del root
// (título completo con marca) y `registro` recibe la plantilla `%s · ContaSJ`.
export const metadata: Metadata = {
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: SITE_NAME,
    title: SITE_TITLE_DEFAULT,
    description: SITE_DESCRIPTION,
  },
  robots: {
    // Next reemplaza `robots` por segmento (no hace deep-merge): repetimos
    // `googleBot` para no perder los directivos de rich preview del root.
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

// Serializa a JSON-LD escapando `<` para que un eventual `</script>` en los
// datos no cierre el bloque antes de tiempo (hardening anti-inyección).
function toJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

// ── Datos estructurados (JSON-LD) ──────────────────────────────────────────
// Organización educativa + aplicación web. Sin datos inventados (no ratings ni
// precios que no existan). Todo dirigido por env, sin institución específica.
const organizationLd = {
  '@context': 'https://schema.org',
  '@type': 'EducationalOrganization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}${SITE_LOGO}`,
  description: SITE_DESCRIPTION,
  inLanguage: 'es-CR',
  areaServed: {
    '@type': 'Country',
    name: 'Costa Rica',
  },
};

const applicationLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: SITE_NAME,
  url: SITE_URL,
  applicationCategory: 'EducationApplication',
  operatingSystem: 'Web',
  browserRequirements: 'Requiere un navegador moderno con JavaScript habilitado',
  inLanguage: 'es-CR',
  description: SITE_DESCRIPTION,
  featureList: [
    'Contabilidad por partida doble (NIIF PYMES)',
    'Facturación electrónica de Costa Rica (Hacienda)',
    'Declaraciones TRIBU-CR: D-104 IVA, D-101 Renta, D-103, D-115',
    'Libros diario y mayor, balance de comprobación y estados financieros',
    'Calificación automática con rúbricas',
  ],
  provider: {
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
  },
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(organizationLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(applicationLd) }}
      />
      {children}
    </>
  );
}
