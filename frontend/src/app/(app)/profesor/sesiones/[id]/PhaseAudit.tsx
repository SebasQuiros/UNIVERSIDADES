'use client';

/**
 * Fase AUDITORÍA — el informe del cruce.
 *
 * Doctrina NIA 240: el sistema detecta *diferencias*, nunca "fraude" ni
 * "trampa". Una diferencia puede ser un error, un criterio contable distinto
 * o algo que amerita revisión del docente — son indistinguibles para el
 * sistema. El juicio final es siempre del profesor, no del software. Por eso
 * el vocabulario de esta pantalla es deliberadamente neutral y descriptivo.
 */

import { useState, type ElementType } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { IconTile } from '@/components/ui/IconTile';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { formatDateTime, fmtNum } from '@/lib/utils';
import {
  MOCK_COMPANIES, MOCK_AUDIT_FINDINGS, MOCK_AUDITOR_SUBMISSIONS, AUDIT_ASSIGNMENTS,
  companyName, type AuditCategory, type ReviewPriority,
} from './_mock';
import {
  Info, TrendingUp, Receipt, Percent, Boxes, HelpCircle, CheckCircle2,
  ShieldCheck, ArrowRight, FileSearch, Trophy, Circle,
} from 'lucide-react';

const CATEGORY_META: Record<AuditCategory, { label: string; icon: ElementType }> = {
  INGRESOS:   { label: 'Ingresos',   icon: TrendingUp },
  GASTOS:     { label: 'Gastos',     icon: Receipt },
  IVA:        { label: 'IVA',        icon: Percent },
  INVENTARIO: { label: 'Inventario', icon: Boxes },
  OTRO:       { label: 'Otro',       icon: HelpCircle },
};

const PRIORITY_META: Record<ReviewPriority, { label: string; variant: 'slate' | 'gold' | 'red' }> = {
  BAJA:  { label: 'Prioridad de revisión: baja',  variant: 'slate' },
  MEDIA: { label: 'Prioridad de revisión: media', variant: 'gold' },
  ALTA:  { label: 'Prioridad de revisión: alta',  variant: 'red' },
};

const fmtMoney = (n: number) => `₡ ${fmtNum(n)}`;

export function PhaseAudit({ onAdvance }: { onAdvance: () => void }) {
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());

  function toggleReviewed(id: string) {
    setReviewed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const total = MOCK_AUDIT_FINDINGS.length;
  const reportedCount = MOCK_AUDIT_FINDINGS.filter((f) => f.reportedByAuditor).length;
  const cleanCompanies = MOCK_COMPANIES.filter((c) => !MOCK_AUDIT_FINDINGS.some((f) => f.auditedCompanyId === c.id)).length;
  const highPriority = MOCK_AUDIT_FINDINGS.filter((f) => f.reviewPriority === 'ALTA').length;

  return (
    <div className="space-y-6">
      {/* Doctrina: cómo leer este informe */}
      <div className="flex items-start gap-3.5 rounded-card border border-blue-200 bg-blue-50/70 p-5 shadow-card">
        <IconTile icon={Info} tint="#2563EB" size={44} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-blue-900">Cómo leer este informe</p>
          <p className="mt-1.5 text-sm leading-relaxed text-blue-900/80">
            El sistema cruza automáticamente las dos puntas de cada transacción entre empresas y señala las
            <strong> diferencias sin explicar</strong> que encuentra. Una diferencia puede deberse a un error de
            digitación, a un criterio contable distinto o a algo que amerita revisión — el sistema no puede
            distinguir la intención detrás de un número, así que no lo intenta. Esa lectura te corresponde a vos.
          </p>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Diferencias detectadas" value={String(total)} icon={FileSearch} tint="#1B2E6E" className="cx-pop cx-d1" />
        <StatCard label="Reportadas por los auditores" value={`${reportedCount}/${total}`} icon={ShieldCheck} tint="#059669" hint="Coinciden con el sistema" className="cx-pop cx-d2" />
        <StatCard label="Empresas sin diferencias" value={String(cleanCompanies)} icon={CheckCircle2} tint="#2563EB" className="cx-pop cx-d3" />
        <StatCard label="Prioridad de revisión alta" value={String(highPriority)} icon={Info} tint="#B8860B" hint="Conviene mirarlas primero" className="cx-pop cx-d4" />
      </div>

      {/* Por empresa */}
      <div className="space-y-4">
        {MOCK_COMPANIES.map((company, i) => {
          const auditorId = AUDIT_ASSIGNMENTS[company.id];
          const submission = MOCK_AUDITOR_SUBMISSIONS.find((s) => s.auditedCompanyId === company.id);
          const findings = MOCK_AUDIT_FINDINGS.filter((f) => f.auditedCompanyId === company.id);

          return (
            <SectionCard
              key={company.id}
              icon={FileSearch}
              iconTint={findings.length === 0 ? '#059669' : '#1B2E6E'}
              eyebrow={`Auditada por ${companyName(auditorId)}`}
              title={company.name}
              flushBody
              className={`cx-pop cx-d${Math.min(i + 1, 6)}`}
            >
              {/* Lo que reportó el equipo auditor */}
              {submission && (
                <div className="border-b border-gray-100 bg-gray-50/60 px-6 py-4 lg:px-7">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
                    <ShieldCheck className="h-3.5 w-3.5" /> Reporte del equipo auditor
                    <span className="font-normal normal-case text-gray-400">· {formatDateTime(submission.submittedAt)}</span>
                  </p>
                  <p className="text-sm text-gray-700">
                    “{submission.note}” <span className="text-gray-400">— reportaron {submission.itemsReported} diferencia{submission.itemsReported !== 1 ? 's' : ''}.</span>
                  </p>
                </div>
              )}

              {/* Diferencias detectadas por el sistema */}
              {findings.length === 0 ? (
                <div className="flex items-center gap-3 px-6 py-6 lg:px-7">
                  <IconTile icon={CheckCircle2} tint="#059669" size={40} />
                  <div>
                    <p className="text-sm font-bold text-emerald-700">Sin diferencias detectadas</p>
                    <p className="text-xs text-gray-500">El cruce automático de las dos puntas de cada transacción no encontró nada que señalar.</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {findings.map((f) => {
                    const cat = CATEGORY_META[f.category];
                    const pri = PRIORITY_META[f.reviewPriority];
                    const isReviewed = reviewed.has(f.id);
                    return (
                      <div key={f.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-start lg:px-7">
                        <IconTile icon={cat.icon} tint="#1B2E6E" size={38} className="flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge variant="blue">{cat.label}</Badge>
                            <Badge variant={pri.variant}>{pri.label}</Badge>
                            {f.reportedByAuditor ? (
                              <Badge variant="emerald"><CheckCircle2 className="h-3 w-3" /> Coincide con el auditor</Badge>
                            ) : (
                              <Badge variant="slate"><Circle className="h-3 w-3" /> El auditor no la reportó</Badge>
                            )}
                          </div>
                          <p className="text-sm leading-relaxed text-gray-700">{f.description}</p>
                          {f.amountDetected != null && (
                            <p className="mt-1 text-xs font-mono font-semibold text-gray-500 tabular-nums">
                              Diferencia: {fmtMoney(f.amountDetected)}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => toggleReviewed(f.id)}
                          className={`flex flex-shrink-0 items-center gap-1.5 self-start rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors cx-press ${
                            isReviewed
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {isReviewed ? 'Revisado por el docente' : 'Marcar como revisado'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-3 rounded-card border border-gray-200/70 bg-white p-5 shadow-card sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3">
          <IconTile icon={Trophy} tint="#B8860B" size={40} />
          <p className="text-sm text-gray-600">Publicá los resultados cuando hayas terminado de revisar las diferencias con el grupo.</p>
        </div>
        <Button onClick={onAdvance} className="w-full cx-press sm:w-auto">
          Publicar resultados <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
