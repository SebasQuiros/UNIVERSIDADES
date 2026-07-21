'use client';

/**
 * Fase LOBBY — pantalla de proyección + armado de grupos.
 *
 * En el backend, "lobby" y "grupos" son la misma fase (`ClassSessionStatus.LOBBY`):
 * mientras el código está proyectado, el profesor también crea las empresas,
 * les asigna arquetipo y reparte a los participantes. Por eso ambas cosas
 * conviven en una sola pantalla.
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import {
  ARCHETYPE_KEYS, ARCHETYPE_LABELS, ARCHETYPE_ICON, ARCHETYPE_TINT, ONLINE_STATUS_LABELS,
  type ClassSessionArchetype,
} from '@/lib/classSession';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { IconTile } from '@/components/ui/IconTile';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { SceneEmptyBox } from '@/components/illustrations';
import type { DashboardResponse } from './types';
import {
  Radio, Users, ArrowRight, Wifi, Plus, Shuffle, Trash2, Building2, X, PlusCircle,
} from 'lucide-react';

const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
  backgroundSize: '22px 22px',
};

const ONLINE_DOT: Record<string, string> = {
  ACTIVE: 'bg-emerald-500',
  IDLE: 'bg-gold-600',
  OFFLINE: 'bg-gray-300',
};

function NewGroupForm({ sessionId, onCreated }: { sessionId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [archetype, setArchetype] = useState<ClassSessionArchetype>('FERRETERIA');
  const [legalId, setLegalId] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error('Ponele un nombre a la empresa'); return; }
    setSaving(true);
    try {
      await api.post(`/api/v1/class-sessions/${sessionId}/groups`, {
        name: name.trim(),
        archetype,
        legalId: legalId.trim() || undefined,
      });
      toast.success('Empresa creada');
      setName(''); setLegalId(''); setArchetype('FERRETERIA'); setOpen(false);
      onCreated();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/60 py-4 text-sm font-semibold text-gray-500 transition-colors hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 cx-press"
      >
        <PlusCircle className="h-4 w-4" /> Crear empresa
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-800">Nueva empresa</p>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
          <X className="h-4 w-4" />
        </button>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre de la empresa"
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
      />
      <select
        value={archetype}
        onChange={(e) => setArchetype(e.target.value as ClassSessionArchetype)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
      >
        {ARCHETYPE_KEYS.map((k) => <option key={k} value={k}>{ARCHETYPE_LABELS[k]}</option>)}
      </select>
      <input
        value={legalId}
        onChange={(e) => setLegalId(e.target.value)}
        placeholder="Cédula jurídica (opcional, ej. 3-101-745102)"
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
      />
      <Button type="submit" size="sm" loading={saving} className="w-full cx-press">
        <Plus className="h-3.5 w-3.5" /> Crear empresa
      </Button>
    </form>
  );
}

export function PhaseLobby({ session, onChanged }: { session: DashboardResponse; onChanged: () => void }) {
  const [savingArchetype, setSavingArchetype] = useState<string | null>(null);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [force, setForce] = useState(false);

  const unassigned = session.participants.filter((p) => !p.companyId);

  async function setArchetype(companyId: string, archetype: ClassSessionArchetype) {
    setSavingArchetype(companyId);
    try {
      await api.patch(`/api/v1/class-sessions/${session.id}/groups/${companyId}/archetype`, { archetype });
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingArchetype(null);
    }
  }

  async function autoAssign() {
    setAutoAssigning(true);
    try {
      const { data } = await api.post<{ assigned: number }>(`/api/v1/class-sessions/${session.id}/groups/auto-assign`);
      toast.success(`${data.assigned} participante${data.assigned !== 1 ? 's' : ''} repartido${data.assigned !== 1 ? 's' : ''}`);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAutoAssigning(false);
    }
  }

  async function removeParticipant(participantId: string) {
    setRemoving(participantId);
    try {
      await api.delete(`/api/v1/class-sessions/${session.id}/participants/${participantId}`);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRemoving(null);
    }
  }

  async function start() {
    setStarting(true);
    try {
      const { data } = await api.post<{ attemptsCreated: number }>(`/api/v1/class-sessions/${session.id}/start`, { force });
      toast.success(`Periodo iniciado — ${data.attemptsCreated} intento${data.attemptsCreated !== 1 ? 's' : ''} creado${data.attemptsCreated !== 1 ? 's' : ''}`);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Pantalla de proyección */}
      <div className="relative overflow-hidden rounded-card shadow-soft cx-pop bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
        <div className="relative flex flex-col items-center px-6 py-14 text-center sm:px-10">
          <div className="mb-5 flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 cx-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Sala de espera abierta</span>
          </div>

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-500">Código de unión</p>
          <p
            className="mt-3 select-all font-mono text-7xl font-black leading-none tracking-[0.14em] text-white sm:text-8xl lg:text-9xl"
            style={{ textShadow: '0 8px 40px rgba(37,99,235,0.55)' }}
          >
            {session.code}
          </p>
          <p className="mt-6 max-w-md text-sm text-blue-100/90 sm:text-base">
            Los estudiantes entran a la sesión desde su computadora y escriben este código para unirse.
          </p>

          <div className="mt-8 flex items-center gap-2 text-sm text-blue-100/80">
            <Users className="w-4 h-4" />
            <span className="font-mono tabular-nums">
              <span key={session.participantsCount} className="cx-count inline-block font-bold text-white">{session.participantsCount}</span>
            </span>
            <span>conectado{session.participantsCount !== 1 ? 's' : ''} hasta ahora</span>
          </div>
        </div>
      </div>

      {/* Grupos / empresas */}
      <SectionCard
        icon={Building2}
        iconTint="#2563EB"
        eyebrow={`${session.groups.length} empresa${session.groups.length !== 1 ? 's' : ''}`}
        title="Empresas de la sesión"
        description="Creá las empresas y elegí el arquetipo de cada una. Los participantes se reparten con el botón de abajo."
        action={
          <Button variant="secondary" onClick={autoAssign} loading={autoAssigning} disabled={session.groups.length === 0} className="cx-press">
            <Shuffle className="w-4 h-4" /> Reparto automático
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {session.groups.map((g, i) => {
            const Icon = ARCHETYPE_ICON[g.archetype];
            return (
              <div key={g.companyId} className={`overflow-hidden rounded-card border border-gray-200/70 bg-white shadow-card transition-all cx-lift cx-pop cx-d${Math.min(i + 1, 6)}`}>
                <div className="flex items-start gap-3 border-b border-gray-100 bg-gray-50/70 p-4">
                  <IconTile icon={Icon} tint={ARCHETYPE_TINT[g.archetype]} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">{g.name}</p>
                    <p className="text-xs text-gray-400">{g.legalId || 'Sin cédula jurídica'}</p>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">Arquetipo de negocio</label>
                    <select
                      value={g.archetype}
                      disabled={savingArchetype === g.companyId}
                      onChange={(e) => setArchetype(g.companyId, e.target.value as ClassSessionArchetype)}
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                    >
                      {ARCHETYPE_KEYS.map((k) => <option key={k} value={k}>{ARCHETYPE_LABELS[k]}</option>)}
                    </select>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Users className="h-3.5 w-3.5" /> {g.memberCount} integrante{g.memberCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            );
          })}
          <div className={session.groups.length === 0 ? '' : 'flex items-stretch'}>
            <NewGroupForm sessionId={session.id} onCreated={onChanged} />
          </div>
        </div>
      </SectionCard>

      {/* Participantes sin grupo */}
      <SectionCard
        icon={Wifi}
        iconTint="#059669"
        eyebrow={`${unassigned.length} sin asignar`}
        title="Participantes"
        flushBody
      >
        {session.participants.length === 0 ? (
          <div className="px-6 py-8 lg:px-7">
            <EmptyState
              illustration={<SceneEmptyBox size={140} />}
              title="Todavía nadie se unió"
              description="Proyectá el código de arriba para que tus estudiantes se conecten."
            />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {session.participants.map((p) => (
              <div key={p.participantId} className="flex items-center gap-3 px-6 py-2.5 lg:px-7">
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#3B82F6,#1E3A8A)' }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{p.name}</p>
                  <p className="truncate text-xs text-gray-400">{p.email}</p>
                </div>
                <span className="flex flex-shrink-0 items-center gap-1.5 text-xs text-gray-500">
                  <span className={`h-1.5 w-1.5 rounded-full ${ONLINE_DOT[p.onlineStatus]}`} />
                  {ONLINE_STATUS_LABELS[p.onlineStatus]}
                </span>
                {p.companyId ? (
                  <Badge variant="blue">{session.groups.find((g) => g.companyId === p.companyId)?.name ?? 'Asignado'}</Badge>
                ) : (
                  <Badge variant="slate">Sin grupo</Badge>
                )}
                <button
                  onClick={() => removeParticipant(p.participantId)}
                  disabled={removing === p.participantId}
                  className="flex-shrink-0 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 cx-press"
                  title="Expulsar de la sesión"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* CTA de avance */}
      <div className="flex flex-col gap-3 rounded-card border border-gray-200/70 bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <IconTile icon={Radio} tint="#2563EB" size={40} />
          <div>
            <p className="text-sm text-gray-600">Cuando los grupos estén listos, arrancá el periodo para que empiecen a comprar y venderse entre sí.</p>
            <label className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
              <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              Forzar inicio aunque algún grupo esté por debajo del mínimo
            </label>
          </div>
        </div>
        <Button onClick={start} loading={starting} disabled={session.groups.length === 0} className="w-full cx-press sm:w-auto">
          Iniciar periodo <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
