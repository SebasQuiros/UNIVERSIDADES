'use client';

import { useState, useEffect } from 'react';
import type { ElementType } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { IconTile } from '@/components/ui/IconTile';
import { Skeleton } from '@/components/ui/Skeleton';
import { ArtGrowth, SceneEmptyBox } from '@/components/illustrations';
import toast from 'react-hot-toast';
import {
  TrendingUp, Award, Clock, Target, Star,
  Trophy, Zap, Medal, Crown, GraduationCap, Compass, Sparkles, ListChecks,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { LearningProfileCard } from '@/components/pedagogy/LearningProfileCard';

interface Stats {
  total:       number;
  graded:      number;
  submitted:   number;
  inProgress:  number;
  notStarted:  number;
  avgPct:      number;
  bestScore:   number;
  totalTimeMin: number;
  scoreHistory: Array<{
    title: string; pct: number; score: number; maxScore: number;
    date: string | null; difficulty: string;
  }>;
  difficultyData: Array<{
    name: string; total: number; graded: number; avgPct: number;
  }>;
}

interface Gamification {
  xp: number;
  level: { index: number; name: string; icon: string; min: number };
  nextLevel: { name: string; icon: string; min: number; xpRemaining: number } | null;
  levelPct: number;
  rank: number | null;
  totalStudents: number;
  completed: number;
  leaderboard: Array<{
    id: string; name: string; avatarUrl: string | null;
    xp: number; completed: number; rank: number; isMe: boolean;
  }>;
}

// Textura de puntos sutil para las bandas hero (fondo azul noche).
const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
};

function diffColor(pct: number) {
  if (pct >= 80) return '#10b981';
  if (pct >= 60) return '#f59e0b';
  return '#ef4444';
}

function rankStyle(rank: number) {
  if (rank === 1) return { bg: 'linear-gradient(135deg,#FBBF24,#B8860B)', icon: Crown,  color: '#fff' };
  if (rank === 2) return { bg: 'linear-gradient(135deg,#CBD5E1,#94A3B8)', icon: Medal,  color: '#fff' };
  if (rank === 3) return { bg: 'linear-gradient(135deg,#D4A017,#8A6608)', icon: Medal,  color: '#fff' };
  return { bg: '#F1F5F9', icon: Trophy, color: '#64748B' };
}

// Iconos de nivel (sin emojis): escalan con el índice del nivel del backend.
const LEVEL_ICONS: ElementType[] = [Sparkles, Star, Award, Medal, Trophy, Crown];
function levelIcon(index: number): ElementType {
  return LEVEL_ICONS[Math.min(Math.max(index, 0), LEVEL_ICONS.length - 1)];
}

// ─── Mentor IA ─────────────────────────────────────────────────────────────
// El mentor da retroalimentación personalizada cruzando ejercicios.
interface Mentor {
  level: 'MENTOR';
  message: string;
  suggestedFocus?: string;
}

function MentorNote() {
  const [mentor, setMentor] = useState<Mentor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Mentor>('/api/v1/pedagogy/mentor')
      .then(({ data }) => setMentor(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!mentor?.message) return null;

  return (
    <div className="relative overflow-hidden rounded-card shadow-soft mb-6 cx-pop bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
      <div className="relative flex items-start gap-4 p-6">
        <IconTile icon={GraduationCap} size={48} onDark className="cx-bounce" />
        <div className="flex-1 min-w-0">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-gold-500">
            Mentor IA
          </p>
          <p className="text-sm text-blue-100 mt-1.5 leading-relaxed whitespace-pre-wrap">
            {mentor.message}
          </p>
          {mentor.suggestedFocus && (
            <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full text-gold-100 bg-white/10 border border-white/15">
              <Compass className="w-3.5 h-3.5" /> Enfoque sugerido: {mentor.suggestedFocus}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton de carga ──────────────────────────────────────────────────────
function ProgresoSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-44 rounded-card" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-card" />)}
      </div>
      <Skeleton className="h-72 rounded-card" />
    </div>
  );
}

export default function ProgresoPage() {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [game, setGame]     = useState<Gamification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Stats>('/api/v1/attempts/stats').then(({ data }) => setStats(data)),
      api.get<Gamification>('/api/v1/attempts/gamification').then(({ data }) => setGame(data)).catch(() => {}),
    ])
      .catch(() => toast.error('Error al cargar estadísticas'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#F4F6F8]">
      <ProgresoSkeleton />
    </div>
  );

  if (!stats) return null;

  const timeHours = Math.floor(stats.totalTimeMin / 60);
  const timeMins  = stats.totalTimeMin % 60;
  const timeStr   = timeHours > 0 ? `${timeHours}h ${timeMins}m` : `${timeMins}m`;

  const letterGrade = (pct: number) => {
    if (pct >= 90) return 'A';
    if (pct >= 80) return 'B';
    if (pct >= 70) return 'C';
    if (pct >= 60) return 'D';
    return 'F';
  };

  const LevelIcon = game ? levelIcon(game.level.index) : Sparkles;

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#F4F6F8]">

      {/* Cabecera */}
      <PageHeader
        eyebrow="Seguimiento académico"
        title="Mi progreso"
        subtitle="Tu evolución ejercicio a ejercicio: notas, tiempo dedicado y competencias en construcción."
        icon={TrendingUp}
        className="mb-6"
      />

      {/* ── Gamificación: nivel + ranking ── */}
      {game && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {/* Tarjeta de nivel (XP) */}
          <div className="lg:col-span-2 relative overflow-hidden rounded-card shadow-soft cx-pop bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
            <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
            <div aria-hidden className="pointer-events-none absolute -right-2 bottom-0 hidden sm:block opacity-90">
              <ArtGrowth size={150} className="cx-float" />
            </div>
            <div className="relative p-6">
              <div className="flex items-center gap-4">
                <IconTile icon={LevelIcon} size={60} onDark className="cx-bounce" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[0.68rem] font-bold uppercase tracking-[0.13em] px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-100 border border-gold-500/30">
                      Nivel {game.level.index + 1}
                    </span>
                    <h3 className="text-xl font-extrabold text-white tracking-tight">{game.level.name}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 text-sm text-blue-200/80">
                    <Zap className="w-4 h-4 text-gold-500" />
                    <span className="font-bold text-white font-mono tabular-nums cx-count">
                      {game.xp.toLocaleString('es-CR')}
                    </span>
                    XP acumulado
                  </div>
                </div>
              </div>

              {/* Barra de progreso al siguiente nivel */}
              <div className="relative mt-6 max-w-xl">
                <div className="flex justify-between text-xs mb-1.5 text-blue-200/80">
                  <span className="flex items-center gap-1.5">
                    {game.nextLevel
                      ? `Progreso hacia ${game.nextLevel.name}`
                      : <><Crown className="w-3.5 h-3.5 text-gold-500" /> ¡Nivel máximo alcanzado!</>}
                  </span>
                  {game.nextLevel && (
                    <span className="font-mono tabular-nums">
                      Faltan {game.nextLevel.xpRemaining.toLocaleString('es-CR')} XP
                    </span>
                  )}
                </div>
                <div className="h-2.5 rounded-full overflow-hidden bg-white/15">
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-out"
                    style={{ width: `${game.levelPct}%`, background: 'linear-gradient(90deg,#B8860B,#FBBF24,#FDE68A)' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tarjeta de ranking */}
          <div className="rounded-card p-6 bg-white border border-gray-200/70 shadow-card hover:shadow-card-hover flex flex-col items-center justify-center text-center cx-lift cx-pop cx-d2 cx-hop-parent">
            <div className="mb-3 cx-hop">
              <IconTile icon={Trophy} tint="#B8860B" size={56} />
            </div>
            <p className="text-4xl font-extrabold text-gray-900 leading-none font-mono tabular-nums cx-count">
              {game.rank ? `#${game.rank}` : '—'}
            </p>
            <p className="text-sm text-gray-500 mt-1.5">
              de {game.totalStudents} estudiante{game.totalStudents !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-gray-400 mt-2">Ranking de tu universidad</p>
          </div>
        </div>
      )}

      {/* ── Tabla de líderes ── */}
      {game && game.leaderboard.length > 1 && (
        <SectionCard
          eyebrow="Comunidad"
          title="Tabla de líderes"
          icon={Trophy}
          iconTint="#B8860B"
          className="mb-8"
          flushBody
          action={
            <span className="text-xs text-gray-400 font-mono">
              Top {Math.min(10, game.leaderboard.length)}
            </span>
          }
        >
          <div className="divide-y divide-gray-100">
            {game.leaderboard.map((r, i) => {
              const rs = rankStyle(r.rank);
              const RankIcon = rs.icon;
              return (
                <div
                  key={r.id}
                  className={cn(
                    'flex items-center gap-3 px-6 lg:px-7 py-3 transition-colors cx-pop',
                    i < 6 ? `cx-d${i + 1}` : undefined,
                    r.isMe ? 'bg-blue-50/70' : 'hover:bg-gray-50',
                  )}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm font-mono tabular-nums"
                    style={{ background: rs.bg, color: rs.color }}
                  >
                    {r.rank <= 3 ? <RankIcon className="w-4 h-4" /> : r.rank}
                  </div>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 overflow-hidden"
                    style={{ background: '#1B2E6E' }}
                  >
                    {r.avatarUrl
                      ? <img src={r.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                      : r.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {r.name}{r.isMe && <span className="text-blue-700 font-bold"> (tú)</span>}
                    </p>
                    <p className="text-xs text-gray-400">
                      {r.completed} ejercicio{r.completed !== 1 ? 's' : ''} calificado{r.completed !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Zap className="w-3.5 h-3.5 text-gold-600" />
                    <span className="text-sm font-bold text-gray-900 font-mono tabular-nums">
                      {r.xp.toLocaleString('es-CR')}
                    </span>
                    <span className="text-xs text-gray-400">XP</span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Resumen de rendimiento */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Nota promedio"
          value={stats.avgPct > 0 ? `${stats.avgPct}%` : '—'}
          hint={stats.avgPct > 0 ? `Letra ${letterGrade(stats.avgPct)}` : undefined}
          icon={Target}
          tint="#2563EB"
          className="cx-pop cx-d1"
        />
        <StatCard
          label="Mejor nota"
          value={stats.bestScore > 0 ? `${stats.bestScore}%` : '—'}
          icon={Star}
          tint="#B8860B"
          className="cx-pop cx-d2"
        />
        <StatCard
          label="Calificados"
          value={`${stats.graded}/${stats.total}`}
          hint="Ejercicios con nota"
          icon={Award}
          tint="#059669"
          className="cx-pop cx-d3"
        />
        <StatCard
          label="Tiempo total"
          value={stats.totalTimeMin > 0 ? timeStr : '—'}
          icon={Clock}
          tint="#475569"
          className="cx-pop cx-d4"
        />
      </div>

      {/* Desglose por estado */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Sin iniciar', value: stats.notStarted, color: 'bg-gray-50 text-gray-600 border-gray-200' },
          { label: 'En progreso', value: stats.inProgress, color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: 'Entregados',  value: stats.submitted,  color: 'bg-amber-50 text-amber-700 border-amber-200' },
          { label: 'Calificados', value: stats.graded,     color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        ].map(({ label, value, color }, i) => (
          <div
            key={label}
            className={cn('border rounded-2xl p-3.5 text-center cx-pop', color, `cx-d${i + 1}`)}
          >
            <p className="text-xl font-extrabold font-mono tabular-nums">{value}</p>
            <p className="text-xs mt-0.5 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {stats.scoreHistory.length === 0 ? (
        <Card>
          <EmptyState
            illustration={<SceneEmptyBox size={200} className="cx-float" />}
            title="Todavía no hay calificaciones"
            description="Completa y entrega tus ejercicios: cuando tu profesor los califique, verás aquí tu evolución, tus mejores notas y el tiempo invertido."
          />
        </Card>
      ) : (
        <>
          {/* Evolución de notas */}
          <SectionCard
            eyebrow="Tendencia"
            title="Evolución de notas"
            description="Cada punto es un ejercicio calificado, en orden cronológico."
            icon={TrendingUp}
            iconTint="#2563EB"
            className="mb-6"
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.scoreHistory} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="title" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [`${v}%`, 'Nota']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                />
                <Line
                  type="monotone"
                  dataKey="pct"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: '#2563EB', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </SectionCard>

          {/* Rendimiento por dificultad */}
          {stats.difficultyData.length > 0 && (
            <SectionCard
              eyebrow="Dominio"
              title="Rendimiento por dificultad"
              description="Dónde te sostienes con soltura y dónde conviene reforzar."
              icon={Target}
              iconTint="#475569"
              className="mb-6"
            >
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.difficultyData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v) => [`${v}%`, 'Promedio']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                  />
                  <Bar dataKey="avgPct" radius={[6, 6, 0, 0]} name="Promedio">
                    {stats.difficultyData.map((entry, i) => (
                      <Cell key={i} fill={diffColor(entry.avgPct)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {/* Historial de calificaciones */}
          <SectionCard
            eyebrow="Bitácora"
            title="Historial de calificaciones"
            icon={ListChecks}
            iconTint="#1B2E6E"
            flushBody
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-6 py-3 font-semibold">Ejercicio</th>
                    <th className="text-center px-4 py-3 font-semibold">Nota</th>
                    <th className="text-center px-4 py-3 font-semibold">Puntaje</th>
                    <th className="text-center px-6 py-3 font-semibold">Dificultad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...stats.scoreHistory].reverse().map((h, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-gray-800">{h.title}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="font-bold text-base font-mono tabular-nums"
                          style={{ color: diffColor(h.pct) }}
                        >
                          {h.pct}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 font-mono tabular-nums">
                        {h.score}/{h.maxScore}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full border',
                          h.difficulty === 'BASIC'        ? 'bg-green-50 text-green-700 border-green-200' :
                          h.difficulty === 'INTERMEDIATE' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                            'bg-red-50 text-red-700 border-red-200',
                        )}>
                          {h.difficulty === 'BASIC' ? 'Básico' : h.difficulty === 'INTERMEDIATE' ? 'Intermedio' : 'Avanzado'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}

      {/* ── Perfil de aprendizaje + Mentor IA (evidencia SINAES) ── */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-4">
          <IconTile icon={GraduationCap} tint="#1B2E6E" size={40} />
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">
              Criterio contable
            </p>
            <h3 className="text-base font-bold tracking-tight text-gray-900">Perfil de aprendizaje</h3>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-5 max-w-prose">
          Cómo vas construyendo criterio contable: dominio por competencia, fortalezas y errores a repasar.
        </p>
        <MentorNote />
        <LearningProfileCard />
      </div>
    </div>
  );
}
