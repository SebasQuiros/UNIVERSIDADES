'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatDate, getErrorMessage } from '@/lib/utils';
import { StatusBadge, DifficultyBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { ExerciseAttempt } from '@/types';
import toast from 'react-hot-toast';
import {
  BookOpen, Clock, CheckCircle2, TrendingUp, Calendar,
  Building2, Play, ChevronRight, AlertCircle, RefreshCw, Users,
} from 'lucide-react';

// Tipo mínimo de Company devuelto por GET /companies (Fase 1: incluye GROUP)
interface CompanyLite {
  id: string;
  name: string;
  mode: 'INDIVIDUAL' | 'GROUP';
  legalId: string;
  isCompanyEnabled: boolean;
  exercise?: { id: string; title: string } | null;
  attempt?: { id: string; status: string; exercise?: { id: string; title: string } } | null;
}

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

// ── Helper: exercise type label ───────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  FULL_CYCLE:     'Ciclo Completo',
  JOURNAL_ONLY:   'Diario',
  INVOICING_ONLY: 'Facturación',
  INVENTORY_ONLY: 'Inventario',
};

// ── ProgressBar ───────────────────────────────────────────────────────────
function ProgressBar({ pct }: { pct: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(Math.min(100, pct)), 100);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <div className="w-full rounded-full h-2" style={{ background: 'rgba(59,130,246,0.12)' }}>
      <div
        className="h-2 rounded-full transition-all duration-700 ease-out"
        style={{
          width: `${width}%`,
          background: 'linear-gradient(90deg,#3B82F6,#60A5FA)',
          boxShadow: width > 0 ? '0 0 8px rgba(59,130,246,0.5)' : 'none',
        }}
      />
    </div>
  );
}

// ── Stats Card ────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, gradient, glow }: {
  label: string; value: number; icon: React.ElementType;
  gradient: string; glow: string;
}) {
  const animated = useCountUp(value);
  return (
    <div className="relative rounded-2xl p-5 overflow-hidden flex items-center gap-4 transition-transform duration-200 hover:-translate-y-0.5"
      style={{ background: gradient, boxShadow: `0 4px 20px ${glow}` }}>
      <div className="absolute inset-0 opacity-10"
        style={{ background: 'radial-gradient(circle at top right, white 0%, transparent 60%)' }} />
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/20 backdrop-blur-sm">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="relative">
        <p className="text-3xl font-black text-white leading-none">{animated}</p>
        <p className="text-xs text-white/80 mt-1 font-medium">{label}</p>
      </div>
    </div>
  );
}

// ── Attempt Card ──────────────────────────────────────────────────────────
function AttemptCard({ attempt, onStart }: { attempt: ExerciseAttempt; onStart: () => void }) {
  const router   = useRouter();
  const exercise = attempt.exercise;
  const progress = attempt.studentProgress;

  if (!exercise) return null;
  const pct      = Number(progress?.progressPct ?? 0);
  const score    = attempt.score ? Number(attempt.score) : null;
  const maxScore = Number(attempt.maxScore);

  function handleAction() {
    if (attempt.status === 'NOT_STARTED') {
      onStart();
    } else {
      router.push(`/estudiante/ejercicio/${attempt.id}`);
    }
  }

  return (
    <div className="group bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-blue-200"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <DifficultyBadge difficulty={exercise.difficulty} />
            <Badge variant="slate">{TYPE_LABELS[exercise.type] ?? exercise.type}</Badge>
          </div>
          <h3 className="font-semibold text-gray-900 leading-snug">
            {exercise.title}
          </h3>
          {exercise.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{exercise.description}</p>
          )}
        </div>
        <StatusBadge status={attempt.status} />
      </div>

      {/* Course info */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5" />
          {exercise.course?.name}
        </span>
        {exercise.course?.period && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {exercise.course.period}
          </span>
        )}
        {exercise.dueDate && (
          <span className={`flex items-center gap-1 ${
            new Date(exercise.dueDate) < new Date() && attempt.status !== 'GRADED'
              ? 'text-red-600'
              : ''
          }`}>
            <Clock className="w-3.5 h-3.5" />
            Vence: {formatDate(exercise.dueDate)}
          </span>
        )}
      </div>

      {/* Progress bar (if in progress) */}
      {(attempt.status === 'IN_PROGRESS' || attempt.status === 'SUBMITTED') && (
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-gray-500">Progreso</span>
            <span className="text-gray-700 font-medium">{pct}%</span>
          </div>
          <ProgressBar pct={pct} />
          {progress && (
            <div className="flex gap-3 mt-2 text-xs text-gray-400">
              <span>{progress.clientsCount} clientes</span>
              <span>{progress.invoicesCount} facturas</span>
              <span>{progress.entriesCount} asientos</span>
              {progress.timeSpentMin > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {progress.timeSpentMin}min
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Company info */}
      {attempt.company && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">
          <Building2 className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-600">{attempt.company.name}</span>
        </div>
      )}

      {/* Grade (if graded) */}
      {attempt.status === 'GRADED' && score !== null && (
        <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">
              {score} / {maxScore} puntos
            </span>
          </div>
          <span className="text-lg font-bold text-emerald-700">
            {maxScore > 0 ? Math.round((score / maxScore) * 100) : 0}%
          </span>
        </div>
      )}

      {/* Action button */}
      <Button
        onClick={handleAction}
        variant={attempt.status === 'NOT_STARTED' ? 'primary' : 'secondary'}
        size="sm"
        className="w-full mt-auto"
      >
        {attempt.status === 'NOT_STARTED' && (
          <><Play className="w-3.5 h-3.5" /> Iniciar ejercicio</>
        )}
        {attempt.status === 'IN_PROGRESS' && (
          <><ChevronRight className="w-3.5 h-3.5" /> Continuar</>
        )}
        {attempt.status === 'SUBMITTED' && (
          <><TrendingUp className="w-3.5 h-3.5" /> Ver estado</>
        )}
        {attempt.status === 'GRADED' && (
          <><CheckCircle2 className="w-3.5 h-3.5" /> Ver resultado</>
        )}
      </Button>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────
export default function EstudianteDashboard() {
  const { user } = useAuth();
  const [attempts,  setAttempts]  = useState<ExerciseAttempt[]>([]);
  const [companies, setCompanies] = useState<CompanyLite[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [starting,  setStarting]  = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Cargamos en paralelo: attempts (INDIVIDUAL) + companies (incluye GROUP).
      const [aRes, cRes] = await Promise.all([
        api.get<ExerciseAttempt[]>('/api/v1/attempts'),
        api.get<CompanyLite[]>('/api/v1/companies'),
      ]);
      setAttempts(aRes.data);
      setCompanies(cRes.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleStart(attemptId: string) {
    setStarting(attemptId);
    try {
      await api.post(`/api/v1/attempts/${attemptId}/start`);
      toast.success('¡Ejercicio iniciado!');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setStarting(null);
    }
  }

  // Stats
  const stats = {
    total:      attempts.length,
    inProgress: attempts.filter((a) => a.status === 'IN_PROGRESS').length,
    graded:     attempts.filter((a) => a.status === 'GRADED').length,
  };

  // Filter groups
  const active  = attempts.filter((a) => a.status === 'NOT_STARTED' || a.status === 'IN_PROGRESS');
  const done    = attempts.filter((a) => a.status === 'SUBMITTED' || a.status === 'GRADED');

  const firstName = user?.name?.split(' ')[0] ?? 'Estudiante';

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto" style={{ background: 'linear-gradient(180deg,#EFF6FF 0%,#F8FAFC 40%,#FFFFFF 100%)' }}>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Buenos días, {firstName} 👋
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Aquí están tus ejercicios asignados
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label="Ejercicios totales" value={stats.total}      icon={BookOpen}     gradient="linear-gradient(135deg,#3B82F6,#1E40AF)" glow="rgba(59,130,246,0.25)" />
        <StatCard label="En progreso"        value={stats.inProgress} icon={TrendingUp}   gradient="linear-gradient(135deg,#F59E0B,#D97706)" glow="rgba(245,158,11,0.25)" />
        <StatCard label="Calificados"        value={stats.graded}     icon={CheckCircle2} gradient="linear-gradient(135deg,#10B981,#059669)" glow="rgba(16,185,129,0.25)" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : attempts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-gray-700 font-semibold">Sin ejercicios asignados</h3>
          <p className="text-gray-500 text-sm mt-1">
            Tu profesor aún no ha publicado ejercicios
          </p>
        </div>
      ) : (
        <>
          {/* Empresas grupales — solo si el estudiante es miembro de alguna */}
          {companies.filter(c => c.mode === 'GROUP').length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  Mis empresas grupales
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white bg-blue-600">
                  {companies.filter(c => c.mode === 'GROUP').length}
                </span>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {companies.filter(c => c.mode === 'GROUP').map(c => (
                  <div
                    key={c.id}
                    className={`flex items-center gap-3 p-4 rounded-xl border ${
                      c.isCompanyEnabled
                        ? 'border-gray-200 bg-white hover:border-blue-300'
                        : 'border-amber-300 bg-amber-50'
                    } transition-colors`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{c.name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {c.exercise?.title ?? 'Empresa grupal'}
                        {!c.isCompanyEnabled && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-amber-800 bg-amber-200">
                            deshabilitada por el profe
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Por ahora solo informativa: el flujo grupal completo se
                        habilita en la siguiente fase (entonces este botón irá
                        a /estudiante/empresa/[companyId]). */}
                    <span className="text-xs text-gray-400">Próximamente</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Active exercises */}
          {active.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  Pendientes
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ background: 'linear-gradient(90deg,#3B82F6,#6366F1)', boxShadow: '0 2px 8px rgba(59,130,246,0.4)' }}>
                  {active.length}
                </span>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {active.map((attempt) => (
                  <AttemptCard
                    key={attempt.id}
                    attempt={attempt}
                    onStart={() => handleStart(attempt.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Completed / graded */}
          {done.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  Completados
                </h3>
                <span className="bg-gray-100 text-gray-600 border border-gray-200 text-xs font-bold px-2 py-0.5 rounded-full">
                  {done.length}
                </span>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {done.map((attempt) => (
                  <AttemptCard
                    key={attempt.id}
                    attempt={attempt}
                    onStart={() => {}}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
