'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import { Users, Building2, DollarSign, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

// ── Constants ────────────────────────────────────────────────────────────────
// Annual license price per student in Costa Rican colones (CRC).
// Confidential — only visible to SUPERADMIN (this page is under /superadmin/*).
const PRICE_PER_STUDENT_CRC = 5000;

// ── Types ────────────────────────────────────────────────────────────────────

interface UniversityBreakdown {
  id:            string;
  name:          string;
  shortName:     string | null;
  studentsCount: number;
  isActive:      boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtCrc = (n: number) =>
  new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0,
  }).format(n);

const BAR_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IngresosPage() {
  const [universities, setUniversities] = useState<UniversityBreakdown[]>([]);
  const [loading,      setLoading]      = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all universities + their student counts.
      // Uses the existing /superadmin/universities endpoint (SUPERADMIN-only).
      const { data } = await api.get<any[]>('/api/v1/superadmin/universities');
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

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><Spinner size="lg" /></div>;
  }

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
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Ingresos</h2>
        <p className="text-gray-500 text-sm mt-1">
          Licencia anual de <span className="font-semibold text-gray-700">{fmtCrc(PRICE_PER_STUDENT_CRC)}</span> por estudiante activo.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Información confidencial &mdash; visible únicamente para SuperAdmin.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
            <p className="text-xs text-gray-500 mt-0.5">Estudiantes activos</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{activeUnis.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Universidades activas</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{fmtCrc(annualRevenue)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Ingresos anuales estimados</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{fmtCrc(monthlyRevenue)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Promedio mensual</p>
          </div>
        </div>
      </div>

      {/* Chart + breakdown layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart */}
        <div className="lg:col-span-2 bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">Estudiantes por universidad</h3>
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Users className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Sin estudiantes registrados</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + '…' : v}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                  formatter={(v: any, name: any) => {
                    if (name === 'students') return [v, 'Estudiantes'];
                    return [v, name];
                  }}
                />
                <Bar dataKey="students" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Breakdown table */}
        <div className="lg:col-span-1 bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">Desglose por universidad</h3>
          {activeUnis.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-gray-400">
              <Building2 className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Sin universidades</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {activeUnis
                .slice()
                .sort((a, b) => b.studentsCount - a.studentsCount)
                .map((u) => (
                  <div key={u.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-800 font-medium truncate">{u.shortName || u.name}</p>
                      <p className="text-xs text-gray-400">{u.studentsCount} estudiantes</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-700 flex-shrink-0 ml-2">
                      {fmtCrc(u.studentsCount * PRICE_PER_STUDENT_CRC)}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
