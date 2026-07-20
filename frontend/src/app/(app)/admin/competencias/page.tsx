'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ArtReport, SceneEmptyBox } from '@/components/illustrations';
import {
  Award, AlertTriangle, BookOpen, Target, Download, GraduationCap,
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

// Textura de puntos sutil para la banda hero (fondo azul noche).
const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
};

function masteryColor(pct: number | null) {
  if (pct == null) return '#CBD5E1';
  if (pct >= 80) return '#1D4ED8';
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

  function exportCsv() {
    if (!data) return;
    const rows = [
      ['Competencia', 'Área', 'Dominio %', 'Evidencias', 'Estudiantes evaluados'],
      ...data.competencies.map(c => [c.code + ' ' + c.name, AREA_LABEL[c.area] ?? c.area, c.masteryPct ?? '', c.evidenceCount, c.studentsAssessed]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'evidencia-competencias.csv';
    a.click();
  }

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#FBF8F1]">
      <PageHeader
        eyebrow="Administración"
        title="Evidencia de competencias"
        subtitle="Dominio por competencia y por cohorte — soporte documental para acreditación."
        icon={Award}
        iconTint="#B8860B"
        className="mb-8"
        actions={
          data && (
            <Button variant="secondary" onClick={exportCsv} className="cx-press">
              <Download className="w-4 h-4" /> Exportar CSV
            </Button>
          )
        }
      />

      {loading && (
        <>
          <Skeleton className="h-48 w-full rounded-card mb-8" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-card" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-card" />
        </>
      )}

      {!loading && error && (
        <SectionCard icon={AlertTriangle} iconTint="#B8860B" eyebrow="Aviso" title="No se puede mostrar la evidencia">
          <p className="text-sm text-gray-600">{error}</p>
        </SectionCard>
      )}

      {!loading && data && (
        <>
          {/* Banda hero — dominio institucional */}
          <div className="relative overflow-hidden rounded-card shadow-soft mb-8 lp-in bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
            <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
            <div aria-hidden className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 hidden xl:block opacity-95">
              <ArtReport size={170} className="lp-drift" />
            </div>
            <div className="relative p-6 lg:p-8">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-gold-500 mb-2">
                Resultados de aprendizaje
              </p>
              <h2 className="text-xl lg:text-2xl font-extrabold text-white tracking-tight">
                Dominio institucional
              </h2>
              <p className="text-sm text-blue-200/80 mt-1.5 max-w-lg">
                Calculado a partir de los intentos calificados en ejercicios vinculados a cada competencia.
              </p>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              key={`om-${data.summary.overallMastery ?? 'na'}`}
              label="Dominio general"
              value={data.summary.overallMastery != null ? `${data.summary.overallMastery}%` : '—'}
              icon={Target}
              tint={masteryColor(data.summary.overallMastery)}
              className="cx-count"
            />
            <StatCard
              key={`ce-${data.summary.competenciesEvidenced}`}
              label="Competencias con evidencia"
              value={`${data.summary.competenciesEvidenced}/${data.summary.totalCompetencies}`}
              icon={Award}
              tint="#2563EB"
              className="cx-count"
            />
            <StatCard
              key={`tc-${data.summary.totalCourses}`}
              label="Cursos"
              value={String(data.summary.totalCourses)}
              icon={BookOpen}
              tint="#1B2E6E"
              hint={`${data.summary.totalExercises} ejercicios`}
              className="cx-count"
            />
            <StatCard
              key={`ar-${data.summary.atRiskCount}`}
              label="Estudiantes en riesgo"
              value={String(data.summary.atRiskCount)}
              icon={AlertTriangle}
              tint={data.summary.atRiskCount > 0 ? '#DC2626' : '#059669'}
              className="cx-count"
            />
          </div>

          {/* Dominio por competencia */}
          <SectionCard
            icon={Award}
            iconTint="#2563EB"
            eyebrow="Por competencia"
            title="Dominio alcanzado"
            className="mb-6"
          >
            {data.competencies.length === 0 ? (
              <EmptyHint />
            ) : (
              <div className="space-y-4">
                {data.competencies.map((c, i) => (
                  <div key={c.id} className={`cx-pop ${i < 6 ? `cx-d${i + 1}` : ''}`}>
                    <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                      <span className="font-medium text-gray-700 min-w-0">
                        <span className="font-mono text-gray-400 mr-1.5">{c.code}</span>
                        {c.name}
                        <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                          {AREA_LABEL[c.area] ?? c.area}
                        </span>
                      </span>
                      <span
                        className="font-bold tabular-nums flex-shrink-0"
                        style={{ color: masteryColor(c.masteryPct) }}
                      >
                        {c.masteryPct != null ? `${c.masteryPct}%` : 'Sin evidencia'}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${c.masteryPct ?? 0}%`, background: masteryColor(c.masteryPct) }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 font-mono tabular-nums">
                      {c.evidenceCount} evidencias · {c.studentsAssessed} estudiantes
                    </p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Cohortes / cursos */}
          <SectionCard
            icon={GraduationCap}
            iconTint="#059669"
            eyebrow="Cohortes"
            title="Desempeño por curso"
            flushBody
          >
            {data.courses.length === 0 ? (
              <EmptyHint />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-6 py-3 font-semibold">Curso</th>
                      <th className="text-left px-3 py-3 font-semibold">Período</th>
                      <th className="text-center px-3 py-3 font-semibold">Ejercicios</th>
                      <th className="text-center px-3 py-3 font-semibold">Evaluados</th>
                      <th className="text-center px-3 py-3 font-semibold">Competencias</th>
                      <th className="text-center px-3 py-3 font-semibold">En riesgo</th>
                      <th className="text-right px-6 py-3 font-semibold">Dominio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.courses.map((c) => (
                      <tr key={c.courseId} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-6 py-3 font-semibold text-gray-800">{c.name}</td>
                        <td className="px-3 py-3 text-gray-500">{c.period ?? '—'}</td>
                        <td className="px-3 py-3 text-center text-gray-600 font-mono tabular-nums">{c.exercises}</td>
                        <td className="px-3 py-3 text-center text-gray-600 font-mono tabular-nums">{c.studentsAssessed}</td>
                        <td className="px-3 py-3 text-center text-gray-600 font-mono tabular-nums">{c.competenciesCovered}</td>
                        <td className="px-3 py-3 text-center font-mono tabular-nums">
                          {c.atRiskCount > 0
                            ? <span className="text-red-600 font-bold">{c.atRiskCount}</span>
                            : <span className="text-gray-400">0</span>}
                        </td>
                        <td
                          className="px-6 py-3 text-right font-bold tabular-nums"
                          style={{ color: masteryColor(c.avgMastery) }}
                        >
                          {c.avgMastery != null ? `${c.avgMastery}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <p className="text-xs text-gray-400 mt-4">
            Generado el {new Date(data.generatedAt).toLocaleString('es-CR')}. El dominio se calcula a partir de los
            intentos calificados en ejercicios vinculados a cada competencia.
          </p>
        </>
      )}
    </div>
  );
}

function EmptyHint() {
  return (
    <EmptyState
      illustration={<SceneEmptyBox size={180} className="lp-drift" />}
      title="Aún no hay evidencia"
      description="Vincula competencias a los ejercicios y califica intentos: el dominio aparecerá aquí automáticamente."
      className="py-6"
    />
  );
}
