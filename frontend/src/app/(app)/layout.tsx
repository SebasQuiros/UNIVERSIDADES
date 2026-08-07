import type { Metadata } from 'next';
import { Providers } from '@/components/Providers';

// Área autenticada (login + dashboards de estudiante/profesor/admin/superadmin).
// NUNCA debe indexarse: son pantallas privadas. Este noindex aplica a todo el
// grupo (app) y se refuerza con el Disallow de robots.ts.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
