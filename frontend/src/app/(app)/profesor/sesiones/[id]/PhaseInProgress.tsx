'use client';

/**
 * Fase EN CURSO — panel en vivo de las empresas operando.
 *
 * El backend no expone métricas operativas por empresa en vivo (facturas,
 * asientos, comercio B2B) — solo participantes, grupos y su estado de
 * conexión (`GET class-sessions/:id/dashboard`). Este panel muestra lo que
 * hay: quién está conectado ahora mismo, por empresa.
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { ARCHETYPE_ICON, ARCHETYPE_LABELS, ARCHETYPE_TINT } from '@/lib/classSession';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/IconTile';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import type { DashboardResponse } from './types';
import {
  Users, Building2, Wifi, ShieldCheck, ArrowRight, CheckCircle2, AlertTriangle,
} from 'lucide-react';

export function PhaseInProgress({ session, onChanged }: { session: DashboardResponse; onChanged: () => void }) {
  const [closing, setClosing] = useState(false);

  const onlineNow = session.participants.filter((p) => p.onlineStatus === 'ACTIVE').length;

  async function closeOperations() {
    setClosing(true);
    try {
      const { data } = await api.post<{ disabledCompanies: number }>(`/api/v1/class-sessions/${session.id}/close-operations`);
      toast.success(`Periodo cerrado — ${data.disabledCompanies} empresa${data.disabledCompanies !== 1 ? 's' : ''} congelada${data.disabledCompanies !== 1 ? 's' : ''}`);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Resumen global */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Participantes" value={String(session.participantsCount)} icon={Users} tint="#2563EB" className="cx-pop cx-d1" />
        <StatCard label="Empresas" value={String(session.groups.length)} icon={Building2} tint="#1B2E6E" className="cx-pop cx-d2" />
        <StatCard label="Conectados ahora" value={String(onlineNow)} icon={Wifi} tint="#059669" hint="En línea en este momento" className="cx-pop cx-d3" />
        <StatCard label="Hallazgos" value={String(session.findingsTotal)} icon={ShieldCheck} tint="#B8860B" hint="Se habilitan en auditoría" className="cx-pop cx-d4" />
      </div>

      {/* Empresas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {session.groups.map((g, i) => {
          const members = session.participants.filter((p) => p.companyId === g.companyId);
          const online = members.filter((p) => p.onlineStatus === 'ACTIVE').length;
          const Icon = ARCHETYPE_ICON[g.archetype];
          return (
            <div key={g.companyId} className={`overflow-hidden rounded-card border bg-white shadow-card transition-all cx-lift cx-pop cx-d${Math.min(i + 1, 6)} ${online > 0 ? 'border-emerald-100' : 'border-gray-200/70'}`}>
              <div className={`flex items-center justify-between gap-2 border-b px-4 py-3 ${online > 0 ? 'border-emerald-100 bg-emerald-50/60' : 'border-gray-100 bg-gray-50/70'}`}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <IconTile icon={Icon} tint={ARCHETYPE_TINT[g.archetype]} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">{g.name}</p>
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">{ARCHETYPE_LABELS[g.archetype]}</p>
                  </div>
                </div>
                {online > 0 ? (
                  <span className="flex flex-shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> {online} en línea
                  </span>
                ) : (
                  <span className="flex flex-shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500">
                    Sin conexión
                  </span>
                )}
              </div>
              <div className="p-4 text-xs">
                <p className="mb-2 text-gray-500">{g.legalId || 'Sin cédula jurídica'}</p>
                <div className="space-y-1">
                  {members.length === 0 ? (
                    <p className="italic text-gray-400">Sin integrantes.</p>
                  ) : members.map((m) => (
                    <div key={m.participantId} className="flex items-center justify-between gap-2">
                      <span className="truncate text-gray-700">{m.name}</span>
                      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${m.onlineStatus === 'ACTIVE' ? 'bg-emerald-500' : m.onlineStatus === 'IDLE' ? 'bg-gold-600' : 'bg-gray-300'}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-3 rounded-card border border-gray-200/70 bg-white p-5 shadow-card sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3">
          <IconTile icon={AlertTriangle} tint="#B8860B" size={40} />
          <p className="text-sm text-gray-600">
            Al cerrar el periodo, los libros de cada empresa se congelan (no admiten más escritura) y pasan a la fase de tributación.
          </p>
        </div>
        <Button onClick={closeOperations} loading={closing} className="w-full cx-press sm:w-auto">
          Cerrar periodo y tributar <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
