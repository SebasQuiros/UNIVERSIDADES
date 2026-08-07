import type { Metadata } from 'next';
import { SITE_NAME } from '@/lib/seo';

const TITLE = 'Registrá tu institución';
const DESCRIPTION =
  'Solicitá acceso a ContaSJ para tu colegio técnico o universidad. Incorporá el ' +
  'simulador contable y fiscal costarricense —facturación electrónica de Hacienda, ' +
  'NIIF PYMES y declaraciones TRIBU-CR— en tus cursos de contabilidad.';

// Página de registro (`registro/page.tsx`) es Client Component: la metadata la
// aporta este layout server, sobreescribiendo la del grupo público.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: '/registro',
  },
  openGraph: {
    type: 'website',
    url: '/registro',
    siteName: SITE_NAME,
    title: `${TITLE} · ${SITE_NAME}`,
    description: DESCRIPTION,
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

export default function RegistroLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
