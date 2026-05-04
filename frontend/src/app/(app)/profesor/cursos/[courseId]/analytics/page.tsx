'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
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
  if (pct >= 70)   return 'text-yellow-600';
  if (pct >= 60)   return 'text-orange-500';
  return 'text-red-600';
}

function studentStatusDot(sp: StudentProgress) {
  if (sp.completionPct === 100)    return <span className="inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" title="Completado" />;
  if (sp.exercisesInProgress > 0) return <span className="inline-flex w-2.5 h-2.5 rounded-full bg-yellow-400 flex-shrink-0" title="En progreso" />;
  return <span className="inline-flex w-2.5 h-2.5 rounded-full bg-red-400 flex-shrink-0" title="Sin iniciar" />;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  colorClass: string;
  sub?: string;
}

function StatCard({ label, value, icon: Icon, colorClass, sub }: StatCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Grade Distribution Chart ──────────────────────────────────────────────────

function GradeDistributionChart({ dist }: { dist: AnalyticsData['gradeDistribution'] }) {
  const data = [
    { label: 'A (≥90)', value: dist.A, fill: '#10b981' },
    { label: 'B (80-89)', value: dist.B, fill: '#34d399' },
    { label: 'C (70-79)', value: dist.C, fill: '#fbbf24' },
    { label: 'D (60-69)', value: dist.D, fill: '#f97316' },
    { label: 'F (<60)',  value: dist.F, fill: '#ef4444' },
  ];

  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <BarChart2 className="w-10 h-10 mb-3 text-gray-200" />
        <p className="text-sm">Sin calificaciones aún</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          formatter={(value: any) => [`${value} estudiante${value !== 1 ? 's' : ''}`, 'Cantidad']}
          contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
        />
        <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={60}>
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
      <div className="flex-1 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <p>No se pudo cargar el análisis.</p>
      </div>
    );
  }

  const { course, totalStudents, totalExercises, studentProgress, exerciseStats, gradeDistribution, overallStats } = data;

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/profesor/cursos" className="hover:text-gray-700 flex items-center gap-1">
          Mis Cursos
        </Link>
        <span>/</span>
        <Link href={`/profesor/cursos/${courseId}`} className="hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> {course.name}
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">Analytics</span>
      </div>

      {/* Page header */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {course.code && (
                <span className="text-xs font-mono text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                  {course.code}
                </span>
              )}
              {course.period && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                  {course.period}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900">{course.name}</h1>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" />
              Panel de análisis académico
            </p>
          </div>
          <Link
            href={`/profesor/cursos/${courseId}`}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al curso
          </Link>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Estudiantes"
          value={totalStudents}
          icon={Users}
          colorClass="bg-blue-50 text-blue-600"
          sub={`${overallStats.studentsCompleted} completaron todo`}
        />
        <StatCard
          label="Ejercicios Activos"
          value={totalExercises}
          icon={FileText}
          colorClass="bg-purple-50 text-purple-600"
          sub={`${exerciseStats.reduce((s, e) => s + e.graded, 0)} calificaciones emitidas`}
        />
        <StatCard
          label="Promedio General"
          value={overallStats.avgGrade !== null ? `${overallStats.avgGrade}%` : '—'}
          icon={BarChart2}
          colorClass="bg-amber-50 text-amber-600"
          sub="sobre ejercicios calificados"
        />
        <StatCard
          label="% Completado"
          value={`${overallStats.avgCompletion}%`}
          icon={TrendingUp}
          colorClass="bg-emerald-50 text-emerald-600"
          sub={`${overallStats.studentsNotStarted} sin iniciar`}
        />
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">

        {/* Grade Distribution Chart */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-600" />
            Distribución de Notas
          </h2>
          <GradeDistributionChart dist={gradeDistribution} />
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
            {[
              { label: 'A ≥90%', color: 'bg-emerald-500', count: gradeDistribution.A },
              { label: 'B 80-89%', color: 'bg-green-400', count: gradeDistribution.B },
              { label: 'C 70-79%', color: 'bg-yellow-400', count: gradeDistribution.C },
              { label: 'D 60-69%', color: 'bg-orange-400', count: gradeDistribution.D },
              { label: 'F <60%', color: 'bg-red-500', count: gradeDistribution.F },
            ].map(({ label, color, count }) => (
              <span key={label} className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-sm inline-block ${color}`} />
                {label} ({count})
              </span>
            ))}
          </div>
        </div>

        {/* Quick overview */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            Resumen del Curso
          </h2>
          <div className="space-y-3">
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
                color: 'bg-yellow-400',
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
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-semibold text-gray-900">{value} <span className="text-gray-400 font-normal text-xs">/ {total}</span></span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xl font-bold text-gray-900">{overallStats.avgCompletion}%</p>
              <p className="text-xs text-gray-400">Compl. prom.</p>
            </div>
            <div>
              <p className={`text-xl font-bold ${gradeColor(overallStats.avgGrade)}`}>
                {overallStats.avgGrade !== null ? `${overallStats.avgGrade}%` : '—'}
              </p>
              <p className="text-xs text-gray-400">Nota prom.</p>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">
                {exerciseStats.reduce((s, e) => s + e.graded, 0)}
              </p>
              <p className="text-xs text-gray-400">Calificaciones</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Student Progress Table ── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            Progreso por Estudiante
          </h2>
          <span className="text-xs text-gray-400">{studentProgress.length} estudiante{studentProgress.length !== 1 ? 's' : ''}</span>
        </div>

        {studentProgress.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium">No hay estudiantes inscritos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 min-w-[200px]">Nombre / Email</th>
                  <th className="text-center px-4 py-3 min-w-[150px]">Progreso</th>
                  <th className="text-center px-4 py-3 hidden sm:table-cell">En Progreso</th>
                  <th className="text-center px-4 py-3">Calificación</th>
                  <th className="text-center px-4 py-3 hidden md:table-cell">Última Actividad</th>
                  <th className="text-center px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {studentProgress.map((sp) => (
                  <tr key={sp.studentId} className="hover:bg-gray-50 transition-colors">
                    {/* Name / Email */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                          {sp.studentName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate max-w-[160px]">{sp.studentName}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[160px]">{sp.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Progress mini-bar */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
                          <div
                            className={`h-full rounded-full transition-all ${
                              sp.completionPct === 100
                                ? 'bg-emerald-500'
                                : sp.completionPct > 0
                                ? 'bg-blue-500'
                                : 'bg-gray-300'
                            }`}
                            style={{ width: `${sp.completionPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 flex-shrink-0 font-mono">
                          {sp.exercisesCompleted}/{sp.exercisesTotal}
                        </span>
                      </div>
                    </td>

                    {/* In progress badge */}
                    <td className="px-4 py-4 text-center hidden sm:table-cell">
                      {sp.exercisesInProgress > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-medium rounded-full">
                          <Clock className="w-3 h-3" />
                          {sp.exercisesInProgress}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Average grade */}
                    <td className="px-4 py-4 text-center">
                      {sp.averageGrade !== null ? (
                        <span className={`font-bold ${gradeColor(sp.averageGrade)}`}>
                          {sp.averageGrade}%
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Last activity */}
                    <td className="px-4 py-4 text-center text-xs text-gray-400 hidden md:table-cell">
                      <span className="flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3" />
                        {relativeDate(sp.lastActivity)}
                      </span>
                    </td>

                    {/* Status dot */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {studentStatusDot(sp)}
                        <span className="text-xs text-gray-500 hidden lg:inline">
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
      </div>

      {/* ── Exercise Stats Table ── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            Estado por Ejercicio
          </h2>
          <span className="text-xs text-gray-400">{exerciseStats.length} ejercicio{exerciseStats.length !== 1 ? 's' : ''} publicados</span>
        </div>

        {exerciseStats.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium">No hay ejercicios publicados</p>
            <p className="text-xs text-gray-400 mt-1">Publica un ejercicio para ver estadísticas aquí</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3">Nombre del Ejercicio</th>
                  <th className="text-center px-4 py-3">Total Intentos</th>
                  <th className="text-center px-4 py-3">Enviados</th>
                  <th className="text-center px-4 py-3">Calificados</th>
                  <th className="text-center px-4 py-3">Sin Iniciar</th>
                  <th className="text-center px-4 py-3">Promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {exerciseStats.map((ex) => (
                  <tr key={ex.exerciseId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-800">{ex.exerciseName}</p>
                    </td>
                    <td className="px-4 py-4 text-center text-gray-600">{ex.totalAttempts}</td>
                    <td className="px-4 py-4 text-center">
                      {ex.submitted > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium rounded-full">
                          {ex.submitted}
                        </span>
                      ) : (
                        <span className="text-gray-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {ex.graded > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          {ex.graded}
                        </span>
                      ) : (
                        <span className="text-gray-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {ex.notStarted > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 border border-gray-200 text-gray-500 text-xs font-medium rounded-full">
                          <AlertCircle className="w-3 h-3" />
                          {ex.notStarted}
                        </span>
                      ) : (
                        <span className="text-gray-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {ex.averageGrade !== null ? (
                        <span className={`font-bold ${gradeColor(ex.averageGrade)}`}>
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
      </div>
    </div>
  );
}
