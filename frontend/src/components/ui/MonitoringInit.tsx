'use client';

import { useEffect } from 'react';
import { initMonitoring } from '@/lib/monitoring';

/** Inicializa Sentry (no-op sin NEXT_PUBLIC_SENTRY_DSN) — montado una vez en el layout raíz. */
export function MonitoringInit() {
  useEffect(() => { initMonitoring(); }, []);
  return null;
}
