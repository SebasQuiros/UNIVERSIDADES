'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate, getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconTile } from '@/components/ui/IconTile';
import { ArtLedger, SceneEmptyBox } from '@/components/illustrations';
import type { Course, University } from '@/types';
import toast from 'react-hot-toast';
import {
  BookOpen, Plus, Users, FileText, ArrowRight,
  X, Calendar, Hash, Building2, ChevronDown, ChevronUp,
  Trash2, AlertTriangle, GraduationCap,
} from 'lucide-react';

// Textura de puntos sutil para la banda hero (fondo azul noche).
const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
};

interface CourseWithUniversity extends Course {
  university?: { id: string; name: string; shortName: string | null };
}

function CreateCourseModal({
  universities,
  onClose,
  onCreated,
}: {
  universities: University[];
  onClose: () => void;
  onCreated: (course: CourseWithUniversity) => void;
}) {
  const [form, setForm] = useState({
    universityId: universities[0]?.id ?? '',
    name: '', code: '', period: '', description: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.universityId) errs.universityId = 'Selecciona una universidad';
    if (!form.name.trim()) errs.name = 'El nombre es requerido';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const { data } = await api.post<CourseWithUniversity>(
        `/api/v1/universities/${form.universityId}/courses`,
        {
          name: form.name,
          code: form.code || undefined,
          period: form.period || undefined,
          description: form.description || undefined,
        },
      );
      const uni = universities.find((u) => u.id === form.universityId);
      toast.success('Curso creado exitosamente');
      onCreated({ ...data, university: uni ? { id: uni.id, name: uni.name, shortName: uni.shortName ?? null } : undefined });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-csq-dark/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200/70 shadow-card-hover rounded-card w-full max-w-md cx-pop">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <IconTile icon={BookOpen} tint="#1B2E6E" size={40} />
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">Portal profesor</p>
              <h3 className="font-bold tracking-tight text-gray-900">Nuevo curso</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors cx-press" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Universidad selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Universidad *
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <select
                value={form.universityId}
                onChange={(e) => setForm({ ...form, universityId: e.target.value })}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
              >
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.shortName ? `${u.shortName} — ${u.name}` : u.name}
                  </option>
                ))}
              </select>
            </div>
            {errors.universityId && <p className="text-xs text-red-600 mt-1">{errors.universityId}</p>}
          </div>

          <Input
            label="Nombre del curso *"
            placeholder="Contabilidad I - 2026"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={errors.name}
            icon={<BookOpen className="w-4 h-4" />}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Código"
              placeholder="CONT-1001"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              icon={<Hash className="w-4 h-4" />}
            />
            <Input
              label="Período"
              placeholder="2026-I"
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
              icon={<Calendar className="w-4 h-4" />}
            />
          </div>
          <Input
            label="Descripción"
            placeholder="Descripción opcional del curso"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" loading={saving} className="flex-1 cx-press">
              Crear curso
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteCourseModal({
  course,
  onConfirm,
  onClose,
  loading,
}: {
  course: CourseWithUniversity;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-csq-dark/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-card shadow-card-hover border border-gray-200/70 w-full max-w-sm p-6 cx-pop">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Cerrar">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <IconTile icon={AlertTriangle} tint="#DC2626" size={44} />
          <h3 className="font-bold tracking-tight text-gray-900">Eliminar curso</h3>
        </div>
        <p className="text-sm text-gray-600 mb-2">
          ¿Seguro que deseas eliminar <strong>{course.name}</strong>?
        </p>
        <p className="text-xs text-red-600 mb-6">
          El curso quedará inactivo y sus estudiantes ya no podrán acceder. No se puede deshacer.
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

function CourseCard({
  course,
  onDelete,
  delay,
}: {
  course: CourseWithUniversity;
  onDelete: (c: CourseWithUniversity) => void;
  delay: string;
}) {
  return (
    <div
      className={`group relative flex flex-col gap-4 rounded-card border border-gray-200/70 bg-white p-5 shadow-card hover:shadow-card-hover hover:border-gray-300/70 cx-lift cx-hop-parent cx-pop ${delay}`}
    >
      <Link href={`/profesor/cursos/${course.id}`} className="flex flex-1 flex-col gap-4 cx-press">
        <div className="flex items-start gap-3.5">
          <IconTile icon={BookOpen} tint="#1B2E6E" size={44} className="cx-hop" />
          <div className="min-w-0 flex-1 pr-8">
            {course.code && (
              <span className="text-xs font-mono text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                {course.code}
              </span>
            )}
            <h3 className="mt-1.5 font-bold tracking-tight text-gray-900 leading-snug">
              {course.name}
            </h3>
            {course.description && (
              <p className="mt-1 line-clamp-2 text-xs text-gray-500">{course.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1.5 tabular-nums">
            <Users className="w-4 h-4 text-gray-400" />
            {course._count?.enrollments ?? 0} estudiantes
          </span>
          <span className="flex items-center gap-1.5 tabular-nums">
            <FileText className="w-4 h-4 text-gray-400" />
            {course._count?.exercises ?? 0} ejercicios
          </span>
        </div>

        {course.period && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Calendar className="w-3.5 h-3.5" />
            Período: {course.period}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
          <span className="text-xs text-gray-400">{formatDate(course.createdAt)}</span>
          <span className="flex items-center gap-1 text-xs font-semibold text-blue-700">
            Ver detalles <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
      <button
        onClick={() => onDelete(course)}
        className="absolute top-4 right-4 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 cx-press"
        title="Eliminar curso"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function UniversitySection({
  university,
  courses,
  onDelete,
}: {
  university: { id: string; name: string; shortName: string | null };
  courses: CourseWithUniversity[];
  onDelete: (c: CourseWithUniversity) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const label = university.shortName ?? university.name;

  return (
    <div className="mb-8">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="mb-4 flex w-full items-center gap-3 text-left cx-hop-parent"
      >
        <IconTile icon={Building2} tint="#2563EB" size={40} className="cx-hop" />
        <div className="flex-1">
          <span className="font-bold tracking-tight text-gray-900">
            {label}
          </span>
          {university.shortName && (
            <span className="ml-2 text-xs text-gray-400">{university.name}</span>
          )}
          <span className="ml-2 text-xs text-gray-400 tabular-nums">
            · {courses.length} curso{courses.length !== 1 ? 's' : ''}
          </span>
        </div>
        {collapsed
          ? <ChevronDown className="w-4 h-4 text-gray-400" />
          : <ChevronUp className="w-4 h-4 text-gray-400" />}
      </button>

      {!collapsed && (
        <div className="grid grid-cols-1 gap-4 sm:pl-[3.25rem] lg:grid-cols-2 xl:grid-cols-3">
          {courses.map((course, i) => (
            <CourseCard
              key={course.id}
              course={course}
              onDelete={onDelete}
              delay={`cx-d${Math.min(i + 1, 6)}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CursosPage() {
  const [courses, setCourses] = useState<CourseWithUniversity[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [toDelete, setToDelete]         = useState<CourseWithUniversity | null>(null);
  const [deleting, setDeleting]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Courses endpoint — always accessible to TEACHER
      const coursesRes = await api.get<CourseWithUniversity[]>('/api/v1/courses/mine');
      setCourses(coursesRes.data);

      // Universities endpoint — may be restricted; build list from courses instead
      const uniMap = new Map<string, University>();
      for (const c of coursesRes.data) {
        if (c.university && !uniMap.has(c.university.id)) {
          uniMap.set(c.university.id, c.university as unknown as University);
        }
      }
      // Also try fetching universities (works for ADMIN roles); silently ignore 403
      try {
        const unisRes = await api.get<University[]>('/api/v1/universities');
        setUniversities(unisRes.data);
      } catch {
        // TEACHER role — derive university list from loaded courses
        setUniversities(Array.from(uniMap.values()));
      }
    } catch {
      toast.error('Error al cargar cursos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    if (!toDelete) return;
    if (!toDelete.university?.id) {
      toast.error('No se puede eliminar: universidad no identificada');
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/api/v1/universities/${toDelete.university.id}/courses/${toDelete.id}`);
      toast.success('Curso eliminado');
      setCourses((prev) => prev.filter((c) => c.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  // Group courses by university
  const grouped = courses.reduce<Map<string, { university: { id: string; name: string; shortName: string | null }; courses: CourseWithUniversity[] }>>(
    (acc, course) => {
      const uniId = course.university?.id ?? 'unknown';
      if (!acc.has(uniId)) {
        acc.set(uniId, {
          university: course.university ?? { id: uniId, name: 'Universidad', shortName: null },
          courses: [],
        });
      }
      acc.get(uniId)!.courses.push(course);
      return acc;
    },
    new Map(),
  );

  const groups = Array.from(grouped.values());

  const totalStudents  = courses.reduce((s, c) => s + (c._count?.enrollments ?? 0), 0);
  const totalExercises = courses.reduce((s, c) => s + (c._count?.exercises ?? 0), 0);

  return (
    <div className="flex-1 overflow-y-auto bg-[#FBF8F1] p-6 lg:p-8">
      {toDelete && (
        <DeleteCourseModal
          course={toDelete}
          onConfirm={handleDelete}
          onClose={() => setToDelete(null)}
          loading={deleting}
        />
      )}
      {showModal && universities.length > 0 && (
        <CreateCourseModal
          universities={universities}
          onClose={() => setShowModal(false)}
          onCreated={(c) => {
            setCourses((prev) => [c, ...prev]);
            setShowModal(false);
          }}
        />
      )}

      <PageHeader
        eyebrow="Portal profesor"
        title="Mis cursos"
        subtitle={`${courses.length} curso${courses.length !== 1 ? 's' : ''} en ${groups.length} universidad${groups.length !== 1 ? 'es' : ''}`}
        icon={GraduationCap}
        className="mb-6"
        actions={
          <Button onClick={() => setShowModal(true)} disabled={universities.length === 0} className="cx-press">
            <Plus className="w-4 h-4" />
            Nuevo curso
          </Button>
        }
      />

      {/* Banda hero — resumen docente sobre azul noche */}
      <div className="relative mb-8 overflow-hidden rounded-card shadow-soft lp-in bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
        <div aria-hidden className="pointer-events-none absolute right-6 bottom-4 hidden opacity-95 xl:block">
          <ArtLedger size={160} className="cx-float" />
        </div>
        <div className="relative p-6 lg:p-8">
          <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-gold-500">
            Tu docencia
          </p>
          <h2 className="text-xl font-extrabold tracking-tight text-white lg:text-2xl">
            Cursos activos y alcance
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-blue-200/80">
            Agrupados por universidad. Cada curso reúne a sus estudiantes y sus ejercicios.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:max-w-2xl">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-card border border-white/10 bg-white/5" />
              ))
            ) : (
              <>
                <StatCard variant="dark" label="Cursos" value={String(courses.length)} icon={BookOpen} hint="Activos" className="cx-pop cx-d1" />
                <StatCard variant="dark" label="Estudiantes" value={String(totalStudents)} icon={Users} hint="Inscritos en total" className="cx-pop cx-d2" />
                <StatCard variant="dark" label="Ejercicios" value={String(totalExercises)} icon={FileText} hint="Publicados y borradores" className="cx-pop cx-d3" />
              </>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-card border border-gray-200/70 bg-white p-5 shadow-card">
              <div className="flex items-start gap-3.5">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <div className="mt-5 flex gap-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-card border border-gray-200/70 bg-white shadow-card">
          <EmptyState
            illustration={<SceneEmptyBox size={200} className="cx-float" />}
            title="Aún no tienes cursos"
            description="Crea tu primer curso para inscribir estudiantes y publicar ejercicios."
            action={
              <Button onClick={() => setShowModal(true)} disabled={universities.length === 0} className="cx-press">
                <Plus className="w-4 h-4" /> Crear curso
              </Button>
            }
          />
        </div>
      ) : (
        groups.map(({ university, courses: uniCourses }) => (
          <UniversitySection
            key={university.id}
            university={university}
            courses={uniCourses}
            onDelete={setToDelete}
          />
        ))
      )}
    </div>
  );
}
