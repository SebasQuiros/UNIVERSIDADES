'use client';

/**
 * Sesiones de aula — lista (Fase 1, maqueta con datos falsos).
 *
 * El profesor abre una sesión sobre un ejercicio existente y la proyecta: sale
 * un código de unión, los estudiantes se conectan desde su computadora, se
 * arman grupos-empresa, operan, cierran y se auditan entre sí. Esta pantalla
 * lista las sesiones activas y finalizadas, y permite abrir una nueva.
 *
 * Sin integración a backend todavía — ver `_mock.ts`.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconTile } from '@/components/ui/IconTile';
import { SceneEmptyBox } from '@/components/illustrations';
import { formatDateTime } from '@/lib/utils';
import {
  MOCK_SESSIONS, MOCK_EXERCISE_OPTIONS,
  type ClassSessionSummary, type SessionPhase, type ExercisePickOption,
} from './_mock';
import {
  Presentation, Plus, X, Radio, Users, Activity, ShieldCheck, Trophy,
  CheckCircle2, Building2, ChevronRight, BookOpen, Wifi, ArrowRight,
} from 'lucide-react';

const PHASE_CONFIG: Record<SessionPhase, { label: string; variant: 'blue' | 'gold' | 'emerald' | 'purple'; icon: typeof Radio }> = {
  LOBBY:       { label: 'Sala de espera', variant: 'blue',    icon: Radio },
  GROUPS:      { label: 'Armando grupos', variant: 'gold',    icon: Users },
  IN_PROGRESS: { label: 'En curso',       variant: 'emerald', icon: Activity },
  AUDIT:       { label: 'Auditoría',      variant: 'purple',  icon: ShieldCheck },
  RESULTS:     { label: 'Resultados',     variant: 'blue',    icon: Trophy },
};

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin caracteres ambiguos
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function SessionRow({ session }: { session: ClassSessionSummary }) {
  const cfg = PHASE_CONFIG[session.phase];
  const PhaseIcon = cfg.icon;
  return (
    <Link
      href={`/profesor/sesiones/${session.id}`}
      className="group flex items-center gap-4 border-b border-gray-100 p-4 transition-colors last:border-0 hover:bg-blue-50/50 cx-hop-parent"
    >
      <IconTile icon={session.isClosed ? CheckCircle2 : PhaseIcon} tint={session.isClosed ? '#64748B' : '#2563EB'} size={40} className="cx-hop" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-xs font-bold tracking-[0.15em] text-gray-600">
            {session.code}
          </span>
          {session.isClosed ? (
            <Badge variant="slate"><CheckCircle2 className="w-3 h-3" /> Finalizada</Badge>
          ) : (
            <Badge variant={cfg.variant}><PhaseIcon className="w-3 h-3" /> {cfg.label}</Badge>
          )}
        </div>
        <p className="truncate text-sm font-semibold text-gray-800 group-hover:text-gray-900">{session.exerciseTitle}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{session.courseName}</span>
          <span className="flex items-center gap-1 tabular-nums"><Wifi className="w-3 h-3" />{session.studentsConnected}/{session.studentsExpected} estudiantes</span>
          <span className="flex items-center gap-1 tabular-nums"><Building2 className="w-3 h-3" />{session.companiesCount} empresas</span>
        </div>
      </div>
      <div className="hidden flex-shrink-0 text-xs text-gray-400 sm:block">
        {session.isClosed && session.closedAt ? `Cerrada ${formatDateTime(session.closedAt)}` : `Abierta ${formatDateTime(session.createdAt)}`}
      </div>
      <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500" />
    </Link>
  );
}

function NewSessionModal({
  onClose, onCreate,
}: {
  onClose: () => void;
  onCreate: (exercise: ExercisePickOption) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-csq-dark/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-card border border-gray-200/70 bg-white shadow-card-hover cx-pop">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <IconTile icon={Presentation} tint="#2563EB" size={40} />
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">Nueva sesión de aula</p>
              <h3 className="font-bold tracking-tight text-gray-900">Elegí el ejercicio</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 cx-press" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-80 space-y-2 overflow-y-auto p-6">
          <p className="mb-3 text-sm text-gray-500">
            Se abrirá una sala de espera con un código de unión. Los estudiantes de este ejercicio se conectarán desde su computadora.
          </p>
          {MOCK_EXERCISE_OPTIONS.map((ex) => (
            <button
              key={ex.id}
              onClick={() => setSelected(ex.id)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors cx-press ${
                selected === ex.id
                  ? 'border-blue-400 bg-blue-50/70 ring-1 ring-blue-300'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <IconTile icon={BookOpen} tint="#1B2E6E" size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-800">{ex.title}</p>
                <p className="truncate text-xs text-gray-400">{ex.courseName} · {ex.studentsEnrolled} estudiantes matriculados</p>
              </div>
              {selected === ex.id && <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-blue-600" />}
            </button>
          ))}
        </div>

        <div className="flex gap-3 border-t border-gray-100 p-6">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button
            onClick={() => {
              const ex = MOCK_EXERCISE_OPTIONS.find((e) => e.id === selected);
              if (ex) onCreate(ex);
            }}
            disabled={!selected}
            className="flex-1 cx-press"
          >
            <ArrowRight className="w-4 h-4" /> Abrir sesión
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SesionesDeAulaPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ClassSessionSummary[]>(MOCK_SESSIONS);
  const [showNew, setShowNew] = useState(false);

  const active = sessions.filter((s) => !s.isClosed);
  const finished = sessions.filter((s) => s.isClosed);
  const connectedNow = active.reduce((sum, s) => sum + s.studentsConnected, 0);

  function handleCreate(exercise: ExercisePickOption) {
    const id = `sesion-${Date.now()}`;
    const newSession: ClassSessionSummary = {
      id,
      code: generateJoinCode(),
      exerciseId: exercise.id,
      exerciseTitle: exercise.title,
      courseName: exercise.courseName,
      phase: 'LOBBY',
      isClosed: false,
      studentsConnected: 0,
      studentsExpected: exercise.studentsEnrolled,
      companiesCount: 0,
      createdAt: new Date().toISOString(),
      closedAt: null,
    };
    setSessions((prev) => [newSession, ...prev]);
    setShowNew(false);
    router.push(`/profesor/sesiones/${id}`);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#FBF8F1] p-6 lg:p-8">
      {showNew && <NewSessionModal onClose={() => setShowNew(false)} onCreate={handleCreate} />}

      <PageHeader
        eyebrow="Aula en vivo"
        title="Sesiones de aula"
        subtitle="Abrí una sesión sobre un ejercicio, proyectala, armá empresas por grupo y dejá que operen y se auditen entre sí."
        icon={Presentation}
        className="mb-6"
        actions={
          <Button onClick={() => setShowNew(true)} className="cx-press">
            <Plus className="w-4 h-4" /> Nueva sesión
          </Button>
        }
      />

      {/* KPIs */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Sesiones activas" value={String(active.length)} icon={Radio} tint="#2563EB" hint="En curso ahora mismo" className="cx-pop cx-d1" />
        <StatCard label="Estudiantes conectados" value={String(connectedNow)} icon={Wifi} tint="#059669" hint="En sesiones activas" className="cx-pop cx-d2" />
        <StatCard label="Finalizadas" value={String(finished.length)} icon={CheckCircle2} tint="#B8860B" hint="Con resultados publicados" className="cx-pop cx-d3" />
      </div>

      {sessions.length === 0 ? (
        <SectionCard title="Sesiones" icon={Presentation}>
          <EmptyState
            illustration={<SceneEmptyBox size={200} className="cx-float" />}
            title="Aún no abriste ninguna sesión"
            description="Elegí un ejercicio publicado y abrí una sesión de aula para proyectarla frente al grupo."
            action={<Button onClick={() => setShowNew(true)} className="cx-press"><Plus className="w-4 h-4" /> Nueva sesión</Button>}
          />
        </SectionCard>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <SectionCard icon={Radio} iconTint="#2563EB" eyebrow="Requieren tu atención" title={`Activas (${active.length})`} flushBody className="cx-pop">
              <div className="divide-y divide-gray-100">
                {active.map((s) => <SessionRow key={s.id} session={s} />)}
              </div>
            </SectionCard>
          )}
          {finished.length > 0 && (
            <SectionCard icon={CheckCircle2} iconTint="#B8860B" eyebrow="Con podio y calificación" title={`Finalizadas (${finished.length})`} flushBody className="cx-pop cx-d2">
              <div className="divide-y divide-gray-100">
                {finished.map((s) => <SessionRow key={s.id} session={s} />)}
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}
