'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate, formatDateTime, getErrorMessage } from '@/lib/utils';
import { StatusBadge, DifficultyBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { Exercise, ExerciseAttempt } from '@/types';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Globe, Lock, Users, Clock, TrendingUp,
  FileText, BookOpen, CheckCircle2, ChevronRight, Send, BarChart2, Trash2, Archive, AlertTriangle, X, Radio, Settings,
} from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  FULL_CYCLE: 'Ciclo Completo', JOURNAL_ONLY: 'Solo Diario',
  INVOICING_ONLY: 'Solo Facturación', INVENTORY_ONLY: 'Solo Inventario',
};

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5">
      <div className="h-1.5 rounded-full bg-blue-600 transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export default function ExerciseDetailPage() {
  const { id }         = useParams<{ id: string }>();
  const searchParams   = useSearchParams();
  const courseId       = searchParams.get('cursoId') ?? '';
  const router         = useRouter();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [attempts, setAttempts] = useState<ExerciseAttempt[]>([]);
  const [loading, setLoading]   = useState(true);
  const [publishing, setPublishing]   = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [archiving, setArchiving]     = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const load = useCallback(async () => {
    if (!courseId) { toast.error('Falta el ID del curso'); router.push('/profesor/ejercicios'); return; }
    setLoading(true);
    try {
      const [ex, att] = await Promise.all([
        api.get<Exercise>(`/api/v1/courses/${courseId}/exercises/${id}`),
        api.get<ExerciseAttempt[]>(`/api/v1/courses/${courseId}/exercises/${id}/attempts`),
      ]);
      setExercise(ex.data);
      setAttempts(att.data);
    } catch { toast.error('Error al cargar el ejercicio'); }
    finally { setLoading(false); }
  }, [id, courseId, router]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    if (!exercise || !courseId) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/courses/${courseId}/exercises/${id}`);
      toast.success('Ejercicio eliminado');
      router.push(courseId ? `/profesor/cursos/${courseId}` : '/profesor/ejercicios');
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleting(false);
    }
    setShowDeleteModal(false);
  }

  async function handleArchive() {
    if (!exercise || !courseId) return;
    setArchiving(true);
    try {
      await api.patch(`/api/v1/courses/${courseId}/exercises/${id}/archive`, {});
      toast.success('Ejercicio archivado — los datos de los estudiantes se conservan');
      router.push(courseId ? `/profesor/cursos/${courseId}` : '/profesor/ejercicios');
    } catch (err) {
      toast.error(getErrorMessage(err));
      setArchiving(false);
    }
    setShowDeleteModal(false);
  }

  async function handlePublish() {
    if (!exercise || !courseId) return;
    if (!confirm(`¿Publicar "${exercise.title}"? Se creará un intento para cada estudiante inscrito y no podrás editar el ejercicio.`)) return;
    setPublishing(true);
    try {
      const { data } = await api.post(`/api/v1/courses/${courseId}/exercises/${id}/publish`);
      toast.success(`Ejercicio publicado. ${data.studentsNotified} estudiante(s) notificados.`);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <div className="flex-1 flex items-center justify-center"><Spinner size="lg" /></div>;
  if (!exercise) return null;

  const stats = {
    total:      attempts.length,
    inProgress: attempts.filter((a) => a.status === 'IN_PROGRESS').length,
    submitted:  attempts.filter((a) => a.status === 'SUBMITTED').length,
    graded:     attempts.filter((a) => a.status === 'GRADED').length,
    notStarted: attempts.filter((a) => a.status === 'NOT_STARTED').length,
  };

  const activeAttempts = attempts.filter(a => ['IN_PROGRESS','SUBMITTED','GRADED'].includes(a.status)).length;
  const hasActiveAttempts = activeAttempts > 0;

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">

      {/* Delete/Archive confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                {hasActiveAttempts ? 'No se puede eliminar' : 'Eliminar ejercicio'}
              </h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">{exercise.title}</span>
              </p>
              {hasActiveAttempts ? (
                <>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                    Este ejercicio tiene <span className="font-bold">{activeAttempts} estudiante{activeAttempts !== 1 ? 's' : ''}</span> con intentos activos. No se puede eliminar.
                  </div>
                  <p className="text-sm text-gray-600">
                    Puedes <span className="font-semibold">archivarlo</span>: quedará oculto para los estudiantes pero se conserva todo el historial y calificaciones.
                  </p>
                </>
              ) : (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {attempts.length > 0
                    ? `Se eliminarán ${attempts.length} intento(s) sin actividad. Esta acción no se puede deshacer.`
                    : 'Esta acción no se puede deshacer.'}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                Cancelar
              </button>
              {hasActiveAttempts ? (
                <button onClick={handleArchive} disabled={archiving}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl disabled:opacity-50 transition-colors">
                  <Archive className="w-4 h-4" />
                  {archiving ? 'Archivando...' : 'Archivar ejercicio'}
                </button>
              ) : (
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50 transition-colors">
                  <Trash2 className="w-4 h-4" />
                  {deleting ? 'Eliminando...' : 'Eliminar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/profesor/ejercicios" className="hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Ejercicios
        </Link>
        <span>/</span>
        <span className="text-gray-700 truncate max-w-xs">{exercise.title}</span>
      </div>

      {/* Exercise header */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <DifficultyBadge difficulty={exercise.difficulty} />
              <Badge variant="slate">{TYPE_LABELS[exercise.type] ?? exercise.type}</Badge>
              {exercise.isPublished
                ? <span className="flex items-center gap-1 text-sm text-emerald-600"><Globe className="w-4 h-4" />Publicado</span>
                : <span className="flex items-center gap-1 text-sm text-amber-600"><Lock className="w-4 h-4" />Borrador</span>}
            </div>
            <h2 className="text-xl font-bold text-gray-900">{exercise.title}</h2>
            {exercise.description && <p className="text-gray-500 text-sm mt-1">{exercise.description}</p>}
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              <span>Puntaje máximo: <span className="text-gray-700 font-medium">{exercise.maxScore} pts</span></span>
              {exercise.dueDate && <span>Vence: <span className="text-gray-700">{formatDate(exercise.dueDate)}</span></span>}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(true)}
              className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </Button>
            <Link href={`/profesor/ejercicios/${id}/config?cursoId=${courseId}`}>
              <Button variant="secondary" className="border-gray-200">
                <Settings className="w-4 h-4" />
                {exercise.isPublished ? 'Ver configuración' : 'Configurar'}
              </Button>
            </Link>
            <Link href={`/profesor/ejercicios/${id}/companies-dashboard?cursoId=${courseId}`}>
              <Button variant="secondary" className="text-blue-700 border-blue-200 hover:bg-blue-50">
                <BarChart2 className="w-4 h-4" />
                Panel de empresas
              </Button>
            </Link>
            {exercise.isPublished && (
              <Link href={`/profesor/ejercicios/${id}/live?cursoId=${courseId}`}>
                <Button variant="secondary" className="text-emerald-600 hover:text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                  <Radio className="w-4 h-4" />
                  Panel en Vivo
                </Button>
              </Link>
            )}
            {!exercise.isPublished && (
              <Button onClick={handlePublish} loading={publishing}>
                <Send className="w-4 h-4" />
                Publicar ejercicio
              </Button>
            )}
          </div>
        </div>

        {/* Rubrics */}
        {exercise.rubrics && exercise.rubrics.length > 0 && (
          <div className="mt-5 pt-5 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Rúbricas</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {exercise.rubrics.map((r) => (
                <div key={r.id} className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-gray-700">{r.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{r.points} pts{r.expectedValue ? ` · mín. ${r.expectedValue}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      {exercise.isPublished && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Sin iniciar',   value: stats.notStarted, color: 'text-gray-500' },
            { label: 'En progreso',   value: stats.inProgress, color: 'text-blue-600' },
            { label: 'Pendientes',    value: stats.submitted,  color: 'text-amber-600' },
            { label: 'Calificados',   value: stats.graded,     color: 'text-emerald-600' },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Group Statistics ───────────────────────────────────────────────── */}
      {exercise.isPublished && attempts.length > 0 && (() => {
        const graded = attempts.filter((a) => a.status === 'GRADED' && a.score != null);
        const avgScore = graded.length
          ? graded.reduce((s, a) => s + Number(a.score), 0) / graded.length
          : null;
        const maxScore = Number(exercise.maxScore);
        const avgPct   = avgScore != null && maxScore > 0 ? (avgScore / maxScore) * 100 : null;

        // Progress distribution buckets
        const buckets = [
          { label: '0–24%',   color: 'bg-gray-400',    min: 0,  max: 24  },
          { label: '25–49%',  color: 'bg-amber-400',   min: 25, max: 49  },
          { label: '50–74%',  color: 'bg-blue-500',    min: 50, max: 74  },
          { label: '75–99%',  color: 'bg-purple-500',  min: 75, max: 99  },
          { label: '100%',    color: 'bg-emerald-500', min: 100, max: 100 },
        ].map((b) => ({
          ...b,
          count: attempts.filter((a) => {
            const pct = Number(a.studentProgress?.progressPct ?? 0);
            return b.max === 100 ? pct >= 100 : pct >= b.min && pct <= b.max;
          }).length,
        }));
        const maxBucket = Math.max(...buckets.map((b) => b.count), 1);

        // Top 5 students by progressPct
        const top = [...attempts]
          .sort((a, b) => Number(b.studentProgress?.progressPct ?? 0) - Number(a.studentProgress?.progressPct ?? 0))
          .slice(0, 5);

        return (
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 mb-6">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-5">
              <BarChart2 className="w-4 h-4 text-blue-600" />
              Estadísticas del grupo
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Score average */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Puntaje promedio</p>
                {avgScore != null ? (
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-emerald-600">{avgScore.toFixed(1)}</span>
                    <span className="text-gray-400 pb-1">/ {maxScore} pts</span>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">Sin calificados aún</p>
                )}
                {avgPct != null && (
                  <div className="mt-2 w-full bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, avgPct)}%` }} />
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <span>{graded.length} calificado{graded.length !== 1 ? 's' : ''}</span>
                  <span>{attempts.filter((a) => a.status === 'SUBMITTED').length} pendiente{attempts.filter((a) => a.status === 'SUBMITTED').length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {/* Progress distribution */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Distribución de progreso</p>
                <div className="space-y-1.5">
                  {buckets.map((b) => (
                    <div key={b.label} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-14 flex-shrink-0">{b.label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div
                          className={`h-4 rounded-full ${b.color} transition-all flex items-center justify-end pr-1`}
                          style={{ width: `${(b.count / maxBucket) * 100}%` }}
                        >
                          {b.count > 0 && <span className="text-white text-[10px] font-bold">{b.count}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top students */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Líderes de progreso</p>
                <div className="space-y-2">
                  {top.map((a, i) => {
                    const pct = Number(a.studentProgress?.progressPct ?? 0);
                    return (
                      <div key={a.id} className="flex items-center gap-2">
                        <span className={`text-xs font-bold w-5 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-500' : 'text-amber-700'}`}>
                          {i + 1}
                        </span>
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                          {(a as any).student?.name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">{(a as any).student?.name ?? '—'}</p>
                        </div>
                        <span className={`text-xs font-bold ${pct >= 75 ? 'text-emerald-600' : pct >= 50 ? 'text-blue-600' : 'text-gray-500'}`}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Feature 5: Errores Frecuentes */}
      {exercise.isPublished && exercise.rubrics && exercise.rubrics.length > 0 && attempts.length > 0 && (() => {
        const total = attempts.length;
        const rubricStats = exercise.rubrics.map((r) => {
          const metCount = attempts.filter((a) => {
            const prog = a.studentProgress;
            if (!prog) return false;
            const expected = r.expectedValue ? Number(r.expectedValue) : null;
            if (expected == null) return false;
            if (r.criterion === 'min_clients')  return (prog.clientsCount ?? 0) >= expected;
            if (r.criterion === 'min_products') return (prog.productsCount ?? 0) >= expected;
            if (r.criterion === 'min_invoices') return (prog.invoicesCount ?? 0) >= expected;
            if (r.criterion === 'min_entries')  return (prog.entriesCount ?? 0) >= expected;
            return false;
          }).length;
          const failCount = total - metCount;
          const failPct = total > 0 ? (failCount / total) * 100 : 0;
          return { ...r, failCount, metCount, failPct };
        }).sort((a, b) => b.failPct - a.failPct);

        return (
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 mb-6">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <span className="text-red-500">⚠</span>
              Errores frecuentes
            </h3>
            <div className="space-y-3">
              {rubricStats.map((r) => (
                <div key={r.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{r.description}</span>
                    <span className={`text-xs font-medium ${r.failCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {r.failCount} de {total} estudiante{total !== 1 ? 's' : ''} no cumplieron
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${r.failPct > 50 ? 'bg-red-500' : r.failPct > 25 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${r.failPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Attempts table */}
      {exercise.isPublished && (
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Intentos de estudiantes
              <span className="bg-gray-100 text-gray-600 border border-gray-200 text-xs px-1.5 py-0.5 rounded-full">{attempts.length}</span>
            </h3>
          </div>

          {attempts.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-gray-500 text-sm">Aún no hay intentos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-200">
                    <th className="text-left p-4">Estudiante</th>
                    <th className="text-left p-4">Estado</th>
                    <th className="text-left p-4">Progreso</th>
                    <th className="text-right p-4">Facturas</th>
                    <th className="text-right p-4">Asientos</th>
                    <th className="text-right p-4">Tiempo</th>
                    <th className="text-right p-4">Puntaje</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {attempts.map((attempt) => {
                    const prog   = attempt.studentProgress;
                    const pct    = Number(prog?.progressPct ?? 0);
                    const canGrade = attempt.status !== 'NOT_STARTED' && attempt.status !== 'GRADED';
                    return (
                      <tr key={attempt.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                              {(attempt as any).student?.name?.charAt(0)?.toUpperCase() ?? '?'}
                            </div>
                            <div>
                              <p className="font-medium text-gray-700">{(attempt as any).student?.name ?? '—'}</p>
                              <p className="text-xs text-gray-400">{(attempt as any).student?.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4"><StatusBadge status={attempt.status} /></td>
                        <td className="p-4 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <ProgressBar pct={pct} />
                            <span className="text-xs text-gray-500 flex-shrink-0">{pct}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-right text-gray-500">{prog?.invoicesCount ?? 0}</td>
                        <td className="p-4 text-right text-gray-500">{prog?.entriesCount ?? 0}</td>
                        <td className="p-4 text-right text-gray-500">
                          {prog?.timeSpentMin ? `${prog.timeSpentMin}min` : '—'}
                        </td>
                        <td className="p-4 text-right">
                          {attempt.score != null
                            ? <span className="font-semibold text-emerald-600">{attempt.score}/{attempt.maxScore}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="p-4 text-right">
                          {canGrade ? (
                            <Link href={`/profesor/ejercicios/${id}/calificar/${attempt.id}?cursoId=${courseId}`}>
                              <Button size="sm">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Calificar
                              </Button>
                            </Link>
                          ) : attempt.status === 'GRADED' ? (
                            <Link href={`/profesor/ejercicios/${id}/calificar/${attempt.id}?cursoId=${courseId}`}>
                              <Button size="sm" variant="secondary">
                                <ChevronRight className="w-3.5 h-3.5" /> Ver
                              </Button>
                            </Link>
                          ) : (
                            <span className="text-xs text-gray-400">Sin iniciar</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
