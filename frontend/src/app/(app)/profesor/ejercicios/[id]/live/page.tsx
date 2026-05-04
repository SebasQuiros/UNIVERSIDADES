'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Radio, Users, CheckCircle2, Clock, Send,
  Wifi, WifiOff, Pause, AlertTriangle, RefreshCw, MessageSquare, X,
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

// ── Online status config ───────────────────────────────────────────────────────
const ONLINE_CONFIG = {
  ACTIVE:      { label: 'Activo',       dot: 'bg-emerald-500 animate-pulse', card: 'border-emerald-200 bg-emerald-50',  text: 'text-emerald-700' },
  IDLE:        { label: 'Inactivo',     dot: 'bg-amber-400',                 card: 'border-amber-200  bg-amber-50',   text: 'text-amber-700' },
  OFFLINE:     { label: 'Desconectado', dot: 'bg-gray-400',                  card: 'border-gray-200   bg-gray-50',    text: 'text-gray-500' },
  NOT_STARTED: { label: 'Sin iniciar',  dot: 'bg-gray-300',                  card: 'border-gray-200   bg-white',      text: 'text-gray-400' },
  SUBMITTED:   { label: 'Entregado',    dot: 'bg-blue-500',                  card: 'border-blue-200   bg-blue-50',    text: 'text-blue-700' },
  GRADED:      { label: 'Calificado',   dot: 'bg-purple-500',                card: 'border-purple-200 bg-purple-50',  text: 'text-purple-700' },
};

// ── Component ──────────────────────────────────────────────────────────────────
export default function LiveDashboardPage() {
  const { id }       = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const courseId     = searchParams.get('cursoId') ?? '';
  const router       = useRouter();

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
    } catch (err) {
      if (loading) toast.error('Error al cargar panel en vivo');
    } finally {
      setLoading(false);
    }
  }, [id, courseId, loading]);

  // Initial load
  useEffect(() => { fetchData(); }, []);  // eslint-disable-line

  // Polling every 5s
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

  if (loading) return <div className="flex-1 flex items-center justify-center"><Spinner size="lg" /></div>;
  if (!data) return null;

  const filteredStudents = filterStatus === 'ALL'
    ? data.students
    : data.students.filter(s => s.onlineStatus === filterStatus);

  const avgProgress = data.students.length
    ? Math.round(data.students.reduce((s, st) => s + st.progressPct, 0) / data.students.length)
    : 0;

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">

      {/* Broadcast modal */}
      {showBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowBroadcast(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                Enviar mensaje a estudiantes
              </h3>
              <button onClick={() => setShowBroadcast(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-500">
                Este mensaje llegará como notificación a todos los estudiantes que aún no han entregado.
              </p>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Ej: Recuerden revisar que los asientos estén cuadrados antes de entregar."
                rows={4}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                maxLength={500}
              />
              <p className="text-xs text-gray-400 text-right">{message.length}/500</p>
            </div>
            <div className="p-5 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowBroadcast(false)}
                className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                Cancelar
              </button>
              <button onClick={handleBroadcast} disabled={sending || !message.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 transition-colors">
                <Send className="w-4 h-4" />
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href={`/profesor/ejercicios/${id}?cursoId=${courseId}`} className="hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> {data.exerciseTitle}
        </Link>
        <span>/</span>
        <span className="text-gray-700">Panel en Vivo</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-500" />
            Panel en Vivo
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">{data.courseName} · {data.exerciseTitle}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Last update */}
          {lastUpdate && (
            <span className="text-xs text-gray-400">
              Actualizado {lastUpdate.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          {/* Poll toggle */}
          <button
            onClick={() => setPollActive(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              pollActive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-gray-100 text-gray-500 border-gray-200'
            }`}
          >
            {pollActive ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {pollActive ? 'En vivo' : 'Pausado'}
          </button>
          {/* Manual refresh */}
          <button onClick={fetchData} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          {/* Broadcast */}
          <Button size="sm" onClick={() => setShowBroadcast(true)}>
            <MessageSquare className="w-3.5 h-3.5" />
            Avisar a todos
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total',         value: data.summary.total,      icon: Users,         color: 'text-gray-700' },
          { label: 'Activos ahora', value: data.summary.active,     icon: Wifi,          color: 'text-emerald-600' },
          { label: 'En progreso',   value: data.summary.inProgress, icon: TrendingUp,    color: 'text-blue-600' },
          { label: 'Entregados',    value: data.summary.submitted,  icon: CheckCircle2,  color: 'text-amber-600' },
          { label: 'Calificados',   value: data.summary.graded,     icon: BarChart2,     color: 'text-purple-600' },
          { label: 'Progreso prom.',value: `${avgProgress}%`,       icon: FileText,      color: 'text-indigo-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-gray-200 shadow-sm rounded-xl p-3 text-center">
            <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter + view toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'ALL',        label: 'Todos',          count: data.students.length },
            { key: 'ACTIVE',     label: 'Activos',        count: data.summary.active },
            { key: 'IDLE',       label: 'Inactivos',      count: data.students.filter(s => s.onlineStatus === 'IDLE').length },
            { key: 'SUBMITTED',  label: 'Entregados',     count: data.summary.submitted },
            { key: 'GRADED',     label: 'Calificados',    count: data.summary.graded },
            { key: 'NOT_STARTED',label: 'Sin iniciar',    count: data.summary.notStarted },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${
                filterStatus === f.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f.label} <span className={filterStatus === f.key ? 'opacity-75' : 'text-gray-400'}>({f.count})</span>
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['grid', 'table'] as const).map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === v ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {v === 'grid' ? 'Cuadrícula' : 'Tabla'}
            </button>
          ))}
        </div>
      </div>

      {/* Students grid */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredStudents.map(s => {
            const cfg = ONLINE_CONFIG[s.onlineStatus];
            return (
              <div key={s.attemptId} className={`rounded-xl border p-4 transition-all ${cfg.card}`}>
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0 shadow-sm">
                      {s.studentName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800 truncate">{s.studentName}</p>
                        {s.tabSwitchCount > 0 && (
                          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                            s.tabSwitchCount > 3
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {s.tabSwitchCount > 3 && <AlertTriangle className="w-2.5 h-2.5" />}
                            <Eye className="w-2.5 h-2.5" />
                            {s.tabSwitchCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{s.studentEmail}</p>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 text-xs font-medium flex-shrink-0 ml-2 ${cfg.text}`}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Progreso</span>
                    <span className="font-medium">{s.progressPct}%</span>
                  </div>
                  <div className="w-full bg-white/70 rounded-full h-2 border border-gray-200">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        s.progressPct >= 75 ? 'bg-emerald-500' :
                        s.progressPct >= 50 ? 'bg-blue-500' :
                        s.progressPct >= 25 ? 'bg-amber-500' : 'bg-gray-400'
                      }`}
                      style={{ width: `${Math.min(100, s.progressPct)}%` }}
                    />
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[
                    { label: 'Facturas',  value: s.invoicesCount },
                    { label: 'Asientos',  value: s.entriesCount },
                    { label: 'Clientes',  value: s.clientsCount },
                    { label: 'Tiempo',    value: s.timeSpentMin ? `${s.timeSpentMin}m` : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/60 rounded-lg p-1.5 text-center border border-white/80">
                      <p className="font-semibold text-gray-700">{value}</p>
                      <p className="text-gray-400">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Score if graded */}
                {s.status === 'GRADED' && s.score != null && (
                  <div className="mt-3 pt-3 border-t border-white/50 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Puntaje final</span>
                    <span className="text-sm font-bold text-purple-700">{s.score}/{data.maxScore}</span>
                  </div>
                )}

                {/* Tab switch activity log */}
                {s.tabSwitchCount > 0 && (
                  <div className="mt-3">
                    <ExamActivityLog attemptId={s.attemptId} defaultExpanded={false} />
                  </div>
                )}

                {/* Actions */}
                {(s.status === 'SUBMITTED' || s.status === 'IN_PROGRESS') && (
                  <div className="mt-3 pt-3 border-t border-white/50">
                    <Link href={`/profesor/ejercicios/${id}/calificar/${s.attemptId}?cursoId=${courseId}`}>
                      <button className="w-full py-1.5 text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors">
                        {s.status === 'SUBMITTED' ? 'Calificar' : 'Ver intento'}
                      </button>
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
          {filteredStudents.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-400 text-sm">
              No hay estudiantes con este estado
            </div>
          )}
        </div>
      ) : (
        /* Table view */
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-200">
                  <th className="text-left p-4">Estudiante</th>
                  <th className="text-left p-4">Estado</th>
                  <th className="text-right p-4">Progreso</th>
                  <th className="text-right p-4">Facturas</th>
                  <th className="text-right p-4">Asientos</th>
                  <th className="text-right p-4">Clientes</th>
                  <th className="text-right p-4">Tiempo</th>
                  <th className="text-right p-4">Pestañas</th>
                  <th className="text-right p-4">Puntaje</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.map(s => {
                  const cfg = ONLINE_CONFIG[s.onlineStatus];
                  return (
                    <tr key={s.attemptId} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                            {s.studentName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-700">{s.studentName}</p>
                            <p className="text-xs text-gray-400">{s.studentEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border ${cfg.card} ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 bg-gray-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${
                                s.progressPct >= 75 ? 'bg-emerald-500' :
                                s.progressPct >= 50 ? 'bg-blue-500' :
                                s.progressPct >= 25 ? 'bg-amber-500' : 'bg-gray-400'
                              }`}
                              style={{ width: `${Math.min(100, s.progressPct)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{s.progressPct}%</span>
                        </div>
                      </td>
                      <td className="p-4 text-right text-gray-500">{s.invoicesCount}</td>
                      <td className="p-4 text-right text-gray-500">{s.entriesCount}</td>
                      <td className="p-4 text-right text-gray-500">{s.clientsCount}</td>
                      <td className="p-4 text-right text-gray-500">{s.timeSpentMin ? `${s.timeSpentMin}m` : '—'}</td>
                      <td className="p-4 text-right">
                        {s.tabSwitchCount > 0 ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                            s.tabSwitchCount > 3
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-50 text-blue-700'
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
                          ? <span className="font-semibold text-purple-600">{s.score}/{data.maxScore}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="p-4 text-right">
                        {(s.status === 'SUBMITTED' || s.status === 'IN_PROGRESS') && (
                          <Link href={`/profesor/ejercicios/${id}/calificar/${s.attemptId}?cursoId=${courseId}`}>
                            <button className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                              {s.status === 'SUBMITTED' ? 'Calificar' : 'Ver'}
                            </button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-gray-400 text-sm">
                      No hay estudiantes con este estado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex items-center gap-4 flex-wrap text-xs text-gray-400">
        <span className="font-medium text-gray-500">Leyenda:</span>
        {Object.entries(ONLINE_CONFIG).map(([key, cfg]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${cfg.dot.replace(' animate-pulse', '')}`} />
            {cfg.label}
          </span>
        ))}
        <span className="ml-4 text-gray-300">· Actualización automática cada 5 segundos</span>
      </div>
    </div>
  );
}
