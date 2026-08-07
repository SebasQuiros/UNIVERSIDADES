import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// Genera /robots.txt. Permite el sitio público e impide rastrear las áreas
// autenticadas y técnicas. El dominio se toma de NEXT_PUBLIC_SITE_URL.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/estudiante',
        '/profesor',
        '/admin',
        '/superadmin',
        '/login',
        '/auth',
        '/api',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
