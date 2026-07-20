'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate, getErrorMessage } from '@/lib/utils';
import { DifficultyBadge } from '@/components/ui/Badge';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconTile } from '@/components/ui/IconTile';
import { ArtLedger, SceneEmptyBox, SceneSearchEmpty } from '@/components/illustrations';
import type { Exercise, ExerciseDifficulty } from '@/types';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Users, FileText, Plus, UserPlus,
  Calendar, X, ChevronRight, Globe, Lock, Search,
  BarChart2, Download, TrendingUp, Clock, CheckCircle, AlertCircle,
  Table2, Layers, BookMarked, Mail, Trash2, GraduationCap, Upload,
  CheckCircle2, Award, Calculator, Info,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { exportToExcelMultiSheet } from '@/lib/excel';

// Textura de puntos sutil para la banda hero (fondo azul noche).
const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
};

// Paleta de marca para las gráficas (azules + dorado).
const CHART = {
  blue:    '#2563EB',
  gold:    '#D4A017',
  emerald: '#059669',
  amber:   '#F59E0B',
  red:     '#DC2626',
  grid:    '#EFF6FF',
  axis:    '#64748B',
} as const;

type ExerciseWithCount = Exercise & { _count?: { attempts: number } };

interface CourseDetail {
  id: string; name: string; code: string | null; period: string | null;
  description: string | null; createdAt: string; universityId: string;
  university?: { id: string; name: string; shortName: string | null };
  teacher: { id: string; name: string; email: string };
  enrollments: Array<{ id: string; enrolledAt: string; student: { id: string; name: string; email: string } }>;
  _count: { exercises: number };
}

interface Student { id: string; name: string; email: string; isActive: boolean; }

interface GradeMatrix {
  exercises: Array<{ id: string; title: string }>;
  students: Array<{
    student: { id: string; name: string; email: string };
    grades: Array<{ exerciseId: string; score: number | null; maxScore: number; status: string }>;
    average: number | null;
  }>;
}

interface TemplateExercise {
  id: string; title: string; difficulty: string; type: string;
  course?: { id: string; name: string };
}

interface Analytics {
  overview: {
    totalStudents: number;
    totalExercises: number;
    avgCompletionRate: number;
    avgScore: number | null;
  };
  exercises: Array<{
    id: string; title: string; difficulty: string;
    totalAssigned: number; submitted: number; graded: number;
    passRate: number | null; avgScore: number | null; avgTimeMin: number | null;
  }>;
}

// ── Enroll Modal ──────────────────────────────────────────────────────────────
function EnrollModal({ courseId, universityId, enrolled, onClose, onEnrolled }: {
  courseId: string; universityId: string;
  enrolled: string[];
  onClose: () => void; onEnrolled: () => void;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch]     = useState('');
  const [saving, setSaving]     = useState<string | null>(null);

  useEffect(() => {
    api.get<Array<Student & { role: string }>>(`/api/v1/universities/${universityId}/users`)
      .then(({ data }) => setStudents(data.filter((u) => u.role === 'STUDENT' && u.isActive)))
      .catch(() => toast.error('No se pudieron cargar los estudiantes'));
  }, [universityId]);

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  async function enroll(studentId: string) {
    setSaving(studentId);
    try {
      await api.post(`/api/v1/universities/${universityId}/courses/${courseId}/enroll`, { studentId });
      toast.success('Estudiante inscrito');
      onEnrolled();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-csq-dark/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-card border border-gray-200/70 bg-white shadow-card-hover cx-pop">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <IconTile icon={UserPlus} tint="#2563EB" size={40} />
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">Roster</p>
              <h3 className="font-bold tracking-tight text-gray-900">Inscribir estudiante</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 cx-press" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o correo…"
              autoFocus
              className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
            />
          </div>
          <div className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200">
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">
                {students.length === 0 ? 'No hay estudiantes en esta universidad' : 'Sin resultados'}
              </p>
            ) : filtered.map((s) => {
              const isEnrolled = enrolled.includes(s.id);
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-blue-50/50">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-sm font-bold text-blue-700">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{s.name}</p>
                    <p className="truncate text-xs text-gray-400">{s.email}</p>
                  </div>
                  {isEnrolled ? (
                    <span className="flex-shrink-0 text-xs font-semibold text-emerald-600">Ya inscrito</span>
                  ) : (
                    <Button size="sm" onClick={() => enroll(s.id)} disabled={saving === s.id} className="flex-shrink-0 cx-press">
                      {saving === s.id ? '…' : 'Inscribir'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="border-t border-gray-100 p-5">
          <Button variant="secondary" onClick={onClose} className="w-full">Cerrar</Button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk Enroll Modal ─────────────────────────────────────────────────────────
function BulkEnrollModal({ courseId, universityId, onClose, onDone }: {
  courseId: string; universityId: string; onClose: () => void; onDone: () => void;
}) {
  const [rawText,  setRawText]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<{ enrolled: number; alreadyEnrolled: number; notFound: string[]; total: number } | null>(null);

  // Parse emails from raw text (CSV, newlines, semicolons, spaces)
  const emails = rawText
    .split(/[\n,;|\s]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => e.includes('@') && e.includes('.'));

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setRawText(prev => prev + '\n' + ((ev.target?.result as string) ?? ''));
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleImport() {
    if (emails.length === 0) return;
    setLoading(true);
    try {
      const { data } = await api.post<{ enrolled: number; alreadyEnrolled: number; notFound: string[]; total: number }>(
        `/api/v1/universities/${universityId}/courses/${courseId}/enroll-bulk`,
        { emails },
      );
      setResult(data);
      if (data.enrolled > 0) onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-csq-dark/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-card border border-gray-200/70 bg-white shadow-card-hover cx-pop">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <IconTile icon={Upload} tint="#1B2E6E" size={40} />
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">Roster</p>
              <h3 className="font-bold tracking-tight text-gray-900">Importar estudiantes</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 cx-press" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!result ? (
          <>
            <div className="space-y-4 p-6">
              <p className="text-sm text-gray-500">
                Pega los correos o sube un archivo CSV/TXT. Acepta separadores por coma, punto y coma, salto de línea o espacio.
              </p>

              {/* File upload */}
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-gray-200 px-4 py-3 transition-colors hover:border-blue-400 hover:bg-blue-50">
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">Subir archivo CSV / TXT</span>
                <input type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
              </label>

              {/* Text area */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">O pega los correos aquí:</label>
                <textarea
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder={'estudiante1@universidad.ac.cr\nestudiante2@universidad.ac.cr, estudiante3@universidad.ac.cr'}
                  rows={6}
                  className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                />
              </div>

              {/* Preview count */}
              {emails.length > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 cx-pop">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span className="tabular-nums">
                    <strong>{emails.length}</strong> correo{emails.length !== 1 ? 's' : ''} detectado{emails.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t border-gray-100 p-6">
              <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
              <Button onClick={handleImport} disabled={loading || emails.length === 0} loading={loading} className="flex-1 cx-press">
                <Upload className="w-4 h-4" />
                {loading ? 'Importando…' : `Importar ${emails.length > 0 ? emails.length : ''}`}
              </Button>
            </div>
          </>
        ) : (
          /* Results */
          <>
            <div className="space-y-4 p-6">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center cx-pop cx-d1">
                  <p className="text-2xl font-extrabold text-emerald-600 tabular-nums">{result.enrolled}</p>
                  <p className="mt-0.5 text-xs text-gray-500">Inscritos</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center cx-pop cx-d2">
                  <p className="text-2xl font-extrabold text-gray-500 tabular-nums">{result.alreadyEnrolled}</p>
                  <p className="mt-0.5 text-xs text-gray-500">Ya inscritos</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center cx-pop cx-d3">
                  <p className="text-2xl font-extrabold text-red-600 tabular-nums">{result.notFound.length}</p>
                  <p className="mt-0.5 text-xs text-gray-500">No encontrados</p>
                </div>
              </div>

              {result.notFound.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-red-600">Correos no encontrados en el sistema:</p>
                  <div className="max-h-32 space-y-1 overflow-y-auto">
                    {result.notFound.map(email => (
                      <div key={email} className="rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 font-mono text-xs text-red-700">
                        {email}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">Estos usuarios deben registrarse primero en la plataforma.</p>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 p-6">
              <Button onClick={onClose} className="w-full cx-press">Cerrar</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────
function AnalyticsTab({ courseId, universityId }: { courseId: string; universityId: string }) {
  const [data, setData]       = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Analytics>(`/api/v1/universities/${universityId}/courses/${courseId}/analytics`)
      .then(({ data: d }) => setData(d))
      .catch(() => toast.error('Error al cargar analytics'))
      .finally(() => setLoading(false));
  }, [courseId, universityId]);

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (!data)   return null;

  const { overview, exercises } = data;

  const chartData = exercises.map((e) => ({
    name:     e.title.length > 20 ? e.title.slice(0, 18) + '…' : e.title,
    entrega:  e.submitted,
    aprobado: e.graded > 0 ? Math.round(e.passRate ?? 0) : 0,
    promedio: e.avgScore ?? 0,
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Estudiantes" value={String(overview.totalStudents)} icon={Users} tint="#2563EB" className="cx-pop cx-d1" />
        <StatCard label="Ejercicios publicados" value={String(overview.totalExercises)} icon={FileText} tint="#1B2E6E" className="cx-pop cx-d2" />
        <StatCard label="Entrega promedio" value={`${overview.avgCompletionRate}%`} icon={TrendingUp} tint="#059669" className="cx-pop cx-d3" />
        <StatCard
          label="Nota promedio"
          value={overview.avgScore !== null ? `${overview.avgScore}%` : '—'}
          icon={BarChart2} tint="#B8860B" className="cx-pop cx-d4"
        />
      </div>

      {exercises.length === 0 ? (
        <SectionCard title="Analítica" icon={BarChart2} iconTint="#B8860B">
          <EmptyState
            illustration={<SceneSearchEmpty size={180} className="cx-float" />}
            title="No hay ejercicios publicados aún"
            description="Publica un ejercicio para empezar a ver estadísticas del grupo."
          />
        </SectionCard>
      ) : (
        <>
          {/* Entregas y aprobación */}
          <SectionCard
            icon={TrendingUp}
            iconTint="#2563EB"
            eyebrow="Comparativa"
            title="Entregas y aprobación por ejercicio"
            className="cx-pop"
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART.axis }} />
                <YAxis tick={{ fontSize: 11, fill: CHART.axis }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #DBEAFE', fontSize: 12 }}
                  formatter={(value, name) => [
                    name === 'entrega' ? `${value} estudiantes` : `${value}%`,
                    name === 'entrega' ? 'Entregaron' : 'Aprobación',
                  ]}
                />
                <Bar dataKey="entrega"  fill={CHART.blue} radius={[6, 6, 0, 0]} name="entrega" />
                <Bar dataKey="aprobado" fill={CHART.gold} radius={[6, 6, 0, 0]} name="aprobado" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 flex items-center justify-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-blue-600" /> Entregaron</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-gold-600" /> % Aprobación</span>
            </div>
          </SectionCard>

          {/* Nota promedio */}
          <SectionCard
            icon={BarChart2}
            iconTint="#B8860B"
            eyebrow="Rendimiento"
            title="Nota promedio por ejercicio"
            className="cx-pop cx-d2"
          >
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 0, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART.axis }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: CHART.axis }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #DBEAFE', fontSize: 12 }}
                  formatter={(v) => [`${v}%`, 'Promedio']}
                />
                <Bar dataKey="promedio" radius={[6, 6, 0, 0]} name="promedio">
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.promedio >= 70 ? CHART.emerald : entry.promedio >= 50 ? CHART.gold : CHART.red} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          {/* Detalle por ejercicio */}
          <SectionCard
            icon={Table2}
            iconTint="#1B2E6E"
            eyebrow="Detalle"
            title="Detalle por ejercicio"
            flushBody
            className="cx-pop cx-d3"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Ejercicio</th>
                    <th className="px-4 py-3 text-center">Entregas</th>
                    <th className="px-4 py-3 text-center">Calificados</th>
                    <th className="px-4 py-3 text-center">Aprobación</th>
                    <th className="px-4 py-3 text-center">Promedio</th>
                    <th className="px-4 py-3 text-center">Tiempo prom.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {exercises.map((ex) => (
                    <tr key={ex.id} className="transition-colors hover:bg-blue-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{ex.title}</p>
                        <DifficultyBadge difficulty={ex.difficulty as ExerciseDifficulty} />
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 tabular-nums">{ex.submitted}/{ex.totalAssigned}</td>
                      <td className="px-4 py-3 text-center text-gray-600 tabular-nums">{ex.graded}</td>
                      <td className="px-4 py-3 text-center">
                        {ex.passRate !== null ? (
                          <span className={`font-semibold tabular-nums ${ex.passRate >= 70 ? 'text-emerald-600' : ex.passRate >= 50 ? 'text-gold-700' : 'text-red-600'}`}>
                            {ex.passRate}%
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {ex.avgScore !== null ? (
                          <span className={`font-semibold tabular-nums ${ex.avgScore >= 70 ? 'text-emerald-600' : ex.avgScore >= 50 ? 'text-gold-700' : 'text-red-600'}`}>
                            {ex.avgScore}%
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {ex.avgTimeMin !== null ? (
                          <span className="flex items-center justify-center gap-1 tabular-nums">
                            <Clock className="w-3 h-3" />{ex.avgTimeMin} min
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

// ── Competency Tab (dominio por competencia + alumnos en riesgo) ───────────────
interface CourseEvidence {
  course: { id: string; name: string };
  summary: { totalStudents: number; totalExercises: number; avgMastery: number | null; atRiskCount: number; competenciesCovered: number };
  competencies: Array<{ id: string; code: string; name: string; area: string; masteryPct: number | null; evidenceCount: number; studentsAssessed: number }>;
  students: Array<{ id: string; name: string; email: string; overallPct: number | null; completedExercises: number; totalExercises: number; coveragePct: number; atRisk: boolean; byComp: Record<string, number> }>;
}
function evMasteryColor(pct: number | null) {
  if (pct == null) return '#CBD5E1';
  if (pct >= 80) return '#059669';
  if (pct >= 60) return '#2563EB';
  if (pct >= 40) return '#D4A017';
  return '#DC2626';
}
function CompetencyCourseTab({ courseId }: { courseId: string }) {
  const [data, setData]       = useState<CourseEvidence | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<CourseEvidence>(`/api/v1/courses/${courseId}/competency-evidence`)
      .then(({ data }) => setData(data))
      .catch(() => toast.error('Error al cargar competencias'))
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-card border border-gray-200/70 bg-white p-5 shadow-card cx-pop cx-d1">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Dominio promedio</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums" style={{ color: evMasteryColor(data.summary.avgMastery) }}>
            {data.summary.avgMastery != null ? `${data.summary.avgMastery}%` : '—'}
          </p>
        </div>
        <StatCard label="Competencias cubiertas" value={String(data.summary.competenciesCovered)} icon={Award} tint="#2563EB" className="cx-pop cx-d2" />
        <StatCard label="Estudiantes" value={String(data.summary.totalStudents)} icon={Users} tint="#1B2E6E" className="cx-pop cx-d3" />
        <div className="rounded-card border border-gray-200/70 bg-white p-5 shadow-card cx-pop cx-d4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">En riesgo</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums" style={{ color: data.summary.atRiskCount > 0 ? '#DC2626' : '#059669' }}>
            {data.summary.atRiskCount}
          </p>
        </div>
      </div>

      {/* Dominio por competencia */}
      <SectionCard
        icon={Award}
        iconTint="#B8860B"
        eyebrow="Evidencia"
        title="Dominio por competencia"
        className="cx-pop"
      >
        {data.competencies.length === 0 ? (
          <EmptyState
            illustration={<SceneSearchEmpty size={170} className="cx-float" />}
            title="Sin competencias vinculadas"
            description="Este curso aún no tiene competencias asociadas a sus ejercicios."
          />
        ) : (
          <div className="space-y-3">
            {data.competencies.map(c => (
              <div key={c.id}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-700">
                    <span className="mr-1.5 font-mono text-gray-400">{c.code}</span>{c.name}
                  </span>
                  <span className="font-bold tabular-nums" style={{ color: evMasteryColor(c.masteryPct) }}>
                    {c.masteryPct != null ? `${c.masteryPct}%` : 'Sin evidencia'}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${c.masteryPct ?? 0}%`, background: evMasteryColor(c.masteryPct) }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Roster con riesgo */}
      <SectionCard
        icon={Users}
        iconTint="#2563EB"
        eyebrow="Roster"
        title="Estudiantes"
        flushBody
        className="cx-pop cx-d2"
      >
        {data.students.length === 0 ? (
          <EmptyState
            illustration={<SceneEmptyBox size={180} className="cx-float" />}
            title="Sin estudiantes inscritos"
            description="Inscribe estudiantes para seguir su dominio por competencia."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 text-left">Estudiante</th>
                  <th className="px-3 py-3 text-center">Progreso</th>
                  <th className="px-3 py-3 text-right">Dominio</th>
                  <th className="px-5 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.students.map(s => (
                  <tr key={s.id} className="transition-colors hover:bg-blue-50/50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.email}</p>
                    </td>
                    <td className="px-3 py-3 text-center text-gray-600 tabular-nums">{s.completedExercises}/{s.totalExercises}</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums" style={{ color: evMasteryColor(s.overallPct) }}>
                      {s.overallPct != null ? `${s.overallPct}%` : '—'}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {s.atRisk
                        ? <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600"><AlertCircle className="w-3 h-3" /> En riesgo</span>
                        : <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600"><CheckCircle className="w-3 h-3" /> Al día</span>}
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

// ── Gradebook Tab ─────────────────────────────────────────────────────────────
function GradebookTab({ courseId, universityId }: { courseId: string; universityId: string }) {
  const [data, setData]       = useState<GradeMatrix | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<GradeMatrix>(`/api/v1/universities/${universityId}/courses/${courseId}/grades`)
      .then(({ data: d }) => setData(d))
      .catch(() => toast.error('Error al cargar calificaciones'))
      .finally(() => setLoading(false));
  }, [courseId, universityId]);

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (!data)   return null;

  function scoreColor(score: number | null, maxScore: number) {
    if (score === null) return 'text-gray-400';
    const pct = (score / maxScore) * 100;
    if (pct >= 70) return 'text-emerald-600 font-semibold';
    if (pct >= 50) return 'text-gold-700 font-semibold';
    return 'text-red-600 font-semibold';
  }

  return (
    <SectionCard
      icon={Table2}
      iconTint="#1B2E6E"
      eyebrow="Notas"
      title="Libro de calificaciones"
      flushBody
      className="cx-pop"
      action={
        <span className="text-xs text-gray-400 tabular-nums">
          {data.students.length} estudiantes · {data.exercises.length} ejercicios
        </span>
      }
    >
      {data.students.length === 0 ? (
        <EmptyState
          illustration={<SceneEmptyBox size={190} className="cx-float" />}
          title="No hay estudiantes inscritos"
          description="Inscribe estudiantes para llevar su libro de calificaciones."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="sticky left-0 min-w-[180px] bg-gray-50/70 px-4 py-3 text-left">Estudiante</th>
                {data.exercises.map((ex) => (
                  <th key={ex.id} className="min-w-[120px] px-3 py-3 text-center">
                    <span className="mx-auto block max-w-[110px] truncate" title={ex.title}>{ex.title}</span>
                  </th>
                ))}
                <th className="min-w-[90px] bg-blue-50 px-4 py-3 text-center text-blue-700">Promedio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.students.map(({ student, grades, average }) => (
                <tr key={student.id} className="group transition-colors hover:bg-blue-50/50">
                  <td className="sticky left-0 bg-white px-4 py-3 group-hover:bg-blue-50/50">
                    <p className="max-w-[160px] truncate font-medium text-gray-800">{student.name}</p>
                    <p className="max-w-[160px] truncate text-xs text-gray-400">{student.email}</p>
                  </td>
                  {grades.map((g, i) => (
                    <td key={i} className="px-3 py-3 text-center">
                      {g.score !== null ? (
                        <span className={`tabular-nums ${scoreColor(g.score, g.maxScore)}`}>
                          {g.score}/{g.maxScore}
                        </span>
                      ) : (
                        <span className="text-xs italic text-gray-400">
                          {g.status === 'NOT_STARTED' ? 'Sin iniciar' :
                           g.status === 'IN_PROGRESS' ? 'En curso' :
                           g.status === 'SUBMITTED'   ? 'Entregado' : '—'}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="bg-blue-50/50 px-4 py-3 text-center">
                    {average !== null ? (
                      <span className={`font-bold tabular-nums ${average >= 70 ? 'text-emerald-600' : average >= 50 ? 'text-gold-700' : 'text-red-600'}`}>
                        {Math.round(average)}%
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

// ── Template Picker Modal ──────────────────────────────────────────────────────
function TemplateModal({ courseId, onClose, onCreated }: {
  courseId: string; onClose: () => void; onCreated: () => void;
}) {
  const [templates, setTemplates] = useState<TemplateExercise[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState<string | null>(null);

  useEffect(() => {
    api.get<TemplateExercise[]>('/api/v1/exercises/templates')
      .then(({ data }) => setTemplates(data))
      .catch(() => toast.error('Error al cargar plantillas'))
      .finally(() => setLoading(false));
  }, []);

  async function useTemplate(templateId: string) {
    setSaving(templateId);
    try {
      await api.post(`/api/v1/courses/${courseId}/exercises/from-template`, { templateId });
      toast.success('Ejercicio creado desde plantilla');
      onCreated();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  const DIFF_LABELS: Record<string, string> = {
    BASIC: 'Básico', INTERMEDIATE: 'Intermedio', ADVANCED: 'Avanzado',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-csq-dark/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-card border border-gray-200/70 bg-white shadow-card-hover cx-pop">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <IconTile icon={BookMarked} tint="#1B2E6E" size={40} />
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">Reutilizar</p>
              <h3 className="font-bold tracking-tight text-gray-900">Usar plantilla</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 cx-press" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : templates.length === 0 ? (
            <EmptyState
              illustration={<SceneEmptyBox size={170} className="cx-float" />}
              title="No tienes plantillas guardadas"
              description="Marca un ejercicio como plantilla desde su menú para reutilizarlo aquí."
            />
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 transition-all hover:border-blue-300 hover:bg-blue-50/40 cx-hop-parent">
                  <IconTile icon={Layers} tint="#2563EB" size={36} className="cx-hop" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">{t.title}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {DIFF_LABELS[t.difficulty] ?? t.difficulty}
                      {t.course && <span className="ml-2">· {t.course.name}</span>}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => useTemplate(t.id)} disabled={saving === t.id} className="flex-shrink-0 cx-press">
                    {saving === t.id ? '…' : 'Usar'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-gray-100 p-5">
          <Button variant="secondary" onClick={onClose} className="w-full">Cancelar</Button>
        </div>
      </div>
    </div>
  );
}

// ── Course Template Modal (cursos base listos para usar) ───────────────────────
interface CourseBaseTemplate {
  key: string; code: string; name: string; description: string;
  exerciseCount: number; competencyCodes: string[];
}
function BaseCourseTemplateModal({ courseId, onClose, onApplied }: {
  courseId: string; onClose: () => void; onApplied: () => void;
}) {
  const [templates, setTemplates] = useState<CourseBaseTemplate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [applying, setApplying]   = useState<string | null>(null);

  useEffect(() => {
    api.get<CourseBaseTemplate[]>('/api/v1/course-templates')
      .then(({ data }) => setTemplates(data))
      .catch(() => toast.error('Error al cargar cursos base'))
      .finally(() => setLoading(false));
  }, []);

  async function apply(key: string) {
    setApplying(key);
    try {
      const { data } = await api.post<{ createdCount: number; skippedCount: number }>(
        `/api/v1/courses/${courseId}/apply-template`, { templateKey: key },
      );
      if (data.createdCount > 0) {
        toast.success(`${data.createdCount} ejercicio(s) cargados${data.skippedCount ? ` (${data.skippedCount} ya existían)` : ''}`);
      } else {
        toast('Todos los ejercicios ya estaban cargados', { icon: <Info className="w-4 h-4 text-blue-600" /> });
      }
      onApplied();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setApplying(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-csq-dark/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-card border border-gray-200/70 bg-white shadow-card-hover cx-pop">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <IconTile icon={GraduationCap} tint="#B8860B" size={40} />
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">Currículo</p>
              <h3 className="font-bold tracking-tight text-gray-900">Cargar curso base</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 cx-press" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : templates.length === 0 ? (
            <EmptyState
              illustration={<SceneEmptyBox size={170} className="cx-float" />}
              title="No hay plantillas de curso disponibles"
              description="Cuando existan cursos base publicados, aparecerán aquí."
            />
          ) : (
            <div className="space-y-3">
              {templates.map((t) => (
                <div key={t.key} className="rounded-xl border border-gray-200 p-4 transition-all hover:border-blue-300 hover:bg-blue-50/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs font-bold text-blue-700">{t.code}</span>
                        <p className="truncate text-sm font-semibold text-gray-900">{t.name}</p>
                      </div>
                      <p className="mt-1.5 text-xs leading-snug text-gray-500">{t.description}</p>
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1 tabular-nums"><FileText className="w-3 h-3" />{t.exerciseCount} ejercicios</span>
                        <span className="flex items-center gap-1 tabular-nums"><CheckCircle2 className="w-3 h-3" />{t.competencyCodes.length} competencias</span>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => apply(t.key)} disabled={applying === t.key} className="flex-shrink-0 cx-press">
                      {applying === t.key ? 'Cargando…' : 'Cargar'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-gray-100 p-5">
          <p className="mb-3 text-center text-[11px] text-gray-400">
            Se crean los ejercicios publicados con sus rúbricas y competencias. No se duplican los que ya existan.
          </p>
          <Button variant="secondary" onClick={onClose} className="w-full">Cerrar</Button>
        </div>
      </div>
    </div>
  );
}

// ── Students Tab ──────────────────────────────────────────────────────────────
interface EnrolledRow {
  enrolledAt: string;
  student: { id: string; name: string; email: string };
  stats: { submitted: number; graded: number; totalExercises: number; avgScore: number | null };
}

function StudentsTab({ courseId, universityId, onEnroll }: {
  courseId: string; universityId: string; onEnroll: () => void;
}) {
  const [students, setStudents]   = useState<EnrolledRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [removing, setRemoving]   = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get<EnrolledRow[]>(`/api/v1/universities/${universityId}/courses/${courseId}/students`)
      .then(({ data }) => setStudents(data))
      .catch(() => toast.error('Error al cargar estudiantes'))
      .finally(() => setLoading(false));
  }, [courseId, universityId]);

  useEffect(() => { load(); }, [load]);

  async function handleRemove(studentId: string) {
    setRemoving(studentId);
    try {
      await api.delete(`/api/v1/universities/${universityId}/courses/${courseId}/students/${studentId}`);
      toast.success('Estudiante removido del curso');
      setStudents((prev) => prev.filter((s) => s.student.id !== studentId));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRemoving(null);
      setConfirmId(null);
    }
  }

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return !q || s.student.name.toLowerCase().includes(q) || s.student.email.toLowerCase().includes(q);
  });

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  const withScore  = students.filter((s) => s.stats.avgScore !== null);
  const classAvg   = withScore.length > 0
    ? `${Math.round(withScore.reduce((a, s) => a + (s.stats.avgScore ?? 0), 0) / withScore.length)}%`
    : '—';

  return (
    <div className="space-y-5">
      {/* Barra de acciones */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
          />
        </div>
        <Button onClick={onEnroll} className="cx-press">
          <UserPlus className="w-4 h-4" /> Inscribir estudiante
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Inscritos" value={String(students.length)} icon={Users} tint="#2563EB" className="cx-pop cx-d1" />
        <StatCard
          label="Con entregas"
          value={String(students.filter((s) => s.stats.submitted > 0).length)}
          icon={CheckCircle2} tint="#059669" className="cx-pop cx-d2"
        />
        <StatCard label="Promedio clase" value={classAvg} icon={BarChart2} tint="#B8860B" className="cx-pop cx-d3" />
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <SectionCard title="Estudiantes" icon={Users} iconTint="#2563EB">
          <EmptyState
            illustration={search
              ? <SceneSearchEmpty size={180} className="cx-float" />
              : <SceneEmptyBox size={180} className="cx-float" />}
            title={search ? 'Sin resultados para tu búsqueda' : 'No hay estudiantes inscritos'}
            description={search
              ? 'Prueba con otro nombre o correo.'
              : 'Inscribe al primer estudiante para empezar a seguir su progreso.'}
            action={!search
              ? <Button onClick={onEnroll} className="cx-press"><UserPlus className="w-4 h-4" /> Inscribir estudiante</Button>
              : undefined}
          />
        </SectionCard>
      ) : (
        <SectionCard
          icon={Users}
          iconTint="#2563EB"
          eyebrow="Roster"
          title="Estudiantes del curso"
          flushBody
          className="cx-pop"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 text-left">Estudiante</th>
                  <th className="hidden px-4 py-3 text-center md:table-cell">Inscrito</th>
                  <th className="px-4 py-3 text-center">Entregas</th>
                  <th className="hidden px-4 py-3 text-center sm:table-cell">Calificados</th>
                  <th className="px-4 py-3 text-center">Promedio</th>
                  <th className="w-12 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((s) => (
                  <tr key={s.student.id} className="transition-colors hover:bg-blue-50/50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-sm font-bold text-blue-700">
                          {s.student.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-800">{s.student.name}</p>
                          <p className="flex items-center gap-1 truncate text-xs text-gray-400">
                            <Mail className="w-3 h-3" />{s.student.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-4 text-center text-xs text-gray-400 md:table-cell">
                      {formatDate(s.enrolledAt)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="font-medium text-gray-700 tabular-nums">
                        {s.stats.submitted}/{s.stats.totalExercises}
                      </span>
                    </td>
                    <td className="hidden px-4 py-4 text-center text-gray-600 tabular-nums sm:table-cell">
                      {s.stats.graded}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {s.stats.avgScore !== null ? (
                        <span className={`font-bold tabular-nums ${s.stats.avgScore >= 70 ? 'text-emerald-600' : s.stats.avgScore >= 50 ? 'text-gold-700' : 'text-red-600'}`}>
                          {s.stats.avgScore}%
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {confirmId === s.student.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="danger" size="sm"
                            onClick={() => handleRemove(s.student.id)}
                            disabled={removing === s.student.id}
                            className="cx-press"
                          >
                            {removing === s.student.id ? '…' : 'Sí'}
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => setConfirmId(null)}>
                            No
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmId(s.student.id)}
                          className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 cx-press"
                          title="Remover del curso"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 bg-gray-50/70 px-5 py-3 text-xs text-gray-400 tabular-nums">
            {filtered.length} estudiante{filtered.length !== 1 ? 's' : ''}{search ? ` (filtrado de ${students.length})` : ''}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── Grades export ─────────────────────────────────────────────────────────────
interface ExportGradeCell { exerciseId: string; score: number | null; maxScore: number; status: string }
interface ExportGradeRow {
  student: { id: string; name: string; email: string };
  grades: ExportGradeCell[];
  average: number | null;
}
interface ExportGradesResponse {
  exercises: Array<{ id: string; title: string; maxScore: number }>;
  students: ExportGradeRow[];
}

async function exportGrades(courseId: string, universityId: string, courseName: string) {
  try {
    const { data } = await api.get<ExportGradesResponse>(`/api/v1/universities/${universityId}/courses/${courseId}/grades`);
    const exercises = data.exercises;
    const students  = data.students;
    const filename = `Calificaciones_${courseName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;

    // ── Sheet 1: Calificaciones (student × exercise matrix) ──────────────────
    const sheet1 = students.map((s) => {
      const row: Record<string, unknown> = { 'Estudiante': s.student.name, 'Email': s.student.email };
      exercises.forEach((ex, i) => {
        const g = s.grades[i];
        row[ex.title] = g?.score != null ? g.score : (g?.status ?? '—');
        row[`${ex.title} (%)`] = g?.score != null ? Math.round((g.score / g.maxScore) * 100) : '—';
      });
      row['Promedio (%)'] = s.average !== null ? Math.round(s.average) : '—';
      return row;
    });

    // ── Sheet 2: Estadísticas por ejercicio ──────────────────────────────────
    const sheet2 = exercises.map((ex) => {
      const scores = students
        .map((s) => s.grades.find((g) => g.exerciseId === ex.id))
        .filter((g): g is ExportGradeCell => g?.score != null)
        .map((g) => Math.round(((g.score as number) / g.maxScore) * 100));
      const n    = scores.length;
      const avg  = n > 0 ? scores.reduce((a, b) => a + b, 0) / n : null;
      const min  = n > 0 ? Math.min(...scores) : null;
      const max  = n > 0 ? Math.max(...scores) : null;
      const std  = n > 1 ? Math.round(Math.sqrt(scores.reduce((a, b) => a + (b - avg!) ** 2, 0) / n)) : null;
      const pass = scores.filter((v) => v >= 60).length;
      const d1   = scores.filter((v) => v < 60).length;
      const d2   = scores.filter((v) => v >= 60 && v < 80).length;
      const d3   = scores.filter((v) => v >= 80).length;
      const submitted = students.filter((s) => {
        const g = s.grades.find((gr) => gr.exerciseId === ex.id);
        return g && ['SUBMITTED', 'GRADED'].includes(g.status);
      }).length;
      return {
        'Ejercicio':      ex.title,
        'Puntaje máx':   ex.maxScore,
        'Enviados':       submitted,
        'Calificados':    n,
        'Promedio (%)':   avg !== null ? Math.round(avg) : '—',
        'Mín (%)':        min ?? '—',
        'Máx (%)':        max ?? '—',
        'Desv. Est.':     std ?? '—',
        'Tasa aprobación (%)': n > 0 ? Math.round((pass / n) * 100) : '—',
        'Reprobados (<60%)':   d1,
        'Suficiente (60-79%)': d2,
        'Sobresaliente (≥80%)':d3,
      };
    });

    // ── Sheet 3: Resumen por estudiante ──────────────────────────────────────
    const sheet3 = students.map((s) => {
      const submitted  = s.grades.filter((g) => ['SUBMITTED', 'GRADED'].includes(g.status)).length;
      const graded     = s.grades.filter((g) => g.status === 'GRADED' && g.score != null).length;
      const passed     = s.grades.filter((g) => g.status === 'GRADED' && g.score != null && Math.round(((g.score as number) / g.maxScore) * 100) >= 60).length;
      return {
        'Estudiante':    s.student.name,
        'Email':         s.student.email,
        'Enviados':      submitted,
        'Calificados':   graded,
        'Aprobados':     passed,
        'Reprobados':    graded - passed,
        'Promedio (%)':  s.average !== null ? Math.round(s.average) : '—',
        'Estado':        graded === 0 ? 'Sin calificar' : passed === graded ? 'Todo aprobado' : passed > 0 ? 'Parcial' : 'Reprobado',
      };
    });

    exportToExcelMultiSheet(filename, [
      { name: 'Calificaciones',  rows: sheet1 },
      { name: 'Estadísticas',    rows: sheet2 },
      { name: 'Resumen Alumnos', rows: sheet3 },
    ]);
    toast.success('Archivo descargado');
  } catch {
    toast.error('Error al exportar calificaciones');
  }
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CourseDetailPage() {
  const { courseId: id }   = useParams<{ courseId: string }>();
  const router   = useRouter();
  const [course, setCourse]         = useState<CourseDetail | null>(null);
  const [exercises, setExercises]   = useState<ExerciseWithCount[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showEnroll, setShowEnroll]           = useState(false);
  const [showBulkEnroll, setShowBulkEnroll]   = useState(false);
  const [showTemplates, setShowTemplates]     = useState(false);
  const [showBaseCourse, setShowBaseCourse]   = useState(false);
  const [tab, setTab]                     = useState<'overview' | 'students' | 'competencias' | 'analytics' | 'gradebook'>('overview');
  const [exporting, setExporting]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, e] = await Promise.all([
        api.get<CourseDetail>(`/api/v1/courses/${id}`),
        api.get<ExerciseWithCount[]>(`/api/v1/courses/${id}/exercises`),
      ]);
      setCourse(c.data);
      setExercises(e.data);
    } catch {
      toast.error('Error al cargar el curso');
      router.push('/profesor/cursos');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#FBF8F1] p-6 lg:p-8">
        <Skeleton className="mb-6 h-4 w-48" />
        <div className="mb-6 h-44 rounded-card border border-gray-200/70 bg-white shadow-card" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="h-72 rounded-card border border-gray-200/70 bg-white shadow-card" />
          <div className="h-72 rounded-card border border-gray-200/70 bg-white shadow-card" />
        </div>
      </div>
    );
  }
  if (!course) return null;

  const enrolledIds = course.enrollments.map((e) => e.student.id);

  async function handleExport() {
    setExporting(true);
    await exportGrades(id, course!.universityId, course!.name);
    setExporting(false);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#FBF8F1] p-6 lg:p-8">
      {showEnroll && course.universityId && (
        <EnrollModal
          courseId={id} universityId={course.universityId} enrolled={enrolledIds}
          onClose={() => setShowEnroll(false)}
          onEnrolled={() => { load(); setShowEnroll(false); }}
        />
      )}
      {showBulkEnroll && course.universityId && (
        <BulkEnrollModal
          courseId={id} universityId={course.universityId}
          onClose={() => setShowBulkEnroll(false)}
          onDone={() => { load(); }}
        />
      )}
      {showTemplates && (
        <TemplateModal
          courseId={id}
          onClose={() => setShowTemplates(false)}
          onCreated={() => { load(); setShowTemplates(false); }}
        />
      )}
      {showBaseCourse && (
        <BaseCourseTemplateModal
          courseId={id}
          onClose={() => setShowBaseCourse(false)}
          onApplied={() => { load(); setShowBaseCourse(false); }}
        />
      )}

      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/profesor/cursos" className="flex items-center gap-1 transition-colors hover:text-gray-700">
          <ArrowLeft className="w-3.5 h-3.5" /> Mis cursos
        </Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">{course.name}</span>
      </div>

      {/* Cabecera del curso — banda azul noche */}
      <div className="relative mb-6 overflow-hidden rounded-card shadow-soft lp-in bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
        <div aria-hidden className="pointer-events-none absolute right-6 bottom-4 hidden opacity-95 xl:block">
          <ArtLedger size={150} className="cx-float" />
        </div>
        <div className="relative flex flex-wrap items-start justify-between gap-5 p-6 lg:p-8">
          <div className="min-w-0 xl:max-w-2xl">
            <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-gold-500">
              Portal profesor
            </p>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {course.code && (
                <span className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 font-mono text-xs text-blue-100">
                  {course.code}
                </span>
              )}
              {course.period && (
                <span className="flex items-center gap-1 rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-xs text-blue-100">
                  <Calendar className="w-3 h-3" />{course.period}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white lg:text-3xl">{course.name}</h1>
            {course.description && <p className="mt-1.5 max-w-prose text-sm text-blue-200/80">{course.description}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-blue-100">
              <span className="flex items-center gap-1.5 tabular-nums">
                <Users className="w-4 h-4 text-blue-300" />{course.enrollments.length} estudiantes
              </span>
              <span className="flex items-center gap-1.5 tabular-nums">
                <FileText className="w-4 h-4 text-blue-300" />{exercises.length} ejercicios
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={handleExport} loading={exporting} className="cx-press">
              <Download className="w-4 h-4" /> Exportar notas
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowBulkEnroll(true)} className="cx-press">
              <Upload className="w-4 h-4" /> Importar CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowEnroll(true)} className="cx-press">
              <UserPlus className="w-4 h-4" /> Inscribir
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowTemplates(true)} className="cx-press">
              <BookMarked className="w-4 h-4" /> Desde plantilla
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowBaseCourse(true)} className="cx-press">
              <GraduationCap className="w-4 h-4" /> Cargar curso base
            </Button>
            <Link
              href={`/profesor/cursos/${id}/analytics`}
              className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'cx-press' })}
            >
              <TrendingUp className="w-4 h-4" /> Analítica
            </Link>
            <Link
              href={`/profesor/cursos/${id}/practica`}
              className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'cx-press' })}
            >
              <Calculator className="w-4 h-4" /> Práctica
            </Link>
            <Link
              href={`/profesor/ejercicios/nuevo?cursoId=${id}`}
              className={buttonClasses({ variant: 'gold', size: 'sm', className: 'cx-press' })}
            >
              <Plus className="w-4 h-4" /> Nuevo ejercicio
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex w-fit gap-1 rounded-2xl border border-gray-200/70 bg-white p-1 shadow-card">
        {([
          { key: 'overview',     label: 'Resumen',        icon: FileText      },
          { key: 'students',     label: 'Estudiantes',    icon: GraduationCap },
          { key: 'competencias', label: 'Competencias',   icon: Award         },
          { key: 'gradebook',    label: 'Calificaciones', icon: Table2        },
          { key: 'analytics',    label: 'Analítica',      icon: BarChart2     },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all cx-press ${
              tab === key
                ? 'bg-gradient-to-br from-blue-600 to-[#1B2E6E] text-white shadow-[0_6px_20px_rgba(27,46,110,0.28)]'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <span className="flex items-center gap-2"><Icon className="w-4 h-4" /> {label}</span>
          </button>
        ))}
      </div>

      {tab === 'analytics' ? (
        <AnalyticsTab courseId={id} universityId={course.universityId} />
      ) : tab === 'competencias' ? (
        <CompetencyCourseTab courseId={id} />
      ) : tab === 'gradebook' ? (
        <GradebookTab courseId={id} universityId={course.universityId} />
      ) : tab === 'students' ? (
        <StudentsTab
          courseId={id}
          universityId={course.universityId}
          onEnroll={() => setShowEnroll(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Estudiantes inscritos */}
          <SectionCard
            icon={Users}
            iconTint="#2563EB"
            eyebrow={`${course.enrollments.length} inscrito${course.enrollments.length !== 1 ? 's' : ''}`}
            title="Estudiantes inscritos"
            flushBody
            className="cx-pop"
            action={
              <Button variant="ghost" size="sm" onClick={() => setShowEnroll(true)} className="cx-press">
                <UserPlus className="w-3.5 h-3.5" /> Agregar
              </Button>
            }
          >
            <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
              {course.enrollments.length === 0 ? (
                <EmptyState
                  illustration={<SceneEmptyBox size={170} className="cx-float" />}
                  title="No hay estudiantes inscritos"
                  description="Inscribe al primer estudiante para comenzar."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setShowEnroll(true)} className="cx-press">
                      <UserPlus className="w-3.5 h-3.5" /> Inscribir ahora
                    </Button>
                  }
                />
              ) : (
                course.enrollments.map((enroll) => (
                  <div key={enroll.id} className="flex items-center gap-3 p-4 transition-colors hover:bg-blue-50/50">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-sm font-bold text-blue-700">
                      {enroll.student.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-700">{enroll.student.name}</p>
                      <p className="truncate text-xs text-gray-400">{enroll.student.email}</p>
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(enroll.enrolledAt)}</span>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          {/* Ejercicios */}
          <SectionCard
            icon={FileText}
            iconTint="#B8860B"
            eyebrow={`${exercises.length} en el curso`}
            title="Ejercicios"
            flushBody
            className="cx-pop cx-d2"
            action={
              <Link
                href={`/profesor/ejercicios/nuevo?cursoId=${id}`}
                className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'cx-press' })}
              >
                <Plus className="w-4 h-4" /> Nuevo
              </Link>
            }
          >
            <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
              {exercises.length === 0 ? (
                <EmptyState
                  illustration={<SceneEmptyBox size={170} className="cx-float" />}
                  title="No hay ejercicios creados"
                  description="Crea un ejercicio o carga un curso base para empezar."
                  action={
                    <Link
                      href={`/profesor/ejercicios/nuevo?cursoId=${id}`}
                      className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'cx-press' })}
                    >
                      <Plus className="w-4 h-4" /> Nuevo ejercicio
                    </Link>
                  }
                />
              ) : (
                exercises.map((ex) => (
                  <Link key={ex.id} href={`/profesor/ejercicios/${ex.id}?cursoId=${id}`}
                    className="group flex items-center gap-3 p-4 transition-colors hover:bg-blue-50/50 cx-hop-parent cx-press">
                    <IconTile
                      icon={ex.isPublished ? Globe : Lock}
                      tint={ex.isPublished ? '#059669' : '#94A3B8'}
                      size={38}
                      className="cx-hop"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <DifficultyBadge difficulty={ex.difficulty} />
                        {ex.isPublished
                          ? <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><Globe className="w-3 h-3" />Publicado</span>
                          : <span className="flex items-center gap-1 text-xs font-semibold text-gray-400"><Lock className="w-3 h-3" />Borrador</span>
                        }
                      </div>
                      <p className="truncate text-sm font-semibold text-gray-700 group-hover:text-gray-900">{ex.title}</p>
                      {ex.dueDate && (
                        <p className="mt-0.5 text-xs text-gray-400">Vence: {formatDate(ex.dueDate)}</p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <span className="text-xs text-gray-400 tabular-nums">{ex._count?.attempts ?? 0} intentos</span>
                      <ChevronRight className="w-4 h-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
