'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import {
  TrendingUp, Award, Clock, BookOpen, Target, Star,
  Trophy, Zap, Medal, Crown,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

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

function diffColor(pct: number) {
  if (pct >= 80) return '#10b981';
  if (pct >= 60) return '#f59e0b';
  return '#ef4444';
}

function rankStyle(rank: number) {
  if (rank === 1) return { bg: 'linear-gradient(135deg,#FBBF24,#F59E0B)', icon: Crown,  color: '#fff' };
  if (rank === 2) return { bg: 'linear-gradient(135deg,#CBD5E1,#94A3B8)', icon: Medal,  color: '#fff' };
  if (rank === 3) return { bg: 'linear-gradient(135deg,#D97706,#B45309)', icon: Medal,  color: '#fff' };
  return { bg: '#F1F5F9', icon: Trophy, color: '#64748B' };
}

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
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
    <div className="flex-1 flex items-center justify-center">
      <Spinner size="lg" />
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

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          Mi Progreso
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Evolución académica y estadísticas de rendimiento
        </p>
      </div>

      {/* ── Gamificación: nivel + ranking ── */}
      {game && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {/* Tarjeta de nivel (XP) */}
          <div className="lg:col-span-2 rounded-2xl p-6 text-white relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#0F2657 0%,#1E3A8A 55%,#3B82F6 100%)' }}>
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-20"
              style={{ background: 'radial-gradient(circle,#FBBF24,transparent 70%)', transform: 'translate(30%,-30%)' }} />
            <div className="relative flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
                {game.level.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(251,191,36,0.2)', color: '#FDE68A' }}>
                    Nivel {game.level.index + 1}
                  </span>
                  <h3 className="text-xl font-black">{game.level.name}</h3>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-sm" style={{ color: '#BFDBFE' }}>
                  <Zap className="w-4 h-4" style={{ color: '#FBBF24' }} />
                  <span className="font-bold text-white">{game.xp.toLocaleString('es-CR')}</span> XP acumulado
                </div>
              </div>
            </div>

            {/* Barra de progreso al siguiente nivel */}
            <div className="relative mt-5">
              <div className="flex justify-between text-xs mb-1.5" style={{ color: '#BFDBFE' }}>
                <span>{game.nextLevel ? `Progreso a ${game.nextLevel.name}` : '¡Nivel máximo alcanzado! 👑'}</span>
                {game.nextLevel && <span>Faltan {game.nextLevel.xpRemaining.toLocaleString('es-CR')} XP</span>}
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${game.levelPct}%`, background: 'linear-gradient(90deg,#FBBF24,#FDE68A)' }} />
              </div>
            </div>
          </div>

          {/* Tarjeta de ranking */}
          <div className="rounded-2xl p-6 bg-white border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: 'linear-gradient(135deg,#FBBF24,#F59E0B)' }}>
              <Trophy className="w-7 h-7 text-white" />
            </div>
            <p className="text-4xl font-black text-gray-900 leading-none">
              {game.rank ? `#${game.rank}` : '—'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              de {game.totalStudents} estudiante{game.totalStudents !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-gray-400 mt-2">Ranking de tu universidad</p>
          </div>
        </div>
      )}

      {/* ── Leaderboard ── */}
      {game && game.leaderboard.length > 1 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-8">
          <div className="p-5 border-b border-gray-200 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-gray-900">Tabla de líderes</h3>
            <span className="text-xs text-gray-400 ml-auto">Top {Math.min(10, game.leaderboard.length)}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {game.leaderboard.map((r) => {
              const rs = rankStyle(r.rank);
              const RankIcon = rs.icon;
              return (
                <div key={r.id}
                  className="flex items-center gap-3 px-5 py-3"
                  style={r.isMe ? { background: 'linear-gradient(90deg,rgba(59,130,246,0.07),transparent)' } : undefined}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm"
                    style={{ background: rs.bg, color: rs.color }}>
                    {r.rank <= 3 ? <RankIcon className="w-4 h-4" /> : r.rank}
                  </div>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#3B82F6,#1E3A8A)' }}>
                    {r.avatarUrl
                      ? <img src={r.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                      : r.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {r.name}{r.isMe && <span className="text-blue-600 font-semibold"> (tú)</span>}
                    </p>
                    <p className="text-xs text-gray-400">{r.completed} ejercicio{r.completed !== 1 ? 's' : ''} calificado{r.completed !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-sm font-bold text-gray-900">{r.xp.toLocaleString('es-CR')}</span>
                    <span className="text-xs text-gray-400">XP</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Nota promedio"
          value={stats.avgPct > 0 ? `${stats.avgPct}%` : '—'}
          sub={stats.avgPct > 0 ? `Letra: ${letterGrade(stats.avgPct)}` : undefined}
          icon={Target}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Mejor nota"
          value={stats.bestScore > 0 ? `${stats.bestScore}%` : '—'}
          icon={Star}
          color="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Ejercicios calificados"
          value={`${stats.graded}/${stats.total}`}
          icon={Award}
          color="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Tiempo total"
          value={stats.totalTimeMin > 0 ? timeStr : '—'}
          icon={Clock}
          color="bg-purple-50 text-purple-600"
        />
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Sin iniciar', value: stats.notStarted, color: 'bg-gray-100 text-gray-600 border-gray-200' },
          { label: 'En progreso', value: stats.inProgress, color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: 'Entregados',  value: stats.submitted,  color: 'bg-amber-50 text-amber-700 border-amber-200' },
          { label: 'Calificados', value: stats.graded,     color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`border rounded-xl p-3 text-center ${color}`}>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {stats.scoreHistory.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
          <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-700 mb-1">Sin calificaciones aún</h3>
          <p className="text-gray-500 text-sm">
            Completa y entrega ejercicios para ver tu evolución aquí.
          </p>
        </div>
      ) : (
        <>
          {/* Score history line chart */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Evolución de notas
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.scoreHistory} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="title" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: any) => [`${v}%`, 'Nota']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                />
                <Line
                  type="monotone"
                  dataKey="pct"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* By difficulty */}
          {stats.difficultyData.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-600" />
                Rendimiento por dificultad
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.difficultyData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => [`${v}%`, 'Promedio']} />
                  <Bar dataKey="avgPct" radius={[6, 6, 0, 0]} name="Promedio">
                    {stats.difficultyData.map((entry, i) => (
                      <Cell key={i} fill={diffColor(entry.avgPct)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recent grades table */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Historial de calificaciones</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">Ejercicio</th>
                    <th className="text-center px-4 py-3">Nota</th>
                    <th className="text-center px-4 py-3">Puntaje</th>
                    <th className="text-center px-4 py-3">Dificultad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...stats.scoreHistory].reverse().map((h, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{h.title}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="font-bold text-base"
                          style={{ color: diffColor(h.pct) }}
                        >
                          {h.pct}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{h.score}/{h.maxScore}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          h.difficulty === 'BASIC'        ? 'bg-green-50 text-green-700' :
                          h.difficulty === 'INTERMEDIATE' ? 'bg-yellow-50 text-yellow-700' :
                                                            'bg-red-50 text-red-700'
                        }`}>
                          {h.difficulty === 'BASIC' ? 'Básico' : h.difficulty === 'INTERMEDIATE' ? 'Intermedio' : 'Avanzado'}
                        </span>
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
