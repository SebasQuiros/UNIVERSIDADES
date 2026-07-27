'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Clock, Flag } from 'lucide-react';

/**
 * Cronómetro del cierre del período comercial (spec cap. 3). Da urgencia a la
 * sesión. Solo lectura: lee `commercialCloseAt` del endpoint /live.
 */
export function CommercialCountdown({ sessionId }: { sessionId: string }) {
  const [closeAt, setCloseAt] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    let alive = true;
    const load = () => api.get<{ commercialCloseAt: string | null }>(`/api/v1/class-sessions/${sessionId}/live`)
      .then(({ data }) => { if (alive) setCloseAt(data.commercialCloseAt ?? null); }).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [sessionId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!closeAt) return null;
  const target = new Date(closeAt).getTime();
  const diff = target - now;
  const closed = diff <= 0;

  const s = Math.max(0, Math.floor(diff / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const label = d > 0 ? `${d}d ${h}h ${m}m` : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

  const urgent = !closed && diff < 10 * 60 * 1000; // < 10 min

  return (
    <div className={`mb-6 flex items-center justify-between gap-3 rounded-card border px-4 py-3 ${
      closed ? 'border-gray-200 bg-gray-50' : urgent ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
      <div className="flex items-center gap-2.5">
        {closed ? <Flag className="h-5 w-5 text-gray-500" /> : <Clock className={`h-5 w-5 ${urgent ? 'text-red-600' : 'text-blue-600'}`} />}
        <div>
          <p className={`text-sm font-bold ${closed ? 'text-gray-600' : urgent ? 'text-red-800' : 'text-blue-800'}`}>
            {closed ? 'Período comercial cerrado' : 'Cierre del período comercial'}
          </p>
          <p className="text-xs text-gray-500">
            {closed ? 'Ya no se pueden hacer nuevas operaciones comerciales.' : 'Cerrá tus tratos antes de que termine el tiempo.'}
          </p>
        </div>
      </div>
      {!closed && (
        <span className={`font-mono text-xl font-black tabular-nums ${urgent ? 'text-red-700' : 'text-blue-700'}`}>{label}</span>
      )}
    </div>
  );
}
