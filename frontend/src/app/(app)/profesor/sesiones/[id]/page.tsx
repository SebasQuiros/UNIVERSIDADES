'use client';

/**
 * Sesión de aula — pantalla de control (Fase 1, maqueta con datos falsos).
 *
 * Cambia de contenido según la fase de la sesión. Sin backend todavía: la
 * fase se maneja con estado local y hay un selector visible de andamiaje
 * (marcado abajo) para poder recorrer las cinco fases sin depender de que
 * ocurran en orden real. En la Fase 2, la fase vendrá del servidor (o de un
 * socket) y ese selector desaparece.
 */

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { MOCK_SESSIONS, type SessionPhase } from '../_mock';
import { PhaseLobby } from './PhaseLobby';
import { PhaseGroups } from './PhaseGroups';
import { PhaseInProgress } from './PhaseInProgress';
import { PhaseAudit } from './PhaseAudit';
import { PhaseResults } from './PhaseResults';
import {
  ArrowLeft, Presentation, Radio, Users, Activity, ShieldCheck, Trophy, FlaskConical,
} from 'lucide-react';

const PHASE_STEPS: Array<{ key: SessionPhase; label: string; icon: typeof Radio }> = [
  { key: 'LOBBY',       label: 'Lobby',      icon: Radio },
  { key: 'GROUPS',      label: 'Grupos',     icon: Users },
  { key: 'IN_PROGRESS', label: 'En curso',   icon: Activity },
  { key: 'AUDIT',       label: 'Auditoría',  icon: ShieldCheck },
  { key: 'RESULTS',     label: 'Resultados', icon: Trophy },
];

export default function SesionControlPage() {
  const { id } = useParams<{ id: string }>();
  const [phase, setPhase] = useState<SessionPhase>('LOBBY');
  const [finalized, setFinalized] = useState(false);

  const session = MOCK_SESSIONS.find((s) => s.id === id) ?? MOCK_SESSIONS[0];

  return (
    <div className="flex-1 overflow-y-auto bg-[#F4F6F8] p-6 lg:p-8">

      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/profesor/sesiones" className="flex items-center gap-1 transition-colors hover:text-gray-700">
          <ArrowLeft className="w-3.5 h-3.5" /> Sesiones de aula
        </Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">{session.code}</span>
      </div>

      <PageHeader
        eyebrow="Sesión de aula"
        title={session.exerciseTitle}
        subtitle={`${session.courseName} · código ${session.code}`}
        icon={Presentation}
        className="mb-6"
      />

      {/* ── Andamiaje de maqueta: selector manual de fase ──────────────────
          Esto NO existe en producción. La fase real la determina el backend
          (o llega por socket cuando el profesor avanza la sesión). Se deja
          visible y marcado para poder validar las 5 pantallas sin tener que
          jugar la sesión completa cada vez. */}
      <div className="mb-6 rounded-2xl border-2 border-dashed border-gold-100 bg-gold-50/60 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-gold-900">
          <FlaskConical className="h-4 w-4" />
          Andamiaje de maqueta — selector de fase (no existe en producción)
        </div>
        <div className="flex flex-wrap gap-2">
          {PHASE_STEPS.map((step) => {
            const active = phase === step.key;
            const locked = finalized && step.key !== 'RESULTS';
            const Icon = step.icon;
            return (
              <button
                key={step.key}
                onClick={() => !locked && setPhase(step.key)}
                disabled={locked}
                title={locked ? 'La sesión ya fue finalizada' : undefined}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors cx-press ${
                  active
                    ? 'border-transparent bg-gradient-to-br from-blue-600 to-[#1B2E6E] text-white shadow-[0_6px_20px_rgba(27,46,110,0.28)]'
                    : locked
                      ? 'cursor-not-allowed border-gray-200 bg-white/60 text-gray-300'
                      : 'border-gold-100 bg-white text-gray-600 hover:bg-gold-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {step.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Contenido de la fase actual ── */}
      {phase === 'LOBBY' && <PhaseLobby code={session.code} onAdvance={() => setPhase('GROUPS')} />}
      {phase === 'GROUPS' && <PhaseGroups onAdvance={() => setPhase('IN_PROGRESS')} />}
      {phase === 'IN_PROGRESS' && <PhaseInProgress onAdvance={() => setPhase('AUDIT')} />}
      {phase === 'AUDIT' && <PhaseAudit onAdvance={() => setPhase('RESULTS')} />}
      {phase === 'RESULTS' && <PhaseResults finalized={finalized} onFinalize={() => setFinalized(true)} />}
    </div>
  );
}
