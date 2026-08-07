import type { Metadata, Viewport } from 'next';
import NextTopLoader from 'nextjs-toploader';
import './globals.css';
import { PwaInstallPrompt } from '@/components/ui/PwaInstallPrompt';
import { MonitoringInit } from '@/components/ui/MonitoringInit';
import {
  SITE_URL, SITE_NAME, SITE_TITLE_DEFAULT, SITE_DESCRIPTION,
  SITE_KEYWORDS, SITE_LOCALE, SITE_LOGO,
} from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  // URL base para resolver todas las URL relativas (canonical, OG, etc.)
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE_DEFAULT,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'education',
  alternates: {
    canonical: '/',
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: SITE_NAME,
  },
  icons: {
    icon: SITE_LOGO,
    shortcut: SITE_LOGO,
    apple: SITE_LOGO,
  },
  openGraph: {
    type: 'website',
    locale: SITE_LOCALE,
    url: '/',
    siteName: SITE_NAME,
    title: SITE_TITLE_DEFAULT,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE_DEFAULT,
    description: SITE_DESCRIPTION,
  },
  robots: {
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

export const viewport: Viewport = {
  themeColor: '#2563EB',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CR">
      <body>
        {/* Indicador global de transición de ruta — feedback instantáneo en cada navegación */}
        <NextTopLoader
          color="#2563EB"
          height={3}
          showSpinner={false}
          shadow="0 0 10px #2563EB, 0 0 6px #60A5FA"
          easing="ease"
          speed={400}
          zIndex={1600}
        />
        {children}
        <MonitoringInit />
        <PwaInstallPrompt />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) { console.log('SW registrado', reg.scope); })
                    .catch(function(err) { console.log('SW error:', err); });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
