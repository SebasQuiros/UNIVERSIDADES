'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ArtCoins, SceneEmptyBox } from '@/components/illustrations';
import toast from 'react-hot-toast';
import { Users, Building2, Coins, TrendingUp, Lock } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

// ── Constants ────────────────────────────────────────────────────────────────
// Annual license price per student in Costa Rican colones (CRC).
// Confidential — only visible to SUPERADMIN (this page is under /superadmin/*).
const PRICE_PER_STUDENT_CRC = 5000;

// Textura de puntos sutil para la banda hero (fondo azul noche).
const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
};

// ── Types ────────────────────────────────────────────────────────────────────

interface UniversityBreakdown {
  id:            string;
  name:          string;
  shortName:     string | null;
  studentsCount: number;
  isActive:      boolean;
}

/** Forma parcial devuelta por /superadmin/universities (sólo lo que usamos aquí). */
interface UniversityApiItem {
  id:             string;
  name:           string;
  shortName?:     string | null;
  isActive?:      boolean;
  studentsCount?: number;
  _count?:        { users?: number };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtCrc = (n: number) =>
  new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0,
  }).format(n);

const BAR_COLORS = ['#2563EB', '#1B2E6E', '#3B82F6', '#059669', '#B8860B', '#475569'];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IngresosPage() {
  const [universities, setUniversities] = useState<UniversityBreakdown[]>([]);
  const [loading,      setLoading]      = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all universities + their student counts.
      // Uses the existing /superadmin/universities endpoint (SUPERADMIN-only).
      const { data } = await api.get<UniversityApiItem[]>('/api/v1/superadmin/universities');
      const mapped: UniversityBreakdown[] = (data ?? []).map((u) => ({
        id:            u.id,
        name:          u.name,
        shortName:     u.shortName ?? null,
        studentsCount: u._count?.users ?? u.studentsCount ?? 0,
        isActive:      u.isActive ?? true,
      }));
      setUniversities(mapped);
    } catch {
      toast.error('Error al cargar ingresos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeUnis     = universities.filter((u) => u.isActive);
  const totalStudents  = activeUnis.reduce((s, u) => s + u.studentsCount, 0);
  const annualRevenue  = totalStudents * PRICE_PER_STUDENT_CRC;
  const monthlyRevenue = annualRevenue / 12;

  const chartData = activeUnis
    .filter((u) => u.studentsCount > 0)
    .map((u, i) => ({
      name:     u.shortName || u.name,
      students: u.studentsCount,
      revenue:  u.studentsCount * PRICE_PER_STUDENT_CRC,
      fill:     BAR_COLORS[i % BAR_COLORS.length],
    }));

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#F4F6F8]">
      <PageHeader
        eyebrow="Superadmin"
        title="Ingresos y planes"
        subtitle={`Licencia anual de ${fmtCrc(PRICE_PER_STUDENT_CRC)} por estudiante activo.`}
        icon={Coins}
        iconTint="#B8860B"
        className="mb-6"
        actions={
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold-50 border border-gold-100 text-gold-900 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5" /> Información confidencial
          </span>
        }
      />

      {loading ? (
        <>
          <Skeleton className="h-52 w-full rounded-card mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-80 rounded-card lg:col-span-2" />
            <Skeleton className="h-80 rounded-card" />
          </div>
        </>
      ) : (
        <>
          {/* Banda hero — resumen económico */}
          <div className="relative overflow-hidden rounded-card shadow-soft mb-8 lp-in bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
            <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
            <div aria-hidden className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 hidden xl:block opacity-95">
              <ArtCoins size={180} className="lp-drift" />
            </div>
            <div className="relative p-6 lg:p-8">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-gold-500 mb-2">
                Modelo de licencias
              </p>
              <h2 className="text-xl lg:text-2xl font-extrabold text-white tracking-tight">
                Ingresos estimados
              </h2>
              <p className="text-sm text-blue-200/80 mt-1.5 max-w-md">
                Proyección basada en los estudiantes activos de las universidades habilitadas.
              </p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard
                  key={`st-${totalStudents}`}
                  variant="dark"
                  label="Estudiantes activos"
                  value={String(totalStudents)}
                  icon={Users}
                  className="cx-count"
                />
                <StatCard
                  key={`un-${activeUnis.length}`}
                  variant="dark"
                  label="Universidades activas"
                  value={String(activeUnis.length)}
                  icon={Building2}
                  className="cx-count"
                />
                <StatCard
                  key={`an-${annualRevenue}`}
                  variant="dark"
                  label="Ingresos anuales"
                  value={fmtCrc(annualRevenue)}
                  icon={Coins}
                  hint="Estimación"
                  className="cx-count"
                />
                <StatCard
                  key={`me-${monthlyRevenue}`}
                  variant="dark"
                  label="Promedio mensual"
                  value={fmtCrc(monthlyRevenue)}
                  icon={TrendingUp}
                  hint="Anual ÷ 12"
                  className="cx-count"
                />
              </div>
            </div>
          </div>

          {/* Gráfica + desglose */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SectionCard
              className="lg:col-span-2"
              icon={Users}
              iconTint="#2563EB"
              eyebrow="Distribución"
              title="Estudiantes por universidad"
            >
              {chartData.length === 0 ? (
                <EmptyState
                  illustration={<SceneEmptyBox size={170} className="lp-drift" />}
                  title="Sin estudiantes registrados"
                  description="Cuando las universidades activas matriculen estudiantes, verás aquí su distribución."
                  className="py-6"
                />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + '…' : v}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <Tooltip
                      cursor={{ fill: 'rgba(37,99,235,0.06)' }}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                    />
                    <Bar dataKey="students" name="Estudiantes" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={`${entry.name}-${i}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            <SectionCard
              icon={Building2}
              iconTint="#B8860B"
              eyebrow="Por institución"
              title="Desglose de licencias"
            >
              {activeUnis.length === 0 ? (
                <EmptyState
                  illustration={<SceneEmptyBox size={150} className="lp-drift" />}
                  title="Sin universidades activas"
                  description="Activa una universidad para calcular su licencia anual."
                  className="py-6"
                />
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {activeUnis
                    .slice()
                    .sort((a, b) => b.studentsCount - a.studentsCount)
                    .map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between gap-3 text-sm border-b border-gray-100 pb-2 last:border-b-0 cx-lift rounded-lg px-1"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-gray-800 font-semibold truncate">{u.shortName || u.name}</p>
                          <p className="text-xs text-gray-400 font-mono tabular-nums">
                            {u.studentsCount} estudiantes
                          </p>
                        </div>
                        <p className="text-sm font-bold text-gray-800 flex-shrink-0 font-mono tabular-nums">
                          {fmtCrc(u.studentsCount * PRICE_PER_STUDENT_CRC)}
                        </p>
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
