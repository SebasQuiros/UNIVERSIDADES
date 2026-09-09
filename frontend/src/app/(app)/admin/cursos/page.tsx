'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconTile } from '@/components/ui/IconTile';
import { Skeleton } from '@/components/ui/Skeleton';
import { SceneEmptyBox, SceneSearchEmpty } from '@/components/illustrations';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  BookOpen, Users, FileText, Calendar, Search, ChevronRight, X, CheckCircle2,
  GraduationCap, Plus, UserCog, Pencil,
} from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { EditarCursoModal, type CursoEditable } from '@/components/admin/EditarCursoModal';
import { getErrorMessage } from '@/lib/utils';
import type { Course } from '@/types';

interface Docente { id: string; name: string; email: string; role: string; isActive: boolean }

/**
 * Alta de curso desde administracion.
 *
 * Esta pantalla era de solo lectura: la administracion podia ver los cursos
 * pero no crear ninguno, y el estado vacio decia "cuando el profesorado cree
 * cursos apareceran aqui". En una institucion real quien arma la oferta
 * academica es la administracion, y ademas designa a la persona responsable,
 * asi que hace falta poder elegirla desde aqui.
 */
function NuevoCursoModal({
  universityId,
  onClose,
  onCreated,
}: {
  universityId: string;
  onClose: () => void;
  onCreated: (c: Course) => void;
}) {
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [cargandoDocentes, setCargandoDocentes] = useState(true);
  const [form, setForm] = useState({ name: '', code: '', period: '', description: '', teacherId: '' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<Docente[]>(`/api/v1/universities/${universityId}/users`);
        // Solo quien puede quedar a cargo de un curso, y solo cuentas activas:
        // ofrecer una cuenta desactivada termina en un error del backend.
        setDocentes(
          data.filter((u) => u.isActive && (u.role === 'TEACHER' || u.role === 'ADMIN' || u.role === 'SUPERADMIN')),
        );
      } catch {
        toast.error('No se pudo cargar la lista de profesores');
      } finally {
        setCargandoDocentes(false);
      }
    })();
  }, [universityId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'El nombre es requerido';
    if (!form.teacherId) errs.teacherId = 'Elige quien queda a cargo del curso';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const { data } = await api.post<Course>(`/api/v1/universities/${universityId}/courses`, {
        name: form.name,
        teacherId: form.teacherId,
        code: form.code || undefined,
        period: form.period || undefined,
        description: form.description || undefined,
      });
      toast.success('Curso creado');
      onCreated(data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-csq-dark/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-card border border-gray-200/70 bg-white shadow-card-hover cx-pop">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 pb-4 pt-5">
          <div className="flex items-center gap-3">
            <IconTile icon={BookOpen} tint="#2563EB" size={40} />
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">Administracion</p>
              <h3 className="font-bold tracking-tight text-gray-900">Nuevo curso</h3>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-gray-400 transition-colors hover:text-gray-700 cx-press">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <Input
            label="Nombre del curso *"
            placeholder="Contabilidad I - 2026"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={errors.name}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Persona responsable *
            </label>
            <div className="relative">
              <UserCog className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <select
                value={form.teacherId}
                onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
                disabled={cargandoDocentes}
                className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60 disabled:bg-gray-50"
              >
                <option value="">
                  {cargandoDocentes ? 'Cargando profesorado...' : 'Selecciona a quien queda a cargo'}
                </option>
                {docentes.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} - {d.email}</option>
                ))}
              </select>
            </div>
            {errors.teacherId && <p className="mt-1 text-xs text-red-600">{errors.teacherId}</p>}
            {!cargandoDocentes && docentes.length === 0 && (
              <p className="mt-1 text-xs text-amber-700">
                Todavia no hay profesores en la institucion. Crealos en Usuarios y vuelve aqui.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Codigo"
              placeholder="CONT-101"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
            <Input
              label="Periodo"
              placeholder="2026-I"
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
            />
          </div>

          <Input
            label="Descripcion"
            placeholder="Ciclo contable completo"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="cx-press">Cancelar</Button>
            <Button type="submit" loading={saving} className="cx-press">Crear curso</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminCursosPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [showNuevo, setShowNuevo] = useState(false);
  const [editando, setEditando] = useState<CursoEditable | null>(null);

  const load = useCallback(async () => {
    if (!user?.universityId) return;
    setLoading(true);
    try {
      const { data } = await api.get<Course[]>(`/api/v1/universities/${user.universityId}/courses`);
      setCourses(data);
    } catch { toast.error('Error al cargar cursos'); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const filtered = courses.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.code?.toLowerCase() ?? '').includes(q);
  });

  const activeCount     = courses.filter((c) => c.isActive).length;
  const totalEnrollments = courses.reduce((s, c) => s + (c._count?.enrollments ?? 0), 0);

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#FBF8F1]">
      <PageHeader
        eyebrow="Administración"
        title="Cursos"
        subtitle="Todos los cursos de la universidad, con su profesorado y matrícula."
        icon={BookOpen}
        iconTint="#2563EB"
        className="mb-8"
        actions={
          <Button onClick={() => setShowNuevo(true)} className="cx-press">
            <Plus className="h-4 w-4" /> Nuevo curso
          </Button>
        }
      />

      {editando && user?.universityId && (
        <EditarCursoModal
          universityId={user.universityId}
          curso={editando}
          onClose={() => setEditando(null)}
          onGuardado={() => { setEditando(null); load(); }}
        />
      )}

      {showNuevo && user?.universityId && (
        <NuevoCursoModal
          universityId={user.universityId}
          onClose={() => setShowNuevo(false)}
          onCreated={(c) => { setCourses((prev) => [c, ...prev]); setShowNuevo(false); }}
        />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          key={`tot-${courses.length}`}
          label="Cursos" value={String(courses.length)}
          icon={BookOpen} tint="#2563EB" className="cx-count"
        />
        <StatCard
          key={`act-${activeCount}`}
          label="Cursos activos" value={String(activeCount)}
          icon={CheckCircle2} tint="#059669"
          hint={`${courses.length - activeCount} inactivos`}
          className="cx-count"
        />
        <StatCard
          key={`enr-${totalEnrollments}`}
          label="Matrículas" value={String(totalEnrollments)}
          icon={GraduationCap} tint="#B8860B" className="cx-count"
        />
      </div>

      {/* Búsqueda */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o código…"
            className="w-full rounded-xl bg-white border border-gray-300 text-gray-900 placeholder-gray-400 pl-9 pr-4 py-2.5 text-sm transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
          />
        </div>
        {search && (
          <button
            onClick={() => setSearch('')}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors cx-press"
          >
            <X className="w-3.5 h-3.5" /> Limpiar
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-card" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200/70 rounded-card shadow-card">
          {search ? (
            <EmptyState
              illustration={<SceneSearchEmpty size={190} className="lp-drift" />}
              title="Sin resultados"
              description="Ningún curso coincide con esa búsqueda. Prueba con otro nombre o código."
              action={
                <Button variant="secondary" onClick={() => setSearch('')} className="cx-press">
                  Limpiar búsqueda
                </Button>
              }
            />
          ) : (
            <EmptyState
              illustration={<SceneEmptyBox size={200} className="lp-drift" />}
              title="Aún no hay cursos"
              description="Crea el primer curso y asígnaselo a una persona del profesorado."
              action={
                <Button onClick={() => setShowNuevo(true)} className="cx-press">
                  <Plus className="h-4 w-4" /> Crear curso
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((course, i) => (
            <div
              key={course.id}
              className={`bg-white border border-gray-200/70 shadow-card rounded-card p-5 flex flex-col gap-4 cx-lift cx-hop-parent cx-pop ${i < 6 ? `cx-d${i + 1}` : ''}`}
            >
              <div className="flex items-start gap-3.5">
                <IconTile icon={BookOpen} tint="#2563EB" size={44} className="cx-hop" />
                <div className="min-w-0">
                  {course.code && (
                    <span className="inline-block text-xs font-mono text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                      {course.code}
                    </span>
                  )}
                  <h3 className="font-bold text-gray-900 mt-1.5 leading-tight">{course.name}</h3>
                  {course.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{course.description}</p>
                  )}
                  {course.teacher && (
                    <p className="text-xs text-gray-500 mt-1.5">
                      Profesor: <span className="text-gray-700 font-medium">{course.teacher.name}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1.5 font-mono tabular-nums">
                  <Users className="w-4 h-4 text-gray-400" />{course._count?.enrollments ?? 0}
                </span>
                <span className="flex items-center gap-1.5 font-mono tabular-nums">
                  <FileText className="w-4 h-4 text-gray-400" />{course._count?.exercises ?? 0}
                </span>
                {course.period && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-gray-400" />{course.period}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-auto">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${course.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {course.isActive ? 'Activo' : 'Inactivo'}
                </span>
                <div className="flex items-center gap-2">
                  {/* Reasignar el grupo a otro profesor es lo que mas se
                      necesita a mitad de año, asi que va a un clic. */}
                  <Button
                    size="sm" variant="secondary" className="cx-press"
                    onClick={() => setEditando(course as unknown as CursoEditable)}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Link href={`/admin/cursos/${course.id}`}>
                    <Button size="sm" variant="secondary" className="cx-press">
                      Ver curso <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
