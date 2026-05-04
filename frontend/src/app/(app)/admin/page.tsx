'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import {
  Users, BookOpen, Building2, TrendingUp, ArrowRight, Globe,
  FileText, Award, GraduationCap, CheckCircle2,
} from 'lucide-react';

interface UniversityDetail {
  id: string; name: string; shortName: string | null; country: string; isActive: boolean;
  _count: { courses: number; users: number };
}

interface UniversityStats {
  totalStudents:  number;
  totalTeachers:  number;
  totalAdmins:    number;
  totalCourses:   number;
  totalExercises: number;
  totalGraded:    number;
  avgScore:       number | null;
}

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: number | string; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [university, setUniversity] = useState<UniversityDetail | null>(null);
  const [stats, setStats]           = useState<UniversityStats | null>(null);
  const [loading, setLoading]       = useState(true);

  const load = useCallback(async () => {
    if (!user?.universityId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [uRes, sRes] = await Promise.all([
        api.get<UniversityDetail>(`/api/v1/universities/${user.universityId}`),
        api.get<UniversityStats>(`/api/v1/universities/${user.universityId}/stats`),
      ]);
      setUniversity(uRes.data);
      setStats(sRes.data);
    } catch { toast.error('Error al cargar datos'); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex-1 flex items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Panel de Administración</h2>
        {university && (
          <p className="text-gray-500 text-sm mt-1 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> {university.name}
            {university.shortName && <span className="text-gray-400">· {university.shortName}</span>}
            <span className="text-gray-300">·</span>
            <Globe className="w-3 h-3" />
            {university.country}
          </p>
        )}
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Estudiantes"
          value={stats?.totalStudents ?? 0}
          icon={GraduationCap}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Profesores"
          value={stats?.totalTeachers ?? 0}
          icon={Users}
          color="bg-purple-50 text-purple-600"
        />
        <StatCard
          label="Cursos activos"
          value={stats?.totalCourses ?? 0}
          icon={BookOpen}
          color="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Ejercicios"
          value={stats?.totalExercises ?? 0}
          icon={FileText}
          color="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Intentos calificados"
          value={stats?.totalGraded ?? 0}
          icon={CheckCircle2}
          color="bg-teal-50 text-teal-600"
        />
        <StatCard
          label="Nota promedio"
          value={stats?.avgScore !== null && stats?.avgScore !== undefined ? `${stats.avgScore}%` : '—'}
          sub={stats?.avgScore ? (stats.avgScore >= 70 ? 'Aprobado promedio' : 'Por mejorar') : undefined}
          icon={Award}
          color="bg-rose-50 text-rose-600"
        />
        <StatCard
          label="Estado"
          value={university?.isActive ? 'Activo' : 'Inactivo'}
          icon={TrendingUp}
          color="bg-gray-50 text-gray-600"
        />
      </div>

      {/* Quick links */}
      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Gestión</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          {
            href: '/admin/usuarios',
            title: 'Gestión de Usuarios',
            desc: 'Ver, crear y administrar profesores y estudiantes',
            icon: Users,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
          },
          {
            href: '/admin/cursos',
            title: 'Gestión de Cursos',
            desc: 'Ver todos los cursos activos de la universidad',
            icon: BookOpen,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
          },
        ].map((item) => (
          <Link key={item.href} href={item.href}
            className="group bg-white border border-gray-200 shadow-sm hover:shadow-md rounded-2xl p-6 flex items-center gap-4 transition-all">
            <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
              <item.icon className={`w-6 h-6 ${item.color}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{item.title}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{item.desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
