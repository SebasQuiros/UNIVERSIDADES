'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { IconTile } from '@/components/ui/IconTile';
import { ArtLedger } from '@/components/illustrations';
import toast from 'react-hot-toast';
import {
  Users, BookOpen, Building2, TrendingUp, ArrowRight, Globe,
  FileText, Award, GraduationCap, CheckCircle2, Settings,
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

// Textura de puntos sutil para la banda hero (fondo azul noche).
const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
};

// Accesos rápidos de gestión de la universidad.
const QUICK_LINKS = [
  {
    href: '/admin/usuarios',
    title: 'Gestión de Usuarios',
    desc: 'Ver, crear y administrar profesores y estudiantes',
    icon: Users,
    tint: '#475569',
  },
  {
    href: '/admin/cursos',
    title: 'Gestión de Cursos',
    desc: 'Ver todos los cursos activos de la universidad',
    icon: BookOpen,
    tint: '#2563EB',
  },
];

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

  // Renderizamos el shell siempre y usamos skeletons donde van los datos,
  // en lugar de tapar toda la pantalla con un spinner centrado.
  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#F4F6F8]">
      {/* Cabecera */}
      <PageHeader
        eyebrow="Panel de administración"
        title="Panel de Administración"
        subtitle="Gestión de tu universidad"
        icon={Building2}
        className="mb-8"
      />

      {/* Banda hero — universidad + KPIs primarios sobre azul noche */}
      <div className="relative overflow-hidden rounded-card shadow-soft mb-8 lp-in bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
        <div aria-hidden className="pointer-events-none absolute right-6 bottom-4 hidden xl:block opacity-95">
          <ArtLedger size={176} className="lp-drift" />
        </div>
        <div className="relative p-6 lg:p-8">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-gold-500 mb-2">
            Tu universidad
          </p>
          {loading ? (
            <div className="h-7 w-56 bg-white/10 rounded animate-pulse" />
          ) : (
            <h2 className="text-xl lg:text-2xl font-extrabold text-white tracking-tight">
              {university?.name ?? 'Universidad no asignada'}
            </h2>
          )}
          {!loading && university && (
            <p className="text-sm text-blue-200/80 mt-1.5 flex items-center gap-1.5 flex-wrap">
              {university.shortName && <span>{university.shortName}</span>}
              {university.shortName && <span className="text-blue-200/40">·</span>}
              <Globe className="w-3.5 h-3.5" />
              {university.country}
            </p>
          )}

          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4 xl:max-w-3xl">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-card h-28 bg-white/5 border border-white/10 animate-pulse" />
              ))
            ) : (
              <>
                <StatCard variant="dark" label="Estudiantes"   value={String(stats?.totalStudents ?? 0)}  icon={GraduationCap} />
                <StatCard variant="dark" label="Profesores"    value={String(stats?.totalTeachers ?? 0)}  icon={Users} />
                <StatCard variant="dark" label="Cursos activos" value={String(stats?.totalCourses ?? 0)}  icon={BookOpen} />
                <StatCard variant="dark" label="Ejercicios"    value={String(stats?.totalExercises ?? 0)} icon={FileText} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 bg-white border border-gray-200/70 rounded-card shadow-card animate-pulse" />
          ))
        ) : (
          <>
            <StatCard
              label="Intentos calificados"
              value={String(stats?.totalGraded ?? 0)}
              icon={CheckCircle2}
              tint="#2563EB"
            />
            <StatCard
              label="Nota promedio"
              value={stats?.avgScore !== null && stats?.avgScore !== undefined ? `${stats.avgScore}%` : '—'}
              hint={stats?.avgScore ? (stats.avgScore >= 70 ? 'Aprobado promedio' : 'Por mejorar') : undefined}
              icon={Award}
              tint="#B8860B"
            />
            <StatCard
              label="Estado"
              value={university?.isActive ? 'Activo' : 'Inactivo'}
              icon={TrendingUp}
              tint="#475569"
            />
          </>
        )}
      </div>

      {/* Quick links */}
      <div className="flex items-center gap-3 mb-4">
        <IconTile icon={Settings} tint="#1B2E6E" size={40} />
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">Administración</p>
          <h3 className="text-base font-bold tracking-tight text-gray-900">Gestión</h3>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUICK_LINKS.map((item) => (
          <Link key={item.href} href={item.href}
            className="group bg-white border border-gray-200/70 rounded-card shadow-card hover:shadow-card-hover lp-card-pro p-6 flex items-center gap-4">
            <IconTile icon={item.icon} tint={item.tint} size={52} />
            <div className="flex-1 min-w-0">
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
