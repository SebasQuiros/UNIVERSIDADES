'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatDate, getErrorMessage } from '@/lib/utils';
import { DifficultyBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { Exercise } from '@/types';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Users, FileText, UserPlus,
  Calendar, X, ChevronRight, Globe, Lock, Search, UserX,
} from 'lucide-react';

interface CourseDetail {
  id: string; name: string; code: string | null; period: string | null;
  description: string | null; createdAt: string;
  teacher: { id: string; name: string; email: string };
  enrollments: Array<{ id: string; enrolledAt: string; student: { id: string; name: string; email: string } }>;
  _count: { exercises: number };
}

interface Student { id: string; name: string; email: string; isActive: boolean; }

function EnrollModal({ courseId, universityId, enrolled, onClose, onEnrolled }: {
  courseId: string; universityId: string;
  enrolled: string[];
  onClose: () => void; onEnrolled: () => void;
}) {
  const [students, setStudents]   = useState<Student[]>([]);
  const [search, setSearch]       = useState('');
  const [saving, setSaving]       = useState<string | null>(null);

  useEffect(() => {
    api.get<any[]>(`/api/v1/universities/${universityId}/users`)
      .then(({ data }) => setStudents(data.filter((u: any) => u.role === 'STUDENT' && u.isActive)))
      .catch(() => toast.error('No se pudieron cargar los estudiantes'));
  }, [universityId]);

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  async function enroll(studentId: string) {
    setSaving(studentId);
    try {
      await api.post(`/api/v1/universities/${universityId}/courses/${courseId}/enroll`, { studentId });
      toast.success('Estudiante inscrito');
      onEnrolled();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 shadow-xl rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Inscribir estudiante</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o correo..."
              autoFocus
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-200">
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">
                {students.length === 0 ? 'No hay estudiantes en esta universidad' : 'Sin resultados'}
              </p>
            ) : filtered.map(s => {
              const isEnrolled = enrolled.includes(s.id);
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                    <p className="text-xs text-gray-400 truncate">{s.email}</p>
                  </div>
                  {isEnrolled ? (
                    <span className="text-xs text-emerald-600 font-medium flex-shrink-0">Ya inscrito</span>
                  ) : (
                    <button
                      onClick={() => enroll(s.id)}
                      disabled={saving === s.id}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {saving === s.id ? '...' : 'Inscribir'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="p-4 border-t border-gray-200">
          <button onClick={onClose}
            className="w-full py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminCourseDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const { user } = useAuth();
  const router   = useRouter();
  const [course, setCourse]       = useState<CourseDetail | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showEnroll, setShowEnroll] = useState(false);

  const load = useCallback(async () => {
    if (!user?.universityId) return;
    setLoading(true);
    try {
      const [c, e] = await Promise.all([
        api.get<CourseDetail>(`/api/v1/universities/${user.universityId}/courses/${id}`),
        api.get<Exercise[]>(`/api/v1/courses/${id}/exercises`),
      ]);
      setCourse(c.data);
      setExercises(e.data);
    } catch {
      toast.error('Error al cargar el curso');
      router.push('/admin/cursos');
    } finally {
      setLoading(false);
    }
  }, [id, user, router]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex-1 flex items-center justify-center"><Spinner size="lg" /></div>;
  if (!course) return null;

  const enrolledIds = course.enrollments.map(e => e.student.id);

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      {showEnroll && user?.universityId && (
        <EnrollModal
          courseId={id} universityId={user.universityId} enrolled={enrolledIds}
          onClose={() => setShowEnroll(false)}
          onEnrolled={() => { load(); }}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/admin/cursos" className="hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Cursos
        </Link>
        <span>/</span>
        <span className="text-gray-700">{course.name}</span>
      </div>

      {/* Course header */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            {course.code && (
              <span className="text-xs font-mono text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                {course.code}
              </span>
            )}
            <h2 className="text-xl font-bold text-gray-900 mt-2">{course.name}</h2>
            {course.description && <p className="text-gray-500 text-sm mt-1">{course.description}</p>}
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              <span className="text-gray-600">Profesor: <span className="font-medium">{course.teacher.name}</span></span>
              {course.period && (
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{course.period}</span>
              )}
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{course.enrollments.length} estudiantes</span>
              <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{exercises.length} ejercicios</span>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowEnroll(true)}>
            <UserPlus className="w-4 h-4" /> Inscribir estudiante
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Students */}
        <section className="bg-white border border-gray-200 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Estudiantes inscritos
              <span className="bg-gray-100 text-gray-600 border border-gray-200 text-xs px-1.5 py-0.5 rounded-full">
                {course.enrollments.length}
              </span>
            </h3>
            <button onClick={() => setShowEnroll(true)}
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
              <UserPlus className="w-3.5 h-3.5" /> Agregar
            </button>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {course.enrollments.length === 0 ? (
              <div className="p-8 text-center">
                <UserX className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No hay estudiantes inscritos</p>
                <button onClick={() => setShowEnroll(true)}
                  className="mt-3 text-xs text-blue-600 hover:underline">Inscribir ahora</button>
              </div>
            ) : (
              course.enrollments.map((enroll) => (
                <div key={enroll.id} className="flex items-center gap-3 p-4 hover:bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-sm flex-shrink-0">
                    {enroll.student.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{enroll.student.name}</p>
                    <p className="text-xs text-gray-400 truncate">{enroll.student.email}</p>
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(enroll.enrolledAt)}</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Exercises */}
        <section className="bg-white border border-gray-200 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Ejercicios
              <span className="bg-gray-100 text-gray-600 border border-gray-200 text-xs px-1.5 py-0.5 rounded-full">
                {exercises.length}
              </span>
            </h3>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {exercises.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500 text-sm">No hay ejercicios creados</p>
              </div>
            ) : (
              exercises.map((ex) => (
                <div key={ex.id} className="flex items-center gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <DifficultyBadge difficulty={ex.difficulty} />
                      {ex.isPublished
                        ? <span className="flex items-center gap-1 text-xs text-emerald-600"><Globe className="w-3 h-3" />Publicado</span>
                        : <span className="flex items-center gap-1 text-xs text-gray-400"><Lock className="w-3 h-3" />Borrador</span>
                      }
                    </div>
                    <p className="text-sm font-medium text-gray-700 truncate">{ex.title}</p>
                    {ex.dueDate && (
                      <p className="text-xs text-gray-400 mt-0.5">Vence: {formatDate(ex.dueDate)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-400">{(ex as any)._count?.attempts ?? 0} intentos</span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
