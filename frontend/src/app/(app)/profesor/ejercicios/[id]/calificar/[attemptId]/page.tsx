'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate, formatDateTime, getErrorMessage, esc } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { ExerciseAttempt } from '@/types';
import toast from 'react-hot-toast';
import {
  ArrowLeft, FileText, BookOpen,
  CheckCircle2, Clock, Send, TrendingUp,
  Zap, ChevronDown, ChevronUp, X, Check,
  AlertTriangle, BarChart2, Printer, Eye,
} from 'lucide-react';
import { ExamActivityLog } from '@/components/exam';

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

function SectionCard({ title, icon, children, collapsible = false }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; collapsible?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden mb-6">
      <button
        className="w-full flex items-center justify-between gap-2 p-5 border-b border-gray-200 text-left"
        onClick={() => collapsible && setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-gray-900">
          <span className="text-blue-600">{icon}</span>
          {title}
        </span>
        {collapsible && (open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />)}
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

export default function GradeAttemptPage() {
  const { id, attemptId } = useParams<{ id: string; attemptId: string }>();
  const searchParams = useSearchParams();
  const courseId = searchParams.get('cursoId') ?? '';
  const router   = useRouter();

  const [attempt,     setAttempt]     = useState<ExerciseAttempt | null>(null);
  const [invoices,    setInvoices]    = useState<Invoice[]>([]);
  const [entries,     setEntries]     = useState<JournalEntry[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [autoing,     setAutoing]     = useState(false);
  const [score,       setScore]       = useState('');
  const [feedback,    setFeedback]    = useState('');
  const [rubricCmts,  setRubricCmts]  = useState<Record<string, string>>({});
  const [preview,     setPreview]     = useState<AutoGradePreview | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ExerciseAttempt>(`/api/v1/attempts/${attemptId}`);
      setAttempt(data);
      if (data.score != null) setScore(String(data.score));
      if (data.feedback) {
        try {
          const parsed = JSON.parse(data.feedback as string);
          if (parsed?.text) setFeedback(parsed.text);
          if (parsed?.rubric) setRubricCmts(parsed.rubric);
        } catch { setFeedback(data.feedback as string); }
      }
      const companyId = (data as any).company?.id;
      if (companyId) {
        const [invRes, jRes] = await Promise.allSettled([
          api.get<Invoice[] | { invoices: Invoice[] }>(`/api/v1/companies/${companyId}/invoices`),
          api.get<{ entries: JournalEntry[] }>(`/api/v1/companies/${companyId}/journal`),
        ]);
        if (invRes.status === 'fulfilled') {
          const d = invRes.value.data;
          setInvoices(Array.isArray(d) ? d : (d as any).invoices ?? []);
        }
        if (jRes.status  === 'fulfilled') {
          const d = jRes.value.data;
          setEntries(Array.isArray(d) ? d : (d as any).entries ?? []);
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
      // Pre-fill score and feedback from preview
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

  if (loading) return <div className="flex-1 flex items-center justify-center"><Spinner size="lg" /></div>;
  if (!attempt) return null;

  const isAlreadyGraded = attempt.status === 'GRADED';
  const prog     = attempt.studentProgress;
  const exercise = attempt.exercise!;
  const student  = (attempt as any).student;
  const company  = (attempt as any).company;
  const hasRubricsWithCriteria = exercise.rubrics?.some((r: any) => r.criterion);
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
          ${exercise.rubrics.map((r: any) => {
            const comment = parsedRubricCmts[r.id] || rubricCmts[r.id] || '';
            const passed  = comment.startsWith('✓');
            const failed  = comment.startsWith('✗');
            return `<div class="row" style="align-items:flex-start;gap:12px;padding:8px 14px;${passed ? 'background:#f0fdf4' : failed ? 'background:#fef2f2' : ''}">
              <span style="font-size:14px;flex-shrink:0">${passed ? '✓' : failed ? '✗' : '·'}</span>
              <div style="flex:1">
                <div style="font-size:12px;font-weight:600;color:#111827">${esc(r.description)}</div>
                ${r.criterion ? `<div style="font-size:11px;font-family:monospace;color:#2563eb;margin-top:2px">${esc(r.criterion)}${r.expectedValue ? ` = ${esc(r.expectedValue)}` : ''}</div>` : ''}
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
                <td style="padding:5px 14px;font-family:monospace;color:#2563eb">${esc(inv.consecutiveNumber)}</td>
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
  .doc-header { border-bottom: 2px solid #1e40af; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
  .doc-header .left .title { font-size: 20px; font-weight: bold; color: #1e3a8a; }
  .doc-header .left .sub { font-size: 13px; color: #374151; margin-top: 4px; }
  .doc-header .left .meta { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .doc-header .right { text-align: right; }
  .score-box { background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 8px; padding: 12px 20px; display: inline-block; }
  .score-box .num { font-size: 36px; font-weight: 900; color: #15803d; line-height: 1; }
  .score-box .den { font-size: 14px; color: #6b7280; }
  .score-box .pct { font-size: 13px; font-weight: 700; color: #16a34a; margin-top: 2px; }
  .stats-row { display: flex; gap: 12px; margin-bottom: 20px; }
  .stat { flex: 1; text-align: center; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 8px; }
  .stat .val { font-size: 20px; font-weight: bold; color: #1d4ed8; }
  .stat .lbl { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .feedback-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
  .feedback-box .label { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; color: #1d4ed8; margin-bottom: 6px; }
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
    <div style="font-size:13px;color:#1e3a8a">${esc(feedbackText)}</div>
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
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/profesor/pendientes" className="hover:text-gray-700 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Pendientes
          </Link>
          <span>/</span>
          <span className="text-gray-700">Calificar</span>
        </div>

        {/* Header */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-600 flex-shrink-0">
              {student?.name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h2 className="text-xl font-bold text-gray-900">{student?.name ?? '—'}</h2>
                <StatusBadge status={attempt.status} />
              </div>
              <p className="text-gray-500 text-sm">{student?.email}</p>
              <p className="text-gray-500 text-sm mt-0.5 font-medium">{exercise.title}</p>
              <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                {prog?.timeSpentMin != null && (
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{prog.timeSpentMin} min</span>
                )}
                {attempt.startedAt   && <span>Inicio: {formatDateTime(attempt.startedAt)}</span>}
                {attempt.submittedAt && <span>Envío: {formatDateTime(attempt.submittedAt)}</span>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {isAlreadyGraded && (
                <div className="text-right">
                  <p className="text-3xl font-bold text-emerald-600">{attempt.score}</p>
                  <p className="text-xs text-gray-400">/ {attempt.maxScore} pts</p>
                </div>
              )}
              <button
                onClick={handlePrintReport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 rounded-xl transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                Exportar PDF
              </button>
            </div>
          </div>
        </div>

        {/* Progress stats */}
        {prog && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Clientes',  value: prog.clientsCount  ?? 0, color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200'   },
              { label: 'Productos', value: prog.productsCount ?? 0, color: 'text-purple-600',  bg: 'bg-purple-50 border-purple-200' },
              { label: 'Facturas',  value: prog.invoicesCount ?? 0, color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200'     },
              { label: 'Asientos',  value: prog.entriesCount  ?? 0, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-4 text-center border ${s.bg}`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Rubrics */}
        {exercise.rubrics && exercise.rubrics.length > 0 && (
          <SectionCard title="Rúbricas de evaluación" icon={<CheckCircle2 className="w-4 h-4" />} collapsible>
            <div className="space-y-2">
              {exercise.rubrics.map((r: any) => (
                <div key={r.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700">{r.description}</p>
                    {r.criterion && (
                      <p className="text-xs text-blue-600 mt-0.5 font-mono">
                        {r.criterion}{r.expectedValue ? ` = ${r.expectedValue}` : ''}
                      </p>
                    )}
                    {rubricCmts[r.id] && (
                      <p className="text-xs text-gray-500 mt-1 italic">{rubricCmts[r.id]}</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-gray-500 flex-shrink-0">{r.points} pts</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Auto-grade preview panel */}
        {showPreview && preview && (
          <div className="bg-white border-2 border-blue-200 shadow-md rounded-2xl overflow-hidden mb-6">
            <div className="flex items-center justify-between p-5 bg-blue-50 border-b border-blue-200">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-blue-900">Resultado de Auto-calificación</h3>
              </div>
              <button onClick={() => setShowPreview(false)} className="text-blue-400 hover:text-blue-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Score summary */}
            <div className="grid grid-cols-3 gap-4 p-5 border-b border-blue-100">
              <div className="text-center">
                <p className="text-3xl font-black text-blue-700">{preview.score}</p>
                <p className="text-xs text-gray-500 mt-0.5">/ {preview.maxScore} pts</p>
                <p className="text-xs font-semibold text-blue-600 mt-1">Puntaje sugerido</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-black text-emerald-600">{preview.passedCount}</p>
                <p className="text-xs text-gray-500 mt-0.5">/ {preview.totalCount} criterios</p>
                <p className="text-xs font-semibold text-emerald-600 mt-1">Aprobados</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-black text-gray-700">
                  {preview.totalPoints > 0 ? Math.round((preview.earnedPoints / preview.totalPoints) * 100) : 0}%
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{preview.earnedPoints.toFixed(1)} / {preview.totalPoints.toFixed(1)} pts rubrica</p>
                <p className="text-xs font-semibold text-gray-600 mt-1">Porcentaje</p>
              </div>
            </div>

            {/* Per-criterion results */}
            <div className="p-5 space-y-2">
              {preview.results.map(r => (
                <div key={r.rubricId} className={`flex items-start gap-3 p-3 rounded-xl border ${
                  r.passed
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    r.passed ? 'bg-emerald-500' : 'bg-red-500'
                  }`}>
                    {r.passed
                      ? <Check className="w-3.5 h-3.5 text-white" />
                      : <X    className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{r.description}</p>
                    <p className={`text-xs mt-0.5 ${r.passed ? 'text-emerald-600' : 'text-red-600'}`}>{r.detail}</p>
                  </div>
                  <span className={`text-xs font-bold flex-shrink-0 ${r.passed ? 'text-emerald-700' : 'text-red-500'}`}>
                    {r.passed ? `+${r.points}` : `0/${r.points}`} pts
                  </span>
                </div>
              ))}
            </div>

            <div className="px-5 pb-5">
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                El puntaje ha sido pre-cargado en el formulario. Puedes ajustarlo antes de confirmar.
              </p>
            </div>
          </div>
        )}

        {/* Company info */}
        {company && (
          <div className="mb-4 px-1">
            <p className="text-xs text-gray-500 font-medium">Empresa: <span className="text-gray-700">{company.name}</span></p>
          </div>
        )}

        {/* Invoices */}
        {invoices.length > 0 && (
          <SectionCard title={`Facturas (${invoices.length})`} icon={<FileText className="w-4 h-4" />} collapsible>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                    <th className="text-left pb-3">Número</th>
                    <th className="text-left pb-3">Cliente</th>
                    <th className="text-left pb-3">Fecha</th>
                    <th className="text-right pb-3">Total</th>
                    <th className="text-right pb-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="py-3 text-blue-600 font-mono text-xs">{inv.consecutiveNumber}</td>
                      <td className="py-3 text-gray-700">{inv.clientName}</td>
                      <td className="py-3 text-gray-500">{formatDate(inv.issueDate)}</td>
                      <td className="py-3 text-right text-gray-700 font-medium">
                        ₡{Number(inv.total).toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-right">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
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
          </SectionCard>
        )}

        {/* Journal entries */}
        {entries.length > 0 && (
          <SectionCard title={`Asientos contables (${entries.length})`} icon={<BookOpen className="w-4 h-4" />} collapsible>
            <div className="space-y-4">
              {entries.map(entry => (
                <div key={entry.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
                    <div>
                      <p className="text-sm font-medium text-gray-700">#{entry.entryNumber} — {entry.description}</p>
                      {entry.reference && <p className="text-xs text-gray-500">Ref: {entry.reference}</p>}
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(entry.entryDate)}</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-100">
                        <th className="text-left p-3">Cuenta</th>
                        <th className="text-right p-3">Débito</th>
                        <th className="text-right p-3">Crédito</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.lines.map((line, i) => (
                        <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                          <td className="p-3 text-gray-600">
                            <span className="font-mono text-gray-400">{line.account.code}</span> {line.account.name}
                          </td>
                          <td className="p-3 text-right text-gray-700">
                            {Number(line.debit) > 0 ? `₡${Number(line.debit).toLocaleString('es-CR', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="p-3 text-right text-gray-700">
                            {Number(line.credit) > 0 ? `₡${Number(line.credit).toLocaleString('es-CR', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Exam activity log */}
        <div className="mb-6">
          <ExamActivityLog attemptId={attemptId} defaultExpanded={false} />
        </div>

        {/* Grading form */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              {isAlreadyGraded ? 'Calificación enviada' : 'Enviar calificación'}
            </h3>
            {canAutoGrade && (
              <Button
                type="button"
                onClick={handleAutoGrade}
                loading={autoing}
                className="!bg-blue-600 hover:!bg-blue-700 border-blue-600 gap-2"
                size="sm"
              >
                <Zap className="w-4 h-4" />
                Auto-calificar con IA
              </Button>
            )}
            {!canAutoGrade && !isAlreadyGraded && (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <BarChart2 className="w-3.5 h-3.5" />
                {!company ? 'Sin empresa creada' : 'Sin rúbricas con criterios'}
              </p>
            )}
          </div>

          {isAlreadyGraded && attempt.feedback && (
            <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-xs font-semibold text-emerald-700 mb-1">Retroalimentación enviada</p>
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
                Puntaje * <span className="text-gray-400 font-normal">(0 – {attempt.maxScore} pts)</span>
              </label>
              <input
                type="number" min="0" max={Number(attempt.maxScore)} step="0.5"
                value={score}
                onChange={e => setScore(e.target.value)}
                disabled={isAlreadyGraded}
                placeholder={`0 – ${attempt.maxScore}`}
                className="w-full max-w-xs rounded-xl bg-white border border-gray-300 text-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Retroalimentación</label>
              <textarea
                rows={4} value={feedback}
                onChange={e => setFeedback(e.target.value)}
                disabled={isAlreadyGraded}
                placeholder="Escribe comentarios para el estudiante sobre su trabajo..."
                className="w-full rounded-xl bg-white border border-gray-300 text-gray-900 placeholder-gray-400 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-50"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => router.back()}>
                <ArrowLeft className="w-4 h-4" /> Volver
              </Button>
              {!isAlreadyGraded && (
                <Button type="submit" loading={saving} disabled={!score}>
                  <Send className="w-4 h-4" />
                  {preview ? 'Confirmar calificación' : 'Enviar calificación'}
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
