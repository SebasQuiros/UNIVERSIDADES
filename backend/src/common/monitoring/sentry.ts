import * as Sentry from '@sentry/node';

/**
 * Monitoreo de errores — inactivo por diseño hasta que exista SENTRY_DSN.
 * Sin esa env var, `initSentry()` no hace nada y `captureError()` es un no-op
 * seguro (Sentry.captureException sin init previo simplemente no envía nada).
 *
 * Para activar: crear un proyecto gratis en sentry.io, y setear SENTRY_DSN
 * en las variables de entorno de Railway. No requiere ningún otro cambio.
 */
let initialized = false;

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
  initialized = true;
}

export function captureError(exception: unknown, context?: Record<string, any>) {
  if (!initialized) return;
  Sentry.captureException(exception, context ? { extra: context } : undefined);
}
