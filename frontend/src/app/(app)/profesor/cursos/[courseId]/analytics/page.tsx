'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { buttonClasses } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArtGrowth, ArtReport, SceneEmptyBox, SceneSearchEmpty } from '@/components/illustrations';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Users,
  FileText,
  BarChart2,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Clock,
  BookOpen,
  Activity,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// Textura de puntos sutil para la banda hero (fondo azul noche).
const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
};

// ── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  course: {
    id: string;
    name: string;
    code: string | null;
    period: string | null;
  };
  totalStudents: number;
  totalExercises: number;
  studentProgress: StudentProgress[];
  exerciseStats: ExerciseStat[];
  gradeDistribution: {
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
  };
  overallStats: {
    avgCompletion: number;
    avgGrade: number | null;
    studentsNotStarted: number;
    studentsCompleted: number;
  };
}

interface StudentProgress {
  studentId: string;
  studentName: string;
  email: string;
  exercisesTotal: number;
  exercisesCompleted: number;
  exercisesInProgress: number;
  exercisesNotStarted: number;
  averageGrade: number | null;
  lastActivity: string | null;
  completionPct: number;
}

interface ExerciseStat {
  exerciseId: string;
  exerciseName: string;
  totalAttempts: number;
  submitted: number;
  graded: number;
  averageGrade: number | null;
  notStarted: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeDate(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)    return 'Ahora mismo';
  if (mins < 60)   return `Hace ${mins} min`;
  if (hours < 24)  return `Hace ${hours}h`;
  if (days === 1)  return 'Ayer';
  if (days < 7)    return `Hace ${days} días`;
  return new Date(iso).toLocaleDateString('es-CR', { day: '2-digit', month: 'short' });
}

function gradeColor(pct: number | null): string {
  if (pct === null) return 'text-gray-400';
  if (pct >= 90)   return 'text-emerald-600';
  if (pct >= 80)   return 'text-green-600';
  if (pct >= 70)   return 'text-gold-700';
  if (pct >= 60)   return 'text-orange-500';
  return 'text-red-600';
}

function studentStatusDot(sp: StudentProgress) {
  if (sp.completionPct === 100)   return <span className="inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-emerald-500" title="Completado" />;
  if (sp.exercisesInProgress > 0) return <span className="inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-gold-500" title="En progreso" />;
  return <span className="inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-red-400" title="Sin iniciar" />;
}

// ── Grade Distribution Chart ──────────────────────────────────────────────────

function GradeDistributionChart({ dist }: { dist: AnalyticsData['gradeDistribution'] }) {
  const data = [
    { label: 'A (≥90)',   value: dist.A, fill: '#059669' },
    { label: 'B (80-89)', value: dist.B, fill: '#2563EB' },
    { label: 'C (70-79)', value: dist.C, fill: '#D4A017' },
    { label: 'D (60-69)', value: dist.D, fill: '#F59E0B' },
    { label: 'F (<60)',   value: dist.F, fill: '#DC2626' },
  ];

  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <EmptyState
        illustration={<SceneSearchEmpty size={170} className="cx-float" />}
        title="Sin calificaciones aún"
        description="La distribución aparecerá cuando califiques las primeras entregas."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EFF6FF" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
        <Tooltip
          formatter={(value) => [`${value} estudiante${value !== 1 ? 's' : ''}`, 'Cantidad']}
          contentStyle={{ borderRadius: 12, border: '1px solid #DBEAFE', fontSize: 12 }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CourseAnalyticsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [data, setData]       = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // We need universityId from the course detail first, then call analytics
  useEffect(() => {
    async function load() {
      try {
        // Step 1: get basic course info (uses /api/v1/courses/:id which returns universityId)
        const courseRes = await api.get<{ id: string; universityId: string; name: string }>(`/api/v1/courses/${courseId}`);
        const uniId = courseRes.data.universityId;

        // Step 2: get analytics
        const analyticsRes = await api.get<AnalyticsData>(
          `/api/v1/universities/${uniId}/courses/${courseId}/analytics`,
        );
        setData(analyticsRes.data);
      } catch {
        toast.error('Error al cargar el análisis del curso');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#F4F6F8] p-6 lg:p-8">
        <div className="mb-8 h-40 rounded-card border border-gray-200/70 bg-white shadow-card" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-card border border-gray-200/70 bg-white p-5 shadow-card">
              <div className="space-y-2.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#F4F6F8] p-6 lg:p-8">
        <div className="rounded-card border border-gray-200/70 bg-white shadow-card">
          <EmptyState
            illustration={<SceneSearchEmpty size={200} className="cx-float" />}
            title="No se pudo cargar el análisis"
            description="Vuelve a intentarlo o regresa al curso."
            action={
              <Link
                href={`/profesor/cursos/${courseId}`}
                className={buttonClasses({ variant: 'secondary', className: 'cx-press' })}
              >
                <ArrowLeft className="w-4 h-4" /> Volver al curso
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const { course, totalStudents, totalExercises, studentProgress, exerciseStats, gradeDistribution, overallStats } = data;
  const totalGrades = exerciseStats.reduce((s, e) => s + e.graded, 0);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F4F6F8] p-6 lg:p-8">

      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/profesor/cursos" className="transition-colors hover:text-gray-700">
          Mis cursos
        </Link>
        <span className="text-gray-300">/</span>
        <Link href={`/profesor/cursos/${courseId}`} className="flex items-center gap-1 transition-colors hover:text-gray-700">
          {course.name}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Analítica</span>
      </div>

      <PageHeader
        eyebrow="Analítica del curso"
        title={course.name}
        subtitle="Panel de análisis académico: progreso, notas y estado por ejercicio"
        icon={Activity}
        className="mb-6"
        actions={
          <Link
            href={`/profesor/cursos/${courseId}`}
            className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'cx-press' })}
          >
            <ArrowLeft className="w-4 h-4" /> Volver al curso
          </Link>
        }
      />

      {/* Banda hero — identidad del curso */}
      <div className="relative mb-8 overflow-hidden rounded-card shadow-soft lp-in bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
        <div aria-hidden className="pointer-events-none absolute right-6 bottom-4 hidden opacity-95 xl:block">
          <ArtGrowth size={160} className="cx-float" />
        </div>
        <div className="relative p-6 lg:p-8">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {course.code && (
              <span className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 font-mono text-xs text-blue-100">
                {course.code}
              </span>
            )}
            {course.period && (
              <span className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-xs text-blue-100">
                {course.period}
              </span>
            )}
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-white lg:text-2xl">
            Desempeño del grupo
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-blue-200/80">
            Cómo avanzan tus estudiantes y qué ejercicios les cuestan más.
          </p>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Estudiantes"
          value={String(totalStudents)}
          icon={Users}
          tint="#2563EB"
          hint={`${overallStats.studentsCompleted} completaron todo`}
          className="cx-pop cx-d1"
        />
        <StatCard
          label="Ejercicios activos"
          value={String(totalExercises)}
          icon={FileText}
          tint="#1B2E6E"
          hint={`${totalGrades} calificaciones emitidas`}
          className="cx-pop cx-d2"
        />
        <StatCard
          label="Promedio general"
          value={overallStats.avgGrade !== null ? `${overallStats.avgGrade}%` : '—'}
          icon={BarChart2}
          tint="#B8860B"
          hint="Sobre ejercicios calificados"
          className="cx-pop cx-d3"
        />
        <StatCard
          label="% completado"
          value={`${overallStats.avgCompletion}%`}
          icon={TrendingUp}
          tint="#059669"
          hint={`${overallStats.studentsNotStarted} sin iniciar`}
          className="cx-pop cx-d4"
        />
      </div>

      {/* ── Dos columnas ── */}
      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Distribución de notas */}
        <SectionCard
          icon={BarChart2}
          iconTint="#B8860B"
          eyebrow="Calificaciones"
          title="Distribución de notas"
          className="cx-pop"
        >
          <GradeDistributionChart dist={gradeDistribution} />
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
            {[
              { label: 'A ≥90%',   color: 'bg-emerald-600', count: gradeDistribution.A },
              { label: 'B 80-89%', color: 'bg-blue-600',    count: gradeDistribution.B },
              { label: 'C 70-79%', color: 'bg-gold-600',    count: gradeDistribution.C },
              { label: 'D 60-69%', color: 'bg-amber-500',   count: gradeDistribution.D },
              { label: 'F <60%',   color: 'bg-red-600',     count: gradeDistribution.F },
            ].map(({ label, color, count }) => (
              <span key={label} className="flex items-center gap-1 tabular-nums">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${color}`} />
                {label} ({count})
              </span>
            ))}
          </div>
        </SectionCard>

        {/* Resumen del curso */}
        <SectionCard
          icon={Activity}
          iconTint="#2563EB"
          eyebrow="Panorama"
          title="Resumen del curso"
          className="cx-pop cx-d2"
        >
          <div className="space-y-3.5">
            {[
              {
                label: 'Completaron todos los ejercicios',
                value: overallStats.studentsCompleted,
                total: totalStudents,
                color: 'bg-emerald-500',
              },
              {
                label: 'Con al menos un ejercicio en progreso',
                value: studentProgress.filter(sp => sp.exercisesInProgress > 0).length,
                total: totalStudents,
                color: 'bg-blue-600',
              },
              {
                label: 'Sin iniciar ningún ejercicio',
                value: overallStats.studentsNotStarted,
                total: totalStudents,
                color: 'bg-red-400',
              },
            ].map(({ label, value, total, color }) => {
              const pct = total > 0 ? Math.round((value / total) * 100) : 0;
              return (
                <div key={label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-semibold text-gray-900 tabular-nums">
                      {value} <span className="text-xs font-normal text-gray-400">/ {total}</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-gray-100 pt-4 text-center">
            <div>
              <p className="text-xl font-extrabold text-gray-900 tabular-nums">{overallStats.avgCompletion}%</p>
              <p className="text-xs text-gray-400">Compl. prom.</p>
            </div>
            <div>
              <p className={`text-xl font-extrabold tabular-nums ${gradeColor(overallStats.avgGrade)}`}>
                {overallStats.avgGrade !== null ? `${overallStats.avgGrade}%` : '—'}
              </p>
              <p className="text-xs text-gray-400">Nota prom.</p>
            </div>
            <div>
              <p className="text-xl font-extrabold text-gray-900 tabular-nums">{totalGrades}</p>
              <p className="text-xs text-gray-400">Calificaciones</p>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ── Progreso por estudiante ── */}
      <SectionCard
        icon={Users}
        iconTint="#2563EB"
        eyebrow="Seguimiento individual"
        title="Progreso por estudiante"
        flushBody
        className="mb-6 cx-pop"
        action={
          <span className="text-xs text-gray-400 tabular-nums">
            {studentProgress.length} estudiante{studentProgress.length !== 1 ? 's' : ''}
          </span>
        }
      >
        {studentProgress.length === 0 ? (
          <EmptyState
            illustration={<SceneEmptyBox size={190} className="cx-float" />}
            title="No hay estudiantes inscritos"
            description="Inscribe estudiantes en el curso para ver su progreso aquí."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="min-w-[200px] px-5 py-3 text-left">Nombre / correo</th>
                  <th className="min-w-[150px] px-4 py-3 text-center">Progreso</th>
                  <th className="hidden px-4 py-3 text-center sm:table-cell">En progreso</th>
                  <th className="px-4 py-3 text-center">Calificación</th>
                  <th className="hidden px-4 py-3 text-center md:table-cell">Última actividad</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {studentProgress.map((sp) => (
                  <tr key={sp.studentId} className="transition-colors hover:bg-blue-50/50">
                    {/* Nombre / correo */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-sm font-bold text-blue-700">
                          {sp.studentName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-[160px] truncate font-medium text-gray-800">{sp.studentName}</p>
                          <p className="max-w-[160px] truncate text-xs text-gray-400">{sp.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Barra de progreso */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 min-w-[60px] flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              sp.completionPct === 100
                                ? 'bg-emerald-500'
                                : sp.completionPct > 0
                                ? 'bg-blue-600'
                                : 'bg-gray-300'
                            }`}
                            style={{ width: `${sp.completionPct}%` }}
                          />
                        </div>
                        <span className="flex-shrink-0 text-xs text-gray-500 tabular-nums">
                          {sp.exercisesCompleted}/{sp.exercisesTotal}
                        </span>
                      </div>
                    </td>

                    {/* En progreso */}
                    <td className="hidden px-4 py-4 text-center sm:table-cell">
                      {sp.exercisesInProgress > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-gold-100 bg-gold-50 px-2 py-0.5 text-xs font-semibold text-gold-900 tabular-nums">
                          <Clock className="w-3 h-3" />
                          {sp.exercisesInProgress}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>

                    {/* Nota promedio */}
                    <td className="px-4 py-4 text-center">
                      {sp.averageGrade !== null ? (
                        <span className={`font-bold tabular-nums ${gradeColor(sp.averageGrade)}`}>
                          {sp.averageGrade}%
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Última actividad */}
                    <td className="hidden px-4 py-4 text-center text-xs text-gray-400 md:table-cell">
                      <span className="flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3" />
                        {relativeDate(sp.lastActivity)}
                      </span>
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {studentStatusDot(sp)}
                        <span className="hidden text-xs text-gray-500 lg:inline">
                          {sp.completionPct === 100
                            ? 'Listo'
                            : sp.exercisesInProgress > 0
                            ? 'Activo'
                            : 'Pendiente'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── Estado por ejercicio ── */}
      <SectionCard
        icon={BookOpen}
        iconTint="#1B2E6E"
        eyebrow="Por actividad"
        title="Estado por ejercicio"
        flushBody
        className="cx-pop cx-d2"
        action={
          <span className="text-xs text-gray-400 tabular-nums">
            {exerciseStats.length} publicado{exerciseStats.length !== 1 ? 's' : ''}
          </span>
        }
      >
        {exerciseStats.length === 0 ? (
          <EmptyState
            illustration={<ArtReport size={170} className="cx-float" />}
            title="No hay ejercicios publicados"
            description="Publica un ejercicio para ver sus estadísticas aquí."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 text-left">Ejercicio</th>
                  <th className="px-4 py-3 text-center">Total intentos</th>
                  <th className="px-4 py-3 text-center">Enviados</th>
                  <th className="px-4 py-3 text-center">Calificados</th>
                  <th className="px-4 py-3 text-center">Sin iniciar</th>
                  <th className="px-4 py-3 text-center">Promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {exerciseStats.map((ex) => (
                  <tr key={ex.exerciseId} className="transition-colors hover:bg-blue-50/50">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-800">{ex.exerciseName}</p>
                    </td>
                    <td className="px-4 py-4 text-center text-gray-600 tabular-nums">{ex.totalAttempts}</td>
                    <td className="px-4 py-4 text-center">
                      {ex.submitted > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 tabular-nums">
                          {ex.submitted}
                        </span>
                      ) : (
                        <span className="text-gray-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {ex.graded > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 tabular-nums">
                          <CheckCircle className="w-3 h-3" />
                          {ex.graded}
                        </span>
                      ) : (
                        <span className="text-gray-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {ex.notStarted > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-500 tabular-nums">
                          <AlertCircle className="w-3 h-3" />
                          {ex.notStarted}
                        </span>
                      ) : (
                        <span className="text-gray-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {ex.averageGrade !== null ? (
                        <span className={`font-bold tabular-nums ${gradeColor(ex.averageGrade)}`}>
                          {ex.averageGrade}%
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
