'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { StatusBadge, DifficultyBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import type { Course, ExerciseAttempt } from '@/types';
import toast from 'react-hot-toast';
import {
  BookOpen, Users, FileText, ClipboardCheck,
  ArrowRight, Plus, Clock, TrendingUp,
} from 'lucide-react';

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

function StatCard({ label, value, icon: Icon, gradient, glow, sub }: {
  label: string; value: number | string; icon: React.ElementType;
  gradient: string; glow: string; sub?: string;
}) {
  const numVal = typeof value === 'number' ? value : 0;
  const animated = useCountUp(numVal);
  return (
    <div className="relative rounded-2xl p-5 overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"
      style={{ background: gradient, boxShadow: `0 4px 20px ${glow}` }}>
      <div className="absolute inset-0 opacity-10"
        style={{ background: 'radial-gradient(circle at top right, white 0%, transparent 60%)' }} />
      <div className="relative flex items-start justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/70">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/20 backdrop-blur-sm">
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <p className="relative text-3xl font-black text-white leading-none">{typeof value === 'number' ? animated : value}</p>
      {sub && <p className="relative text-xs text-white/60 mt-1">{sub}</p>}
    </div>
  );
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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto" style={{ background: 'linear-gradient(180deg,#EFF6FF 0%,#F8FAFC 40%,#FFFFFF 100%)' }}>

      {showOnboarding && user?.id && (
        <OnboardingWizard userId={user.id} onComplete={() => setShowOnboarding(false)} />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bienvenido, {firstName} 👋</h2>
          <p className="text-gray-500 text-sm mt-1">Resumen de tus cursos y actividad</p>
        </div>
        <Link href="/profesor/ejercicios/nuevo">
          <Button size="sm">
            <Plus className="w-4 h-4" />
            Nuevo ejercicio
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Cursos activos"  value={stats.courses}   icon={BookOpen}       gradient="linear-gradient(135deg,#3B82F6,#1E40AF)" glow="rgba(59,130,246,0.25)" sub="Este período" />
        <StatCard label="Ejercicios"      value={stats.exercises} icon={FileText}       gradient="linear-gradient(135deg,#8B5CF6,#7C3AED)" glow="rgba(139,92,246,0.25)" sub="Publicados y borradores" />
        <StatCard label="Estudiantes"     value={stats.students}  icon={Users}          gradient="linear-gradient(135deg,#10B981,#059669)" glow="rgba(16,185,129,0.25)" sub="Inscritos en total" />
        <StatCard label="Por calificar"   value={stats.pending}   icon={ClipboardCheck} gradient="linear-gradient(135deg,#F59E0B,#D97706)" glow="rgba(245,158,11,0.25)" sub="Requieren atención" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Courses */}
        <section className="bg-white rounded-2xl transition-shadow duration-200 hover:shadow-lg" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid rgba(226,232,240,0.8)' }}>
          <div className="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              Mis Cursos
            </h3>
            <Link href="/profesor/cursos">
              <Button variant="ghost" size="sm">
                Ver todos <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {courses.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500 text-sm">No tienes cursos creados</p>
                <Link href="/profesor/cursos" className="mt-2 inline-block">
                  <Button variant="secondary" size="sm">Crear curso</Button>
                </Link>
              </div>
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
        </section>

        {/* Pending grading */}
        <section className="bg-white rounded-2xl transition-shadow duration-200 hover:shadow-lg" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid rgba(226,232,240,0.8)' }}>
          <div className="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-amber-500" />
              Pendientes de calificar
              {stats.pending > 0 && (
                <span className="bg-amber-400 text-amber-900 text-xs font-bold rounded-full px-1.5 py-0.5">
                  {stats.pending}
                </span>
              )}
            </h3>
            {stats.pending > 0 && (
              <Link href="/profesor/pendientes">
                <Button variant="ghost" size="sm">
                  Ver todos <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            )}
          </div>
          <div className="divide-y divide-gray-100">
            {pendingAttempts.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500 text-sm">¡Todo al día! No hay intentos por calificar</p>
              </div>
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
                      {(attempt as any).student?.name ?? 'Estudiante'}
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
        </section>
      </div>
    </div>
  );
}
