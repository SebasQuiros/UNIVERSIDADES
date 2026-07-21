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
  BookOpen, Users, FileText, Calendar, Search, ChevronRight, X, CheckCircle2, GraduationCap,
} from 'lucide-react';
import type { Course } from '@/types';

export default function AdminCursosPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

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
      />

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
              description="Cuando el profesorado cree cursos en esta universidad, aparecerán en este listado."
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
                <Link href={`/admin/cursos/${course.id}`}>
                  <Button size="sm" variant="secondary" className="cx-press">
                    Ver curso <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
