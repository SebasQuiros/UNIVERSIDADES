'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import {
  TrendingUp, Award, Clock, BookOpen, Target, Star,
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

function diffColor(pct: number) {
  if (pct >= 80) return '#10b981';
  if (pct >= 60) return '#f59e0b';
  return '#ef4444';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Stats>('/api/v1/attempts/stats')
      .then(({ data }) => setStats(data))
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
