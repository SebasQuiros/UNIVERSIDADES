'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { SceneEmptyBox } from '@/components/illustrations';
import type { Course } from '@/types';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock, BookOpen, ChevronRight, ClipboardCheck } from 'lucide-react';

interface PendingAttempt {
  id: string;
  status: 'SUBMITTED' | 'IN_PROGRESS';
  submittedAt: string | null;
  startedAt: string | null;
  student: { id: string; name: string; email: string };
  exercise: { id: string; title: string; maxScore: number };
  courseId: string;
  courseName: string;
}

/** Forma mínima de los ejercicios/intentos que consumimos aquí. */
interface ExerciseLite {
  id: string;
  title: string;
  maxScore: number;
  isPublished: boolean;
}
interface AttemptLite {
  id: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
  submittedAt: string | null;
  startedAt: string | null;
  student: { id: string; name: string; email: string };
}

/** Fila de la tabla de pendientes — misma forma para "por calificar" y "en progreso". */
function AttemptRow({ a, kind }: { a: PendingAttempt; kind: 'submitted' | 'inProgress' }) {
  const dateStr = kind === 'submitted'
    ? (a.submittedAt ? formatDateTime(a.submittedAt) : '—')
    : (a.startedAt ? formatDateTime(a.startedAt) : '—');

  return (
    <tr className="group transition-colors hover:bg-blue-50/50">
      <td className="p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-xs font-bold text-blue-700">
            {a.student?.name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-800">{a.student?.name ?? '—'}</p>
            <p className="truncate text-xs text-gray-400">{a.student?.email}</p>
          </div>
        </div>
      </td>
      <td className="p-4">
        <p className="font-medium text-gray-700">{a.exercise.title}</p>
        <p className="text-xs text-gray-400 tabular-nums">{a.exercise.maxScore} pts</p>
      </td>
      <td className="p-4">
        <span className="flex items-center gap-1.5 text-gray-500">
          <BookOpen className="w-3.5 h-3.5 text-gray-400" /> {a.courseName}
        </span>
      </td>
      <td className="p-4 text-xs text-gray-400 tabular-nums">{dateStr}</td>
      <td className="p-4 text-right">
        <Link href={`/profesor/ejercicios/${a.exercise.id}/calificar/${a.id}?cursoId=${a.courseId}`}>
          {kind === 'submitted' ? (
            <Button size="sm" className="cx-press">
              <CheckCircle2 className="w-3.5 h-3.5" /> Calificar
            </Button>
          ) : (
            <Button size="sm" variant="secondary" className="cx-press">
              <ChevronRight className="w-3.5 h-3.5" /> Ver
            </Button>
          )}
        </Link>
      </td>
    </tr>
  );
}

export default function PendientesPage() {
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.universityId) return;
    setLoading(true);
    try {
      const { data: courses } = await api.get<Course[]>(`/api/v1/universities/${user.universityId}/courses`);
      const all: PendingAttempt[] = [];
      await Promise.all(
        courses.map(async (course) => {
          try {
            const { data: exList } = await api.get<ExerciseLite[]>(`/api/v1/courses/${course.id}/exercises`);
            await Promise.all(
              exList.filter((ex) => ex.isPublished).map(async (ex) => {
                const { data: attempts } = await api.get<AttemptLite[]>(
                  `/api/v1/courses/${course.id}/exercises/${ex.id}/attempts`,
                );
                attempts
                  .filter((a): a is AttemptLite & { status: PendingAttempt['status'] } =>
                    a.status === 'SUBMITTED' || a.status === 'IN_PROGRESS')
                  .forEach((a) => {
                    all.push({
                      id: a.id,
                      status: a.status,
                      submittedAt: a.submittedAt,
                      startedAt: a.startedAt,
                      student: a.student,
                      exercise: { id: ex.id, title: ex.title, maxScore: ex.maxScore },
                      courseId: course.id,
                      courseName: course.name,
                    });
                  });
              }),
            );
          } catch { /* skip courses with errors */ }
        }),
      );
      // Sort: submitted first, then by submittedAt date
      all.sort((a, b) => {
        if (a.status === 'SUBMITTED' && b.status !== 'SUBMITTED') return -1;
        if (a.status !== 'SUBMITTED' && b.status === 'SUBMITTED') return 1;
        const dateA = a.submittedAt ?? a.startedAt ?? '';
        const dateB = b.submittedAt ?? b.startedAt ?? '';
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
      setPending(all);
    } catch { toast.error('Error al cargar pendientes'); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const submitted   = pending.filter((a) => a.status === 'SUBMITTED');
  const inProgress  = pending.filter((a) => a.status === 'IN_PROGRESS');

  return (
    <div className="flex-1 overflow-y-auto bg-[#FBF8F1] p-6 lg:p-8">
      <PageHeader
        eyebrow="Calificación"
        title="Pendientes de calificación"
        subtitle={`${submitted.length} entrega${submitted.length !== 1 ? 's' : ''} por revisar · ${inProgress.length} en progreso`}
        icon={ClipboardCheck}
        iconTint="#B8860B"
        className="mb-6"
        actions={
          submitted.length > 0 ? (
            <span className="relative inline-flex items-center gap-2 rounded-full border border-gold-100 bg-gold-50 px-3 py-1.5 text-xs font-bold text-gold-900">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-gold-500 cx-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-600" />
              </span>
              <span className="tabular-nums">{submitted.length}</span> reclaman tu atención
            </span>
          ) : undefined
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
            <StatCard
              label="Por calificar" value={String(submitted.length)} icon={CheckCircle2} tint="#B8860B"
              hint="Entregas esperando nota" className="cx-pop cx-d1"
            />
            <StatCard
              label="En progreso" value={String(inProgress.length)} icon={Clock} tint="#2563EB"
              hint="Intentos aún abiertos" className="cx-pop cx-d2"
            />
            <StatCard
              label="Total en cola" value={String(pending.length)} icon={ClipboardCheck} tint="#1B2E6E"
              hint="Intentos activos" className="cx-pop cx-d3"
            />
          </>
        )}
      </div>

      {loading ? (
        <SectionCard title="Cargando entregas…" icon={ClipboardCheck} flushBody>
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-8 w-24 rounded-xl" />
              </div>
            ))}
          </div>
        </SectionCard>
      ) : pending.length === 0 ? (
        <SectionCard title="Bandeja de calificación" icon={ClipboardCheck} iconTint="#059669">
          <EmptyState
            illustration={<SceneEmptyBox size={200} className="cx-float" />}
            title="¡Todo al día!"
            description="No hay intentos pendientes de calificación. Cuando tus estudiantes entreguen, aparecerán aquí."
          />
        </SectionCard>
      ) : (
        <div className="space-y-6">

          {/* Entregados — necesitan nota */}
          {submitted.length > 0 && (
            <SectionCard
              icon={CheckCircle2}
              iconTint="#B8860B"
              eyebrow="Requieren tu nota"
              title={`Por calificar (${submitted.length})`}
              flushBody
              className="cx-pop"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-gray-500">
                      <th className="p-4 text-left">Estudiante</th>
                      <th className="p-4 text-left">Ejercicio</th>
                      <th className="p-4 text-left">Curso</th>
                      <th className="p-4 text-left">Enviado</th>
                      <th className="p-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {submitted.map((a) => <AttemptRow key={a.id} a={a} kind="submitted" />)}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* En progreso */}
          {inProgress.length > 0 && (
            <SectionCard
              icon={Clock}
              iconTint="#2563EB"
              eyebrow="Trabajo en curso"
              title={`En progreso (${inProgress.length})`}
              flushBody
              className="cx-pop cx-d2"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-gray-500">
                      <th className="p-4 text-left">Estudiante</th>
                      <th className="p-4 text-left">Ejercicio</th>
                      <th className="p-4 text-left">Curso</th>
                      <th className="p-4 text-left">Iniciado</th>
                      <th className="p-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {inProgress.map((a) => <AttemptRow key={a.id} a={a} kind="inProgress" />)}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}
