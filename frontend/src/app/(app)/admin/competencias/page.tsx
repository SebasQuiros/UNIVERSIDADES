'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import {
  Award, TrendingUp, AlertTriangle, BookOpen, Target, Download, GraduationCap,
} from 'lucide-react';

interface CompetencyRow {
  id: string; code: string; name: string; area: string;
  masteryPct: number | null; evidenceCount: number; studentsAssessed: number;
}
interface CourseRow {
  courseId: string; name: string; period: string | null;
  exercises: number; studentsAssessed: number; avgMastery: number | null;
  atRiskCount: number; competenciesCovered: number;
}
interface UniversityEvidence {
  summary: {
    totalCourses: number; totalExercises: number; overallMastery: number | null;
    competenciesEvidenced: number; totalCompetencies: number; atRiskCount: number;
  };
  competencies: CompetencyRow[];
  courses: CourseRow[];
  generatedAt: string;
}

const AREA_LABEL: Record<string, string> = {
  CONTABLE: 'Contable', TRIBUTARIO: 'Tributario', FINANCIERO: 'Financiero',
  COSTOS: 'Costos', AUDITORIA: 'Auditoría', DATOS: 'Datos', GESTION: 'Gestión',
};

function masteryColor(pct: number | null) {
  if (pct == null) return '#CBD5E1';
  if (pct >= 80) return '#059669';
  if (pct >= 60) return '#2563EB';
  if (pct >= 40) return '#D97706';
  return '#DC2626';
}

export default function CompetenciasInstitucionalPage() {
  const { user } = useAuth();
  const [data, setData] = useState<UniversityEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.universityId) { setLoading(false); setError('Tu usuario no está asociado a una universidad.'); return; }
    api.get<UniversityEvidence>(`/api/v1/universities/${user.universityId}/competency-evidence`)
      .then(({ data }) => setData(data))
      .catch(() => setError('No se pudo cargar la evidencia de competencias.'))
      .finally(() => setLoading(false));
  }, [user?.universityId]);

  if (loading) return <div className="flex-1 flex items-center justify-center py-32"><Spinner size="lg" /></div>;

  function exportCsv() {
    if (!data) return;
    const rows = [
      ['Competencia', 'Área', 'Dominio %', 'Evidencias', 'Estudiantes evaluados'],
      ...data.competencies.map(c => [c.code + ' ' + c.name, AREA_LABEL[c.area] ?? c.area, c.masteryPct ?? '', c.evidenceCount, c.studentsAssessed]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'evidencia-competencias.csv';
    a.click();
  }

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white"
            style={{ background: 'linear-gradient(135deg,#1E3A8A,#0F2657)' }}>
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Evidencia de competencias</h1>
            <p className="text-sm text-gray-500">Dominio por competencia y por cohorte — soporte para acreditación</p>
          </div>
        </div>
        {data && (
          <button onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800 text-sm">{error}</div>
      )}

      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Kpi icon={<Target className="w-4 h-4" />} label="Dominio general"
              value={data.summary.overallMastery != null ? `${data.summary.overallMastery}%` : '—'}
              color={masteryColor(data.summary.overallMastery)} />
            <Kpi icon={<Award className="w-4 h-4" />} label="Competencias con evidencia"
              value={`${data.summary.competenciesEvidenced}/${data.summary.totalCompetencies}`} color="#1E3A8A" />
            <Kpi icon={<BookOpen className="w-4 h-4" />} label="Cursos"
              value={`${data.summary.totalCourses}`} color="#7C3AED" />
            <Kpi icon={<AlertTriangle className="w-4 h-4" />} label="Estudiantes en riesgo"
              value={`${data.summary.atRiskCount}`} color={data.summary.atRiskCount > 0 ? '#DC2626' : '#059669'} />
          </div>

          {/* Dominio por competencia */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
            <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-blue-600" /> Dominio por competencia
            </h2>
            {data.competencies.length === 0 ? (
              <EmptyHint />
            ) : (
              <div className="space-y-3">
                {data.competencies.map(c => (
                  <div key={c.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">
                        <span className="font-mono text-gray-400 mr-1.5">{c.code}</span>{c.name}
                        <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{AREA_LABEL[c.area] ?? c.area}</span>
                      </span>
                      <span className="font-bold" style={{ color: masteryColor(c.masteryPct) }}>
                        {c.masteryPct != null ? `${c.masteryPct}%` : 'Sin evidencia'}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${c.masteryPct ?? 0}%`, background: masteryColor(c.masteryPct) }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{c.evidenceCount} evidencias · {c.studentsAssessed} estudiantes</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cohortes / cursos */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-blue-600" /> Cohortes (cursos)
            </h2>
            {data.courses.length === 0 ? (
              <EmptyHint />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                      <th className="py-2 pr-3 font-medium">Curso</th>
                      <th className="py-2 px-3 font-medium">Período</th>
                      <th className="py-2 px-3 font-medium text-center">Ejercicios</th>
                      <th className="py-2 px-3 font-medium text-center">Evaluados</th>
                      <th className="py-2 px-3 font-medium text-center">Competencias</th>
                      <th className="py-2 px-3 font-medium text-center">En riesgo</th>
                      <th className="py-2 pl-3 font-medium text-right">Dominio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.courses.map(c => (
                      <tr key={c.courseId} className="border-b border-gray-50 last:border-0">
                        <td className="py-2.5 pr-3 font-medium text-gray-800">{c.name}</td>
                        <td className="py-2.5 px-3 text-gray-500">{c.period ?? '—'}</td>
                        <td className="py-2.5 px-3 text-center text-gray-600">{c.exercises}</td>
                        <td className="py-2.5 px-3 text-center text-gray-600">{c.studentsAssessed}</td>
                        <td className="py-2.5 px-3 text-center text-gray-600">{c.competenciesCovered}</td>
                        <td className="py-2.5 px-3 text-center">
                          {c.atRiskCount > 0
                            ? <span className="text-red-600 font-semibold">{c.atRiskCount}</span>
                            : <span className="text-gray-400">0</span>}
                        </td>
                        <td className="py-2.5 pl-3 text-right font-bold" style={{ color: masteryColor(c.avgMastery) }}>
                          {c.avgMastery != null ? `${c.avgMastery}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 mt-4">
            Generado {new Date(data.generatedAt).toLocaleString('es-CR')}. El dominio se calcula a partir de los
            intentos calificados en ejercicios vinculados a cada competencia.
          </p>
        </>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
        <span style={{ color }}>{icon}</span> {label}
      </div>
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="text-center py-8 text-gray-400">
      <TrendingUp className="w-8 h-8 mx-auto text-gray-200 mb-2" />
      <p className="text-sm">Aún no hay evidencia. Vincula competencias a los ejercicios y califica intentos.</p>
    </div>
  );
}
