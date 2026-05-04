'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { Course } from '@/types';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock, Users, BookOpen, ChevronRight } from 'lucide-react';

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
            const { data: exList } = await api.get<any[]>(`/api/v1/courses/${course.id}/exercises`);
            await Promise.all(
              exList.filter((ex) => ex.isPublished).map(async (ex) => {
                const { data: attempts } = await api.get<any[]>(
                  `/api/v1/courses/${course.id}/exercises/${ex.id}/attempts`,
                );
                attempts
                  .filter((a) => a.status === 'SUBMITTED' || a.status === 'IN_PROGRESS')
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
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Pendientes de calificación</h2>
        <p className="text-gray-500 text-sm mt-1">
          {submitted.length} enviado{submitted.length !== 1 ? 's' : ''} · {inProgress.length} en progreso
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : pending.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-gray-700 font-semibold">¡Todo al día!</h3>
          <p className="text-gray-500 text-sm mt-1">No hay intentos pendientes de calificación</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Submitted — need grading */}
          {submitted.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-amber-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Por calificar ({submitted.length})
              </h3>
              <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-200">
                        <th className="text-left p-4">Estudiante</th>
                        <th className="text-left p-4">Ejercicio</th>
                        <th className="text-left p-4">Curso</th>
                        <th className="text-left p-4">Enviado</th>
                        <th className="p-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {submitted.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                                {a.student?.name?.charAt(0)?.toUpperCase() ?? '?'}
                              </div>
                              <div>
                                <p className="font-medium text-gray-700">{a.student?.name ?? '—'}</p>
                                <p className="text-xs text-gray-400">{a.student?.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <p className="text-gray-700 font-medium">{a.exercise.title}</p>
                            <p className="text-xs text-gray-400">{a.exercise.maxScore} pts</p>
                          </td>
                          <td className="p-4">
                            <span className="flex items-center gap-1 text-gray-500">
                              <BookOpen className="w-3.5 h-3.5" /> {a.courseName}
                            </span>
                          </td>
                          <td className="p-4 text-gray-400 text-xs">
                            {a.submittedAt ? formatDateTime(a.submittedAt) : '—'}
                          </td>
                          <td className="p-4 text-right">
                            <Link href={`/profesor/ejercicios/${a.exercise.id}/calificar/${a.id}?cursoId=${a.courseId}`}>
                              <Button size="sm">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Calificar
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* In progress */}
          {inProgress.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" /> En progreso ({inProgress.length})
              </h3>
              <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-200">
                        <th className="text-left p-4">Estudiante</th>
                        <th className="text-left p-4">Ejercicio</th>
                        <th className="text-left p-4">Curso</th>
                        <th className="text-left p-4">Iniciado</th>
                        <th className="p-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {inProgress.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                                {a.student?.name?.charAt(0)?.toUpperCase() ?? '?'}
                              </div>
                              <div>
                                <p className="font-medium text-gray-700">{a.student?.name ?? '—'}</p>
                                <p className="text-xs text-gray-400">{a.student?.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <p className="text-gray-700 font-medium">{a.exercise.title}</p>
                            <p className="text-xs text-gray-400">{a.exercise.maxScore} pts</p>
                          </td>
                          <td className="p-4">
                            <span className="flex items-center gap-1 text-gray-500">
                              <BookOpen className="w-3.5 h-3.5" /> {a.courseName}
                            </span>
                          </td>
                          <td className="p-4 text-gray-400 text-xs">
                            {a.startedAt ? formatDateTime(a.startedAt) : '—'}
                          </td>
                          <td className="p-4 text-right">
                            <Link href={`/profesor/ejercicios/${a.exercise.id}/calificar/${a.id}?cursoId=${a.courseId}`}>
                              <Button size="sm" variant="secondary">
                                <ChevronRight className="w-3.5 h-3.5" /> Ver
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
