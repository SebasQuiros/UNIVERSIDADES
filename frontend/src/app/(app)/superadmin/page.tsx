'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Building2, Users, BookOpen, FileText, DollarSign,
  GraduationCap, ArrowRight, Activity, TrendingUp, Globe,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArtGrowth, SceneSearchEmpty } from '@/components/illustrations';

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

// Textura de puntos sutil para la banda hero (fondo azul noche).
const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
};

// ── Activity badge ────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  STUDENT:    'bg-blue-50 text-blue-700 border-blue-200',
  TEACHER:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  ADMIN:      'bg-slate-100 text-slate-700 border-slate-200',
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

// ── Skeleton del dashboard ──────────────────────────────────────────────────
// Reproduce la estructura (hero + 3 KPIs + 2 gráficas + 2 paneles) con
// placeholders animados, para que el shell aparezca de inmediato.
function SuperAdminSkeleton() {
  return (
    <>
      <div className="h-48 rounded-card bg-gray-100 border border-gray-200 animate-pulse mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 bg-gray-100 rounded-card border border-gray-200 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="h-72 bg-gray-100 rounded-card border border-gray-200 animate-pulse" />
        <div className="h-72 bg-gray-100 rounded-card border border-gray-200 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 bg-gray-100 rounded-card border border-gray-200 animate-pulse" />
        <div className="h-72 bg-gray-100 rounded-card border border-gray-200 animate-pulse" />
      </div>
    </>
  );
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

  // Precio de licencia anual por estudiante (confidencial — solo SUPERADMIN)
  const PRICE_PER_STUDENT_CRC = 5000;
  const annualRevenue = (stats?.totalStudents ?? 0) * PRICE_PER_STUDENT_CRC;
  const fmtCrc = (n: number) =>
    new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#FBF8F1]">
      {/* Cabecera — visible siempre, incluso mientras cargan los datos */}
      <PageHeader
        eyebrow="Consola global"
        title="Panel SuperAdmin"
        subtitle="Vista global de la plataforma ContaSJ"
        icon={Globe}
        className="mb-8"
      />

      {loading || !stats ? (
        <SuperAdminSkeleton />
      ) : (
      <>
      {/* Banda hero — métricas de negocio sobre azul noche */}
      <div className="relative overflow-hidden rounded-card shadow-soft mb-8 lp-in bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
        <div aria-hidden className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 hidden xl:block opacity-95">
          <ArtGrowth size={190} className="lp-drift" />
        </div>
        <div className="relative p-6 lg:p-8">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-gold-500 mb-2">
            Estado de la plataforma
          </p>
          <h2 className="text-xl lg:text-2xl font-extrabold text-white tracking-tight">
            Crecimiento y alcance
          </h2>
          <p className="text-sm text-blue-200/80 mt-1.5 max-w-md">
            Universidades, estudiantes activos e ingresos anuales estimados.
          </p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 xl:max-w-3xl">
            <StatCard
              variant="dark"
              label="Universidades"
              value={String(stats.totalUniversities)}
              icon={Building2}
              hint={`${stats.activeUniversities} activas`}
            />
            <StatCard
              variant="dark"
              label="Estudiantes"
              value={String(stats.totalStudents)}
              icon={GraduationCap}
            />
            <StatCard
              variant="dark"
              label="Ingresos anuales"
              value={fmtCrc(annualRevenue)}
              icon={DollarSign}
              hint={`${stats.totalStudents} × ₡${PRICE_PER_STUDENT_CRC.toLocaleString()}`}
            />
          </div>
        </div>
      </div>

      {/* KPIs secundarios */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Profesores"
          value={String(stats.totalTeachers)}
          icon={Users}
          tint="#475569"
        />
        <StatCard
          label="Cursos"
          value={String(stats.totalCourses)}
          icon={BookOpen}
          tint="#B8860B"
        />
        <StatCard
          label="Ejercicios"
          value={String(stats.totalExercises)}
          icon={FileText}
          tint="#2563EB"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Growth line chart */}
        <SectionCard
          icon={TrendingUp}
          eyebrow="Últimos 6 meses"
          title="Crecimiento de universidades"
        >
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
                stroke="#2563EB"
                strokeWidth={2}
                dot={{ r: 4, fill: '#2563EB' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Top universities bar chart */}
        <SectionCard
          icon={Building2}
          iconTint="#059669"
          eyebrow="Por estudiantes"
          title="Top universidades"
        >
          {stats.topUniversities.length === 0 ? (
            <EmptyState
              illustration={<SceneSearchEmpty size={150} className="lp-drift" />}
              title="Sin datos aún"
              description="Cuando se registren universidades con estudiantes, verás su ranking aquí."
              className="py-4"
            />
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
        </SectionCard>
      </div>

      {/* Bottom row: top universities table + activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 universities table */}
        <SectionCard
          icon={Building2}
          eyebrow="Ranking"
          title="Top universidades por actividad"
          flushBody
          action={
            <Link href="/superadmin/universidades" className="text-xs text-blue-700 hover:text-blue-800 flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          {stats.topUniversities.length === 0 ? (
            <EmptyState
              illustration={<SceneSearchEmpty size={150} className="lp-drift" />}
              title="Sin universidades registradas"
              description="Cuando registres tu primera universidad, aparecerá en este ranking."
            />
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
                        <span className="text-gray-600 font-medium font-mono tabular-nums">{u.students}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Recent activity feed */}
        <SectionCard
          icon={Activity}
          iconTint="#475569"
          eyebrow="En tiempo real"
          title="Actividad reciente"
          flushBody
          action={
            <Link href="/superadmin/actividad" className="text-xs text-blue-700 hover:text-blue-800 flex items-center gap-1">
              Ver todo <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          {stats.recentActivity.length === 0 ? (
            <EmptyState
              illustration={<SceneSearchEmpty size={150} className="lp-drift" />}
              title="Sin actividad registrada"
              description="La actividad de las universidades y usuarios aparecerá aquí."
            />
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
        </SectionCard>
      </div>
      </>
      )}
    </div>
  );
}
