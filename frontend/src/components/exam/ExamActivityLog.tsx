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
    (event.metadata as any)?.type === 'TAB_SWITCH'
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
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Registro de actividad</span>
          {tabSwitchCount > 0 && (
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                hasCheating
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-blue-100 text-blue-700 border border-blue-200'
              }`}
            >
              {hasCheating && <AlertTriangle className="w-3 h-3" />}
              {tabSwitchCount} cambio{tabSwitchCount !== 1 ? 's' : ''} de pestaña
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {loading && (
            <div className="p-4 text-sm text-center text-gray-400">Cargando...</div>
          )}
          {!loading && events.length === 0 && (
            <div className="p-4 text-sm text-center text-gray-400">Sin eventos registrados</div>
          )}
          {!loading && events.map((ev) => {
            const isSwitch = isTabSwitch(ev);
            return (
              <div
                key={ev.id}
                className={`flex items-start gap-3 px-4 py-2.5 text-xs ${
                  isSwitch
                    ? 'bg-amber-50 border-l-2 border-amber-400'
                    : 'bg-white'
                }`}
              >
                {isSwitch && (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <span className={`font-medium ${isSwitch ? 'text-amber-800' : 'text-gray-700'}`}>
                    {isSwitch
                      ? `Cambio de pestaña #${(ev.metadata as any).count ?? ''}`
                      : (EVENT_LABELS[ev.event] ?? ev.event)}
                  </span>
                  {!isSwitch && (ev.metadata as any)?.type === 'hint' && (
                    <span className="ml-1 text-gray-400">— pista ({(ev.metadata as any)?.tab})</span>
                  )}
                </div>
                <time className="text-gray-400 flex-shrink-0 whitespace-nowrap">
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
