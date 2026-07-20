'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate, getErrorMessage, esc } from '@/lib/utils';
import { exportToExcel } from '@/lib/excel';
import { DifficultyBadge, StatusBadge, Badge } from '@/components/ui/Badge';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconTile } from '@/components/ui/IconTile';
import { ArtBalance, SceneStudentDesk, SceneEmptyBox } from '@/components/illustrations';
import { CabysSearch, type CabysItem } from '@/components/cabys/CabysSearch';
import { ExchangeRateWidget } from '@/components/ui/ExchangeRateWidget';
import { ExamModeWrapper } from '@/components/exam';
import { ExecutiveDashboard } from '@/components/dashboard/ExecutiveDashboard';
import type { ExerciseAttempt } from '@/types';
import toast from 'react-hot-toast';
import type { ElementType } from 'react';
import {
  ArrowLeft, Building2, Users, Package, FileText, FileSpreadsheet,
  BookOpen, BarChart2, CheckCircle2, Send, Plus, Trash2,
  Clock, TrendingUp, X, RefreshCw, ChevronRight, Truck,
  Printer, Landmark, Award, Star, Zap, Circle, History, Upload,
  Scale, ClipboardList, ClipboardCheck, Lock, Download, MessageCircle,
  Lightbulb, ShoppingCart, Search, LineChart, Inbox, GraduationCap,
  Trophy, PlayCircle, Receipt, FolderOpen, XCircle, Target,
} from 'lucide-react';
import { PurchaseProposalsInbox } from '@/components/business/PurchaseProposalsInbox';
import { ProcurementOrders } from '@/components/business/ProcurementOrders';
import { SocraticTutorPanel } from '@/components/pedagogy/SocraticTutorPanel';
import {
  TYPE_LABELS,
  ClientsTab, ProductsTab, SuppliersTab, InvoicesTab, JournalTab, LedgerTab,
  ReportsTab, BankTab, MayorizacionTab, BalanceComprobacionTab, SpecialJournalTab,
  FixedAssetsTab, PayrollTab,
} from './workspace-modules';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Company { id: string; name: string; legalId: string | null; email: string | null; phone: string | null; }

// ─── Tab helpers ─────────────────────────────────────────────────────────────
type Tab = 'dashboard' | 'clients' | 'suppliers' | 'products' | 'invoices' | 'journal' | 'ledger' | 'bank'
         | 'mayorizacion' | 'balance-comprobacion' | 'ajustes' | 'balance-ajustado'
         | 'reports' | 'asientos-cierre' | 'balanza-post-cierre' | 'activity'
         | 'fixed-assets' | 'payroll' | 'purchase-proposals' | 'procurement' | 'tutor';

function TabButton({ id, active, onClick, icon: Icon, label, count }: {
  id: Tab; active: boolean; onClick: () => void; icon: React.ElementType; label: string; count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'border-blue-600 text-blue-700'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      {count != null && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
          {count}
        </span>
      )}
    </button>
  );
}


// ─── Dashboard tab ───────────────────────────────────────────────────────────
// ── Recorrido del estudiante: Constituir → Operar → Declarar → Cerrar → Analizar ──
function StudentJourney({ companyId, attemptId, prog, status }: {
  companyId: string; attemptId: string; prog: any; status?: string;
}) {
  const [taxCount, setTaxCount] = useState<number | null>(null);
  const [hasClosing, setHasClosing] = useState<boolean | null>(null);

  useEffect(() => {
    api.get<any[]>('/api/v1/tax-declarations')
      .then(({ data }) => setTaxCount(Array.isArray(data) ? data.length : 0))
      .catch(() => setTaxCount(0));
    api.get<any[]>(`/api/v1/companies/${companyId}/journal`)
      .then(({ data }) => {
        const entries = Array.isArray(data) ? data : (data as any)?.entries ?? [];
        const closing = entries.some((e: any) =>
          (e.reference ?? '').toUpperCase().includes('CIER') ||
          (e.description ?? '').toLowerCase().includes('cierre'));
        setHasClosing(closing);
      })
      .catch(() => setHasClosing(false));
  }, [companyId]);

  const invoices = prog?.invoicesCount ?? 0;
  const entries  = prog?.entriesCount ?? 0;

  const steps = [
    { key: 'constituir', label: 'Constituir', icon: Building2,   done: true,
      href: null as string | null, hint: 'Empresa creada' },
    { key: 'operar', label: 'Operar', icon: ShoppingCart, done: invoices > 0 && entries > 0,
      href: `/estudiante/ejercicio/${attemptId}/diario`, hint: 'Factura y registra asientos' },
    { key: 'declarar', label: 'Declarar', icon: Landmark, done: (taxCount ?? 0) > 0,
      href: `/estudiante/ejercicio/${attemptId}/renta`, hint: 'Presenta tus declaraciones' },
    { key: 'cerrar', label: 'Cerrar', icon: Scale, done: hasClosing === true,
      href: `/estudiante/ejercicio/${attemptId}/diario`, hint: 'Registra los asientos de cierre' },
    { key: 'analizar', label: 'Analizar', icon: TrendingUp, done: status === 'GRADED' || status === 'SUBMITTED',
      href: `/estudiante/simulador`, hint: 'Analiza tu empresa en el simulador' },
  ];
  const currentIdx = steps.findIndex(s => !s.done);
  const current = currentIdx === -1 ? null : steps[currentIdx];

  return (
    <SectionCard
      eyebrow="Tu recorrido"
      title="De constituir la empresa a analizar sus resultados"
      icon={Target}
      iconTint="#1B2E6E"
      className="cx-pop"
      action={current && current.href ? (
        <Link
          href={current.href}
          className={buttonClasses({ size: 'sm', className: 'cx-press' })}
        >
          Siguiente: {current.hint} <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      ) : undefined}
    >
      <div className="flex items-center">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isCurrent = current?.key === s.key;
          const color = s.done ? '#2563EB' : isCurrent ? '#03080F' : '#CBD5E1';
          const body = (
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0 cx-hop-parent" style={{ minWidth: 64 }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white transition-all cx-hop"
                style={{ background: color, boxShadow: isCurrent ? '0 0 0 4px rgba(37,99,235,0.15)' : 'none' }}>
                {s.done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span className="text-[11px] font-semibold text-center" style={{ color: s.done || isCurrent ? '#334155' : '#94A3B8' }}>
                {s.label}
              </span>
            </div>
          );
          return (
            <div key={s.key} className="flex items-center flex-1 last:flex-none">
              {s.href ? <Link href={s.href} className="cx-press">{body}</Link> : body}
              {i < steps.length - 1 && (
                <div className="flex-1 h-0.5 mx-1 rounded" style={{ background: s.done ? '#2563EB' : '#E2E8F0', minWidth: 16 }} />
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function DashboardTab({ companyId, attempt }: { companyId: string; attempt: ExerciseAttempt; }) {
  const [dash, setDash] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState<any[]>([]);

  useEffect(() => {
    const year = new Date().getFullYear();
    api.get(`/api/v1/companies/${companyId}/periods/active`)
      .catch(() => {
        api.post(`/api/v1/companies/${companyId}/periods`, {
          name: `Período ${year}`, type: 'ANNUAL',
          startDate: `${year}-01-01`, endDate: `${year}-12-31`,
        }).catch(() => {});
      });

    Promise.all([
      api.get(`/api/v1/companies/${companyId}/dashboard`),
      api.get(`/api/v1/attempts/${attempt.id}/progress`),
      api.get(`/api/v1/companies/${companyId}/ledger`),
    ]).then(([dashRes, progRes, ledgerRes]) => {
      setDash(dashRes.data);
      setProgress(progRes.data);
      setLedger(Array.isArray(ledgerRes.data) ? ledgerRes.data : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [companyId, attempt.id]);

  // Use live counts from progress endpoint (always fresh)
  const liveCounts = progress?.liveCounts ?? null;
  const prog = liveCounts ?? attempt.studentProgress;

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  // ── Panel ejecutivo: KPIs, tendencia, IVA, AR/AP ──────────
  // Se renderiza arriba; debajo queda la gamificación existente.
  // El simulador (precio de acción, macro, IA, eventos) vive en su propia
  // sección: /estudiante/simulador.
  const executivePanel = <ExecutiveDashboard companyId={companyId} />;

  // ── Gamification ──────────────────────────────────────────────────────────
  const progressPct = Number(progress?.progress?.progressPct ?? attempt.studentProgress?.progressPct ?? 0);
  const LEVELS = [
    { min: 0,  label: 'Principiante', color: '#94a3b8', bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-200' },
    { min: 25, label: 'Aprendiz',     color: '#2563EB', bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-200'  },
    { min: 50, label: 'Contador',     color: '#475569', bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-200'},
    { min: 75, label: 'Experto',      color: '#10b981', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200'},
  ];
  const level = [...LEVELS].reverse().find(l => progressPct >= l.min) ?? LEVELS[0];
  const nextLevel = LEVELS[LEVELS.findIndex(l => l.label === level.label) + 1];
  const ACHIEVEMENTS: Array<{ id: string; label: string; desc: string; unlocked: boolean; icon: ElementType }> = [
    { id: 'company',  label: 'Empresa creada',   desc: 'Creaste tu empresa',      unlocked: true, icon: Building2 },
    { id: 'client',   label: 'Primer cliente',   desc: '1 cliente registrado',     unlocked: (prog?.clientsCount  ?? 0) >= 1, icon: Users },
    { id: 'product',  label: 'Primer producto',  desc: '1 producto en catálogo',   unlocked: (prog?.productsCount ?? 0) >= 1, icon: Package },
    { id: 'invoice',  label: 'Primera venta',    desc: '1 factura emitida',        unlocked: (prog?.invoicesCount ?? 0) >= 1, icon: Receipt },
    { id: 'journal',  label: 'Diario activo',    desc: '1 asiento contable',       unlocked: (prog?.entriesCount  ?? 0) >= 1, icon: BookOpen },
    { id: 'ledger',   label: 'Libro Mayor',      desc: 'Revisaste el libro mayor', unlocked: ledger.length > 0, icon: BarChart2 },
    { id: 'complete', label: 'Misión cumplida',  desc: 'Todas las rúbricas al día',unlocked: progressPct >= 100, icon: Trophy },
  ];
  const unlockedCount = ACHIEVEMENTS.filter(a => a.unlocked).length;
  // SVG ring
  const R = 42, C = 2 * Math.PI * R;
  const ringOffset = C - (progressPct / 100) * C;

  return (
    <div className="space-y-6">
      {/* ── Banda del ejercicio ─────────────────────────────────────────────── */}
      <Card variant="onDark" className="cx-pop">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-6 lg:px-7 py-6">
          <div className="flex-1 min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-1.5">
              Tu empresa en marcha
            </p>
            <h2 className="text-lg font-bold leading-snug">Opera, registra y cuadra: el ciclo contable completo.</h2>
            <p className="mt-1.5 text-sm text-blue-200/80 max-w-xl">
              Cada factura, compra y cobro genera asientos en el diario. Confírmalos, mayoriza y llega a los
              estados financieros de tu propia empresa.
            </p>
          </div>
          <ArtBalance size={150} className="lp-drift flex-shrink-0" />
        </div>
      </Card>

      <StudentJourney companyId={companyId} attemptId={attempt.id} prog={prog} status={attempt.status} />
      {executivePanel}

      {/* Acceso al Simulador Financiero (sección propia) */}
      <Link href="/estudiante/simulador"
        className="group cx-hop-parent cx-press flex items-center gap-4 rounded-card px-5 py-4 text-white transition-all bg-gradient-to-br from-csq-mid to-csq-active border border-white/10 shadow-soft hover:shadow-card-hover">
        <IconTile icon={LineChart} size={44} onDark className="cx-hop" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm">Simulador Financiero</p>
          <p className="text-xs text-blue-200/80">
            Precio de acción, indicadores macro, gerente financiero IA y eventos económicos de tu empresa.
          </p>
        </div>
        <ChevronRight className="w-5 h-5 flex-shrink-0 text-csq-accent-bright" />
      </Link>

      {/* ── Gamification card ───────────────────────────────────────────────── */}
      <SectionCard
        eyebrow="Progreso"
        title="Tu nivel en el ejercicio"
        icon={Award}
        iconTint="#B8860B"
        className="cx-pop cx-d1"
      >
        <div className="flex items-center gap-5 flex-wrap">
          {/* Progress ring */}
          <div className="flex-shrink-0">
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={R} fill="none" stroke="#e2e8f0" strokeWidth="10" />
              <circle cx="50" cy="50" r={R} fill="none" stroke={level.color} strokeWidth="10"
                strokeDasharray={C} strokeDashoffset={ringOffset}
                strokeLinecap="round" transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
              <text x="50" y="45" textAnchor="middle" dominantBaseline="middle" className="fill-gray-800" style={{ fontSize: 18, fontWeight: 700, fill: '#1e293b' }}>{progressPct}%</text>
              <text x="50" y="63" textAnchor="middle" style={{ fontSize: 9, fill: '#64748b' }}>progreso</text>
            </svg>
          </div>
          {/* Level & XP */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${level.bg} ${level.text} ${level.border}`}>
                <Star className="w-3 h-3 inline mr-0.5" />{level.label}
              </span>
              <span className="text-xs text-gray-400">{unlockedCount}/{ACHIEVEMENTS.length} logros</span>
            </div>
            <p className={`text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5 ${progressPct >= 100 ? 'cx-tada' : ''}`}>
              {progressPct >= 100 && <Trophy className="w-4 h-4 text-gold-600" />}
              {progressPct >= 100 ? '¡Ejercicio completado!' : nextLevel ? `Faltan ${nextLevel.min - progressPct}% para nivel ${nextLevel.label}` : 'En progreso...'}
            </p>
            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, backgroundColor: level.color }} />
            </div>
          </div>
        </div>

        {/* Achievements */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {ACHIEVEMENTS.map((a) => {
            const AIcon = a.icon;
            return (
              <div key={a.id} className={`cx-hop-parent flex items-center gap-2.5 p-2.5 rounded-xl border text-xs transition-all ${
                a.unlocked ? 'bg-white border-emerald-200 text-gray-700 shadow-card' : 'bg-gray-50/60 border-gray-200 text-gray-400'
              }`}>
                <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center cx-hop ${
                  a.unlocked ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-300'
                }`}>
                  <AIcon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className={`font-semibold leading-tight truncate ${a.unlocked ? 'text-gray-800' : 'text-gray-400'}`}>{a.label}</p>
                  <p className="text-gray-400 text-xs leading-tight">{a.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Progress */}
      {prog && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Clientes',  value: prog.clientsCount ?? 0,  icon: Users,      tint: '#B8860B' },
            { label: 'Productos', value: prog.productsCount ?? 0, icon: Package,    tint: '#1B2E6E' },
            { label: 'Facturas',  value: prog.invoicesCount ?? 0, icon: FileText,   tint: '#2563EB' },
            { label: 'Asientos',  value: prog.entriesCount ?? 0,  icon: BookOpen,   tint: '#16A34A' },
          ].map((s, i) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={String(s.value)}
              icon={s.icon}
              tint={s.tint}
              className={`cx-pop cx-d${i + 1} cx-lift cx-hop-parent`}
            />
          ))}
        </div>
      )}

      {/* Rubrics checklist */}
      {attempt.exercise?.rubrics && attempt.exercise.rubrics.length > 0 && (
        <SectionCard
          eyebrow="Evaluación"
          title="Rúbricas del ejercicio"
          description="Criterios que tu profesor califica automáticamente."
          icon={ClipboardCheck}
          iconTint="#1B2E6E"
          className="cx-pop cx-d2"
        >
          <div className="space-y-2">
            {attempt.exercise.rubrics.map((r) => {
              const expected = r.expectedValue ? Number(r.expectedValue) : null;
              let current = 0;
              if (prog) {
                if (r.criterion === 'min_clients')  current = prog.clientsCount ?? 0;
                if (r.criterion === 'min_products') current = prog.productsCount ?? 0;
                if (r.criterion === 'min_invoices') current = prog.invoicesCount ?? 0;
                if (r.criterion === 'min_entries')  current = prog.entriesCount ?? 0;
              }
              const met = expected != null ? current >= expected : false;
              return (
                <div key={r.id} className={`cx-hop-parent flex items-center gap-3 p-3.5 rounded-xl border transition-colors ${met ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
                  <CheckCircle2 className={`w-4 h-4 flex-shrink-0 cx-hop ${met ? 'text-emerald-600' : 'text-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">{r.description}</p>
                    {expected != null && (
                      <p className="text-xs text-gray-500 mt-0.5 tabular-nums">{current} / {expected}</p>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-gray-500 tabular-nums">{r.points} pts</span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Finance summary */}
      {dash?.totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Facturas emitidas', value: dash.totals.invoices,       icon: FileText, tint: '#2563EB' },
            { label: 'Clientes activos',  value: dash.totals.clients,        icon: Users,    tint: '#B8860B' },
            { label: 'Productos',         value: dash.totals.products,       icon: Package,  tint: '#1B2E6E' },
            { label: 'Asientos',          value: dash.totals.journalEntries, icon: BookOpen, tint: '#16A34A' },
          ].map((s, i) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={String(s.value)}
              icon={s.icon}
              tint={s.tint}
              className={`cx-pop cx-d${i + 1} cx-lift cx-hop-parent`}
            />
          ))}
        </div>
      )}
      {dash?.totals?.totalSales != null && (
        <StatCard
          variant="dark"
          label="Ventas aceptadas"
          value={`₡${Number(dash.totals.totalSales).toLocaleString('es-CR', { minimumFractionDigits: 2 })}`}
          hint="Facturas electrónicas aceptadas por Hacienda"
          icon={TrendingUp}
          className="cx-pop"
        />
      )}

      {/* Feature 4: Comparación con solución esperada */}
      {(() => {
        const settings = (attempt.exercise as any)?.settings as any;
        const ev = settings?.expectedValues;
        if (!ev || !prog) return null;
        const totalAssets = ledger.filter((a: any) => a.type === 'ASSET').reduce((s: number, a: any) => s + Math.abs(Number(a.balance)), 0);
        const totalRevenue = ledger.filter((a: any) => a.type === 'INCOME').reduce((s: number, a: any) => s + Math.abs(Number(a.balance)), 0);
        const totalExpenses = ledger.filter((a: any) => a.type === 'EXPENSE').reduce((s: number, a: any) => s + Math.abs(Number(a.balance)), 0);
        const totalLiabilities = ledger.filter((a: any) => a.type === 'LIABILITY').reduce((s: number, a: any) => s + Math.abs(Number(a.balance)), 0);
        const totalEquity = ledger.filter((a: any) => a.type === 'EQUITY').reduce((s: number, a: any) => s + Math.abs(Number(a.balance)), 0);
        const isBalanced = Math.abs(totalAssets - totalLiabilities - totalEquity) < 1;
        const fmt = (v: number) => `₡${v.toLocaleString('es-CR', { minimumFractionDigits: 0 })}`;
        const criteria = [
          ev.minAssets != null && { label: 'Activos mínimos', met: totalAssets >= ev.minAssets, actual: fmt(totalAssets), expected: fmt(ev.minAssets) },
          ev.minRevenue != null && { label: 'Ingresos mínimos', met: totalRevenue >= ev.minRevenue, actual: fmt(totalRevenue), expected: fmt(ev.minRevenue) },
          ev.minExpenses != null && { label: 'Gastos mínimos', met: totalExpenses >= ev.minExpenses, actual: fmt(totalExpenses), expected: fmt(ev.minExpenses) },
          ev.balancedSheet && { label: 'Balance general cuadrado', met: isBalanced, actual: isBalanced ? 'Sí' : 'No', expected: 'Sí' },
        ].filter(Boolean) as { label: string; met: boolean; actual: string; expected: string }[];
        if (criteria.length === 0) return null;
        return (
          <SectionCard
            eyebrow="Autoevaluación"
            title="Comparación con la solución esperada"
            description="Contrasta tus cifras con los valores que definió el profesor."
            icon={Scale}
            iconTint="#1B2E6E"
            className="cx-pop cx-d3"
          >
            <div className="space-y-2">
              {criteria.map((c) => (
                <div key={c.label} className={`cx-hop-parent flex items-start gap-3 p-3.5 rounded-xl border ${c.met ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  {c.met
                    ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600 cx-hop" />
                    : <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600 cx-hop" />}
                  <div className="flex-1 text-sm">
                    <span className={`font-semibold ${c.met ? 'text-emerald-800' : 'text-red-800'}`}>{c.label}</span>
                    <span className="text-gray-500 ml-2 tabular-nums">(actual: {c.actual}{!c.met ? `, esperado: ${c.expected}` : ''})</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        );
      })()}

      {ledger.length > 0 && (() => {
        const typeLabelsChart: Record<string, string> = {
          ASSET: 'Activo', LIABILITY: 'Pasivo', EQUITY: 'Patrimonio',
          INCOME: 'Ingreso', EXPENSE: 'Gasto',
        };
        const typeColorsChart: Record<string, string> = {
          ASSET: '#2563EB', LIABILITY: '#ef4444', EQUITY: '#475569',
          INCOME: '#10b981', EXPENSE: '#f59e0b',
        };
        const grouped = ledger.reduce((acc: Record<string, number>, acc2: any) => {
          const t = acc2.type as string;
          acc[t] = (acc[t] ?? 0) + Math.abs(Number(acc2.balance));
          return acc;
        }, {} as Record<string, number>);
        const chartData = Object.entries(grouped).map(([type, balance]) => ({
          name: typeLabelsChart[type] ?? type,
          balance,
          type,
        }));
        return (
          <SectionCard
            eyebrow="Ecuación contable"
            title="Balance por tipo de cuenta"
            description="Activo = Pasivo + Patrimonio. Los ingresos y gastos alimentan el resultado."
            icon={Scale}
            iconTint="#2563EB"
            className="cx-pop cx-d4"
          >
            <div className="flex items-end gap-3 h-40 pt-4">
              {(() => {
                const maxVal = Math.max(...chartData.map(d => d.balance), 1);
                return chartData.map((entry) => (
                  <div key={entry.type} className="flex flex-col items-center flex-1 h-full justify-end gap-1">
                    <p className="text-xs font-mono tabular-nums text-gray-600 text-center">{`₡${Math.round(entry.balance / 1000)}k`}</p>
                    <div
                      className="w-full rounded-t-lg transition-all"
                      style={{
                        height: `${Math.max(8, (entry.balance / maxVal) * 100)}%`,
                        backgroundColor: typeColorsChart[entry.type] ?? '#6b7280',
                        opacity: 0.85,
                      }}
                    />
                    <p className="text-xs text-gray-500 text-center mt-1">{entry.name}</p>
                  </div>
                ));
              })()}
            </div>
          </SectionCard>
        );
      })()}

      {/* ── Acceso rápido — Facturas de Compra (IVA Crédito Fiscal) ─── */}
      <SectionCard
        eyebrow="Crédito fiscal"
        title="Facturas de compra — IVA acreditable"
        description="Registra las facturas recibidas de tus proveedores. El IVA pagado se convierte en crédito fiscal que deduce el IVA a pagar en la declaración D-104."
        icon={ShoppingCart}
        iconTint="#16A34A"
        className="cx-pop cx-d5"
        action={
          <Link
            href={`/estudiante/ejercicio/${attempt.id}/compras`}
            className={buttonClasses({ size: 'sm', className: 'cx-press whitespace-nowrap' })}
          >
            <Plus className="w-3.5 h-3.5" /> Gestionar compras
          </Link>
        }
      >
        <p className="text-sm text-gray-500">
          Solo el IVA de facturas electrónicas aceptadas por Hacienda puede acreditarse.
        </p>
      </SectionCard>
    </div>
  );
}








// ─── Activity tab ─────────────────────────────────────────────────────────────
import {
  AreaChart, Area, BarChart as RBarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface ActivityEvent {
  id: string; event: string; createdAt: string;
  metadata?: Record<string, unknown>;
}
interface ActivityResponse {
  events: ActivityEvent[];
  startedAt: string | null;
  submittedAt: string | null;
}

const EVENT_META: Record<string, { label: string; color: string; icon: ElementType; short: string }> = {
  EXERCISE_OPENED:      { label: 'Ejercicio abierto',      color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: FolderOpen,  short: 'Apertura'  },
  EXERCISE_RESUMED:     { label: 'Ejercicio reanudado',    color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: PlayCircle,  short: 'Reanudado' },
  CLIENT_CREATED:       { label: 'Cliente creado',         color: 'bg-gold-50 text-gold-900 border-gold-100',        icon: Users,       short: 'Cliente'   },
  PRODUCT_CREATED:      { label: 'Producto creado',        color: 'bg-slate-100 text-slate-700 border-slate-200',    icon: Package,     short: 'Producto'  },
  INVOICE_CREATED:      { label: 'Factura creada',         color: 'bg-slate-100 text-slate-700 border-slate-200',    icon: FileText,    short: 'Factura'   },
  INVOICE_ISSUED:       { label: 'Factura emitida',        color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2, short: 'Emitida' },
  JOURNAL_ENTRY_SAVED:  { label: 'Asiento registrado',     color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: BookOpen,    short: 'Asiento'   },
  REPORT_VIEWED:        { label: 'Reporte visualizado',    color: 'bg-gray-100 text-gray-700 border-gray-200',       icon: BarChart2,   short: 'Reporte'   },
  EXERCISE_SUBMITTED:   { label: 'Ejercicio enviado',      color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Trophy,    short: 'Entrega' },
};

function ActivityTab({ attemptId }: { attemptId: string }) {
  const [events,     setEvents]     = useState<ActivityEvent[]>([]);
  const [startedAt,  setStartedAt]  = useState<string | null>(null);
  const [submittedAt,setSubmittedAt]= useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [showAll,    setShowAll]    = useState(false);

  useEffect(() => {
    api.get<ActivityResponse>(`/api/v1/attempts/${attemptId}/activity`)
      .then(({ data }) => {
        setEvents(data.events ?? []);
        setStartedAt(data.startedAt);
        setSubmittedAt(data.submittedAt);
      })
      .catch(() => toast.error('Error al cargar historial'))
      .finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  if (events.length === 0) return (
    <Card className="cx-pop">
      <EmptyState
        illustration={<SceneEmptyBox size={200} className="lp-drift" />}
        title="No hay actividad registrada aún"
        description="Las acciones que realices en el ejercicio (crear clientes, emitir facturas, registrar asientos) quedarán aquí en orden cronológico."
        className="py-12"
      />
    </Card>
  );

  // ── Build cumulative chart data ────────────────────────────────────────────
  const TRACKED = ['INVOICE_CREATED', 'INVOICE_ISSUED', 'JOURNAL_ENTRY_SAVED', 'CLIENT_CREATED', 'PRODUCT_CREATED'];
  const chartPoints: Array<{ label: string; facturas: number; asientos: number; clientes: number; productos: number; ts: number }> = [];
  let facturas = 0, asientos = 0, clientes = 0, productos = 0;

  const startTs = startedAt ? new Date(startedAt).getTime() : new Date(events[0].createdAt).getTime();

  for (const ev of events) {
    if (!TRACKED.includes(ev.event)) continue;
    if (ev.event === 'INVOICE_CREATED' || ev.event === 'INVOICE_ISSUED') facturas++;
    if (ev.event === 'JOURNAL_ENTRY_SAVED') asientos++;
    if (ev.event === 'CLIENT_CREATED')  clientes++;
    if (ev.event === 'PRODUCT_CREATED') productos++;
    const ts = new Date(ev.createdAt).getTime();
    const minElapsed = Math.round((ts - startTs) / 60000);
    chartPoints.push({ label: `${minElapsed}m`, facturas, asientos, clientes, productos, ts });
  }

  // Add start point
  if (chartPoints.length > 0) {
    chartPoints.unshift({ label: '0m', facturas: 0, asientos: 0, clientes: 0, productos: 0, ts: startTs });
  }

  // ── Event distribution bar data ────────────────────────────────────────────
  const distMap: Record<string, number> = {};
  for (const ev of events) {
    distMap[ev.event] = (distMap[ev.event] ?? 0) + 1;
  }
  const distData = Object.entries(distMap)
    .map(([event, count]) => ({ name: EVENT_META[event]?.short ?? event, count }))
    .sort((a, b) => b.count - a.count);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const durationMin = startedAt && (submittedAt ?? events.at(-1)?.createdAt)
    ? Math.round((new Date(submittedAt ?? events.at(-1)!.createdAt).getTime() - new Date(startedAt).getTime()) / 60000)
    : null;

  // Find busiest 10-minute window
  let busiestCount = 0;
  for (let i = 0; i < events.length; i++) {
    const windowEnd = new Date(events[i].createdAt).getTime() + 10 * 60000;
    const count = events.filter(e => {
      const t = new Date(e.createdAt).getTime();
      return t >= new Date(events[i].createdAt).getTime() && t <= windowEnd;
    }).length;
    if (count > busiestCount) busiestCount = count;
  }

  const displayEvents = showAll ? events : [...events].reverse().slice(0, 20);

  return (
    <div className="space-y-6">

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total eventos',   value: String(events.length),                          icon: History,     tint: '#2563EB' },
          { label: 'Duración sesión', value: durationMin != null ? `${durationMin}m` : '—',  icon: Clock,       tint: '#1B2E6E' },
          { label: 'Pico 10 min',     value: `${busiestCount} acc.`,                        icon: Zap,         tint: '#B8860B' },
          { label: 'Tipos distintos', value: String(Object.keys(distMap).length),            icon: Lightbulb,   tint: '#16A34A' },
        ].map((s, i) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            icon={s.icon}
            tint={s.tint}
            className={`cx-pop cx-d${i + 1} cx-lift cx-hop-parent`}
          />
        ))}
      </div>

      {/* ── Cumulative progress chart ── */}
      {chartPoints.length >= 2 && (
        <SectionCard
          eyebrow="Trazabilidad"
          title="Progreso acumulado en el tiempo"
          icon={TrendingUp}
          iconTint="#2563EB"
          className="cx-pop cx-d2"
        >
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartPoints} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                {[
                  { id: 'fact', color: '#6366f1' },
                  { id: 'asie', color: '#60A5FA' },
                  { id: 'clie', color: '#f59e0b' },
                  { id: 'prod', color: '#a855f7' },
                ].map(({ id, color }) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                formatter={(v: any, name: any) => [v, ({ facturas: 'Facturas', asientos: 'Asientos', clientes: 'Clientes', productos: 'Productos' } as any)[name] ?? name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => (({ facturas: 'Facturas', asientos: 'Asientos', clientes: 'Clientes', productos: 'Productos' } as any)[v] ?? v)} />
              <Area type="monotone" dataKey="facturas" stroke="#6366f1" fill="url(#fact)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="asientos" stroke="#60A5FA" fill="url(#asie)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="clientes" stroke="#f59e0b" fill="url(#clie)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="productos" stroke="#a855f7" fill="url(#prod)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-400 text-center mt-1">Minutos desde el inicio del ejercicio</p>
        </SectionCard>
      )}

      {/* ── Event distribution ── */}
      {distData.length > 0 && (
        <SectionCard
          eyebrow="Hábitos de trabajo"
          title="Distribución de acciones"
          icon={BarChart2}
          iconTint="#1B2E6E"
          className="cx-pop cx-d3"
        >
          <ResponsiveContainer width="100%" height={160}>
            <RBarChart data={distData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <Bar dataKey="count" name="Acciones" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </RBarChart>
          </ResponsiveContainer>
        </SectionCard>
      )}

      {/* ── Timeline list ── */}
      <SectionCard
        eyebrow="Bitácora"
        title="Historial de eventos"
        description={`${events.length} ${events.length === 1 ? 'evento registrado' : 'eventos registrados'} en este ejercicio.`}
        icon={History}
        iconTint="#B8860B"
        className="cx-pop cx-d4"
      >
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-2">
            {displayEvents.map((ev) => {
              const meta = EVENT_META[ev.event] ?? { label: ev.event, color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Circle, short: ev.event };
              const EvIcon = meta.icon;
              return (
                <div key={ev.id} className="cx-hop-parent flex items-start gap-4 pl-10 relative">
                  <div className="absolute left-0 top-1 w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center z-10 shadow-sm cx-hop">
                    <EvIcon className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className={`flex-1 p-3 rounded-xl border ${meta.color}`}>
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="text-sm font-semibold">{meta.label}</span>
                      <span className="text-xs opacity-60 tabular-nums">
                        {new Date(ev.createdAt).toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                    {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                      <p className="text-xs mt-0.5 opacity-70">
                        {Object.entries(ev.metadata).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {events.length > 20 && (
          <Button
            variant="outline"
            onClick={() => setShowAll(s => !s)}
            className="mt-4 w-full cx-press"
          >
            {showAll ? 'Mostrar menos' : `Ver todos (${events.length} eventos)`}
          </Button>
        )}
      </SectionCard>
    </div>
  );
}





// ─── AI Assistant (Feature 8) ─────────────────────────────────────────────────
function AiAssistant({ activeTab, companyName }: { activeTab: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setAnswer('');
    try {
      const { data } = await api.post('/api/v1/ai/suggest', { question, tab: activeTab, companyName });
      setAnswer(typeof data === 'string' ? data : (data as any).text ?? JSON.stringify(data));
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? getErrorMessage(err);
      setAnswer(msg.includes('ANTHROPIC_API_KEY') || msg.includes('no configurada') ? 'La IA no está configurada en este servidor.' : `Error: ${msg}`);
    }
    finally { setLoading(false); }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="cx-press cx-bounce fixed bottom-6 right-6 z-40 w-14 h-14 text-white rounded-full shadow-[0_10px_30px_rgba(27,46,110,0.35)] flex items-center justify-center transition-all bg-gradient-to-br from-blue-600 to-csq-mid hover:shadow-card-hover"
        title="Asistente IA">
        <MessageCircle className="w-6 h-6" />
      </button>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 bg-white border border-gray-200/70 rounded-card shadow-card-hover flex flex-col overflow-hidden cx-pop">
          <div className="flex items-center justify-between p-4 bg-gradient-to-br from-csq-mid to-csq-active text-white">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500">Aprendizaje</p>
              <p className="font-bold text-sm">Asistente Contable IA</p>
            </div>
            <button onClick={() => setOpen(false)} className="cx-press text-blue-200/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 flex-1">
            {answer && (
              <div className="mb-3 p-3 bg-gray-50 rounded-xl text-sm text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto cx-pop">{answer}</div>
            )}
            <form onSubmit={handleAsk} className="space-y-2">
              <textarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="¿Tienes alguna pregunta contable?"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 resize-none transition-colors"
                rows={3}
                maxLength={500}
              />
              <Button type="submit" loading={loading} className="w-full cx-press">Preguntar</Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Company Setup ────────────────────────────────────────────────────────────
function CompanySetup({ attemptId, onCreated }: { attemptId: string; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', legalId: '', legalIdType: '02', economicActivity: '',
    email: '', phone: '', address: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('El nombre de la empresa es requerido'); return; }
    if (!form.legalId.trim()) { toast.error('La cédula jurídica es requerida'); return; }
    if (!form.economicActivity || form.economicActivity.length !== 6) {
      toast.error('La actividad económica debe tener exactamente 6 caracteres'); return;
    }
    setSaving(true);
    try {
      await api.post(`/api/v1/attempts/${attemptId}/company`, {
        name: form.name, legalId: form.legalId, legalIdType: form.legalIdType,
        economicActivity: form.economicActivity,
        email: form.email || undefined, phone: form.phone || undefined,
        address: form.address || undefined,
      });
      toast.success('¡Empresa creada! Ya puedes empezar a trabajar.');
      onCreated();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 flex items-start justify-center bg-gray-50/60">
      <div className="w-full max-w-2xl py-2 space-y-6">
        {/* Banda de bienvenida */}
        <Card variant="onDark" className="cx-pop">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-6 lg:px-7 py-6">
            <div className="flex-1 min-w-0">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-1.5">
                Paso 1 · Constituir
              </p>
              <h2 className="text-lg font-bold leading-snug">Toda contabilidad empieza con una empresa.</h2>
              <p className="mt-1.5 text-sm text-blue-200/80 max-w-md">
                Estos datos aparecerán en tus facturas electrónicas y en tus estados financieros.
              </p>
            </div>
            <SceneStudentDesk size={170} className="lp-drift flex-shrink-0" />
          </div>
        </Card>

        <SectionCard
          eyebrow="Datos de la empresa"
          title="Configura tu empresa"
          description="Campos obligatorios para emitir facturas electrónicas (Hacienda v4.3)."
          icon={Building2}
          iconTint="#1B2E6E"
          className="cx-pop cx-d1"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Nombre de la empresa *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Consultores CR S.A." icon={<Building2 className="w-4 h-4" />} />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Tipo de cédula *</label>
                <select value={form.legalIdType} onChange={(e) => setForm({ ...form, legalIdType: e.target.value })}
                  className="rounded-xl bg-white border border-gray-300 text-gray-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors">
                  <option value="01">01 — Física</option>
                  <option value="02">02 — Jurídica</option>
                  <option value="03">03 — DIMEX</option>
                  <option value="04">04 — NITE</option>
                </select>
              </div>
              <Input label="Cédula *" value={form.legalId} onChange={(e) => setForm({ ...form, legalId: e.target.value })}
                placeholder="Ej: 3101999999" />
            </div>
            <Input label="Actividad económica CIIU * (6 dígitos)" value={form.economicActivity}
              onChange={(e) => setForm({ ...form, economicActivity: e.target.value })}
              placeholder="Ej: 702001" maxLength={6} />
            <p className="text-xs text-gray-500 -mt-2">Código de actividad económica de Hacienda CR (ej: 702001 = Consultoría)</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="2222-3333" />
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="empresa@correo.com" />
            </div>
            <Input label="Dirección" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="San José, Costa Rica" />
            <Button type="submit" loading={saving} className="w-full cx-press" size="lg">
              <Building2 className="w-4 h-4" /> Crear empresa
            </Button>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ExerciseWorkspacePage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const router = useRouter();

  const [attempt, setAttempt] = useState<ExerciseAttempt | null>(null);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const searchParams = useSearchParams();
  const pingRef = useRef<NodeJS.Timeout | null>(null);

  // Deep-link a una pestaña vía ?tab= (para el menú lateral)
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t) setActiveTab(t as Tab);
  }, [searchParams]);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<ExerciseAttempt>(`/api/v1/attempts/${attemptId}`);
      setAttempt(data);
    } catch { toast.error('Error al cargar el ejercicio'); router.push('/estudiante'); }
    finally { setLoading(false); }
  }, [attemptId, router]);

  useEffect(() => { load(); }, [load]);

  // Ping every 2 minutes while IN_PROGRESS
  useEffect(() => {
    if (attempt?.status !== 'IN_PROGRESS') return;
    pingRef.current = setInterval(() => {
      api.post(`/api/v1/attempts/${attemptId}/ping`).catch(() => {});
    }, 2 * 60 * 1000);
    return () => { if (pingRef.current) clearInterval(pingRef.current); };
  }, [attempt?.status, attemptId]);

  async function handleSubmit() {
    if (!confirm('¿Enviar el ejercicio para calificación? Ya no podrás hacer cambios.')) return;
    setSubmitting(true);
    try {
      await api.post(`/api/v1/attempts/${attemptId}/track`, { event: 'EXERCISE_SUBMITTED' }).catch(() => {});
      await api.post(`/api/v1/attempts/${attemptId}/submit`);
      toast.success('¡Ejercicio enviado para calificación!');
      await load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div className="flex-1 flex items-center justify-center bg-gray-50"><Spinner size="lg" /></div>;
  if (!attempt) return null;

  const exercise  = attempt.exercise!;
  const company   = attempt.company;
  const isReadonly = attempt.status === 'SUBMITTED' || attempt.status === 'GRADED';
  const showSetup  = attempt.status === 'IN_PROGRESS' && !company;
  const exerciseType = exercise.type;

  // ── Ciclo contable completo ──────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard',             label: 'Resumen',              icon: TrendingUp     },
    // Maestros
    ...(exerciseType !== 'JOURNAL_ONLY' ? [{ id: 'clients'   as Tab, label: 'Clientes',    icon: Users   }] : []),
    ...(exerciseType !== 'JOURNAL_ONLY' ? [{ id: 'suppliers' as Tab, label: 'Proveedores', icon: Truck   }] : []),
    // Modo Empresarial: propuestas de compra recibidas de ventas de otras empresas del curso
    ...(exerciseType !== 'JOURNAL_ONLY' ? [{ id: 'purchase-proposals' as Tab, label: 'Propuestas de compra', icon: Inbox }] : []),
    // Modo ERP (F2.3): órdenes de aprovisionamiento entre empresas del curso
    ...(exerciseType !== 'JOURNAL_ONLY' ? [{ id: 'procurement' as Tab, label: 'Aprovisionamiento (ERP)', icon: Truck }] : []),
    ...(exerciseType !== 'JOURNAL_ONLY' && exerciseType !== 'INVOICING_ONLY' ? [{ id: 'products' as Tab, label: 'Productos', icon: Package }] : []),
    // 1. Transacciones
    ...(exerciseType !== 'JOURNAL_ONLY' && exerciseType !== 'INVENTORY_ONLY' ? [{ id: 'invoices' as Tab, label: '1. Facturas',  icon: FileText  }] : []),
    { id: 'bank'                 as Tab, label: '2. Bancos',              icon: Landmark       },
    // 3. Asientos al Diario
    ...(exerciseType !== 'INVOICING_ONLY' && exerciseType !== 'INVENTORY_ONLY' ? [{ id: 'journal' as Tab, label: '3. Diario', icon: BookOpen }] : []),
    // 4. Libro Mayor
    { id: 'ledger'               as Tab, label: '4. Libro Mayor',         icon: TrendingUp     },
    // 5. Mayorización (Cuentas T)
    { id: 'mayorizacion'         as Tab, label: '5. Mayorización',        icon: Scale          },
    // 6. Balance de Comprobación
    { id: 'balance-comprobacion' as Tab, label: '6. Bal. Comprobación',   icon: ClipboardList  },
    // 7. Ajustes
    ...(exerciseType !== 'INVOICING_ONLY' && exerciseType !== 'INVENTORY_ONLY' ? [{ id: 'ajustes' as Tab, label: '7. Ajustes', icon: RefreshCw }] : []),
    // 8. Balance de Comprobación Ajustado
    { id: 'balance-ajustado'     as Tab, label: '8. Bal. Ajustado',       icon: ClipboardCheck },
    // 9. Estados Financieros
    { id: 'reports'              as Tab, label: '9. Est. Financieros',    icon: BarChart2      },
    // 10. Asientos de Cierre
    ...(exerciseType !== 'INVOICING_ONLY' && exerciseType !== 'INVENTORY_ONLY' ? [{ id: 'asientos-cierre' as Tab, label: '10. Asientos Cierre', icon: Lock }] : []),
    // 11. Balanza Post Cierre
    { id: 'balanza-post-cierre'  as Tab, label: '11. Balanza Post Cierre', icon: CheckCircle2  },
    // Herramientas
    { id: 'activity'             as Tab, label: 'Actividad',              icon: History        },
    // Feature 6: Activos Fijos
    { id: 'fixed-assets'         as Tab, label: 'Activos Fijos',          icon: Building2      },
    // Feature 7: Nómina
    { id: 'payroll'              as Tab, label: 'Nómina',                 icon: Users          },
    // Aprendizaje: Tutor socrático (profe IA)
    { id: 'tutor'                as Tab, label: 'Tutor IA',              icon: GraduationCap  },
  ];

  // ── Exam mode config (from exercise settings) ─────────────────────────────
  const examSettings   = (exercise as any)?.settings as any;
  const isExamMode     = !!(examSettings?.examMode) && attempt.status === 'IN_PROGRESS';
  const timeLimitMins  = examSettings?.timeLimit ? Number(examSettings.timeLimit) : undefined;

  async function handleAutoSubmit() {
    try {
      await api.post(`/api/v1/attempts/${attemptId}/track`, { event: 'EXERCISE_SUBMITTED' }).catch(() => {});
      await api.post(`/api/v1/attempts/${attemptId}/submit`);
      await load();
    } catch {
      // Best-effort auto-submit on timeout
    }
  }

  return (
    <ExamModeWrapper
      attemptId={attemptId}
      studentName={(attempt as any).student?.name ?? 'Estudiante'}
      exerciseName={exercise.title}
      timeLimitMinutes={isExamMode ? timeLimitMins : undefined}
      examMode={isExamMode}
      onAutoSubmit={handleAutoSubmit}
    >
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">

      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4 flex items-center gap-4 flex-wrap bg-white shadow-card">
        <Link
          href="/estudiante"
          aria-label="Volver al panel"
          className="text-gray-400 transition-colors hover:text-blue-700 cx-press"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <DifficultyBadge difficulty={exercise.difficulty} />
            <Badge variant="slate">{TYPE_LABELS[exercise.type] ?? exercise.type}</Badge>
            <StatusBadge status={attempt.status} />
          </div>
          <h2 className="text-base font-bold text-gray-900 truncate tracking-tight">{exercise.title}</h2>
        </div>
        {company && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-200">
            <Building2 className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-sm text-gray-700">{company.name}</span>
          </div>
        )}
        {company && (
          <div className="flex items-center gap-1.5 ml-2">
            <Link
              href={`/estudiante/ejercicio/${attemptId}/cxc`}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-gray-600 hover:text-blue-700 hover:border-blue-300 transition-colors border border-gray-200 cx-press"
            >
              Cuentas por cobrar
            </Link>
            <Link
              href={`/estudiante/ejercicio/${attemptId}/cxp`}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-gray-600 hover:text-blue-700 hover:border-blue-300 transition-colors border border-gray-200 cx-press"
            >
              Cuentas por pagar
            </Link>
            <Link
              href={`/estudiante/ejercicio/${attemptId}/diario`}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors ring-1 ring-blue-200/60 cx-press"
            >
              Libro diario
            </Link>
          </div>
        )}
        {attempt.status === 'IN_PROGRESS' && company && (
          <Button onClick={handleSubmit} loading={submitting} size="sm" className="cx-press">
            <Send className="w-4 h-4" /> Enviar para calificar
          </Button>
        )}
        {attempt.status === 'GRADED' && attempt.score != null && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl cx-tada">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-bold text-emerald-700 tabular-nums">
              {attempt.score} / {attempt.maxScore} pts
            </span>
          </div>
        )}
      </div>

      {/* No company yet — show setup */}
      {showSetup && (
        <CompanySetup attemptId={attemptId} onCreated={load} />
      )}

      {/* Main workspace */}
      {!showSetup && company && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Encabezado de sección — la navegación es el menú lateral izquierdo */}
          <div className="cx-hop-parent flex items-center justify-between gap-3 px-6 py-3 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-3 min-w-0">
              {(() => {
                const t = tabs.find((x) => x.id === activeTab);
                const I = t?.icon;
                return (
                  <>
                    {I && <IconTile icon={I} tint="#1B2E6E" size={32} className="cx-hop" />}
                    <div className="min-w-0">
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.13em] text-gold-900">Sección</p>
                      <span className="text-sm font-bold text-gray-800 truncate block">{t?.label ?? 'Resumen'}</span>
                    </div>
                  </>
                );
              })()}
            </div>
            {activeTab !== 'dashboard' && (
              <button onClick={() => setActiveTab('dashboard')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 flex-shrink-0 cx-press">
                <ArrowLeft className="w-3.5 h-3.5" /> Resumen del ejercicio
              </button>
            )}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'dashboard' && <DashboardTab  companyId={company.id} attempt={attempt} />}
            {activeTab === 'clients'   && <ClientsTab    companyId={company.id} readonly={isReadonly} attemptId={attemptId} />}
            {activeTab === 'suppliers' && <SuppliersTab  companyId={company.id} readonly={isReadonly} />}
            {activeTab === 'purchase-proposals' && <PurchaseProposalsInbox companyId={company.id} />}
            {activeTab === 'procurement' && <ProcurementOrders companyId={company.id} exerciseId={attempt.exerciseId} />}
            {activeTab === 'products'  && <ProductsTab   companyId={company.id} readonly={isReadonly} attemptId={attemptId} />}
            {activeTab === 'invoices'  && <InvoicesTab   companyId={company.id} readonly={isReadonly} attemptId={attemptId} />}
            {activeTab === 'journal'   && <JournalTab    companyId={company.id} readonly={isReadonly} attemptId={attemptId} />}
            {activeTab === 'ledger'    && <LedgerTab     companyId={company.id} />}
            {activeTab === 'bank'               && <BankTab              companyId={company.id} readonly={isReadonly} />}
            {activeTab === 'mayorizacion'       && <MayorizacionTab      companyId={company.id} />}
            {activeTab === 'balance-comprobacion' && <BalanceComprobacionTab companyId={company.id} />}
            {activeTab === 'ajustes'            && <SpecialJournalTab    companyId={company.id} readonly={isReadonly} attemptId={attemptId} prefix="ADJ"  emptyLabel="No hay asientos de ajuste aún" />}
            {activeTab === 'balance-ajustado'   && <BalanceComprobacionTab companyId={company.id} note="Incluye asientos de ajuste registrados" />}
            {activeTab === 'reports'            && <ReportsTab           companyId={company.id} companyName={company.name} />}
            {activeTab === 'asientos-cierre'    && <SpecialJournalTab    companyId={company.id} readonly={isReadonly} attemptId={attemptId} prefix="CIER" emptyLabel="No hay asientos de cierre aún" />}
            {activeTab === 'balanza-post-cierre' && <BalanceComprobacionTab companyId={company.id} filterTypes={['ASSET','LIABILITY','EQUITY']} note="Solo cuentas permanentes (activo, pasivo, patrimonio)" />}
            {activeTab === 'activity'           && <ActivityTab          attemptId={attemptId} />}
            {activeTab === 'fixed-assets'       && <FixedAssetsTab       companyId={company.id} />}
            {activeTab === 'payroll'            && <PayrollTab           companyId={company.id} />}
            {activeTab === 'tutor'              && <SocraticTutorPanel   attemptId={attemptId} companyId={company.id} />}
          </div>
        </div>
      )}

      {/* Submitted / not started messages */}
      {!showSetup && !company && attempt.status === 'NOT_STARTED' && (
        <div className="flex-1 flex items-center justify-center p-6">
          <EmptyState
            illustration={<SceneStudentDesk size={220} className="lp-drift" />}
            title="Este ejercicio aún no ha comenzado"
            description="Inicia el ejercicio desde el panel principal para crear tu empresa y empezar a registrar operaciones."
            action={
              <Link
                href="/estudiante"
                className={buttonClasses({ variant: 'primary', className: 'cx-press' })}
              >
                <ArrowLeft className="w-4 h-4" /> Volver al panel
              </Link>
            }
          />
        </div>
      )}
      {attempt.status === 'SUBMITTED' && !company && (
        <div className="flex-1 flex items-center justify-center p-6">
          <EmptyState
            illustration={<SceneEmptyBox size={200} className="lp-drift" />}
            title="Ejercicio enviado"
            description="Tu trabajo está en manos del profesor. Recibirás la calificación y la retroalimentación aquí mismo."
          />
        </div>
      )}

      {attempt.status === 'GRADED' && attempt.feedback && (() => {
        let feedbackText = attempt.feedback as string;
        let rubricComments: Record<string, string> = {};
        try {
          const parsed = JSON.parse(attempt.feedback as string);
          if (parsed && typeof parsed === 'object') {
            feedbackText   = parsed.text   || '';
            rubricComments = parsed.rubric || {};
          }
        } catch { /* use raw string */ }
        const rubricEntries = Object.entries(rubricComments).filter(([, v]) => v);
        const rubrics: Array<{ id: string; criterion: string }> = (attempt.exercise as any)?.rubrics ?? [];
        if (!feedbackText && rubricEntries.length === 0) return null;
        return (
          <div className="px-6 pb-4">
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-card space-y-3 cx-pop">
              <p className="text-[0.68rem] font-bold text-emerald-700 uppercase tracking-[0.13em] flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" /> Retroalimentación del profesor
              </p>
              {feedbackText && <p className="text-sm text-gray-700 leading-relaxed">{feedbackText}</p>}
              {rubricEntries.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-emerald-200">
                  {rubricEntries.map(([rubricId, comment]) => {
                    const rubric = rubrics.find(r => r.id === rubricId);
                    return (
                      <div key={rubricId} className="text-xs">
                        <span className="font-semibold text-emerald-700">{rubric?.criterion ?? 'Criterio'}:</span>
                        <span className="text-gray-600 ml-1">{comment}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Feature 8: AI Assistant floating button */}
      {company && attempt.status === 'IN_PROGRESS' && (
        <AiAssistant activeTab={activeTab} companyName={company.name} />
      )}
    </div>
    </ExamModeWrapper>
  );
}
