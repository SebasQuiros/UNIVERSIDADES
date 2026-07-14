'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArtReport, SceneEmptyBox } from '@/components/illustrations';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import type { Course, ExerciseAttempt } from '@/types';
import toast from 'react-hot-toast';
import type { ElementType } from 'react';
import {
  BookOpen, Users, FileText, ClipboardCheck,
  ArrowRight, Plus, Clock, TrendingUp, GraduationCap,
} from 'lucide-react';

// Textura de puntos sutil para la banda hero (fondo azul noche).
const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
};

// ── Animated counter hook ─────────────────────────────────────────────────
function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      setCount(start);
      if (start >= target) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

// ── KPI del hero (StatCard oscuro con contador animado) ────────────────────
// Conserva el count-up original alimentando el valor animado al primitivo StatCard.
function CountStat({ label, value, icon, hint }: {
  label: string; value: number; icon: ElementType; hint?: string;
}) {
  const animated = useCountUp(value);
  return <StatCard variant="dark" label={label} value={String(animated)} icon={icon} hint={hint} />;
}

export default function ProfesorDashboard() {
  const { user } = useAuth();
  const [courses, setCourses]           = useState<Course[]>([]);
  const [attempts, setAttempts]         = useState<ExerciseAttempt[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    // Show onboarding for first-time teachers
    const done = localStorage.getItem(`cf_onboarding_${user.id}`);
    if (!done) setShowOnboarding(true);

    Promise.all([
      api.get<Course[]>('/api/v1/courses/mine'),
      api.get<ExerciseAttempt[]>('/api/v1/attempts'),
    ])
      .then(([c, a]) => { setCourses(c.data); setAttempts(a.data); })
      .catch(() => toast.error('Error al cargar datos'))
      .finally(() => setLoading(false));
  }, [user]);

  const stats = {
    courses:    courses.length,
    exercises:  courses.reduce((s, c) => s + (c._count?.exercises ?? 0), 0),
    students:   courses.reduce((s, c) => s + (c._count?.enrollments ?? 0), 0),
    pending:    attempts.filter((a) => a.status === 'IN_PROGRESS' || a.status === 'SUBMITTED').length,
  };

  const pendingAttempts = attempts
    .filter((a) => a.status === 'IN_PROGRESS' || a.status === 'SUBMITTED')
    .slice(0, 5);

  const firstName = user?.name?.split(' ')[0] ?? 'Profesor';

  // En vez de esconder toda la pantalla con un spinner, renderizamos el shell
  // siempre y mostramos placeholders donde van los datos (progressive skeletons).
  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#F4F6F8]">

      {showOnboarding && user?.id && (
        <OnboardingWizard userId={user.id} onComplete={() => setShowOnboarding(false)} />
      )}

      {/* Cabecera */}
      <PageHeader
        eyebrow="Panel del profesor"
        title={`Bienvenido, ${firstName}`}
        subtitle="Resumen de tus cursos y actividad"
        icon={GraduationCap}
        className="mb-6"
        actions={
          <Link href="/profesor/ejercicios/nuevo">
            <Button size="sm">
              <Plus className="w-4 h-4" />
              Nuevo ejercicio
            </Button>
          </Link>
        }
      />

      {/* Banda hero — KPIs docentes sobre azul noche */}
      <div className="relative overflow-hidden rounded-card shadow-soft mb-10 lp-in bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
        <div aria-hidden className="pointer-events-none absolute right-6 bottom-5 hidden xl:block opacity-95">
          <ArtReport size={168} className="lp-drift" />
        </div>
        <div className="relative p-6 lg:p-8">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-gold-500 mb-2">
            Tu docencia
          </p>
          <h2 className="text-xl lg:text-2xl font-extrabold text-white tracking-tight">
            Cursos y desempeño en marcha
          </h2>
          <p className="text-sm text-blue-200/80 mt-1.5 max-w-md">
            Cursos activos, ejercicios publicados y entregas por revisar.
          </p>
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4 xl:max-w-3xl">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-card h-28 bg-white/5 border border-white/10 animate-pulse" />
              ))
            ) : (
              <>
                <CountStat label="Cursos activos" value={stats.courses}   icon={BookOpen}       hint="Este período" />
                <CountStat label="Ejercicios"     value={stats.exercises} icon={FileText}       hint="Publicados y borradores" />
                <CountStat label="Estudiantes"    value={stats.students}  icon={Users}          hint="Inscritos en total" />
                <CountStat label="Por calificar"  value={stats.pending}   icon={ClipboardCheck} hint="Requieren atención" />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Courses */}
        <SectionCard
          icon={BookOpen}
          eyebrow="Tus cursos"
          title="Mis Cursos"
          flushBody
          action={
            <Link href="/profesor/cursos">
              <Button variant="ghost" size="sm">
                Ver todos <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          }
        >
          <div className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))
            ) : courses.length === 0 ? (
              <EmptyState
                illustration={<SceneEmptyBox size={180} className="lp-drift" />}
                title="Aún no tienes cursos"
                description="Crea tu primer curso para empezar a publicar ejercicios y seguir a tus estudiantes."
                action={
                  <Link href="/profesor/cursos">
                    <Button variant="secondary" size="sm">Crear curso</Button>
                  </Link>
                }
              />
            ) : (
              courses.slice(0, 4).map((course) => (
                <Link
                  key={course.id}
                  href={`/profesor/cursos/${course.id}`}
                  className="flex items-center justify-between p-4 hover:bg-blue-50/50 transition-all duration-150 group"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{course.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{course.period ?? '—'} · {course.code ?? 'Sin código'}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {course._count?.enrollments ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {course._count?.exercises ?? 0}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </SectionCard>

        {/* Pending grading */}
        <SectionCard
          icon={ClipboardCheck}
          iconTint="#B8860B"
          eyebrow={stats.pending > 0 ? `${stats.pending} por revisar` : 'Al día'}
          title="Pendientes de calificar"
          flushBody
          action={
            stats.pending > 0 ? (
              <Link href="/profesor/pendientes">
                <Button variant="ghost" size="sm">
                  Ver todos <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            ) : undefined
          }
        >
          <div className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start justify-between p-4">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                    <div className="flex gap-3 pt-0.5">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  </div>
                </div>
              ))
            ) : pendingAttempts.length === 0 ? (
              <EmptyState
                illustration={<SceneEmptyBox size={180} className="lp-drift" />}
                title="¡Todo al día!"
                description="No hay intentos por calificar. Cuando tus estudiantes entreguen, aparecerán aquí."
              />
            ) : (
              pendingAttempts.map((attempt) => (
                <Link
                  key={attempt.id}
                  href={`/profesor/ejercicios/${attempt.exercise?.id}?cursoId=${attempt.exercise?.course?.id}`}
                  className="flex items-start justify-between p-4 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 truncate">
                      {attempt.exercise?.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(attempt as { student?: { name?: string } }).student?.name ?? 'Estudiante'}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <StatusBadge status={attempt.status} />
                      {attempt.studentProgress && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {attempt.studentProgress.progressPct}%
                        </span>
                      )}
                      {attempt.studentProgress?.timeSpentMin ? (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {attempt.studentProgress.timeSpentMin}min
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0 mt-1 transition-colors" />
                </Link>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
