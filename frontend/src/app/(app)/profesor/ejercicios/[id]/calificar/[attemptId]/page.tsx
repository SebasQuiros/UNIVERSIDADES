'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ElementType, ReactNode } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate, formatDateTime, getErrorMessage, esc } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { IconTile } from '@/components/ui/IconTile';
import { ArtBalance } from '@/components/illustrations';
import type { ExerciseAttempt } from '@/types';
import toast from 'react-hot-toast';
import {
  ArrowLeft, FileText, BookOpen, Users, Package,
  CheckCircle2, Clock, Send, TrendingUp, Award,
  Zap, ChevronDown, ChevronUp, X, ClipboardCheck,
  AlertTriangle, BarChart2, Printer, RotateCcw, Receipt,
} from 'lucide-react';
import { ExamActivityLog } from '@/components/exam';

// Textura de puntos sutil para la banda hero (fondo azul noche).
const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
};

interface Invoice {
  id: string; consecutiveNumber: string; issueDate: string;
  total: number | string; status: string; clientName: string;
}
interface JournalEntry {
  id: string; entryDate: string; entryNumber: number; description: string; reference: string | null;
  lines: Array<{ account: { code: string; name: string }; debit: number | string; credit: number | string }>;
}
interface RubricResult {
  rubricId: string; criterion: string; description: string;
  points: number; passed: boolean; detail: string;
}
interface AutoGradePreview {
  score: number; maxScore: number; earnedPoints: number; totalPoints: number;
  passedCount: number; totalCount: number;
  results: RubricResult[]; feedbackText: string; rubricComments: Record<string, string>;
}

type AttemptWithStudent = ExerciseAttempt & {
  student?: { id: string; name: string; email: string };
};

/** Check trazado (SVG con pathLength=1) — animación `cx-draw`. */
function DrawnCheck({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden
    >
      <path d="M5 13l4 4L19 7" pathLength={1} className="cx-draw" />
    </svg>
  );
}

/** Tarjeta plegable del expediente del intento (facturas, asientos, rúbricas). */
function CollapsibleCard({ title, eyebrow, icon: Icon, iconTint = '#1B2E6E', children, collapsible = false, className }: {
  title: string; eyebrow?: string; icon: ElementType; iconTint?: string;
  children: ReactNode; collapsible?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className={`mb-6 overflow-hidden rounded-card border border-gray-200/70 bg-white shadow-card ${className ?? ''}`}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-6 py-4 text-left lg:px-7"
        onClick={() => collapsible && setOpen(o => !o)}
      >
        <span className="flex items-center gap-3.5">
          <IconTile icon={Icon} tint={iconTint} size={44} />
          <span className="min-w-0">
            {eyebrow && (
              <span className="block text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">
                {eyebrow}
              </span>
            )}
            <span className="block text-base font-bold tracking-tight text-gray-900">{title}</span>
          </span>
        </span>
        {collapsible && (open
          ? <ChevronUp className="w-4 h-4 flex-shrink-0 text-gray-400" />
          : <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-400" />)}
      </button>
      {open && <div className="px-6 py-5 lg:px-7">{children}</div>}
    </section>
  );
}

export default function GradeAttemptPage() {
  const { id, attemptId } = useParams<{ id: string; attemptId: string }>();
  const searchParams = useSearchParams();
  const courseId = searchParams.get('cursoId') ?? '';
  const router   = useRouter();

  const [attempt,     setAttempt]     = useState<AttemptWithStudent | null>(null);
  const [invoices,    setInvoices]    = useState<Invoice[]>([]);
  const [entries,     setEntries]     = useState<JournalEntry[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [autoing,     setAutoing]     = useState(false);
  const [reopening,   setReopening]   = useState(false);
  const [score,       setScore]       = useState('');
  const [feedback,    setFeedback]    = useState('');
  const [rubricCmts,  setRubricCmts]  = useState<Record<string, string>>({});
  const [preview,     setPreview]     = useState<AutoGradePreview | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<AttemptWithStudent>(`/api/v1/attempts/${attemptId}`);
      setAttempt(data);
      if (data.score != null) setScore(String(data.score));
      if (data.feedback) {
        try {
          const parsed = JSON.parse(data.feedback as string);
          if (parsed?.text) setFeedback(parsed.text);
          if (parsed?.rubric) setRubricCmts(parsed.rubric);
        } catch { setFeedback(data.feedback as string); }
      }
      const companyId = data.company?.id;
      if (companyId) {
        const [invRes, jRes] = await Promise.allSettled([
          api.get<Invoice[] | { invoices: Invoice[] }>(`/api/v1/companies/${companyId}/invoices`),
          api.get<{ entries: JournalEntry[] }>(`/api/v1/companies/${companyId}/journal`),
        ]);
        if (invRes.status === 'fulfilled') {
          const d = invRes.value.data;
          setInvoices(Array.isArray(d) ? d : d.invoices ?? []);
        }
        if (jRes.status  === 'fulfilled') {
          const d = jRes.value.data;
          setEntries(Array.isArray(d) ? d : d.entries ?? []);
        }
      }
    } catch { toast.error('Error al cargar el intento'); }
    finally  { setLoading(false); }
  }, [attemptId]);

  useEffect(() => { load(); }, [load]);

  async function handleAutoGrade() {
    setAutoing(true);
    try {
      const { data } = await api.post<AutoGradePreview>(`/api/v1/attempts/${attemptId}/auto-grade`);
      setPreview(data);
      setShowPreview(true);
      // Pre-carga puntaje y retroalimentación desde la vista previa
      setScore(String(data.score));
      setFeedback(data.feedbackText);
      setRubricCmts(data.rubricComments);
      toast.success(`Auto-calificación: ${data.passedCount}/${data.totalCount} criterios cumplidos`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAutoing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!attempt) return;
    const numScore = Number(score);
    const max = Number(attempt.maxScore);
    if (isNaN(numScore) || numScore < 0 || numScore > max) {
      toast.error(`Puntaje debe estar entre 0 y ${max}`); return;
    }
    setSaving(true);
    try {
      await api.post(`/api/v1/attempts/${attemptId}/grade`, {
        score:         numScore,
        feedback:      feedback || undefined,
        rubricComments: Object.keys(rubricCmts).length ? rubricCmts : undefined,
      });
      toast.success('Calificación enviada exitosamente');
      router.push(courseId ? `/profesor/ejercicios/${id}?cursoId=${courseId}` : '/profesor/pendientes');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleReopen() {
    if (!attempt) return;
    if (!confirm('¿Reabrir este intento? El estudiante podrá corregir y volver a entregar. Se borrará la calificación actual.')) return;
    setReopening(true);
    try {
      await api.post(`/api/v1/attempts/${attemptId}/reopen`);
      toast.success('Intento reabierto. El estudiante puede corregir.');
      router.push(courseId ? `/profesor/ejercicios/${id}?cursoId=${courseId}` : '/profesor/pendientes');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setReopening(false);
    }
  }

  if (loading) return <div className="flex-1 flex items-center justify-center bg-[#FBF8F1]"><Spinner size="lg" /></div>;
  if (!attempt) return null;

  const isAlreadyGraded = attempt.status === 'GRADED';
  const prog     = attempt.studentProgress;
  const exercise = attempt.exercise!;
  const student  = attempt.student;
  const company  = attempt.company;
  const hasRubricsWithCriteria = exercise.rubrics?.some((r) => r.criterion);
  const canAutoGrade = !isAlreadyGraded && hasRubricsWithCriteria && !!company;

  function handlePrintReport() {
    if (!attempt) return;
    const fmt = (n: number) => '₡' + n.toLocaleString('es-CR', { minimumFractionDigits: 2 });
    const dateStr = new Date().toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' });

    // Parse feedback
    let feedbackText = '';
    let parsedRubricCmts: Record<string, string> = {};
    if (attempt?.feedback) {
      try {
        const p = JSON.parse(attempt.feedback as string);
        feedbackText = p.text || '';
        parsedRubricCmts = p.rubric || {};
      } catch { feedbackText = attempt.feedback as string; }
    }

    // Rubrics HTML
    const rubricsHtml = exercise.rubrics?.length
      ? `<div class="section">
          <div class="section-header">Rúbricas de evaluación</div>
          ${exercise.rubrics.map((r) => {
            const comment = parsedRubricCmts[r.id] || rubricCmts[r.id] || '';
            const passed  = comment.startsWith('✓');
            const failed  = comment.startsWith('✗');
            return `<div class="row" style="align-items:flex-start;gap:12px;padding:8px 14px;${passed ? 'background:#f0fdf4' : failed ? 'background:#fef2f2' : ''}">
              <span style="font-size:14px;flex-shrink:0">${passed ? '✓' : failed ? '✗' : '·'}</span>
              <div style="flex:1">
                <div style="font-size:12px;font-weight:600;color:#111827">${esc(r.description)}</div>
                ${r.criterion ? `<div style="font-size:11px;font-family:monospace;color:#2563EB;margin-top:2px">${esc(r.criterion)}${r.expectedValue ? ` = ${esc(r.expectedValue)}` : ''}</div>` : ''}
                ${comment ? `<div style="font-size:11px;color:${passed ? '#15803d' : failed ? '#b91c1c' : '#6b7280'};margin-top:2px">${esc(comment)}</div>` : ''}
              </div>
              <span style="font-size:12px;font-weight:bold;color:#374151;flex-shrink:0">${Number(r.points)} pts</span>
            </div>`;
          }).join('')}
        </div>` : '';

    // Invoices HTML
    const invoicesHtml = invoices.length
      ? `<div class="section">
          <div class="section-header">Facturas (${invoices.length})</div>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="color:#6b7280;border-bottom:1px solid #e5e7eb;text-align:left">
              <th style="padding:6px 14px">Número</th>
              <th style="padding:6px 14px">Cliente</th>
              <th style="padding:6px 14px">Fecha</th>
              <th style="padding:6px 14px;text-align:right">Total</th>
              <th style="padding:6px 14px;text-align:right">Estado</th>
            </tr></thead>
            <tbody>${invoices.map(inv => `
              <tr style="border-top:1px solid #f3f4f6">
                <td style="padding:5px 14px;font-family:monospace;color:#2563EB">${esc(inv.consecutiveNumber)}</td>
                <td style="padding:5px 14px;color:#374151">${esc(inv.clientName)}</td>
                <td style="padding:5px 14px;color:#6b7280">${new Date(inv.issueDate).toLocaleDateString('es-CR')}</td>
                <td style="padding:5px 14px;text-align:right;font-weight:600">${fmt(Number(inv.total))}</td>
                <td style="padding:5px 14px;text-align:right;color:${inv.status === 'ACCEPTED' ? '#15803d' : '#6b7280'}">${inv.status === 'DRAFT' ? 'Borrador' : inv.status === 'ACCEPTED' ? 'Aceptada' : esc(inv.status)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : '';

    // Journal entries HTML
    const entriesHtml = entries.length
      ? `<div class="section" style="page-break-before:auto">
          <div class="section-header">Asientos contables (${entries.length})</div>
          ${entries.map(e => `
            <div style="margin:8px 14px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
              <div style="background:#f9fafb;padding:6px 12px;display:flex;justify-content:space-between;border-bottom:1px solid #e5e7eb">
                <span style="font-size:12px;font-weight:600;color:#374151">#${Number(e.entryNumber)} — ${esc(e.description)}${e.reference ? ` · ${esc(e.reference)}` : ''}</span>
                <span style="font-size:11px;color:#9ca3af">${new Date(e.entryDate).toLocaleDateString('es-CR')}</span>
              </div>
              <table style="width:100%;border-collapse:collapse;font-size:11px">
                <thead><tr style="color:#9ca3af;text-align:right">
                  <th style="text-align:left;padding:4px 12px">Cuenta</th>
                  <th style="padding:4px 8px">Débito</th>
                  <th style="padding:4px 12px">Crédito</th>
                </tr></thead>
                <tbody>${e.lines.map(l => `
                  <tr style="border-top:1px solid #f9fafb">
                    <td style="padding:3px 12px;color:#374151"><span style="font-family:monospace;color:#9ca3af">${esc(l.account.code)}</span> ${esc(l.account.name)}</td>
                    <td style="padding:3px 8px;text-align:right;color:#374151">${Number(l.debit) > 0 ? fmt(Number(l.debit)) : '—'}</td>
                    <td style="padding:3px 12px;text-align:right;color:#374151">${Number(l.credit) > 0 ? fmt(Number(l.credit)) : '—'}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>`).join('')}
        </div>` : '';

    const maxScoreNum = Number(attempt.maxScore);
    const scorePct = attempt.score != null && maxScoreNum > 0
      ? Math.round((Number(attempt.score) / maxScoreNum) * 100) : null;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Calificación — ${esc(student?.name ?? '')} — ${esc(exercise.title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111827; background: #fff; padding: 32px 40px; }
  .doc-header { border-bottom: 2px solid #2563EB; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
  .doc-header .left .title { font-size: 20px; font-weight: bold; color: #03080F; }
  .doc-header .left .sub { font-size: 13px; color: #374151; margin-top: 4px; }
  .doc-header .left .meta { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .doc-header .right { text-align: right; }
  .score-box { background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 8px; padding: 12px 20px; display: inline-block; }
  .score-box .num { font-size: 36px; font-weight: 900; color: #15803d; line-height: 1; }
  .score-box .den { font-size: 14px; color: #6b7280; }
  .score-box .pct { font-size: 13px; font-weight: 700; color: #16a34a; margin-top: 2px; }
  .stats-row { display: flex; gap: 12px; margin-bottom: 20px; }
  .stat { flex: 1; text-align: center; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 8px; }
  .stat .val { font-size: 20px; font-weight: bold; color: #2563EB; }
  .stat .lbl { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .feedback-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
  .feedback-box .label { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; color: #2563EB; margin-bottom: 6px; }
  .section { margin-bottom: 18px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; page-break-inside: avoid; }
  .section-header { background: #f9fafb; padding: 8px 14px; font-weight: bold; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #374151; border-bottom: 1px solid #e5e7eb; }
  .row { display: flex; align-items: center; padding: 6px 14px; border-top: 1px solid #f3f4f6; gap: 8px; }
  .doc-footer { margin-top: 28px; border-top: 1px solid #e5e7eb; padding-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }
  @media print { body { padding: 16px 20px; } @page { margin: 1.5cm; size: A4; } }
</style></head><body>

  <div class="doc-header">
    <div class="left">
      <div class="title">${esc(student?.name ?? '—')}</div>
      <div class="sub">${esc(exercise.title)}</div>
      <div class="meta">
        ${company ? `Empresa: ${esc(company.name)} · ` : ''}
        ${attempt.submittedAt ? `Entregado: ${new Date(attempt.submittedAt).toLocaleDateString('es-CR')} · ` : ''}
        Generado: ${dateStr}
      </div>
    </div>
    ${attempt.score != null ? `
    <div class="right">
      <div class="score-box">
        <div class="num">${Number(attempt.score)}</div>
        <div class="den">/ ${Number(attempt.maxScore)} pts</div>
        ${scorePct != null ? `<div class="pct">${Number(scorePct)}%</div>` : ''}
      </div>
    </div>` : ''}
  </div>

  ${prog ? `
  <div class="stats-row">
    <div class="stat"><div class="val">${prog.clientsCount ?? 0}</div><div class="lbl">Clientes</div></div>
    <div class="stat"><div class="val">${prog.productsCount ?? 0}</div><div class="lbl">Productos</div></div>
    <div class="stat"><div class="val">${prog.invoicesCount ?? 0}</div><div class="lbl">Facturas</div></div>
    <div class="stat"><div class="val">${prog.entriesCount ?? 0}</div><div class="lbl">Asientos</div></div>
    <div class="stat"><div class="val">${prog.timeSpentMin ?? 0}m</div><div class="lbl">Tiempo</div></div>
  </div>` : ''}

  ${feedbackText ? `
  <div class="feedback-box">
    <div class="label">Retroalimentación del profesor</div>
    <div style="font-size:13px;color:#03080F">${esc(feedbackText)}</div>
  </div>` : ''}

  ${rubricsHtml}
  ${invoicesHtml}
  ${entriesHtml}

  <div class="doc-footer">
    <span>ContaSJ · ${dateStr}</span>
    <span>${esc(exercise.title)} — ${esc(student?.name ?? '')}</span>
  </div>
  <script>window.onload = function() { window.print(); }<\/script>
</body></html>`);
    win.document.close();
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#FBF8F1] p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">

        {/* Breadcrumb */}
        <div className="mb-5 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/profesor/pendientes" className="flex items-center gap-1 transition-colors hover:text-gray-700">
            <ArrowLeft className="w-3.5 h-3.5" /> Pendientes
          </Link>
          <span className="text-gray-300">/</span>
          <span className="font-medium text-gray-700">Calificar</span>
        </div>

        {/* Cabecera — banda azul noche con el expediente del estudiante */}
        <div className="relative mb-6 overflow-hidden rounded-card shadow-soft lp-in bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
          <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
          <div aria-hidden className="pointer-events-none absolute right-6 bottom-4 hidden opacity-95 xl:block">
            <ArtBalance size={140} className="cx-float" />
          </div>
          <div className="relative flex flex-wrap items-start gap-5 p-6 lg:p-8">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-xl font-extrabold text-white">
              {student?.name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-gold-500">
                Calificación
              </p>
              <div className="mb-1 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-extrabold tracking-tight text-white">{student?.name ?? '—'}</h1>
                <StatusBadge status={attempt.status} />
              </div>
              <p className="text-sm text-blue-200/80">{student?.email}</p>
              <p className="mt-0.5 text-sm font-semibold text-blue-100">{exercise.title}</p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-blue-200/80">
                {prog?.timeSpentMin != null && (
                  <span className="flex items-center gap-1.5 tabular-nums">
                    <Clock className="w-3.5 h-3.5" />{prog.timeSpentMin} min
                  </span>
                )}
                {attempt.startedAt   && <span className="tabular-nums">Inicio: {formatDateTime(attempt.startedAt)}</span>}
                {attempt.submittedAt && <span className="tabular-nums">Envío: {formatDateTime(attempt.submittedAt)}</span>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-3">
              {isAlreadyGraded && (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-right cx-tada">
                  <p className="text-3xl font-extrabold text-emerald-300 tabular-nums">{attempt.score}</p>
                  <p className="text-xs text-blue-200/80 tabular-nums">/ {attempt.maxScore} pts</p>
                </div>
              )}
              <Button variant="secondary" size="sm" onClick={handlePrintReport} className="cx-press">
                <Printer className="w-3.5 h-3.5" />
                Exportar PDF
              </Button>
            </div>
          </div>
        </div>

        {/* Métricas del intento */}
        {prog && (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Clientes"  value={String(prog.clientsCount  ?? 0)} icon={Users}   tint="#B8860B" className="cx-pop cx-d1" />
            <StatCard label="Productos" value={String(prog.productsCount ?? 0)} icon={Package} tint="#1B2E6E" className="cx-pop cx-d2" />
            <StatCard label="Facturas"  value={String(prog.invoicesCount ?? 0)} icon={Receipt} tint="#2563EB" className="cx-pop cx-d3" />
            <StatCard label="Asientos"  value={String(prog.entriesCount  ?? 0)} icon={BookOpen} tint="#059669" className="cx-pop cx-d4" />
          </div>
        )}

        {/* Rúbricas */}
        {exercise.rubrics && exercise.rubrics.length > 0 && (
          <CollapsibleCard
            title="Rúbricas de evaluación"
            eyebrow="Criterios"
            icon={ClipboardCheck}
            iconTint="#B8860B"
            collapsible
            className="cx-pop"
          >
            <div className="space-y-2">
              {exercise.rubrics.map((r) => {
                const comment = rubricCmts[r.id];
                const passed  = comment?.startsWith('✓');
                const failed  = comment?.startsWith('✗');
                return (
                  <div
                    key={r.id}
                    className={`flex items-start justify-between gap-4 rounded-xl border p-3.5 ${
                      passed ? 'border-emerald-200 bg-emerald-50'
                      : failed ? 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2.5">
                      {passed && <DrawnCheck className="mt-0.5 w-4 h-4 flex-shrink-0 text-emerald-600" />}
                      {failed && <X className="mt-0.5 w-4 h-4 flex-shrink-0 text-red-600" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{r.description}</p>
                        {r.criterion && (
                          <p className="mt-0.5 font-mono text-xs text-blue-700">
                            {r.criterion}{r.expectedValue ? ` = ${r.expectedValue}` : ''}
                          </p>
                        )}
                        {comment && (
                          <p className={`mt-1 text-xs ${passed ? 'text-emerald-700' : failed ? 'text-red-700' : 'text-gray-500'}`}>
                            {comment}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="flex-shrink-0 text-sm font-bold text-gray-500 tabular-nums">{r.points} pts</span>
                  </div>
                );
              })}
            </div>
          </CollapsibleCard>
        )}

        {/* Vista previa de auto-calificación */}
        {showPreview && preview && (
          <div className="mb-6 overflow-hidden rounded-card border-2 border-blue-200 bg-white shadow-card-hover cx-pop">
            <div className="flex items-center justify-between border-b border-blue-200 bg-blue-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <IconTile icon={Zap} tint="#2563EB" size={40} className="cx-wiggle-loop" />
                <div>
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">Sugerencia</p>
                  <h3 className="font-bold tracking-tight text-blue-900">Resultado de auto-calificación</h3>
                </div>
              </div>
              <button onClick={() => setShowPreview(false)} className="text-blue-500 hover:text-blue-700 cx-press" aria-label="Cerrar">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-3 gap-4 border-b border-blue-100 p-6">
              <div className="text-center">
                <p className="text-3xl font-extrabold text-blue-700 tabular-nums cx-count">{preview.score}</p>
                <p className="mt-0.5 text-xs text-gray-500 tabular-nums">/ {preview.maxScore} pts</p>
                <p className="mt-1 text-xs font-bold text-blue-700">Puntaje sugerido</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-extrabold text-emerald-600 tabular-nums cx-count">{preview.passedCount}</p>
                <p className="mt-0.5 text-xs text-gray-500 tabular-nums">/ {preview.totalCount} criterios</p>
                <p className="mt-1 text-xs font-bold text-emerald-600">Aprobados</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-extrabold text-gray-700 tabular-nums cx-count">
                  {preview.totalPoints > 0 ? Math.round((preview.earnedPoints / preview.totalPoints) * 100) : 0}%
                </p>
                <p className="mt-0.5 text-xs text-gray-500 tabular-nums">
                  {preview.earnedPoints.toFixed(1)} / {preview.totalPoints.toFixed(1)} pts rúbrica
                </p>
                <p className="mt-1 text-xs font-bold text-gray-600">Porcentaje</p>
              </div>
            </div>

            {/* Resultado por criterio */}
            <div className="space-y-2 p-6">
              {preview.results.map((r, i) => (
                <div
                  key={r.rubricId}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 cx-pop cx-d${Math.min(i + 1, 6)} ${
                    r.passed ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                    r.passed ? 'bg-emerald-500' : 'bg-red-500'
                  }`}>
                    {r.passed
                      ? <DrawnCheck className="w-3.5 h-3.5 text-white" />
                      : <X className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800">{r.description}</p>
                    <p className={`mt-0.5 text-xs ${r.passed ? 'text-emerald-700' : 'text-red-700'}`}>{r.detail}</p>
                  </div>
                  <span className={`flex-shrink-0 text-xs font-bold tabular-nums ${r.passed ? 'text-emerald-700' : 'text-red-600'}`}>
                    {r.passed ? `+${r.points}` : `0/${r.points}`} pts
                  </span>
                </div>
              ))}
            </div>

            <div className="px-6 pb-6">
              <p className="flex items-center gap-1.5 text-xs text-gray-500">
                <AlertTriangle className="w-3.5 h-3.5 text-gold-600" />
                El puntaje quedó pre-cargado en el formulario. Puedes ajustarlo antes de confirmar.
              </p>
            </div>
          </div>
        )}

        {/* Empresa */}
        {company && (
          <div className="mb-4 px-1">
            <p className="text-xs font-medium text-gray-500">
              Empresa: <span className="font-semibold text-gray-700">{company.name}</span>
            </p>
          </div>
        )}

        {/* Facturas */}
        {invoices.length > 0 && (
          <CollapsibleCard
            title={`Facturas (${invoices.length})`}
            eyebrow="Evidencia"
            icon={FileText}
            iconTint="#2563EB"
            collapsible
            className="cx-pop cx-d2"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                    <th className="pb-3 text-left">Número</th>
                    <th className="pb-3 text-left">Cliente</th>
                    <th className="pb-3 text-left">Fecha</th>
                    <th className="pb-3 text-right">Total</th>
                    <th className="pb-3 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="transition-colors hover:bg-blue-50/50">
                      <td className="py-3 font-mono text-xs text-blue-700">{inv.consecutiveNumber}</td>
                      <td className="py-3 text-gray-700">{inv.clientName}</td>
                      <td className="py-3 text-gray-500">{formatDate(inv.issueDate)}</td>
                      <td className="py-3 text-right font-semibold text-gray-800 tabular-nums">
                        ₡{Number(inv.total).toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-right">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          inv.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          inv.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-gray-100 text-gray-600 border-gray-200'
                        }`}>
                          {inv.status === 'DRAFT' ? 'Borrador' : inv.status === 'ACCEPTED' ? 'Aceptada' : inv.status === 'REJECTED' ? 'Rechazada' : inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleCard>
        )}

        {/* Asientos contables */}
        {entries.length > 0 && (
          <CollapsibleCard
            title={`Asientos contables (${entries.length})`}
            eyebrow="Doble partida"
            icon={BookOpen}
            iconTint="#059669"
            collapsible
            className="cx-pop cx-d3"
          >
            <div className="space-y-4">
              {entries.map(entry => (
                <div key={entry.id} className="overflow-hidden rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">#{entry.entryNumber} — {entry.description}</p>
                      {entry.reference && <p className="text-xs text-gray-500">Ref: {entry.reference}</p>}
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(entry.entryDate)}</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400">
                        <th className="p-3 text-left">Cuenta</th>
                        <th className="p-3 text-right">Débito</th>
                        <th className="p-3 text-right">Crédito</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.lines.map((line, i) => (
                        <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-blue-50/50">
                          <td className="p-3 text-gray-600">
                            <span className="font-mono text-gray-400">{line.account.code}</span> {line.account.name}
                          </td>
                          <td className="p-3 text-right text-gray-700 tabular-nums">
                            {Number(line.debit) > 0 ? `₡${Number(line.debit).toLocaleString('es-CR', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="p-3 text-right text-gray-700 tabular-nums">
                            {Number(line.credit) > 0 ? `₡${Number(line.credit).toLocaleString('es-CR', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </CollapsibleCard>
        )}

        {/* Registro de actividad del examen */}
        <div className="mb-6">
          <ExamActivityLog attemptId={attemptId} defaultExpanded={false} />
        </div>

        {/* Formulario de calificación */}
        <SectionCard
          icon={isAlreadyGraded ? Award : TrendingUp}
          iconTint={isAlreadyGraded ? '#059669' : '#1B2E6E'}
          eyebrow={isAlreadyGraded ? 'Cerrado' : 'Acción'}
          title={isAlreadyGraded ? 'Calificación enviada' : 'Enviar calificación'}
          className="mb-8 cx-pop"
          action={
            canAutoGrade ? (
              <Button type="button" size="sm" onClick={handleAutoGrade} loading={autoing} className="cx-press">
                <Zap className="w-4 h-4" />
                Auto-calificar
              </Button>
            ) : !isAlreadyGraded ? (
              <p className="flex items-center gap-1 text-xs text-gray-400">
                <BarChart2 className="w-3.5 h-3.5" />
                {!company ? 'Sin empresa creada' : 'Sin rúbricas con criterios'}
              </p>
            ) : undefined
          }
        >
          {isAlreadyGraded && attempt.feedback && (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Retroalimentación enviada
              </p>
              <p className="text-sm text-gray-700">
                {(() => {
                  try { const p = JSON.parse(attempt.feedback as string); return p.text || attempt.feedback; }
                  catch { return attempt.feedback as string; }
                })()}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                Puntaje * <span className="font-normal text-gray-400 tabular-nums">(0 – {attempt.maxScore} pts)</span>
              </label>
              <input
                type="number" min="0" max={Number(attempt.maxScore)} step="0.5"
                value={score}
                onChange={e => setScore(e.target.value)}
                disabled={isAlreadyGraded}
                placeholder={`0 – ${attempt.maxScore}`}
                className="w-full max-w-xs rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 tabular-nums focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60 disabled:opacity-50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Retroalimentación</label>
              <textarea
                rows={4} value={feedback}
                onChange={e => setFeedback(e.target.value)}
                disabled={isAlreadyGraded}
                placeholder="Escribe comentarios para el estudiante sobre su trabajo…"
                className="w-full resize-none rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60 disabled:opacity-50"
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => router.back()} className="cx-press">
                <ArrowLeft className="w-4 h-4" /> Volver
              </Button>
              {(attempt.status === 'SUBMITTED' || attempt.status === 'GRADED') && (
                <Button type="button" variant="outline" loading={reopening} onClick={handleReopen} className="cx-press">
                  <RotateCcw className="w-4 h-4" /> Reabrir intento
                </Button>
              )}
              {!isAlreadyGraded && (
                <Button type="submit" loading={saving} disabled={!score} className="cx-press">
                  <Send className="w-4 h-4" />
                  {preview ? 'Confirmar calificación' : 'Enviar calificación'}
                </Button>
              )}
            </div>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}
