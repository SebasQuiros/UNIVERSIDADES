'use client';

/**
 * Sesiones de aula — lista.
 *
 * El profesor abre una sesión sobre un ejercicio existente y la proyecta: sale
 * un código de unión, los estudiantes se conectan desde su computadora, se
 * arman grupos-empresa, operan, cierran y se auditan entre sí.
 *
 * El backend no expone un listado global de sesiones — solo
 * `GET courses/:courseId/exercises/:exerciseId/class-session` (404 si no
 * existe). Por eso esta pantalla recorre `courses/mine` → `exercises` y
 * resuelve la sesión de cada ejercicio en paralelo.
 */

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { formatDateTime, getErrorMessage } from '@/lib/utils';
import { STATUS_LABELS, ACTIVE_STATUSES, type ClassSessionStatus } from '@/lib/classSession';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconTile } from '@/components/ui/IconTile';
import { Skeleton } from '@/components/ui/Skeleton';
import { SceneEmptyBox } from '@/components/illustrations';
import type { Course, Exercise } from '@/types';
import {
  Presentation, Plus, X, Radio, Users, Activity, ShieldCheck, Trophy, Ban,
  CheckCircle2, Building2, ChevronRight, BookOpen, Wifi, ArrowRight, FileClock,
} from 'lucide-react';

const PHASE_ICON: Record<ClassSessionStatus, typeof Radio> = {
  DRAFT:        FileClock,
  LOBBY:        Radio,
  EN_CURSO:     Activity,
  TRIBUTACION:  Building2,
  AUDITORIA:    ShieldCheck,
  CALIFICACION: Trophy,
  FINALIZADA:   CheckCircle2,
  CANCELADA:    Ban,
};

const PHASE_VARIANT: Record<ClassSessionStatus, 'blue' | 'gold' | 'emerald' | 'purple' | 'slate' | 'red'> = {
  DRAFT:        'slate',
  LOBBY:        'blue',
  EN_CURSO:     'emerald',
  TRIBUTACION:  'gold',
  AUDITORIA:    'purple',
  CALIFICACION: 'gold',
  FINALIZADA:   'slate',
  CANCELADA:    'red',
};

interface SessionRecord {
  id: string;
  code: string;
  status: ClassSessionStatus;
  createdAt: string;
  companies: Array<{ id: string }>;
  _count?: { participants: number };
}

interface ExerciseSessionItem {
  exerciseId: string;
  courseId: string;
  exerciseTitle: string;
  courseName: string;
  studentsEnrolled: number;
  session: SessionRecord | null;
}

function SessionRow({ item }: { item: ExerciseSessionItem }) {
  const session = item.session!;
  const PhaseIcon = PHASE_ICON[session.status];
  const isClosed = session.status === 'FINALIZADA' || session.status === 'CANCELADA';
  return (
    <Link
      href={`/profesor/sesiones/${session.id}`}
      className="group flex items-center gap-4 border-b border-gray-100 p-4 transition-colors last:border-0 hover:bg-blue-50/50 cx-hop-parent"
    >
      <IconTile icon={isClosed ? CheckCircle2 : PhaseIcon} tint={isClosed ? '#64748B' : '#2563EB'} size={40} className="cx-hop" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-xs font-bold tracking-[0.15em] text-gray-600">
            {session.code}
          </span>
          <Badge variant={PHASE_VARIANT[session.status]}><PhaseIcon className="w-3 h-3" /> {STATUS_LABELS[session.status]}</Badge>
        </div>
        <p className="truncate text-sm font-semibold text-gray-800 group-hover:text-gray-900">{item.exerciseTitle}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{item.courseName}</span>
          <span className="flex items-center gap-1 tabular-nums"><Wifi className="w-3 h-3" />{session._count?.participants ?? 0} participantes</span>
          <span className="flex items-center gap-1 tabular-nums"><Building2 className="w-3 h-3" />{session.companies.length} empresas</span>
        </div>
      </div>
      <div className="hidden flex-shrink-0 text-xs text-gray-400 sm:block">
        Abierta {formatDateTime(session.createdAt)}
      </div>
      <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500" />
    </Link>
  );
}

function NewSessionModal({
  candidates, onClose, onCreate, creating,
}: {
  candidates: ExerciseSessionItem[];
  onClose: () => void;
  onCreate: (item: ExerciseSessionItem) => void;
  creating: boolean;
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
          {candidates.length === 0 ? (
            <p className="text-sm text-gray-400">
              Todos tus ejercicios ya tienen una sesión de aula abierta (cada ejercicio admite solo una).
            </p>
          ) : candidates.map((c) => (
            <button
              key={c.exerciseId}
              onClick={() => setSelected(c.exerciseId)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors cx-press ${
                selected === c.exerciseId
                  ? 'border-blue-400 bg-blue-50/70 ring-1 ring-blue-300'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <IconTile icon={BookOpen} tint="#1B2E6E" size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-800">{c.exerciseTitle}</p>
                <p className="truncate text-xs text-gray-400">{c.courseName} · {c.studentsEnrolled} estudiantes matriculados</p>
              </div>
              {selected === c.exerciseId && <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-blue-600" />}
            </button>
          ))}
        </div>

        <div className="flex gap-3 border-t border-gray-100 p-6">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={creating}>Cancelar</Button>
          <Button
            onClick={() => {
              const c = candidates.find((x) => x.exerciseId === selected);
              if (c) onCreate(c);
            }}
            disabled={!selected}
            loading={creating}
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
  const [items, setItems] = useState<ExerciseSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: courses } = await api.get<Course[]>('/api/v1/courses/mine');
      const all: ExerciseSessionItem[] = [];
      await Promise.all(courses.map(async (course) => {
        const { data: exList } = await api.get<Exercise[]>(`/api/v1/courses/${course.id}/exercises`);
        await Promise.all(exList.map(async (ex) => {
          let session: SessionRecord | null = null;
          try {
            const { data } = await api.get<SessionRecord>(
              `/api/v1/courses/${course.id}/exercises/${ex.id}/class-session`,
            );
            session = data;
          } catch (err: any) {
            if (err?.response?.status !== 404) throw err;
          }
          all.push({
            exerciseId: ex.id,
            courseId: course.id,
            exerciseTitle: ex.title,
            courseName: course.name,
            studentsEnrolled: course._count?.enrollments ?? 0,
            session,
          });
        }));
      }));
      all.sort((a, b) => {
        const da = a.session?.createdAt ?? '';
        const db = b.session?.createdAt ?? '';
        return db.localeCompare(da);
      });
      setItems(all);
    } catch (err) {
      setLoadError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const withSession = items.filter((i) => i.session);
  const active = withSession.filter((i) => ACTIVE_STATUSES.includes(i.session!.status));
  const finished = withSession.filter((i) => !ACTIVE_STATUSES.includes(i.session!.status));
  const withoutSession = items.filter((i) => !i.session);
  const connectedNow = active.reduce((sum, i) => sum + (i.session!._count?.participants ?? 0), 0);

  async function handleCreate(item: ExerciseSessionItem) {
    setCreating(true);
    try {
      const { data } = await api.post<SessionRecord>(
        `/api/v1/courses/${item.courseId}/exercises/${item.exerciseId}/class-session`,
      );
      toast.success('Sesión creada');
      setShowNew(false);
      router.push(`/profesor/sesiones/${data.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F4F6F8] p-6 lg:p-8">
      {showNew && (
        <NewSessionModal
          candidates={withoutSession}
          onClose={() => setShowNew(false)}
          onCreate={handleCreate}
          creating={creating}
        />
      )}

      <PageHeader
        eyebrow="Aula en vivo"
        title="Sesiones de aula"
        subtitle="Abrí una sesión sobre un ejercicio, proyectala, armá empresas por grupo y dejá que operen y se auditen entre sí."
        icon={Presentation}
        className="mb-6"
        actions={
          <Button onClick={() => setShowNew(true)} className="cx-press" disabled={loading}>
            <Plus className="w-4 h-4" /> Nueva sesión
          </Button>
        }
      />

      {/* KPIs */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-card border border-gray-200/70 bg-white shadow-card">
              <div className="space-y-2.5 p-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          ))
        ) : (
          <>
            <StatCard label="Sesiones activas" value={String(active.length)} icon={Radio} tint="#2563EB" hint="En curso ahora mismo" className="cx-pop cx-d1" />
            <StatCard label="Participantes conectados" value={String(connectedNow)} icon={Wifi} tint="#059669" hint="En sesiones activas" className="cx-pop cx-d2" />
            <StatCard label="Finalizadas" value={String(finished.length)} icon={CheckCircle2} tint="#B8860B" hint="Con resultados publicados" className="cx-pop cx-d3" />
          </>
        )}
      </div>

      {loading ? (
        <SectionCard title="Sesiones" icon={Presentation} flushBody>
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : loadError ? (
        <SectionCard title="Sesiones" icon={Presentation}>
          <EmptyState
            illustration={<SceneEmptyBox size={180} />}
            title="No se pudieron cargar las sesiones"
            description={loadError}
            action={<Button variant="secondary" onClick={load}>Reintentar</Button>}
          />
        </SectionCard>
      ) : items.length === 0 ? (
        <SectionCard title="Sesiones" icon={Presentation}>
          <EmptyState
            illustration={<SceneEmptyBox size={200} className="cx-float" />}
            title="Todavía no tenés ejercicios"
            description="Creá un ejercicio en uno de tus cursos y después volvé acá para abrir una sesión de aula sobre él."
          />
        </SectionCard>
      ) : active.length === 0 && finished.length === 0 ? (
        <SectionCard title="Sesiones" icon={Presentation}>
          <EmptyState
            illustration={<SceneEmptyBox size={200} className="cx-float" />}
            title="Aún no abriste ninguna sesión"
            description="Elegí un ejercicio y abrí una sesión de aula para proyectarla frente al grupo."
            action={<Button onClick={() => setShowNew(true)} className="cx-press"><Plus className="w-4 h-4" /> Nueva sesión</Button>}
          />
        </SectionCard>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <SectionCard icon={Radio} iconTint="#2563EB" eyebrow="Requieren tu atención" title={`Activas (${active.length})`} flushBody className="cx-pop">
              <div className="divide-y divide-gray-100">
                {active.map((i) => <SessionRow key={i.session!.id} item={i} />)}
              </div>
            </SectionCard>
          )}
          {finished.length > 0 && (
            <SectionCard icon={CheckCircle2} iconTint="#B8860B" eyebrow="Con podio y calificación" title={`Finalizadas (${finished.length})`} flushBody className="cx-pop cx-d2">
              <div className="divide-y divide-gray-100">
                {finished.map((i) => <SessionRow key={i.session!.id} item={i} />)}
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}
