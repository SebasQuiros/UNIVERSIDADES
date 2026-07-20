'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatDate, getErrorMessage } from '@/lib/utils';
import { DifficultyBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconTile } from '@/components/ui/IconTile';
import { SceneEmptyBox } from '@/components/illustrations';
import type { Course, Exercise } from '@/types';
import toast from 'react-hot-toast';
import {
  FileText, Plus, Globe, Lock, ChevronRight, BookOpen, Users,
  Trash2, AlertTriangle, X, ClipboardList,
} from 'lucide-react';

interface ExerciseWithCourse extends Exercise {
  courseId: string;
  courseName: string;
  _count?: { attempts: number };
}

function DeleteModal({
  exercise,
  onConfirm,
  onClose,
  loading,
}: {
  exercise: ExerciseWithCourse;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-csq-dark/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-card border border-gray-200/70 bg-white p-6 shadow-card-hover cx-pop">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600" aria-label="Cerrar">
          <X className="w-5 h-5" />
        </button>
        <div className="mb-4 flex items-center gap-3">
          <IconTile icon={AlertTriangle} tint="#DC2626" size={44} />
          <h3 className="font-bold tracking-tight text-gray-900">Eliminar ejercicio</h3>
        </div>
        <p className="mb-2 text-sm text-gray-600">
          ¿Seguro que deseas eliminar <strong>{exercise.title}</strong>?
        </p>
        <p className="mb-6 text-xs text-red-600">
          Esta acción eliminará el ejercicio y todos sus intentos. No se puede deshacer.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={loading}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading} className="flex-1 cx-press">
            Eliminar
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function EjerciciosPage() {
  const { user } = useAuth();
  const [exercises, setExercises]     = useState<ExerciseWithCourse[]>([]);
  const [loading, setLoading]         = useState(true);
  const [toDelete, setToDelete]       = useState<ExerciseWithCourse | null>(null);
  const [deleting, setDeleting]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: courses } = await api.get<Course[]>(`/api/v1/courses/mine`);
      const all: ExerciseWithCourse[] = [];
      await Promise.all(
        courses.map(async (course) => {
          const { data: exList } = await api.get<Exercise[]>(`/api/v1/courses/${course.id}/exercises`);
          exList.forEach((ex) => all.push({ ...ex, courseId: course.id, courseName: course.name }));
        }),
      );
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setExercises(all);
    } catch { toast.error('Error al cargar ejercicios'); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/courses/${toDelete.courseId}/exercises/${toDelete.id}`);
      toast.success('Ejercicio eliminado');
      setExercises((prev) => prev.filter((e) => e.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  const published = exercises.filter((e) => e.isPublished);
  const drafts    = exercises.filter((e) => !e.isPublished);
  const totalAttempts = exercises.reduce((s, e) => s + (e._count?.attempts ?? 0), 0);

  function ExerciseRow({ ex }: { ex: ExerciseWithCourse }) {
    return (
      <div className="group flex items-center gap-4 border-b border-gray-100 p-4 transition-colors last:border-0 hover:bg-blue-50/50 cx-hop-parent">
        <IconTile
          icon={ex.isPublished ? Globe : Lock}
          tint={ex.isPublished ? '#059669' : '#94A3B8'}
          size={40}
          className="cx-hop"
        />
        <Link
          href={`/profesor/ejercicios/${ex.id}?cursoId=${ex.courseId}`}
          className="min-w-0 flex-1 cx-press"
        >
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <DifficultyBadge difficulty={ex.difficulty} />
            {ex.isPublished
              ? <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><Globe className="w-3 h-3" />Publicado</span>
              : <span className="flex items-center gap-1 text-xs font-semibold text-gray-400"><Lock className="w-3 h-3" />Borrador</span>}
          </div>
          <p className="truncate text-sm font-semibold text-gray-800 group-hover:text-gray-900">{ex.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{ex.courseName}</span>
            <span className="flex items-center gap-1 tabular-nums"><Users className="w-3 h-3" />{ex._count?.attempts ?? 0} intentos</span>
            {ex.dueDate && <span>Vence: {formatDate(ex.dueDate)}</span>}
          </div>
        </Link>
        <div className="hidden flex-shrink-0 text-xs text-gray-400 sm:block">{formatDate(ex.createdAt)}</div>
        <button
          onClick={(e) => { e.preventDefault(); setToDelete(ex); }}
          className="flex-shrink-0 rounded-lg p-2 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 cx-press"
          title="Eliminar ejercicio"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <Link href={`/profesor/ejercicios/${ex.id}?cursoId=${ex.courseId}`} className="flex-shrink-0">
          <ChevronRight className="w-4 h-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#FBF8F1] p-6 lg:p-8">
      {toDelete && (
        <DeleteModal
          exercise={toDelete}
          onConfirm={handleDelete}
          onClose={() => setToDelete(null)}
          loading={deleting}
        />
      )}

      <PageHeader
        eyebrow="Portal profesor"
        title="Mis ejercicios"
        subtitle={`${exercises.length} ejercicio${exercises.length !== 1 ? 's' : ''} en total`}
        icon={ClipboardList}
        className="mb-6"
        actions={
          <Link href="/profesor/ejercicios/nuevo">
            <Button className="cx-press"><Plus className="w-4 h-4" /> Nuevo ejercicio</Button>
          </Link>
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
              label="Publicados" value={String(published.length)} icon={Globe} tint="#059669"
              hint="Visibles para estudiantes" className="cx-pop cx-d1"
            />
            <StatCard
              label="Borradores" value={String(drafts.length)} icon={Lock} tint="#B8860B"
              hint="Sin publicar" className="cx-pop cx-d2"
            />
            <StatCard
              label="Intentos" value={String(totalAttempts)} icon={Users} tint="#2563EB"
              hint="Acumulados en todos los cursos" className="cx-pop cx-d3"
            />
          </>
        )}
      </div>

      {loading ? (
        <SectionCard title="Ejercicios" icon={FileText} flushBody>
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </SectionCard>
      ) : exercises.length === 0 ? (
        <SectionCard title="Ejercicios" icon={FileText}>
          <EmptyState
            illustration={<SceneEmptyBox size={200} className="cx-float" />}
            title="Sin ejercicios aún"
            description="Crea tu primer ejercicio para que tus estudiantes empiecen a practicar el ciclo contable."
            action={
              <Link href="/profesor/ejercicios/nuevo">
                <Button className="cx-press"><Plus className="w-4 h-4" /> Crear ejercicio</Button>
              </Link>
            }
          />
        </SectionCard>
      ) : (
        <div className="space-y-6">
          {published.length > 0 && (
            <SectionCard
              icon={Globe}
              iconTint="#059669"
              eyebrow="Visibles para estudiantes"
              title={`Publicados (${published.length})`}
              flushBody
              className="cx-pop"
            >
              <div className="divide-y divide-gray-100">
                {published.map((ex) => <ExerciseRow key={ex.id} ex={ex} />)}
              </div>
            </SectionCard>
          )}
          {drafts.length > 0 && (
            <SectionCard
              icon={Lock}
              iconTint="#B8860B"
              eyebrow="Aún sin publicar"
              title={`Borradores (${drafts.length})`}
              flushBody
              className="cx-pop cx-d2"
            >
              <div className="divide-y divide-gray-100">
                {drafts.map((ex) => <ExerciseRow key={ex.id} ex={ex} />)}
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}
