'use client';

/**
 * Fase AUDITORÍA — el profesor ve quién audita a quién y cuántos hallazgos
 * van entrando, y decide cuándo cerrar la auditoría.
 *
 * Doctrina NIA 240: el sistema reporta *diferencias*, nunca "fraude" — el
 * detalle de cada hallazgo lo revisa el profesor en la fase de calificación;
 * acá solo se muestra el conteo (el backend no expone el detalle de hallazgos
 * al staff en esta fase).
 */

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { ARCHETYPE_ICON, ARCHETYPE_LABELS, ARCHETYPE_TINT } from '@/lib/classSession';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/IconTile';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { Skeleton } from '@/components/ui/Skeleton';
import type { DashboardResponse, AuditAssignmentPair } from './types';
import { Info, FileSearch, ShieldCheck, ArrowRight, Trophy, ArrowRightLeft } from 'lucide-react';

export function PhaseAudit({ session, onChanged }: { session: DashboardResponse; onChanged: () => void }) {
  const [assignments, setAssignments] = useState<AuditAssignmentPair[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const loadAssignments = useCallback(async () => {
    try {
      const { data } = await api.get<AuditAssignmentPair[]>(`/api/v1/class-sessions/${session.id}/audit/assignment`);
      setAssignments(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err));
    }
  }, [session.id]);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  async function closeAudit() {
    setClosing(true);
    try {
      const { data } = await api.post<{ findingsReceived: number }>(`/api/v1/class-sessions/${session.id}/close-audit`);
      toast.success(`Auditoría cerrada — ${data.findingsReceived} hallazgo${data.findingsReceived !== 1 ? 's' : ''} recibido${data.findingsReceived !== 1 ? 's' : ''}`);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3.5 rounded-card border border-blue-200 bg-blue-50/70 p-5 shadow-card">
        <IconTile icon={Info} tint="#2563EB" size={44} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-blue-900">Cómo funciona esta fase</p>
          <p className="mt-1.5 text-sm leading-relaxed text-blue-900/80">
            Cada empresa recibió el paquete de estados financieros congelado de otra empresa y puede reportar
            diferencias concretas, citando cuenta y monto. Cuando el grupo termine, cerrá la auditoría para pasar
            a calificación.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Hallazgos reportados" value={String(session.findingsTotal)} icon={FileSearch} tint="#1B2E6E" className="cx-pop cx-d1" />
        <StatCard label="Pares de auditoría" value={String(assignments?.length ?? session.groups.length)} icon={ArrowRightLeft} tint="#059669" className="cx-pop cx-d2" />
      </div>

      <SectionCard icon={ShieldCheck} iconTint="#1B2E6E" eyebrow="Asignación cruzada" title="Quién audita a quién" flushBody>
        {assignments === null ? (
          loadError ? (
            <div className="p-6 text-sm text-red-600 lg:p-7">{loadError}</div>
          ) : (
            <div className="space-y-3 p-6 lg:p-7">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          )
        ) : (
          <div className="divide-y divide-gray-100">
            {assignments.map((a) => {
              const Icon = ARCHETYPE_ICON[a.archetype];
              return (
                <div key={a.auditorCompanyId} className="flex flex-wrap items-center gap-2.5 px-6 py-3.5 lg:px-7">
                  <span className="text-sm font-semibold text-gray-800">{a.auditorName}</span>
                  <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                  <IconTile icon={Icon} tint={ARCHETYPE_TINT[a.archetype]} size={30} />
                  <span className="text-sm font-semibold text-gray-800">{a.auditeeName}</span>
                  <span className="text-xs text-gray-400">· {ARCHETYPE_LABELS[a.archetype]}</span>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <div className="flex flex-col items-center gap-3 rounded-card border border-gray-200/70 bg-white p-5 shadow-card sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3">
          <IconTile icon={Trophy} tint="#B8860B" size={40} />
          <p className="text-sm text-gray-600">Cerrar la auditoría bloquea nuevos hallazgos y habilita la calificación automática.</p>
        </div>
        <Button onClick={closeAudit} loading={closing} className="w-full cx-press sm:w-auto">
          Cerrar auditoría <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
