'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatDate, getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import type { Course, University } from '@/types';
import toast from 'react-hot-toast';
import {
  BookOpen, Plus, Users, FileText, ArrowRight,
  X, Calendar, Hash, Building2, ChevronDown, ChevronUp,
  Trash2, AlertTriangle,
} from 'lucide-react';

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
      onCreated({ ...data, university: uni ? { id: uni.id, name: uni.name, shortName: (uni as any).shortName ?? null } : undefined });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 shadow-xl rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Nuevo Curso</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Universidad selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Universidad *
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <select
                value={form.universityId}
                onChange={(e) => setForm({ ...form, universityId: e.target.value })}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u as any).shortName ? `${(u as any).shortName} — ${u.name}` : u.name}
                  </option>
                ))}
              </select>
            </div>
            {errors.universityId && <p className="text-red-500 text-xs mt-1">{errors.universityId}</p>}
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
            <Button type="submit" loading={saving} className="flex-1">
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="font-bold text-gray-900">Eliminar curso</h3>
        </div>
        <p className="text-sm text-gray-600 mb-2">
          ¿Estás seguro de que deseas eliminar <strong>"{course.name}"</strong>?
        </p>
        <p className="text-xs text-red-500 mb-6">
          El curso quedará inactivo y sus estudiantes ya no podrán acceder. No se puede deshacer.
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

function CourseCard({
  course,
  onDelete,
}: {
  course: CourseWithUniversity;
  onDelete: (c: CourseWithUniversity) => void;
}) {
  return (
    <div className="group bg-white border border-gray-200 hover:border-gray-300 shadow-sm rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200 hover:shadow-md relative">
      <Link href={`/profesor/cursos/${course.id}`} className="flex flex-col gap-4 flex-1">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {course.code && (
              <span className="text-xs font-mono text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                {course.code}
              </span>
            )}
            <h3 className="font-semibold text-gray-900 group-hover:text-gray-800 mt-1.5 leading-snug">
              {course.name}
            </h3>
            {course.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{course.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            {course._count?.enrollments ?? 0} estudiantes
          </span>
          <span className="flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            {course._count?.exercises ?? 0} ejercicios
          </span>
        </div>
        {course.period && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Calendar className="w-3.5 h-3.5" />
            Período: {course.period}
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-auto">
          <span className="text-xs text-gray-400">{formatDate(course.createdAt)}</span>
          <span className="flex items-center gap-1 text-xs text-blue-600 group-hover:text-blue-700">
            Ver detalles <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </Link>
      <button
        onClick={() => onDelete(course)}
        className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
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
        className="flex items-center gap-3 mb-4 group w-full text-left"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 border border-blue-200">
          <Building2 className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1">
          <span className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
            {label}
          </span>
          {university.shortName && (
            <span className="ml-2 text-xs text-gray-400">{university.name}</span>
          )}
          <span className="ml-2 text-xs text-gray-400">
            · {courses.length} curso{courses.length !== 1 ? 's' : ''}
          </span>
        </div>
        {collapsed
          ? <ChevronDown className="w-4 h-4 text-gray-400" />
          : <ChevronUp className="w-4 h-4 text-gray-400" />}
      </button>

      {!collapsed && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 pl-11">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CursosPage() {
  const { user } = useAuth();
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

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
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

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Mis Cursos</h2>
          <p className="text-gray-500 text-sm mt-1">
            {courses.length} curso{courses.length !== 1 ? 's' : ''} en {groups.length} universidad{groups.length !== 1 ? 'es' : ''}
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} disabled={universities.length === 0}>
          <Plus className="w-4 h-4" />
          Nuevo curso
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-gray-700 font-semibold">No tienes cursos aún</h3>
          <p className="text-gray-500 text-sm mt-1 mb-4">Crea tu primer curso para comenzar</p>
          <Button onClick={() => setShowModal(true)} disabled={universities.length === 0}>
            <Plus className="w-4 h-4" /> Crear curso
          </Button>
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
