import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// Genera /sitemap.xml SOLO con URL públicas indexables. Nunca incluye rutas
// autenticadas (estudiante/profesor/admin/superadmin/login/auth).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/registro`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
