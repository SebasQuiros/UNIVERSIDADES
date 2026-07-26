'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate, getErrorMessage } from '@/lib/utils';
import { StatusBadge, DifficultyBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { ExerciseAttachments } from '@/components/exercise/ExerciseAttachments';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconTile } from '@/components/ui/IconTile';
import { ArtReport, SceneEmptyBox } from '@/components/illustrations';
import type { Exercise, ExerciseAttempt } from '@/types';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Globe, Lock, Users, Clock, Award,
  CheckCircle2, ChevronRight, Send, BarChart2, Trash2, Archive,
  AlertTriangle, X, Radio, Settings, ClipboardCheck, Hourglass, Eye, Paperclip,
} from 'lucide-react';

// Textura de puntos sutil para la banda hero (fondo azul noche).
const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
};

const TYPE_LABELS: Record<string, string> = {
  FULL_CYCLE: 'Ciclo Completo', JOURNAL_ONLY: 'Solo Diario',
  INVOICING_ONLY: 'Solo Facturación', INVENTORY_ONLY: 'Solo Inventario',
};

type AttemptWithStudent = ExerciseAttempt & {
  student?: { id: string; name: string; email: string };
};

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100">
      <div
        className="h-1.5 rounded-full bg-gradient-to-r from-blue-600 to-[#1B2E6E] transition-all duration-500"
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

export default function ExerciseDetailPage() {
  const { id }         = useParams<{ id: string }>();
  const searchParams   = useSearchParams();
  const courseId       = searchParams.get('cursoId') ?? '';
  const router         = useRouter();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [attempts, setAttempts] = useState<AttemptWithStudent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [publishing, setPublishing]   = useState(false);
  const [previewing, setPreviewing]   = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [archiving, setArchiving]     = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const load = useCallback(async () => {
    if (!courseId) { toast.error('Falta el ID del curso'); router.push('/profesor/ejercicios'); return; }
    setLoading(true);
    try {
      const [ex, att] = await Promise.all([
        api.get<Exercise>(`/api/v1/courses/${courseId}/exercises/${id}`),
        api.get<AttemptWithStudent[]>(`/api/v1/courses/${courseId}/exercises/${id}/attempts`),
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

  async function handlePreview() {
    if (!courseId) return;
    setPreviewing(true);
    try {
      const { data } = await api.post<{ attemptId: string }>(
        `/api/v1/courses/${courseId}/exercises/${id}/preview`,
      );
      router.push(`/estudiante/ejercicio/${data.attemptId}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setPreviewing(false);
    }
  }

  async function handlePublish() {
    if (!exercise || !courseId) return;
    if (!confirm(`¿Publicar "${exercise.title}"? Se creará un intento para cada estudiante inscrito y no podrás editar el ejercicio.`)) return;
    setPublishing(true);
    try {
      const { data } = await api.post<{ studentsNotified: number }>(`/api/v1/courses/${courseId}/exercises/${id}/publish`);
      toast.success(`Ejercicio publicado. ${data.studentsNotified} estudiante(s) notificados.`);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#FBF8F1] p-6 lg:p-8">
        <Skeleton className="mb-6 h-4 w-48" />
        <div className="mb-6 h-48 rounded-card border border-gray-200/70 bg-white shadow-card" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-card border border-gray-200/70 bg-white shadow-card" />
          ))}
        </div>
      </div>
    );
  }
  if (!exercise) return null;

  const stats = {
    total:      attempts.length,
    inProgress: attempts.filter((a) => a.status === 'IN_PROGRESS').length,
    submitted:  attempts.filter((a) => a.status === 'SUBMITTED').length,
    graded:     attempts.filter((a) => a.status === 'GRADED').length,
    notStarted: attempts.filter((a) => a.status === 'NOT_STARTED').length,
  };

  const activeAttempts = attempts.filter(a => ['IN_PROGRESS', 'SUBMITTED', 'GRADED'].includes(a.status)).length;
  const hasActiveAttempts = activeAttempts > 0;

  return (
    <div className="flex-1 overflow-y-auto bg-[#FBF8F1] p-6 lg:p-8">

      {/* Modal de eliminar / archivar */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-csq-dark/60 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative w-full max-w-md rounded-card border border-gray-200/70 bg-white shadow-card-hover cx-pop">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 pt-5 pb-4">
              <div className="flex items-center gap-3">
                <IconTile icon={AlertTriangle} tint={hasActiveAttempts ? '#B8860B' : '#DC2626'} size={40} />
                <h3 className="font-bold tracking-tight text-gray-900">
                  {hasActiveAttempts ? 'No se puede eliminar' : 'Eliminar ejercicio'}
                </h3>
              </div>
              <button onClick={() => setShowDeleteModal(false)} className="text-gray-400 hover:text-gray-700 cx-press" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 p-6">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">{exercise.title}</span>
              </p>
              {hasActiveAttempts ? (
                <>
                  <div className="rounded-xl border border-gold-100 bg-gold-50 p-3 text-sm text-gold-900">
                    Este ejercicio tiene <span className="font-bold tabular-nums">{activeAttempts} estudiante{activeAttempts !== 1 ? 's' : ''}</span> con intentos activos. No se puede eliminar.
                  </div>
                  <p className="text-sm text-gray-600">
                    Puedes <span className="font-semibold">archivarlo</span>: quedará oculto para los estudiantes pero se conserva todo el historial y las calificaciones.
                  </p>
                </>
              ) : (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {attempts.length > 0
                    ? `Se eliminarán ${attempts.length} intento(s) sin actividad. Esta acción no se puede deshacer.`
                    : 'Esta acción no se puede deshacer.'}
                </div>
              )}
            </div>
            <div className="flex gap-3 border-t border-gray-100 p-6">
              <Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="flex-1">
                Cancelar
              </Button>
              {hasActiveAttempts ? (
                <Button variant="gold" onClick={handleArchive} loading={archiving} className="flex-1 cx-press">
                  <Archive className="w-4 h-4" />
                  {archiving ? 'Archivando…' : 'Archivar ejercicio'}
                </Button>
              ) : (
                <Button variant="danger" onClick={handleDelete} loading={deleting} className="flex-1 cx-press">
                  <Trash2 className="w-4 h-4" />
                  {deleting ? 'Eliminando…' : 'Eliminar'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/profesor/ejercicios" className="flex items-center gap-1 transition-colors hover:text-gray-700">
          <ArrowLeft className="w-3.5 h-3.5" /> Ejercicios
        </Link>
        <span className="text-gray-300">/</span>
        <span className="max-w-xs truncate font-medium text-gray-700">{exercise.title}</span>
      </div>

      {/* Cabecera del ejercicio — banda azul noche */}
      <div className="relative mb-6 overflow-hidden rounded-card shadow-soft lp-in bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
        <div aria-hidden className="pointer-events-none absolute right-6 bottom-4 hidden opacity-95 xl:block">
          <ArtReport size={150} className="cx-float" />
        </div>
        <div className="relative flex flex-wrap items-start justify-between gap-5 p-6 lg:p-8">
          <div className="min-w-0 flex-1 xl:max-w-2xl">
            <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-gold-500">
              Ejercicio
            </p>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <DifficultyBadge difficulty={exercise.difficulty} />
              <Badge variant="slate">{TYPE_LABELS[exercise.type] ?? exercise.type}</Badge>
              {exercise.isPublished
                ? <span className="flex items-center gap-1 text-sm font-semibold text-emerald-300"><Globe className="w-4 h-4" />Publicado</span>
                : <span className="flex items-center gap-1 text-sm font-semibold text-gold-500"><Lock className="w-4 h-4" />Borrador</span>}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white lg:text-3xl">{exercise.title}</h1>
            {exercise.description && <p className="mt-1.5 max-w-prose text-sm text-blue-200/80">{exercise.description}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-blue-100">
              <span className="flex items-center gap-1.5 tabular-nums">
                <Award className="w-4 h-4 text-blue-300" />
                Puntaje máximo: <span className="font-semibold text-white">{exercise.maxScore} pts</span>
              </span>
              {exercise.dueDate && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-300" />
                  Vence: <span className="font-semibold text-white">{formatDate(exercise.dueDate)}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)} className="cx-press">
              <Trash2 className="w-4 h-4" />
              Eliminar
            </Button>
            <Link href={`/profesor/ejercicios/${id}/config?cursoId=${courseId}`}>
              <Button variant="secondary" size="sm" className="cx-press">
                <Settings className="w-4 h-4" />
                {exercise.isPublished ? 'Ver configuración' : 'Configurar'}
              </Button>
            </Link>
            <Link href={`/profesor/ejercicios/${id}/companies-dashboard?cursoId=${courseId}`}>
              <Button variant="secondary" size="sm" className="cx-press">
                <BarChart2 className="w-4 h-4" />
                Panel de empresas
              </Button>
            </Link>
            <Button variant="secondary" size="sm" onClick={handlePreview} loading={previewing} className="cx-press">
              <Eye className="w-4 h-4" />
              Probar como estudiante
            </Button>
            {exercise.isPublished && (
              <Link href={`/profesor/ejercicios/${id}/live?cursoId=${courseId}`}>
                <Button variant="secondary" size="sm" className="cx-press">
                  <Radio className="w-4 h-4" />
                  Panel en vivo
                </Button>
              </Link>
            )}
            {!exercise.isPublished && (
              <Button variant="gold" size="sm" onClick={handlePublish} loading={publishing} className="cx-press">
                <Send className="w-4 h-4" />
                Publicar ejercicio
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Material del caso (Spec UTN §1) */}
      <SectionCard
        icon={Paperclip}
        iconTint="#2563EB"
        eyebrow="Enunciado"
        title="Material del caso"
        description="Adjunta el enunciado y documentos de apoyo (PDF, Word, Excel, imágenes). El estudiante los verá dentro del ejercicio."
        className="mb-6 cx-pop"
      >
        <ExerciseAttachments courseId={courseId} exerciseId={id} editable />
      </SectionCard>

      {/* Rúbricas */}
      {exercise.rubrics && exercise.rubrics.length > 0 && (
        <SectionCard
          icon={ClipboardCheck}
          iconTint="#B8860B"
          eyebrow="Auto-calificación"
          title="Rúbricas de evaluación"
          description="Criterios con los que se mide el trabajo del estudiante."
          className="mb-6 cx-pop"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {exercise.rubrics.map((r) => (
              <div key={r.id} className="flex items-start gap-2.5 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <CheckCircle2 className="mt-0.5 w-4 h-4 flex-shrink-0 text-emerald-500" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-700">{r.description}</p>
                  <p className="mt-0.5 text-xs text-gray-500 tabular-nums">
                    {r.points} pts{r.expectedValue ? ` · mín. ${r.expectedValue}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* KPIs de estado */}
      {exercise.isPublished && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Sin iniciar" value={String(stats.notStarted)} icon={Hourglass} tint="#94A3B8" className="cx-pop cx-d1" />
          <StatCard label="En progreso" value={String(stats.inProgress)} icon={Clock} tint="#2563EB" className="cx-pop cx-d2" />
          <StatCard label="Pendientes" value={String(stats.submitted)} icon={ClipboardCheck} tint="#B8860B" className="cx-pop cx-d3" />
          <StatCard label="Calificados" value={String(stats.graded)} icon={CheckCircle2} tint="#059669" className="cx-pop cx-d4" />
        </div>
      )}

      {/* ── Estadísticas del grupo ─────────────────────────────────────────── */}
      {exercise.isPublished && attempts.length > 0 && (() => {
        const graded = attempts.filter((a) => a.status === 'GRADED' && a.score != null);
        const avgScore = graded.length
          ? graded.reduce((s, a) => s + Number(a.score), 0) / graded.length
          : null;
        const maxScore = Number(exercise.maxScore);
        const avgPct   = avgScore != null && maxScore > 0 ? (avgScore / maxScore) * 100 : null;

        // Distribución de progreso
        const buckets = [
          { label: '0–24%',   color: 'bg-gray-300',    min: 0,   max: 24  },
          { label: '25–49%',  color: 'bg-gold-500',    min: 25,  max: 49  },
          { label: '50–74%',  color: 'bg-blue-600',    min: 50,  max: 74  },
          { label: '75–99%',  color: 'bg-csq-mid',     min: 75,  max: 99  },
          { label: '100%',    color: 'bg-emerald-500', min: 100, max: 100 },
        ].map((b) => ({
          ...b,
          count: attempts.filter((a) => {
            const pct = Number(a.studentProgress?.progressPct ?? 0);
            return b.max === 100 ? pct >= 100 : pct >= b.min && pct <= b.max;
          }).length,
        }));
        const maxBucket = Math.max(...buckets.map((b) => b.count), 1);

        // Top 5 por progreso
        const top = [...attempts]
          .sort((a, b) => Number(b.studentProgress?.progressPct ?? 0) - Number(a.studentProgress?.progressPct ?? 0))
          .slice(0, 5);

        const pendingCount = attempts.filter((a) => a.status === 'SUBMITTED').length;

        return (
          <SectionCard
            icon={BarChart2}
            iconTint="#2563EB"
            eyebrow="Panorama"
            title="Estadísticas del grupo"
            className="mb-6 cx-pop"
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

              {/* Puntaje promedio */}
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Puntaje promedio</p>
                {avgScore != null ? (
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-extrabold text-emerald-600 tabular-nums cx-count">{avgScore.toFixed(1)}</span>
                    <span className="pb-1 text-gray-400 tabular-nums">/ {maxScore} pts</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Sin calificados aún</p>
                )}
                {avgPct != null && (
                  <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, avgPct)}%` }} />
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500 tabular-nums">
                  <span>{graded.length} calificado{graded.length !== 1 ? 's' : ''}</span>
                  <span>{pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {/* Distribución de progreso */}
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Distribución de progreso</p>
                <div className="space-y-1.5">
                  {buckets.map((b) => (
                    <div key={b.label} className="flex items-center gap-2">
                      <span className="w-14 flex-shrink-0 text-xs text-gray-500 tabular-nums">{b.label}</span>
                      <div className="h-4 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`flex h-4 items-center justify-end rounded-full pr-1 transition-all duration-500 ${b.color}`}
                          style={{ width: `${(b.count / maxBucket) * 100}%` }}
                        >
                          {b.count > 0 && <span className="text-[10px] font-bold text-white tabular-nums">{b.count}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Líderes de progreso */}
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Líderes de progreso</p>
                <div className="space-y-2">
                  {top.map((a, i) => {
                    const pct = Number(a.studentProgress?.progressPct ?? 0);
                    return (
                      <div key={a.id} className="flex items-center gap-2">
                        <span className={`w-5 text-center text-xs font-extrabold tabular-nums ${i === 0 ? 'text-gold-600' : i === 1 ? 'text-gray-400' : 'text-gold-800'}`}>
                          {i + 1}
                        </span>
                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-xs font-bold text-blue-700">
                          {a.student?.name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-gray-700">{a.student?.name ?? '—'}</p>
                        </div>
                        <span className={`text-xs font-bold tabular-nums ${pct >= 75 ? 'text-emerald-600' : pct >= 50 ? 'text-blue-700' : 'text-gray-500'}`}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </SectionCard>
        );
      })()}

      {/* Errores frecuentes */}
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
          <SectionCard
            icon={AlertTriangle}
            iconTint="#DC2626"
            eyebrow="Diagnóstico"
            title="Errores frecuentes"
            description="Criterios que más estudiantes no están cumpliendo."
            className="mb-6 cx-pop cx-d2"
          >
            <div className="space-y-3">
              {rubricStats.map((r) => (
                <div key={r.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{r.description}</span>
                    <span className={`text-xs font-semibold tabular-nums ${r.failCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {r.failCount} de {total} estudiante{total !== 1 ? 's' : ''} no cumplieron
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${r.failPct > 50 ? 'bg-red-500' : r.failPct > 25 ? 'bg-gold-500' : 'bg-emerald-500'}`}
                      style={{ width: `${r.failPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        );
      })()}

      {/* Tabla de intentos */}
      {exercise.isPublished && (
        <SectionCard
          icon={Users}
          iconTint="#1B2E6E"
          eyebrow={`${attempts.length} en total`}
          title="Intentos de estudiantes"
          flushBody
          className="cx-pop cx-d3"
        >
          {attempts.length === 0 ? (
            <EmptyState
              illustration={<SceneEmptyBox size={190} className="cx-float" />}
              title="Aún no hay intentos"
              description="Cuando tus estudiantes abran el ejercicio, verás su avance aquí."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-gray-500">
                    <th className="p-4 text-left">Estudiante</th>
                    <th className="p-4 text-left">Estado</th>
                    <th className="p-4 text-left">Progreso</th>
                    <th className="p-4 text-right">Facturas</th>
                    <th className="p-4 text-right">Asientos</th>
                    <th className="p-4 text-right">Tiempo</th>
                    <th className="p-4 text-right">Puntaje</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {attempts.map((attempt) => {
                    const prog   = attempt.studentProgress;
                    const pct    = Number(prog?.progressPct ?? 0);
                    const canGrade = attempt.status !== 'NOT_STARTED' && attempt.status !== 'GRADED';
                    return (
                      <tr key={attempt.id} className="transition-colors hover:bg-blue-50/50">
                        <td className="p-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-xs font-bold text-blue-700">
                              {attempt.student?.name?.charAt(0)?.toUpperCase() ?? '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-gray-800">{attempt.student?.name ?? '—'}</p>
                              <p className="truncate text-xs text-gray-400">{attempt.student?.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4"><StatusBadge status={attempt.status} /></td>
                        <td className="min-w-[120px] p-4">
                          <div className="flex items-center gap-2">
                            <ProgressBar pct={pct} />
                            <span className="flex-shrink-0 text-xs text-gray-500 tabular-nums">{pct}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-right text-gray-500 tabular-nums">{prog?.invoicesCount ?? 0}</td>
                        <td className="p-4 text-right text-gray-500 tabular-nums">{prog?.entriesCount ?? 0}</td>
                        <td className="p-4 text-right text-gray-500 tabular-nums">
                          {prog?.timeSpentMin ? `${prog.timeSpentMin} min` : '—'}
                        </td>
                        <td className="p-4 text-right">
                          {attempt.score != null
                            ? <span className="font-bold text-emerald-600 tabular-nums">{attempt.score}/{attempt.maxScore}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="p-4 text-right">
                          {canGrade ? (
                            <Link href={`/profesor/ejercicios/${id}/calificar/${attempt.id}?cursoId=${courseId}`}>
                              <Button size="sm" className="cx-press">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Calificar
                              </Button>
                            </Link>
                          ) : attempt.status === 'GRADED' ? (
                            <Link href={`/profesor/ejercicios/${id}/calificar/${attempt.id}?cursoId=${courseId}`}>
                              <Button size="sm" variant="secondary" className="cx-press">
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
        </SectionCard>
      )}
    </div>
  );
}
