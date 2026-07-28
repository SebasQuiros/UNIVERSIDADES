'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SceneEmptyBox } from '@/components/illustrations';
import { History } from 'lucide-react';
import { ActivityLogPanel } from './ActivityLogPanel';

/**
 * Página "Bitácora": resuelve la empresa activa del estudiante (mismo criterio
 * que el sidebar) y muestra su registro de acciones.
 */
export function BitacoraView() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'no-company'>('loading');

  useEffect(() => {
    let alive = true;
    api.get<any[]>('/api/v1/attempts')
      .then(({ data }) => {
        if (!alive) return;
        const list = Array.isArray(data) ? data : [];
        const active =
          list.find((x) => x.status === 'IN_PROGRESS') ??
          list.find((x) => x.company) ??
          list.find((x) => x.status === 'NOT_STARTED') ??
          list[0];
        const cId: string | undefined = active?.company?.id;
        if (cId) { setCompanyId(cId); setPhase('ready'); }
        else setPhase('no-company');
      })
      .catch(() => { if (alive) setPhase('no-company'); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-[#FBF8F1] p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          eyebrow="Auditoría"
          title="Bitácora de acciones"
          subtitle="Quién hizo qué y cuándo en tu empresa: facturas, asientos y demás operaciones."
          icon={History}
          iconTint="#1B2E6E"
          className="mb-6"
        />
        {phase === 'loading' ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : phase === 'no-company' || !companyId ? (
          <EmptyState
            illustration={<SceneEmptyBox size={200} />}
            title="Todavía no tenés una empresa"
            description="Cuando constituyas tu empresa dentro de un ejercicio, acá vas a ver el registro de todas tus acciones."
          />
        ) : (
          <ActivityLogPanel companyId={companyId} />
        )}
      </div>
    </div>
  );
}
