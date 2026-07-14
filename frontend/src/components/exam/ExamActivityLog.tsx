'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { AlertTriangle, Activity, ChevronDown, ChevronUp } from 'lucide-react';

interface ActivityEvent {
  id: string;
  event: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface ExamActivityLogProps {
  attemptId: string;
  /** If true, shows expanded by default */
  defaultExpanded?: boolean;
}

const EVENT_LABELS: Record<string, string> = {
  EXERCISE_OPENED:     'Ejercicio abierto',
  EXERCISE_RESUMED:    'Ejercicio retomado',
  INVOICE_CREATED:     'Factura creada',
  INVOICE_ISSUED:      'Factura emitida',
  JOURNAL_ENTRY_SAVED: 'Asiento guardado',
  REPORT_VIEWED:       'Reporte visualizado',
  EXERCISE_SUBMITTED:  'Ejercicio enviado',
  CLIENT_CREATED:      'Cliente creado',
  PRODUCT_CREATED:     'Producto creado',
};

function isTabSwitch(event: ActivityEvent): boolean {
  return (
    event.event === 'EXERCISE_OPENED' &&
    (event.metadata as { type?: string })?.type === 'TAB_SWITCH'
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-CR', {
      day:    '2-digit',
      month:  '2-digit',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function ExamActivityLog({ attemptId, defaultExpanded = false }: ExamActivityLogProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ events: ActivityEvent[] }>(`/api/v1/attempts/${attemptId}/activity`);
      const evts = res.data.events ?? [];
      setEvents(evts);
      setTabSwitchCount(evts.filter(isTabSwitch).length);
    } catch {
      // silently fail — non-critical component
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    if (expanded) load();
  }, [expanded, load]);

  const hasCheating = tabSwitchCount > 3;

  return (
    <div className="overflow-hidden rounded-card border border-gray-200/70 bg-white shadow-card">
      {/* Cabecera — siempre visible */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-3 bg-gray-50/70 px-4 py-3 text-left transition-colors hover:bg-gray-100 cx-press"
      >
        <div className="flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Registro de actividad</span>
          {tabSwitchCount > 0 && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                hasCheating
                  ? 'border border-gold-100 bg-gold-50 text-gold-900'
                  : 'border border-blue-200 bg-blue-50 text-blue-700'
              }`}
            >
              {hasCheating && <AlertTriangle className="w-3 h-3" />}
              {tabSwitchCount} cambio{tabSwitchCount !== 1 ? 's' : ''} de pestaña
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 flex-shrink-0 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-400" />
        )}
      </button>

      {/* Cuerpo */}
      {expanded && (
        <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto border-t border-gray-100">
          {loading && (
            <div className="p-4 text-center text-sm text-gray-400">Cargando…</div>
          )}
          {!loading && events.length === 0 && (
            <div className="p-4 text-center text-sm text-gray-400">Sin eventos registrados</div>
          )}
          {!loading && events.map((ev) => {
            const isSwitch = isTabSwitch(ev);
            // `metadata` puede venir null desde la API → siempre acceso opcional.
            const meta = ev.metadata as { count?: number; type?: string; tab?: string } | null;
            return (
              <div
                key={ev.id}
                className={`flex items-start gap-3 px-4 py-2.5 text-xs ${
                  isSwitch
                    ? 'border-l-2 border-gold-500 bg-gold-50'
                    : 'bg-white'
                }`}
              >
                {isSwitch && (
                  <AlertTriangle className="mt-0.5 w-3.5 h-3.5 flex-shrink-0 text-gold-700" />
                )}
                <div className="min-w-0 flex-1">
                  <span className={`font-semibold ${isSwitch ? 'text-gold-900' : 'text-gray-700'}`}>
                    {isSwitch
                      ? `Cambio de pestaña #${meta?.count ?? ''}`
                      : (EVENT_LABELS[ev.event] ?? ev.event)}
                  </span>
                  {!isSwitch && meta?.type === 'hint' && (
                    <span className="ml-1 text-gray-400">— pista ({meta?.tab})</span>
                  )}
                </div>
                <time className="flex-shrink-0 whitespace-nowrap text-gray-400 tabular-nums">
                  {formatTime(ev.createdAt)}
                </time>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
