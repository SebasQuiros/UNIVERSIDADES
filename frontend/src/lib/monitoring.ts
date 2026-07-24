// Monitoreo de errores del cliente — inactivo por diseño hasta que exista
// NEXT_PUBLIC_SENTRY_DSN. Sin esa env var, `initMonitoring()` no hace nada y
// `captureError()` es un no-op seguro.
//
// Para activar: crear un proyecto gratis en sentry.io, y setear
// NEXT_PUBLIC_SENTRY_DSN en las variables de entorno de Vercel. No requiere
// ningún otro cambio (ni el wizard oficial ni subir sourcemaps son
// necesarios para captura básica de errores).

let initialized = false;

export function initMonitoring() {
  if (typeof window === 'undefined') return; // solo cliente
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || initialized) return;
  // Import diferido: si no hay DSN, el bundle de Sentry nunca se ejecuta.
  import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    });
    initialized = true;
  }).catch(() => {});
}

export function captureError(error: unknown, context?: Record<string, any>) {
  if (!initialized) return;
  import('@sentry/nextjs').then((Sentry) => {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  }).catch(() => {});
}
