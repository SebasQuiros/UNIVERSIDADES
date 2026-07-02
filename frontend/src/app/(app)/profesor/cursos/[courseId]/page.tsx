'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatDate, getErrorMessage } from '@/lib/utils';
import { DifficultyBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { Exercise } from '@/types';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Users, FileText, Plus, UserPlus,
  Calendar, X, ChevronRight, Globe, Lock, Search, UserX,
  BarChart2, Download, TrendingUp, Clock, CheckCircle, AlertCircle,
  Table2, Layers, BookMarked, Mail, Trash2, GraduationCap, Upload, CheckCircle2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { exportToExcel, exportToExcelMultiSheet } from '@/lib/excel';

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
    api.get<any[]>(`/api/v1/universities/${universityId}/users`)
      .then(({ data }) => setStudents(data.filter((u: any) => u.role === 'STUDENT' && u.isActive)))
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 shadow-xl rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Inscribir estudiante</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o correo..."
              autoFocus
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-200">
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">
                {students.length === 0 ? 'No hay estudiantes en esta universidad' : 'Sin resultados'}
              </p>
            ) : filtered.map((s) => {
              const isEnrolled = enrolled.includes(s.id);
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                    <p className="text-xs text-gray-400 truncate">{s.email}</p>
                  </div>
                  {isEnrolled ? (
                    <span className="text-xs text-emerald-600 font-medium flex-shrink-0">Ya inscrito</span>
                  ) : (
                    <button
                      onClick={() => enroll(s.id)}
                      disabled={saving === s.id}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {saving === s.id ? '...' : 'Inscribir'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="p-4 border-t border-gray-200">
          <button onClick={onClose} className="w-full py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
            Cerrar
          </button>
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
    reader.onload = ev => setRawText(prev => prev + '\n' + (ev.target?.result as string ?? ''));
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 shadow-xl rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-600" />
            Importar estudiantes en bulk
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        {!result ? (
          <>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-500">
                Pega los correos o sube un archivo CSV/TXT. Acepta separadores por coma, punto y coma, salto de línea o espacio.
              </p>

              {/* File upload */}
              <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">Subir archivo CSV / TXT</span>
                <input type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
              </label>

              {/* Text area */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">O pega los correos aquí:</label>
                <textarea
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder={"estudiante1@utn.ac.cr\nestudiante2@utn.ac.cr, estudiante3@utn.ac.cr"}
                  rows={6}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
                />
              </div>

              {/* Preview count */}
              {emails.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span><strong>{emails.length}</strong> correo{emails.length !== 1 ? 's' : ''} detectado{emails.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-200 flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                Cancelar
              </button>
              <button onClick={handleImport} disabled={loading || emails.length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 transition-colors">
                <Upload className="w-4 h-4" />
                {loading ? 'Importando...' : `Importar ${emails.length > 0 ? emails.length : ''}`}
              </button>
            </div>
          </>
        ) : (
          /* Results */
          <>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="text-2xl font-bold text-emerald-600">{result.enrolled}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Inscritos</p>
                </div>
                <div className="text-center p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <p className="text-2xl font-bold text-gray-500">{result.alreadyEnrolled}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Ya inscritos</p>
                </div>
                <div className="text-center p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-2xl font-bold text-red-500">{result.notFound.length}</p>
                  <p className="text-xs text-gray-500 mt-0.5">No encontrados</p>
                </div>
              </div>

              {result.notFound.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-red-600">Correos no encontrados en el sistema:</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {result.notFound.map(email => (
                      <div key={email} className="text-xs font-mono text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
                        {email}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">Estos usuarios deben registrarse primero en la plataforma.</p>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-200">
              <button onClick={onClose}
                className="w-full py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors">
                Cerrar
              </button>
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
      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Estudiantes', value: overview.totalStudents, icon: Users, color: 'bg-blue-50 text-blue-600' },
          { label: 'Ejercicios publicados', value: overview.totalExercises, icon: FileText, color: 'bg-purple-50 text-purple-600' },
          { label: 'Entrega promedio', value: `${overview.avgCompletionRate}%`, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Nota promedio', value: overview.avgScore !== null ? `${overview.avgScore}%` : '—', icon: BarChart2, color: 'bg-amber-50 text-amber-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{label}</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {exercises.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <BarChart2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No hay ejercicios publicados aún</p>
        </div>
      ) : (
        <>
          {/* Bar chart - submission rate */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Entregas y aprobación por ejercicio
            </h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    name === 'entrega' ? `${value} estudiantes` : `${value}%`,
                    name === 'entrega' ? 'Entregaron' : 'Aprobación',
                  ]}
                />
                <Bar dataKey="entrega"  fill="#3b82f6" radius={[4, 4, 0, 0]} name="entrega" />
                <Bar dataKey="aprobado" fill="#10b981" radius={[4, 4, 0, 0]} name="aprobado" />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 justify-center text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Entregaron</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> % Aprobación</span>
            </div>
          </div>

          {/* Bar chart - average score */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-purple-600" />
              Nota promedio por ejercicio
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 0, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [`${v}%`, 'Promedio']} />
                <Bar dataKey="promedio" radius={[4, 4, 0, 0]} name="promedio">
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.promedio >= 70 ? '#10b981' : entry.promedio >= 50 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Exercise table */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-200">
              <h4 className="font-semibold text-gray-800">Detalle por ejercicio</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">Ejercicio</th>
                    <th className="text-center px-4 py-3">Entregas</th>
                    <th className="text-center px-4 py-3">Calificados</th>
                    <th className="text-center px-4 py-3">Aprobación</th>
                    <th className="text-center px-4 py-3">Promedio</th>
                    <th className="text-center px-4 py-3">Tiempo prom.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {exercises.map((ex) => (
                    <tr key={ex.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{ex.title}</p>
                        <DifficultyBadge difficulty={ex.difficulty as any} />
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{ex.submitted}/{ex.totalAssigned}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{ex.graded}</td>
                      <td className="px-4 py-3 text-center">
                        {ex.passRate !== null ? (
                          <span className={`font-semibold ${ex.passRate >= 70 ? 'text-emerald-600' : ex.passRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                            {ex.passRate}%
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {ex.avgScore !== null ? (
                          <span className={`font-semibold ${ex.avgScore >= 70 ? 'text-emerald-600' : ex.avgScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                            {ex.avgScore}%
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {ex.avgTimeMin !== null ? (
                          <span className="flex items-center justify-center gap-1">
                            <Clock className="w-3 h-3" />{ex.avgTimeMin} min
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
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
    if (pct >= 50) return 'text-amber-600 font-semibold';
    return 'text-red-600 font-semibold';
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-gray-200 flex items-center gap-2">
        <Table2 className="w-4 h-4 text-blue-600" />
        <h4 className="font-semibold text-gray-900">Libro de Calificaciones</h4>
        <span className="text-xs text-gray-400 ml-auto">{data.students.length} estudiantes · {data.exercises.length} ejercicios</span>
      </div>
      {data.students.length === 0 ? (
        <div className="p-12 text-center text-gray-500 text-sm">No hay estudiantes inscritos</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left px-4 py-3 sticky left-0 bg-gray-50 min-w-[180px]">Estudiante</th>
                {data.exercises.map((ex) => (
                  <th key={ex.id} className="text-center px-3 py-3 min-w-[120px]">
                    <span className="block truncate max-w-[110px] mx-auto" title={ex.title}>{ex.title}</span>
                  </th>
                ))}
                <th className="text-center px-4 py-3 min-w-[90px] bg-blue-50 text-blue-600">Promedio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.students.map(({ student, grades, average }) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 sticky left-0 bg-white">
                    <p className="font-medium text-gray-800 truncate max-w-[160px]">{student.name}</p>
                    <p className="text-xs text-gray-400 truncate max-w-[160px]">{student.email}</p>
                  </td>
                  {grades.map((g, i) => (
                    <td key={i} className="px-3 py-3 text-center">
                      {g.score !== null ? (
                        <span className={scoreColor(g.score, g.maxScore)}>
                          {g.score}/{g.maxScore}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">
                          {g.status === 'NOT_STARTED' ? 'Sin iniciar' :
                           g.status === 'IN_PROGRESS' ? 'En curso' :
                           g.status === 'SUBMITTED'   ? 'Entregado' : '—'}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center bg-blue-50/50">
                    {average !== null ? (
                      <span className={`font-bold ${average >= 70 ? 'text-emerald-600' : average >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {Math.round(average)}%
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 shadow-xl rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <BookMarked className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Usar plantilla</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Layers className="w-10 h-10 mx-auto text-gray-200 mb-3" />
              <p className="text-sm">No tienes plantillas guardadas.</p>
              <p className="text-xs text-gray-400 mt-1">Marca un ejercicio como plantilla desde el menú del ejercicio.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{t.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {DIFF_LABELS[t.difficulty] ?? t.difficulty}
                      {t.course && <span className="ml-2">· {t.course.name}</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => useTemplate(t.id)}
                    disabled={saving === t.id}
                    className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {saving === t.id ? '...' : 'Usar'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-200">
          <button onClick={onClose} className="w-full py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
            Cancelar
          </button>
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
function UtnTemplateModal({ courseId, onClose, onApplied }: {
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
        toast(`Todos los ejercicios ya estaban cargados`, { icon: 'ℹ️' });
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 shadow-xl rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Cargar curso base</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Layers className="w-10 h-10 mx-auto text-gray-200 mb-3" />
              <p className="text-sm">No hay plantillas de curso disponibles.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((t) => (
                <div key={t.key} className="p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/40 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">{t.code}</span>
                        <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1.5 leading-snug">{t.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{t.exerciseCount} ejercicios</span>
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{t.competencyCodes.length} competencias</span>
                      </div>
                    </div>
                    <button
                      onClick={() => apply(t.key)}
                      disabled={applying === t.key}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {applying === t.key ? 'Cargando…' : 'Cargar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-200">
          <p className="text-[11px] text-gray-400 mb-3 text-center">
            Se crean los ejercicios publicados con sus rúbricas y competencias. No se duplican los que ya existan.
          </p>
          <button onClick={onClose} className="w-full py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Students Tab ──────────────────────────────────────────────────────────────
function StudentsTab({ courseId, universityId, onEnroll }: {
  courseId: string; universityId: string; onEnroll: () => void;
}) {
  const [students, setStudents]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [removing, setRemoving]   = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get<any[]>(`/api/v1/universities/${universityId}/courses/${courseId}/students`)
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

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
          />
        </div>
        <button onClick={() => { onEnroll(); }}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors">
          <UserPlus className="w-4 h-4" /> Inscribir estudiante
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Inscritos', value: students.length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Con entregas', value: students.filter((s) => s.stats.submitted > 0).length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Promedio clase', value: (() => {
            const withScore = students.filter((s) => s.stats.avgScore !== null);
            return withScore.length > 0
              ? `${Math.round(withScore.reduce((a, s) => a + s.stats.avgScore, 0) / withScore.length)}%`
              : '—';
          })(), color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl p-4 border border-gray-100`}>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Student list */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
          <UserX className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{search ? 'Sin resultados para tu búsqueda' : 'No hay estudiantes inscritos'}</p>
          {!search && (
            <button onClick={onEnroll} className="mt-3 text-sm text-blue-600 hover:underline font-medium">
              Inscribir primer estudiante
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3">Estudiante</th>
                <th className="text-center px-4 py-3 hidden md:table-cell">Inscrito</th>
                <th className="text-center px-4 py-3">Entregas</th>
                <th className="text-center px-4 py-3 hidden sm:table-cell">Calificados</th>
                <th className="text-center px-4 py-3">Promedio</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((s) => (
                <tr key={s.student.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                        {s.student.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{s.student.name}</p>
                        <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                          <Mail className="w-3 h-3" />{s.student.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center text-gray-400 text-xs hidden md:table-cell">
                    {formatDate(s.enrolledAt)}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-medium text-gray-700">
                      {s.stats.submitted}/{s.stats.totalExercises}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center text-gray-600 hidden sm:table-cell">
                    {s.stats.graded}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {s.stats.avgScore !== null ? (
                      <span className={`font-bold ${s.stats.avgScore >= 70 ? 'text-emerald-600' : s.stats.avgScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {s.stats.avgScore}%
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {confirmId === s.student.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRemove(s.student.id)}
                          disabled={removing === s.student.id}
                          className="px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                        >
                          {removing === s.student.id ? '...' : 'Sí'}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(s.student.id)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
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
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            {filtered.length} estudiante{filtered.length !== 1 ? 's' : ''}{search ? ` (filtrado de ${students.length})` : ''}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Grades export ─────────────────────────────────────────────────────────────
async function exportGrades(courseId: string, universityId: string, courseName: string) {
  try {
    const { data } = await api.get<any>(`/api/v1/universities/${universityId}/courses/${courseId}/grades`);
    const exercises: any[] = data.exercises;
    const students: any[]  = data.students;
    const filename = `Calificaciones_${courseName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;

    // ── Sheet 1: Calificaciones (student × exercise matrix) ──────────────────
    const sheet1 = students.map((s: any) => {
      const row: Record<string, unknown> = { 'Estudiante': s.student.name, 'Email': s.student.email };
      exercises.forEach((ex: any, i: number) => {
        const g = s.grades[i];
        row[ex.title] = g?.score != null ? g.score : (g?.status ?? '—');
        row[`${ex.title} (%)`] = g?.score != null ? Math.round((g.score / g.maxScore) * 100) : '—';
      });
      row['Promedio (%)'] = s.average !== null ? Math.round(s.average) : '—';
      return row;
    });

    // ── Sheet 2: Estadísticas por ejercicio ──────────────────────────────────
    const sheet2 = exercises.map((ex: any) => {
      const scores = students
        .map((s: any) => s.grades.find((g: any) => g.exerciseId === ex.id))
        .filter((g: any) => g?.score != null)
        .map((g: any) => Math.round((g.score / g.maxScore) * 100));
      const n    = scores.length;
      const avg  = n > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / n : null;
      const min  = n > 0 ? Math.min(...scores) : null;
      const max  = n > 0 ? Math.max(...scores) : null;
      const std  = n > 1 ? Math.round(Math.sqrt(scores.reduce((a: number, b: number) => a + (b - avg!) ** 2, 0) / n)) : null;
      const pass = scores.filter((v: number) => v >= 60).length;
      const d1   = scores.filter((v: number) => v < 60).length;
      const d2   = scores.filter((v: number) => v >= 60 && v < 80).length;
      const d3   = scores.filter((v: number) => v >= 80).length;
      const submitted = students.filter((s: any) => {
        const g = s.grades.find((g: any) => g.exerciseId === ex.id);
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
    const sheet3 = students.map((s: any) => {
      const submitted  = s.grades.filter((g: any) => ['SUBMITTED', 'GRADED'].includes(g.status)).length;
      const graded     = s.grades.filter((g: any) => g.status === 'GRADED' && g.score != null).length;
      const passed     = s.grades.filter((g: any) => g.status === 'GRADED' && g.score != null && Math.round((g.score / g.maxScore) * 100) >= 60).length;
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
  const { user } = useAuth();
  const router   = useRouter();
  const [course, setCourse]         = useState<CourseDetail | null>(null);
  const [exercises, setExercises]   = useState<Exercise[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showEnroll, setShowEnroll]           = useState(false);
  const [showBulkEnroll, setShowBulkEnroll]   = useState(false);
  const [showTemplates, setShowTemplates]     = useState(false);
  const [showUtn, setShowUtn]                 = useState(false);
  const [tab, setTab]                     = useState<'overview' | 'students' | 'analytics' | 'gradebook'>('overview');
  const [exporting, setExporting]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, e] = await Promise.all([
        api.get<CourseDetail>(`/api/v1/courses/${id}`),
        api.get<Exercise[]>(`/api/v1/courses/${id}/exercises`),
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

  if (loading) return <div className="flex-1 flex items-center justify-center"><Spinner size="lg" /></div>;
  if (!course) return null;

  const enrolledIds = course.enrollments.map((e) => e.student.id);

  async function handleExport() {
    setExporting(true);
    await exportGrades(id, course!.universityId, course!.name);
    setExporting(false);
  }

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
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
      {showUtn && (
        <UtnTemplateModal
          courseId={id}
          onClose={() => setShowUtn(false)}
          onApplied={() => { load(); setShowUtn(false); }}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/profesor/cursos" className="hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Mis Cursos
        </Link>
        <span>/</span>
        <span className="text-gray-700">{course.name}</span>
      </div>

      {/* Course header */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            {course.code && (
              <span className="text-xs font-mono text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                {course.code}
              </span>
            )}
            <h2 className="text-xl font-bold text-gray-900 mt-2">{course.name}</h2>
            {course.description && <p className="text-gray-500 text-sm mt-1">{course.description}</p>}
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              {course.period && (
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{course.period}</span>
              )}
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{course.enrollments.length} estudiantes</span>
              <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{exercises.length} ejercicios</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={handleExport} loading={exporting}>
              <Download className="w-4 h-4" /> Exportar notas
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowBulkEnroll(true)}>
              <Upload className="w-4 h-4" /> Importar CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowEnroll(true)}>
              <UserPlus className="w-4 h-4" /> Inscribir
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowTemplates(true)}>
              <BookMarked className="w-4 h-4" /> Desde plantilla
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowUtn(true)}>
              <GraduationCap className="w-4 h-4" /> Cargar curso base
            </Button>
            <Link href={`/profesor/cursos/${id}/analytics`}>
              <Button variant="secondary" size="sm">
                <TrendingUp className="w-4 h-4" /> Analytics
              </Button>
            </Link>
            <Link href={`/profesor/ejercicios/nuevo?cursoId=${id}`}>
              <Button size="sm"><Plus className="w-4 h-4" /> Nuevo ejercicio</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { key: 'overview',   label: 'Resumen',        icon: FileText      },
          { key: 'students',   label: 'Estudiantes',    icon: GraduationCap },
          { key: 'gradebook',  label: 'Calificaciones', icon: Table2        },
          { key: 'analytics',  label: 'Analytics',      icon: BarChart2     },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className="flex items-center gap-2"><Icon className="w-4 h-4" /> {label}</span>
          </button>
        ))}
      </div>

      {tab === 'analytics' ? (
        <AnalyticsTab courseId={id} universityId={course.universityId} />
      ) : tab === 'gradebook' ? (
        <GradebookTab courseId={id} universityId={course.universityId} />
      ) : tab === 'students' ? (
        <StudentsTab
          courseId={id}
          universityId={course.universityId}
          onEnroll={() => setShowEnroll(true)}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Students */}
          <section className="bg-white border border-gray-200 shadow-sm rounded-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                Estudiantes inscritos
                <span className="bg-gray-100 text-gray-600 border border-gray-200 text-xs px-1.5 py-0.5 rounded-full">
                  {course.enrollments.length}
                </span>
              </h3>
              <button onClick={() => setShowEnroll(true)}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
                <UserPlus className="w-3.5 h-3.5" /> Agregar
              </button>
            </div>
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {course.enrollments.length === 0 ? (
                <div className="p-8 text-center">
                  <UserX className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No hay estudiantes inscritos</p>
                  <button onClick={() => setShowEnroll(true)} className="mt-3 text-xs text-blue-600 hover:underline">
                    Inscribir ahora
                  </button>
                </div>
              ) : (
                course.enrollments.map((enroll) => (
                  <div key={enroll.id} className="flex items-center gap-3 p-4 hover:bg-gray-50">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-sm flex-shrink-0">
                      {enroll.student.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{enroll.student.name}</p>
                      <p className="text-xs text-gray-400 truncate">{enroll.student.email}</p>
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(enroll.enrolledAt)}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Exercises */}
          <section className="bg-white border border-gray-200 shadow-sm rounded-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Ejercicios
                <span className="bg-gray-100 text-gray-600 border border-gray-200 text-xs px-1.5 py-0.5 rounded-full">
                  {exercises.length}
                </span>
              </h3>
              <Link href={`/profesor/ejercicios/nuevo?cursoId=${id}`}>
                <Button variant="ghost" size="sm"><Plus className="w-4 h-4" /> Nuevo</Button>
              </Link>
            </div>
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {exercises.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-500 text-sm">No hay ejercicios creados</p>
                </div>
              ) : (
                exercises.map((ex) => (
                  <Link key={ex.id} href={`/profesor/ejercicios/${ex.id}?cursoId=${id}`}
                    className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <DifficultyBadge difficulty={ex.difficulty} />
                        {ex.isPublished
                          ? <span className="flex items-center gap-1 text-xs text-emerald-600"><Globe className="w-3 h-3" />Publicado</span>
                          : <span className="flex items-center gap-1 text-xs text-gray-400"><Lock className="w-3 h-3" />Borrador</span>
                        }
                      </div>
                      <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 truncate">{ex.title}</p>
                      {ex.dueDate && (
                        <p className="text-xs text-gray-400 mt-0.5">Vence: {formatDate(ex.dueDate)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">{(ex as any)._count?.attempts ?? 0} intentos</span>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
