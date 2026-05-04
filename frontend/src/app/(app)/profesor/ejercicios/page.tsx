'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatDate, getErrorMessage } from '@/lib/utils';
import { DifficultyBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { Course, Exercise } from '@/types';
import toast from 'react-hot-toast';
import { FileText, Plus, Globe, Lock, ChevronRight, BookOpen, Users, Trash2, AlertTriangle, X } from 'lucide-react';

interface ExerciseWithCourse extends Exercise {
  courseId: string;
  courseName: string;
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="font-bold text-gray-900">Eliminar ejercicio</h3>
        </div>
        <p className="text-sm text-gray-600 mb-2">
          ¿Estás seguro de que deseas eliminar <strong>"{exercise.title}"</strong>?
        </p>
        <p className="text-xs text-red-500 mb-6">
          Esta acción eliminará el ejercicio y todos sus intentos. No se puede deshacer.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} loading={loading}
            className="flex-1 !bg-red-600 hover:!bg-red-700 border-red-600">
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

  function ExerciseRow({ ex }: { ex: ExerciseWithCourse }) {
    return (
      <div className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 group">
        <Link
          href={`/profesor/ejercicios/${ex.id}?cursoId=${ex.courseId}`}
          className="flex-1 min-w-0"
        >
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <DifficultyBadge difficulty={ex.difficulty} />
            {ex.isPublished
              ? <span className="flex items-center gap-1 text-xs text-emerald-600"><Globe className="w-3 h-3" />Publicado</span>
              : <span className="flex items-center gap-1 text-xs text-gray-400"><Lock className="w-3 h-3" />Borrador</span>}
          </div>
          <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{ex.title}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{ex.courseName}</span>
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{(ex as any)._count?.attempts ?? 0} intentos</span>
            {ex.dueDate && <span>Vence: {formatDate(ex.dueDate)}</span>}
          </div>
        </Link>
        <div className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">{formatDate(ex.createdAt)}</div>
        <button
          onClick={(e) => { e.preventDefault(); setToDelete(ex); }}
          className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
          title="Eliminar ejercicio"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <Link href={`/profesor/ejercicios/${ex.id}?cursoId=${ex.courseId}`} className="flex-shrink-0">
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      {toDelete && (
        <DeleteModal
          exercise={toDelete}
          onConfirm={handleDelete}
          onClose={() => setToDelete(null)}
          loading={deleting}
        />
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Mis Ejercicios</h2>
          <p className="text-gray-500 text-sm mt-1">{exercises.length} ejercicio{exercises.length !== 1 ? 's' : ''} en total</p>
        </div>
        <Link href="/profesor/ejercicios/nuevo">
          <Button><Plus className="w-4 h-4" /> Nuevo ejercicio</Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : exercises.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-gray-700 font-semibold">Sin ejercicios aún</h3>
          <p className="text-gray-500 text-sm mt-1 mb-4">Crea tu primer ejercicio para tus estudiantes</p>
          <Link href="/profesor/ejercicios/nuevo">
            <Button><Plus className="w-4 h-4" /> Crear ejercicio</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {published.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-600" /> Publicados ({published.length})
              </h3>
              <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
                {published.map((ex) => <ExerciseRow key={ex.id} ex={ex} />)}
              </div>
            </section>
          )}
          {drafts.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Lock className="w-4 h-4 text-gray-400" /> Borradores ({drafts.length})
              </h3>
              <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
                {drafts.map((ex) => <ExerciseRow key={ex.id} ex={ex} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
