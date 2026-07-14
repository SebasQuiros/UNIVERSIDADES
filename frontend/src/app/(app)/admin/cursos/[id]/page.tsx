'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatDate, getErrorMessage } from '@/lib/utils';
import { DifficultyBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconTile } from '@/components/ui/IconTile';
import { Skeleton } from '@/components/ui/Skeleton';
import { SceneEmptyBox, SceneSearchEmpty } from '@/components/illustrations';
import type { Exercise } from '@/types';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Users, FileText, UserPlus, BookOpen,
  Calendar, X, ChevronRight, Globe, Lock, Search,
} from 'lucide-react';

interface CourseDetail {
  id: string; name: string; code: string | null; period: string | null;
  description: string | null; createdAt: string;
  teacher: { id: string; name: string; email: string };
  enrollments: Array<{ id: string; enrolledAt: string; student: { id: string; name: string; email: string } }>;
  _count: { exercises: number };
}

interface Student { id: string; name: string; email: string; isActive: boolean; }

/** Usuario de la universidad tal como lo devuelve /universities/:id/users. */
interface UniversityUser {
  id: string; name: string; email: string; role: string; isActive: boolean;
}

/** El endpoint de ejercicios añade el conteo de intentos. */
type ExerciseWithCount = Exercise & { _count?: { attempts?: number } };

// Textura de puntos sutil para la banda hero (fondo azul noche).
const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
};

function EnrollModal({ courseId, universityId, enrolled, onClose, onEnrolled }: {
  courseId: string; universityId: string;
  enrolled: string[];
  onClose: () => void; onEnrolled: () => void;
}) {
  const [students, setStudents]   = useState<Student[]>([]);
  const [search, setSearch]       = useState('');
  const [saving, setSaving]       = useState<string | null>(null);

  useEffect(() => {
    api.get<UniversityUser[]>(`/api/v1/universities/${universityId}/users`)
      .then(({ data }) => setStudents(data.filter((u) => u.role === 'STUDENT' && u.isActive)))
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
      <div className="absolute inset-0 bg-csq-dark/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200/70 shadow-card-hover rounded-card w-full max-w-md cx-pop">
        <div className="flex items-center justify-between gap-3 p-5 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <IconTile icon={UserPlus} tint="#2563EB" size={42} />
            <div className="min-w-0">
              <p className="text-[0.66rem] font-bold uppercase tracking-[0.13em] text-gold-900">Matrícula</p>
              <h3 className="font-bold text-gray-900 truncate">Inscribir estudiante</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cx-press"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o correo…"
              autoFocus
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-xl transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
            />
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-200">
            {filtered.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-gray-500">
                  {students.length === 0
                    ? 'No hay estudiantes activos en esta universidad'
                    : 'Sin resultados para esa búsqueda'}
                </p>
              </div>
            ) : filtered.map(s => {
              const isEnrolled = enrolled.includes(s.id);
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50/40 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                    <p className="text-xs text-gray-400 truncate">{s.email}</p>
                  </div>
                  {isEnrolled ? (
                    <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                      Ya inscrito
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => enroll(s.id)}
                      loading={saving === s.id}
                      className="flex-shrink-0 cx-press"
                    >
                      Inscribir
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose} className="w-full cx-press">Cerrar</Button>
        </div>
      </div>
    </div>
  );
}

function CourseSkeleton() {
  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#F4F6F8]">
      <Skeleton className="h-4 w-48 mb-6" />
      <Skeleton className="h-24 w-full rounded-card mb-8" />
      <Skeleton className="h-40 w-full rounded-card mb-6" />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Skeleton className="h-80 rounded-card" />
        <Skeleton className="h-80 rounded-card" />
      </div>
    </div>
  );
}

export default function AdminCourseDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const { user } = useAuth();
  const router   = useRouter();
  const [course, setCourse]       = useState<CourseDetail | null>(null);
  const [exercises, setExercises] = useState<ExerciseWithCount[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showEnroll, setShowEnroll] = useState(false);

  const load = useCallback(async () => {
    if (!user?.universityId) return;
    setLoading(true);
    try {
      const [c, e] = await Promise.all([
        api.get<CourseDetail>(`/api/v1/universities/${user.universityId}/courses/${id}`),
        api.get<ExerciseWithCount[]>(`/api/v1/courses/${id}/exercises`),
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

  if (loading) return <CourseSkeleton />;
  if (!course) return null;

  const enrolledIds = course.enrollments.map(e => e.student.id);

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#F4F6F8]">
      {showEnroll && user?.universityId && (
        <EnrollModal
          courseId={id} universityId={user.universityId} enrolled={enrolledIds}
          onClose={() => setShowEnroll(false)}
          onEnrolled={() => { load(); }}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/admin/cursos" className="hover:text-gray-800 flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Cursos
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-medium truncate max-w-xs">{course.name}</span>
      </div>

      <PageHeader
        eyebrow="Administración"
        title={course.name}
        subtitle={course.description ?? undefined}
        icon={BookOpen}
        iconTint="#2563EB"
        className="mb-6"
        actions={
          <Button onClick={() => setShowEnroll(true)} className="cx-press">
            <UserPlus className="w-4 h-4" /> Inscribir estudiante
          </Button>
        }
      />

      {/* Banda hero — ficha del curso */}
      <div className="relative overflow-hidden rounded-card shadow-soft mb-6 lp-in bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
        <div className="relative p-6 lg:p-8">
          {course.code && (
            <span className="inline-block text-xs font-mono text-blue-100 bg-white/10 border border-white/15 px-2 py-0.5 rounded-md mb-2">
              {course.code}
            </span>
          )}
          <h2 className="text-xl lg:text-2xl font-extrabold text-white tracking-tight">{course.name}</h2>
          <div className="flex items-center gap-x-5 gap-y-2 mt-3 text-sm text-blue-200/80 flex-wrap">
            <span>Profesor: <span className="text-white font-semibold">{course.teacher.name}</span></span>
            {course.period && (
              <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{course.period}</span>
            )}
            <span className="flex items-center gap-1.5 font-mono tabular-nums">
              <Users className="w-3.5 h-3.5" />{course.enrollments.length} estudiantes
            </span>
            <span className="flex items-center gap-1.5 font-mono tabular-nums">
              <FileText className="w-3.5 h-3.5" />{exercises.length} ejercicios
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Estudiantes */}
        <SectionCard
          icon={Users}
          iconTint="#2563EB"
          eyebrow="Matrícula"
          title={`Estudiantes inscritos (${course.enrollments.length})`}
          flushBody
          action={
            <Button size="sm" variant="ghost" onClick={() => setShowEnroll(true)} className="cx-press">
              <UserPlus className="w-3.5 h-3.5" /> Agregar
            </Button>
          }
        >
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {course.enrollments.length === 0 ? (
              <EmptyState
                illustration={<SceneEmptyBox size={170} className="lp-drift" />}
                title="Nadie inscrito todavía"
                description="Inscribe estudiantes para que puedan trabajar los ejercicios de este curso."
                action={
                  <Button onClick={() => setShowEnroll(true)} className="cx-press">
                    <UserPlus className="w-4 h-4" /> Inscribir ahora
                  </Button>
                }
                className="py-8"
              />
            ) : (
              course.enrollments.map((enroll) => (
                <div key={enroll.id} className="flex items-center gap-3 px-6 lg:px-7 py-3.5 hover:bg-blue-50/40 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                    {enroll.student.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{enroll.student.name}</p>
                    <p className="text-xs text-gray-400 truncate">{enroll.student.email}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(enroll.enrolledAt)}</span>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        {/* Ejercicios */}
        <SectionCard
          icon={FileText}
          iconTint="#B8860B"
          eyebrow="Contenido"
          title={`Ejercicios (${exercises.length})`}
          flushBody
        >
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {exercises.length === 0 ? (
              <EmptyState
                illustration={<SceneSearchEmpty size={170} className="lp-drift" />}
                title="Sin ejercicios creados"
                description="El profesorado del curso todavía no ha publicado ejercicios."
                className="py-8"
              />
            ) : (
              exercises.map((ex) => (
                <div key={ex.id} className="flex items-center gap-3 px-6 lg:px-7 py-3.5 hover:bg-blue-50/40 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <DifficultyBadge difficulty={ex.difficulty} />
                      {ex.isPublished
                        ? <span className="flex items-center gap-1 text-xs text-emerald-600"><Globe className="w-3 h-3" />Publicado</span>
                        : <span className="flex items-center gap-1 text-xs text-gray-400"><Lock className="w-3 h-3" />Borrador</span>
                      }
                    </div>
                    <p className="text-sm font-semibold text-gray-800 truncate">{ex.title}</p>
                    {ex.dueDate && (
                      <p className="text-xs text-gray-400 mt-0.5">Vence: {formatDate(ex.dueDate)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-400 font-mono tabular-nums">
                      {ex._count?.attempts ?? 0} intentos
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
