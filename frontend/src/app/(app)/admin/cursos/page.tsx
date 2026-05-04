'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { BookOpen, Users, FileText, Calendar, Search, ChevronRight } from 'lucide-react';
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

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cursos</h2>
          <p className="text-gray-500 text-sm mt-1">{courses.length} curso{courses.length !== 1 ? 's' : ''} en total</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cursos..."
          className="w-full rounded-xl bg-white border border-gray-300 text-gray-900 placeholder-gray-400 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <BookOpen className="w-8 h-8 text-gray-300 mb-3" />
          <p className="text-gray-500">{search ? 'Sin resultados' : 'No hay cursos registrados'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((course) => (
            <div key={course.id}
              className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 flex flex-col gap-4">
              <div>
                {course.code && (
                  <span className="text-xs font-mono text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                    {course.code}
                  </span>
                )}
                <h3 className="font-semibold text-gray-900 mt-1.5">{course.name}</h3>
                {course.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{course.description}</p>
                )}
                {course.teacher && (
                  <p className="text-xs text-gray-500 mt-1">
                    Profesor: <span className="text-gray-700">{course.teacher.name}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />{course._count?.enrollments ?? 0}
                </span>
                <span className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />{course._count?.exercises ?? 0}
                </span>
                {course.period && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />{course.period}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-auto">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${course.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {course.isActive ? 'Activo' : 'Inactivo'}
                </span>
                <Link href={`/admin/cursos/${course.id}`}>
                  <Button size="sm" variant="secondary">
                    <ChevronRight className="w-3.5 h-3.5" /> Ver
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
