import type { MetadataRoute } from 'next';
import { SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo';

// Genera /manifest.webmanifest (PWA básico). Ayuda en móvil e indexación.
// Usa /logo.svg (escalable, mejor para instalación) y /logo.png como respaldo.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Simulador contable y fiscal universitario de Costa Rica`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0F2657',
    theme_color: '#2563EB',
    lang: 'es-CR',
    dir: 'ltr',
    categories: ['education', 'finance', 'business'],
    icons: [
      { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/logo.png', sizes: '128x85', type: 'image/png', purpose: 'any' },
    ],
  };
}
