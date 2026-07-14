'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { SceneEmptyBox, SceneSearchEmpty } from '@/components/illustrations';
import { LearningProfileCard } from '@/components/pedagogy/LearningProfileCard';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Calculator, Users, Building2, FileText, ChevronDown, ChevronRight,
  Receipt, UserSquare2, Clock, ExternalLink, Sparkles, GraduationCap,
} from 'lucide-react';

interface PracticeCompany {
  id: string;
  name: string;
  economicActivity: string | null;
  createdAt: string;
  counts: { invoices: number; journalEntries: number; clients: number };
  lastActivityAt: string | null;
}
interface StudentPractice {
  student: { id: string; name: string; email: string | null };
  totalCompanies: number;
  totalEntries: number;
  companies: PracticeCompany[];
}

const GOLD = '#D4A017';

export default function TeacherPracticePage() {
  const params   = useParams();
  const courseId = String(params.courseId);

  const [rows, setRows]         = useState<StudentPractice[]>([]);
  const [courseName, setName]   = useState('');
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [profileOpen, setProfileOpen] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const courseRes = await api.get<{ id: string; universityId: string; name: string }>(`/api/v1/courses/${courseId}`);
      setName(courseRes.data.name);
      const { data } = await api.get<StudentPractice[]>(
        `/api/v1/universities/${courseRes.data.universityId}/courses/${courseId}/practice`,
      );
      setRows(data);
    } catch {
      toast.error('Error al cargar la práctica del curso');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => ({
    active:    rows.filter((r) => r.totalCompanies > 0).length,
    students:  rows.length,
    companies: rows.reduce((s, r) => s + r.totalCompanies, 0),
    entries:   rows.reduce((s, r) => s + r.totalEntries, 0),
  }), [rows]);

  // Estudiantes con práctica primero, ordenados por actividad.
  const sorted = useMemo(() => [...rows].sort((a, b) =>
    b.totalCompanies - a.totalCompanies || b.totalEntries - a.totalEntries), [rows]);

  const lastActivityOf = (r: StudentPractice): string | null => {
    const ds = r.companies.map((c) => c.lastActivityAt).filter(Boolean) as string[];
    if (ds.length === 0) return null;
    return ds.sort().slice(-1)[0];
  };

  const toggle = (id: string) => setExpanded((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const toggleProfile = (id: string) => setProfileOpen((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      <Link href={`/profesor/cursos/${courseId}`} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver al curso
      </Link>

      <PageHeader
        eyebrow="Profesor · Práctica libre"
        title="Práctica libre (Espacio Contador)"
        subtitle={`${courseName ? `${courseName} · ` : ''}Empresas-cliente que tus estudiantes practican por su cuenta, sin calificación.`}
        icon={Calculator}
        iconTint="#B8860B"
        className="lp-in"
      />

      {loading ? (
        <div className="flex justify-center py-20 mt-6"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 mt-6">
            <StatCard label="Estudiantes practicando" value={`${summary.active}/${summary.students}`} icon={Users} tint="#B8860B" />
            <StatCard label="Empresas de práctica" value={String(summary.companies)} icon={Building2} tint="#2563EB" />
            <StatCard label="Asientos registrados" value={String(summary.entries)} icon={FileText} tint="#059669" />
            <StatCard label="Promedio empresas/est." value={summary.students ? (summary.companies / summary.students).toFixed(1) : '0'} icon={Calculator} tint="#7C3AED" />
          </div>

          {rows.length === 0 ? (
            <Card className="lp-in">
              <EmptyState
                illustration={<SceneSearchEmpty size={210} className="lp-drift" />}
                title="Sin estudiantes inscritos"
                description="Este curso aún no tiene estudiantes inscritos."
              />
            </Card>
          ) : summary.companies === 0 ? (
            <Card className="lp-in">
              <EmptyState
                illustration={<SceneEmptyBox size={210} className="lp-drift" />}
                title="Aún no hay práctica libre"
                description="Ningún estudiante ha creado empresas de práctica todavía. Invitalos a usar el Espacio Contador para practicar el ciclo contable sin nota."
              />
            </Card>
          ) : (
            <div className="space-y-2.5">
              {sorted.map((r, ri) => {
                const open = expanded.has(r.student.id);
                const last = lastActivityOf(r);
                const has  = r.totalCompanies > 0;
                return (
                  <div key={r.student.id} className={`bg-white border border-gray-200/70 rounded-card shadow-card overflow-hidden lp-in lp-in-d${Math.min(ri + 1, 5)}`}>
                    <button
                      onClick={() => has && toggle(r.student.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                      style={{ cursor: has ? 'pointer' : 'default' }}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white flex-shrink-0 text-sm" style={{ background: has ? GOLD : '#CBD5E1' }}>
                        {r.student.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{r.student.name}</p>
                        {r.student.email && <p className="text-xs text-gray-400 truncate">{r.student.email}</p>}
                      </div>
                      <div className="hidden sm:flex items-center gap-5 flex-shrink-0 mr-2">
                        <Stat n={r.totalCompanies} label="empresas" />
                        <Stat n={r.totalEntries} label="asientos" />
                        <div className="text-right w-28">
                          <p className="text-[11px] text-gray-400">Última actividad</p>
                          <p className="text-xs text-gray-600">{last ? formatDate(last) : '—'}</p>
                        </div>
                      </div>
                      {has
                        ? (open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />)
                        : <span className="text-[11px] text-gray-300 w-4 text-center">·</span>}
                    </button>

                    {(() => {
                      const profOpen = profileOpen.has(r.student.id);
                      return (
                        <div className="border-t border-gray-100">
                          <button
                            onClick={() => toggleProfile(r.student.id)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold transition-colors hover:bg-indigo-50/60"
                            style={{ color: '#4F46E5' }}>
                            <GraduationCap className="w-4 h-4 flex-shrink-0" />
                            <span className="flex-1">Perfil de aprendizaje · evidencia SINAES</span>
                            {profOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                          {profOpen && (
                            <div className="px-4 pb-4 bg-gray-50/60">
                              <LearningProfileCard studentId={r.student.id} />
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {open && has && (
                      <div className="border-t border-gray-100 bg-gray-50/60 p-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {r.companies.map((c) => (
                          <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-3 flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-sm text-gray-900 truncate">{c.name}</p>
                                {c.economicActivity && <p className="text-[11px] text-gray-400 truncate">{c.economicActivity}</p>}
                              </div>
                              <Link href={`/estudiante/contador/${c.id}`} target="_blank"
                                className="text-gray-300 hover:text-amber-600 flex-shrink-0" title="Inspeccionar (solo lectura)">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-gray-500">
                              <span className="inline-flex items-center gap-1"><Receipt className="w-3 h-3 text-amber-600" /> {c.counts.invoices}</span>
                              <span className="inline-flex items-center gap-1"><FileText className="w-3 h-3 text-emerald-600" /> {c.counts.journalEntries}</span>
                              <span className="inline-flex items-center gap-1"><UserSquare2 className="w-3 h-3 text-blue-600" /> {c.counts.clients}</span>
                              <span className="inline-flex items-center gap-1 ml-auto"><Clock className="w-3 h-3" /> {c.lastActivityAt ? formatDate(c.lastActivityAt) : 'sin asientos'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 mt-6 p-3.5 rounded-card text-xs bg-gold-50 text-gold-900 border border-gold-100">
            <Sparkles className="w-4 h-4 flex-shrink-0 text-gold-700" />
            La práctica libre no afecta la nota. Es evidencia útil de constancia y autoaprendizaje para tu acreditación.
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="text-right">
      <p className="text-base font-bold text-gray-900 font-mono tabular-nums leading-none">{n}</p>
      <p className="text-[11px] text-gray-400">{label}</p>
    </div>
  );
}
