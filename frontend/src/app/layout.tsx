import type { Metadata, Viewport } from 'next';
import NextTopLoader from 'nextjs-toploader';
import './globals.css';
import { PwaInstallPrompt } from '@/components/ui/PwaInstallPrompt';
import { MonitoringInit } from '@/components/ui/MonitoringInit';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'ContaSJ — Plataforma Contable',
  description: 'Plataforma educativa de contabilidad y facturación electrónica costarricense',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ContaSJ',
  },
  icons: {
    icon: '/logo.png',
    apple: '/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#2563EB',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
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
