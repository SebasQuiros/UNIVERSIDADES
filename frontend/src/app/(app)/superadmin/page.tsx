'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import {
  Building2, Users, BookOpen, FileText, DollarSign,
  GraduationCap, ArrowRight, Activity, TrendingUp,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalUniversities:  number;
  activeUniversities: number;
  totalUsers:         number;
  totalStudents:      number;
  totalTeachers:      number;
  totalCourses:       number;
  totalExercises:     number;
  totalAttempts:      number;
  revenueEstimate:    number;
  universitiesGrowth: { month: string; count: number }[];
  topUniversities:    { name: string; students: number; exercises: number }[];
  recentActivity:     ActivityEntry[];
}

interface ActivityEntry {
  id:             string;
  action:         string;
  entity:         string | null;
  createdAt:      string;
  user:           { name: string; email: string; role: string };
  universityName: string | null;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string; value: number | string; icon: React.ElementType;
  color: string; sub?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

// ── Activity badge ────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  STUDENT:    'bg-blue-50 text-blue-700 border-blue-200',
  TEACHER:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  ADMIN:      'bg-purple-50 text-purple-700 border-purple-200',
  SUPERADMIN: 'bg-red-50 text-red-700 border-red-200',
};

function formatRelative(dateStr: string) {
  const date = new Date(dateStr);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60)   return 'Ahora mismo';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  return date.toLocaleDateString('es', { day: '2-digit', month: 'short' });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SuperAdminDashboard() {
  const [stats, setStats]   = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<DashboardStats>('/api/v1/superadmin/dashboard');
      setStats(data);
    } catch {
      toast.error('Error al cargar el dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!stats) return null;

  // Annual license price per student (confidential — SUPERADMIN only)
  const PRICE_PER_STUDENT_CRC = 5000;
  const annualRevenue = stats.totalStudents * PRICE_PER_STUDENT_CRC;
  const fmtCrc = (n: number) =>
    new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Panel SuperAdmin</h2>
        <p className="text-gray-500 text-sm mt-1">Vista global de la plataforma ContaSJ</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatCard
          label="Universidades"
          value={stats.totalUniversities}
          icon={Building2}
          color="bg-blue-50 text-blue-600"
          sub={`${stats.activeUniversities} activas`}
        />
        <StatCard
          label="Estudiantes"
          value={stats.totalStudents}
          icon={GraduationCap}
          color="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Profesores"
          value={stats.totalTeachers}
          icon={Users}
          color="bg-purple-50 text-purple-600"
        />
        <StatCard
          label="Cursos"
          value={stats.totalCourses}
          icon={BookOpen}
          color="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Ejercicios"
          value={stats.totalExercises}
          icon={FileText}
          color="bg-pink-50 text-pink-600"
        />
        <StatCard
          label="Ingresos anuales"
          value={fmtCrc(annualRevenue)}
          icon={DollarSign}
          color="bg-teal-50 text-teal-600"
          sub={`${stats.totalStudents} × ₡${PRICE_PER_STUDENT_CRC.toLocaleString()}`}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Growth line chart */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-gray-800 text-sm">Crecimiento de universidades</h3>
            <span className="text-xs text-gray-400 ml-auto">últimos 6 meses</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.universitiesGrowth} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                formatter={(v: any) => [v, 'Nuevas universidades']}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 4, fill: '#2563eb' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top universities bar chart */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-gray-800 text-sm">Top universidades por estudiantes</h3>
          </div>
          {stats.topUniversities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-gray-400">
              <Building2 className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Sin datos aún</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.topUniversities} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickFormatter={(v) => v.length > 10 ? v.slice(0, 10) + '…' : v} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                  formatter={(v: any) => [v, 'Estudiantes']}
                />
                <Bar dataKey="students" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom row: top universities table + activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 universities table */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm">Top universidades por actividad</h3>
            <Link href="/superadmin/universidades" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {stats.topUniversities.length === 0 ? (
            <div className="py-12 text-center">
              <Building2 className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Sin universidades registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                    <th className="text-left p-4">Universidad</th>
                    <th className="text-right p-4">Estudiantes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.topUniversities.map((u, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono w-5 text-gray-400">{i + 1}</span>
                          <p className="font-medium text-gray-700 truncate max-w-[160px]">{u.name}</p>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-gray-600 font-medium">{u.students}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent activity feed */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600" />
              <h3 className="font-semibold text-gray-800 text-sm">Actividad reciente</h3>
            </div>
            <Link href="/superadmin/actividad" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
              Ver todo <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {stats.recentActivity.length === 0 ? (
            <div className="py-12 text-center">
              <Activity className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Sin actividad registrada</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {stats.recentActivity.map((entry) => (
                <div key={entry.id} className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0 mt-0.5">
                    {entry.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{entry.user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{entry.action}</p>
                    {entry.universityName && (
                      <p className="text-xs text-gray-400 truncate">{entry.universityName}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${ROLE_COLORS[entry.user.role] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {entry.user.role}
                    </span>
                    <span className="text-xs text-gray-400">{formatRelative(entry.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
