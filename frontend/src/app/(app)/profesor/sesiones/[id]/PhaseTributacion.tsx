'use client';

/**
 * Fase TRIBUTACIÓN — los libros ya están congelados (`closeOperations` los
 * deshabilitó). Los equipos presentan sus declaraciones pendientes y, cuando
 * el profesor lo decide, se publica el snapshot (congela EEFF + arma las
 * asignaciones de auditoría) y la sesión pasa a AUDITORÍA.
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { ARCHETYPE_ICON, ARCHETYPE_LABELS, ARCHETYPE_TINT } from '@/lib/classSession';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/IconTile';
import { SectionCard } from '@/components/ui/SectionCard';
import type { DashboardResponse } from './types';
import { Building2, Lock, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

export function PhaseTributacion({ session, onChanged }: { session: DashboardResponse; onChanged: () => void }) {
  const [publishing, setPublishing] = useState(false);

  async function publish() {
    setPublishing(true);
    try {
      const { data } = await api.post<{ companiesPublished: number; totalCompanies: number; assignments: number }>(
        `/api/v1/class-sessions/${session.id}/publish-snapshot`,
      );
      toast.success(`Snapshot publicado — ${data.companiesPublished}/${data.totalCompanies} empresas, ${data.assignments} asignaciones de auditoría`);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3.5 rounded-card border border-gold-100 bg-gold-50/60 p-5 shadow-card">
        <IconTile icon={Lock} tint="#B8860B" size={44} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-gold-900">Los libros están congelados</p>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-700">
            Cada empresa dejó de admitir nuevos asientos. Los grupos deberían aprovechar este momento para
            presentar las declaraciones que les falten. Cuando estés listo, publicá el snapshot: congela los
            estados financieros de cada empresa y arma el cruce de auditoría entre pares.
          </p>
        </div>
      </div>

      <SectionCard icon={Building2} iconTint="#1B2E6E" eyebrow={`${session.groups.length} empresas`} title="Empresas de la sesión" flushBody>
        <div className="divide-y divide-gray-100">
          {session.groups.map((g) => {
            const Icon = ARCHETYPE_ICON[g.archetype];
            return (
              <div key={g.companyId} className="flex items-center gap-3 px-6 py-3 lg:px-7">
                <IconTile icon={Icon} tint={ARCHETYPE_TINT[g.archetype]} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800">{g.name}</p>
                  <p className="text-xs text-gray-400">{ARCHETYPE_LABELS[g.archetype]} · {g.memberCount} integrante{g.memberCount !== 1 ? 's' : ''}</p>
                </div>
                <span className="flex items-center gap-1 text-xs font-semibold text-gray-400">
                  <Lock className="h-3.5 w-3.5" /> Congelada
                </span>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="flex flex-col items-center gap-3 rounded-card border border-gray-200/70 bg-white p-5 shadow-card sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3">
          <IconTile icon={ShieldCheck} tint="#2563EB" size={40} />
          <p className="text-sm text-gray-600">Publicar el snapshot es irreversible y arranca el cruce de auditoría entre pares.</p>
        </div>
        <Button onClick={publish} loading={publishing} className="w-full cx-press sm:w-auto">
          <CheckCircle2 className="w-4 h-4" /> Publicar snapshot y auditar <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
