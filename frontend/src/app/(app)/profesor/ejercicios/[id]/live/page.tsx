'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconTile } from '@/components/ui/IconTile';
import { SceneSearchEmpty } from '@/components/illustrations';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Radio, Users, CheckCircle2, Send,
  Wifi, WifiOff, AlertTriangle, RefreshCw, MessageSquare, X,
  TrendingUp, FileText, BarChart2, Eye,
} from 'lucide-react';
import { ExamActivityLog } from '@/components/exam';

// ── Types ──────────────────────────────────────────────────────────────────────
interface StudentRow {
  attemptId:      string;
  studentId:      string;
  studentName:    string;
  studentEmail:   string;
  status:         'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
  onlineStatus:   'ACTIVE' | 'IDLE' | 'OFFLINE' | 'NOT_STARTED' | 'SUBMITTED' | 'GRADED';
  lastPingAt:     string | null;
  startedAt:      string | null;
  submittedAt:    string | null;
  score:          number | null;
  progressPct:    number;
  invoicesCount:  number;
  entriesCount:   number;
  clientsCount:   number;
  productsCount:  number;
  timeSpentMin:   number;
  lastActivity:   string | null;
  tabSwitchCount: number;
}

interface Summary {
  total:      number;
  notStarted: number;
  inProgress: number;
  submitted:  number;
  graded:     number;
  active:     number;
}

interface LiveData {
  exerciseId:    string;
  exerciseTitle: string;
  courseName:    string;
  maxScore:      number;
  dueDate:       string | null;
  summary:       Summary;
  students:      StudentRow[];
}

// ── Config de estado en línea ──────────────────────────────────────────────────
const ONLINE_CONFIG: Record<StudentRow['onlineStatus'], { label: string; dot: string; card: string; text: string }> = {
  ACTIVE:      { label: 'Activo',       dot: 'bg-emerald-500', card: 'border-emerald-200 bg-emerald-50/70', text: 'text-emerald-700' },
  IDLE:        { label: 'Inactivo',     dot: 'bg-gold-500',    card: 'border-gold-100 bg-gold-50/70',       text: 'text-gold-900' },
  OFFLINE:     { label: 'Desconectado', dot: 'bg-gray-400',    card: 'border-gray-200 bg-gray-50',          text: 'text-gray-500' },
  NOT_STARTED: { label: 'Sin iniciar',  dot: 'bg-gray-300',    card: 'border-gray-200 bg-white',            text: 'text-gray-400' },
  SUBMITTED:   { label: 'Entregado',    dot: 'bg-blue-600',    card: 'border-blue-200 bg-blue-50/70',       text: 'text-blue-700' },
  GRADED:      { label: 'Calificado',   dot: 'bg-csq-mid',     card: 'border-blue-200 bg-blue-50',          text: 'text-csq-mid' },
};

function progressTone(pct: number) {
  if (pct >= 75) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-blue-600';
  if (pct >= 25) return 'bg-gold-500';
  return 'bg-gray-300';
}

// ── Componente ─────────────────────────────────────────────────────────────────
export default function LiveDashboardPage() {
  const { id }       = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const courseId     = searchParams.get('cursoId') ?? '';

  const [data,         setData]         = useState<LiveData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [lastUpdate,   setLastUpdate]   = useState<Date | null>(null);
  const [pollActive,   setPollActive]   = useState(true);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [message,      setMessage]      = useState('');
  const [sending,      setSending]      = useState(false);
  const [viewMode,     setViewMode]     = useState<'grid' | 'table'>('grid');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (!courseId) return;
    try {
      const res = await api.get<LiveData>(`/api/v1/courses/${courseId}/exercises/${id}/live`);
      setData(res.data);
      setLastUpdate(new Date());
    } catch {
      if (loading) toast.error('Error al cargar panel en vivo');
    } finally {
      setLoading(false);
    }
  }, [id, courseId, loading]);

  // Carga inicial
  useEffect(() => { fetchData(); }, []);  // eslint-disable-line

  // Polling cada 5s
  useEffect(() => {
    if (!pollActive) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(fetchData, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [pollActive, fetchData]);

  async function handleBroadcast() {
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await api.post<{ sent: number }>(`/api/v1/courses/${courseId}/exercises/${id}/broadcast`, { message: message.trim() });
      toast.success(`Mensaje enviado a ${res.data.sent} estudiante(s)`);
      setMessage('');
      setShowBroadcast(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="flex-1 flex items-center justify-center bg-[#F4F6F8]"><Spinner size="lg" /></div>;
  if (!data) return null;

  const filteredStudents = filterStatus === 'ALL'
    ? data.students
    : data.students.filter(s => s.onlineStatus === filterStatus);

  const avgProgress = data.students.length
    ? Math.round(data.students.reduce((s, st) => s + st.progressPct, 0) / data.students.length)
    : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-[#F4F6F8] p-6 lg:p-8">

      {/* Modal de mensaje masivo */}
      {showBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-csq-dark/60 backdrop-blur-sm" onClick={() => setShowBroadcast(false)} />
          <div className="relative w-full max-w-md rounded-card border border-gray-200/70 bg-white shadow-card-hover cx-pop">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 pt-5 pb-4">
              <div className="flex items-center gap-3">
                <IconTile icon={MessageSquare} tint="#2563EB" size={40} />
                <div>
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">Panel en vivo</p>
                  <h3 className="font-bold tracking-tight text-gray-900">Avisar a los estudiantes</h3>
                </div>
              </div>
              <button onClick={() => setShowBroadcast(false)} className="text-gray-400 hover:text-gray-700 cx-press" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <p className="text-sm text-gray-500">
                Este mensaje llegará como notificación a todos los estudiantes que aún no han entregado.
              </p>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Ej: Recuerden revisar que los asientos estén cuadrados antes de entregar."
                rows={4}
                className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                maxLength={500}
              />
              <p className="text-right text-xs text-gray-400 tabular-nums">{message.length}/500</p>
            </div>
            <div className="flex gap-3 border-t border-gray-100 p-6">
              <Button variant="secondary" onClick={() => setShowBroadcast(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleBroadcast} disabled={sending || !message.trim()} loading={sending} className="flex-1 cx-press">
                <Send className="w-4 h-4" />
                {sending ? 'Enviando…' : 'Enviar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-sm text-gray-500">
        <Link href={`/profesor/ejercicios/${id}?cursoId=${courseId}`} className="flex items-center gap-1 transition-colors hover:text-gray-700">
          <ArrowLeft className="w-3.5 h-3.5" /> {data.exerciseTitle}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Panel en vivo</span>
      </div>

      <PageHeader
        eyebrow="Seguimiento en tiempo real"
        title="Panel en vivo"
        subtitle={`${data.courseName} · ${data.exerciseTitle}`}
        icon={Radio}
        iconTint="#059669"
        className="mb-6"
        actions={
          <>
            {lastUpdate && (
              <span className="text-xs text-gray-400 tabular-nums">
                Actualizado {lastUpdate.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            <button
              onClick={() => setPollActive(p => !p)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors cx-press ${
                pollActive
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-gray-200 bg-gray-100 text-gray-500'
              }`}
            >
              {pollActive ? (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 cx-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              ) : (
                <WifiOff className="w-3.5 h-3.5" />
              )}
              {pollActive ? 'En vivo' : 'Pausado'}
            </button>
            <button
              onClick={fetchData}
              className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 cx-press"
              title="Actualizar ahora"
              aria-label="Actualizar el panel en vivo ahora"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Button size="sm" onClick={() => setShowBroadcast(true)} className="cx-press">
              <MessageSquare className="w-3.5 h-3.5" />
              Avisar a todos
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total" value={String(data.summary.total)} icon={Users} tint="#1B2E6E" className="cx-pop cx-d1" />
        <StatCard label="Activos ahora" value={String(data.summary.active)} icon={Wifi} tint="#059669" className="cx-pop cx-d2" />
        <StatCard label="En progreso" value={String(data.summary.inProgress)} icon={TrendingUp} tint="#2563EB" className="cx-pop cx-d3" />
        <StatCard label="Entregados" value={String(data.summary.submitted)} icon={CheckCircle2} tint="#B8860B" className="cx-pop cx-d4" />
        <StatCard label="Calificados" value={String(data.summary.graded)} icon={BarChart2} tint="#0F2657" className="cx-pop cx-d5" />
        <StatCard label="Progreso prom." value={`${avgProgress}%`} icon={FileText} tint="#3B82F6" className="cx-pop cx-d6" />
      </div>

      {/* Filtros + vista */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'ALL',        label: 'Todos',       count: data.students.length },
            { key: 'ACTIVE',     label: 'Activos',     count: data.summary.active },
            { key: 'IDLE',       label: 'Inactivos',   count: data.students.filter(s => s.onlineStatus === 'IDLE').length },
            { key: 'SUBMITTED',  label: 'Entregados',  count: data.summary.submitted },
            { key: 'GRADED',     label: 'Calificados', count: data.summary.graded },
            { key: 'NOT_STARTED',label: 'Sin iniciar', count: data.summary.notStarted },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors cx-press ${
                filterStatus === f.key
                  ? 'border-transparent bg-gradient-to-br from-blue-600 to-[#1B2E6E] text-white shadow-[0_6px_20px_rgba(27,46,110,0.28)]'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}{' '}
              <span className={`tabular-nums ${filterStatus === f.key ? 'opacity-75' : 'text-gray-400'}`}>({f.count})</span>
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white">
          {(['grid', 'table'] as const).map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors cx-press ${
                viewMode === v ? 'bg-csq-dark text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {v === 'grid' ? 'Cuadrícula' : 'Tabla'}
            </button>
          ))}
        </div>
      </div>

      {/* Cuadrícula de estudiantes */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredStudents.map((s, i) => {
            const cfg = ONLINE_CONFIG[s.onlineStatus];
            return (
              <div
                key={s.attemptId}
                className={`rounded-card border p-4 shadow-card transition-all cx-lift cx-pop cx-d${Math.min(i + 1, 6)} ${cfg.card}`}
              >
                {/* Cabecera */}
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-sm font-bold text-gray-600 shadow-sm">
                      {s.studentName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-bold text-gray-800">{s.studentName}</p>
                        {s.tabSwitchCount > 0 && (
                          <span className={`inline-flex flex-shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                            s.tabSwitchCount > 3
                              ? 'border border-gold-100 bg-gold-50 text-gold-900'
                              : 'border border-blue-200 bg-blue-50 text-blue-700'
                          }`}>
                            {s.tabSwitchCount > 3 && <AlertTriangle className="w-2.5 h-2.5" />}
                            <Eye className="w-2.5 h-2.5" />
                            {s.tabSwitchCount}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-gray-400">{s.studentEmail}</p>
                    </div>
                  </div>
                  <span className={`ml-2 flex flex-shrink-0 items-center gap-1 text-xs font-semibold ${cfg.text}`}>
                    {s.onlineStatus === 'ACTIVE' ? (
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 cx-ping" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                    ) : (
                      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${cfg.dot}`} />
                    )}
                    {cfg.label}
                  </span>
                </div>

                {/* Progreso */}
                <div className="mb-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                    <span>Progreso</span>
                    <span className="font-semibold tabular-nums">{s.progressPct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full border border-gray-200 bg-white/70">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${progressTone(s.progressPct)}`}
                      style={{ width: `${Math.min(100, s.progressPct)}%` }}
                    />
                  </div>
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[
                    { label: 'Facturas',  value: s.invoicesCount },
                    { label: 'Asientos',  value: s.entriesCount },
                    { label: 'Clientes',  value: s.clientsCount },
                    { label: 'Tiempo',    value: s.timeSpentMin ? `${s.timeSpentMin}m` : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg border border-white/80 bg-white/70 p-1.5 text-center">
                      <p className="font-bold text-gray-700 tabular-nums">{value}</p>
                      <p className="text-gray-400">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Puntaje si está calificado */}
                {s.status === 'GRADED' && s.score != null && (
                  <div className="mt-3 flex items-center justify-between border-t border-white/60 pt-3">
                    <span className="text-xs text-gray-500">Puntaje final</span>
                    <span className="text-sm font-extrabold text-csq-mid tabular-nums">{s.score}/{data.maxScore}</span>
                  </div>
                )}

                {/* Registro de actividad */}
                {s.tabSwitchCount > 0 && (
                  <div className="mt-3">
                    <ExamActivityLog attemptId={s.attemptId} defaultExpanded={false} />
                  </div>
                )}

                {/* Acciones */}
                {(s.status === 'SUBMITTED' || s.status === 'IN_PROGRESS') && (
                  <div className="mt-3 border-t border-white/60 pt-3">
                    <Link href={`/profesor/ejercicios/${id}/calificar/${s.attemptId}?cursoId=${courseId}`}>
                      <Button size="sm" variant={s.status === 'SUBMITTED' ? 'primary' : 'secondary'} className="w-full cx-press">
                        {s.status === 'SUBMITTED' ? 'Calificar' : 'Ver intento'}
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
          {filteredStudents.length === 0 && (
            <div className="col-span-full rounded-card border border-gray-200/70 bg-white shadow-card">
              <EmptyState
                illustration={<SceneSearchEmpty size={190} className="cx-float" />}
                title="No hay estudiantes con este estado"
                description="Cambia el filtro para ver a los demás estudiantes."
              />
            </div>
          )}
        </div>
      ) : (
        /* Vista de tabla */
        <SectionCard icon={Users} iconTint="#1B2E6E" eyebrow="Detalle" title="Estudiantes" flushBody className="cx-pop">
          {filteredStudents.length === 0 ? (
            <EmptyState
              illustration={<SceneSearchEmpty size={190} className="cx-float" />}
              title="No hay estudiantes con este estado"
              description="Cambia el filtro para ver a los demás estudiantes."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-gray-500">
                    <th className="p-4 text-left">Estudiante</th>
                    <th className="p-4 text-left">Estado</th>
                    <th className="p-4 text-right">Progreso</th>
                    <th className="p-4 text-right">Facturas</th>
                    <th className="p-4 text-right">Asientos</th>
                    <th className="p-4 text-right">Clientes</th>
                    <th className="p-4 text-right">Tiempo</th>
                    <th className="p-4 text-right">Pestañas</th>
                    <th className="p-4 text-right">Puntaje</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStudents.map(s => {
                    const cfg = ONLINE_CONFIG[s.onlineStatus];
                    return (
                      <tr key={s.attemptId} className="transition-colors hover:bg-blue-50/50">
                        <td className="p-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-xs font-bold text-blue-700">
                              {s.studentName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-gray-800">{s.studentName}</p>
                              <p className="truncate text-xs text-gray-400">{s.studentEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold ${cfg.card} ${cfg.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-20 rounded-full bg-gray-100">
                              <div
                                className={`h-1.5 rounded-full transition-all duration-500 ${progressTone(s.progressPct)}`}
                                style={{ width: `${Math.min(100, s.progressPct)}%` }}
                              />
                            </div>
                            <span className="w-8 text-right text-xs text-gray-500 tabular-nums">{s.progressPct}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-right text-gray-500 tabular-nums">{s.invoicesCount}</td>
                        <td className="p-4 text-right text-gray-500 tabular-nums">{s.entriesCount}</td>
                        <td className="p-4 text-right text-gray-500 tabular-nums">{s.clientsCount}</td>
                        <td className="p-4 text-right text-gray-500 tabular-nums">{s.timeSpentMin ? `${s.timeSpentMin}m` : '—'}</td>
                        <td className="p-4 text-right">
                          {s.tabSwitchCount > 0 ? (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                              s.tabSwitchCount > 3
                                ? 'bg-gold-50 text-gold-900 border border-gold-100'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}>
                              {s.tabSwitchCount > 3 && <AlertTriangle className="w-3 h-3" />}
                              {s.tabSwitchCount}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {s.score != null
                            ? <span className="font-bold text-csq-mid tabular-nums">{s.score}/{data.maxScore}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="p-4 text-right">
                          {(s.status === 'SUBMITTED' || s.status === 'IN_PROGRESS') && (
                            <Link href={`/profesor/ejercicios/${id}/calificar/${s.attemptId}?cursoId=${courseId}`}>
                              <Button size="sm" variant={s.status === 'SUBMITTED' ? 'primary' : 'ghost'} className="cx-press">
                                {s.status === 'SUBMITTED' ? 'Calificar' : 'Ver'}
                              </Button>
                            </Link>
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

      {/* Leyenda */}
      <div className="mt-6 flex flex-wrap items-center gap-4 pb-4 text-xs text-gray-400">
        <span className="font-semibold text-gray-500">Leyenda:</span>
        {(Object.keys(ONLINE_CONFIG) as StudentRow['onlineStatus'][]).map((key) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${ONLINE_CONFIG[key].dot}`} />
            {ONLINE_CONFIG[key].label}
          </span>
        ))}
        <span className="ml-4 text-gray-300">· Actualización automática cada 5 segundos</span>
      </div>
    </div>
  );
}
