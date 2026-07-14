'use client';

/**
 * D-101 — Impuesto sobre la Renta (Ejercicio por empresa)
 * Ruta: /estudiante/ejercicio/[attemptId]/renta
 *
 * Secciones:
 *  1. Resumen del año fiscal (ingresos, gastos, renta neta)
 *  2. Cálculo del impuesto (tramos progresivos)
 *  3. Créditos y pagos (pagos parciales + retenciones recibidas)
 *  4. Pagos parciales trimestrales (programar + marcar pagado)
 *  5. Retenciones realizadas (registrar + listar)
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Info,
  Calendar, Plus, RefreshCw, Clock, Building2,
  TrendingUp, TrendingDown, FileText, DollarSign, Landmark,
} from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArtFiscalCalendar, ArtReport, SceneEmptyBox } from '@/components/illustrations';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface TaxBracket {
  from: number;
  to: number;
  rate: number;
  taxableAmount: number;
  tax: number;
  label: string;
}

interface PartialPayment {
  id: string;
  quarter: number;
  dueDate: string;
  amount: string;
  isPaid: boolean;
  paidDate: string | null;
}

interface Retencion {
  id: string;
  type: string;
  supplierName: string;
  supplierCedula: string | null;
  grossAmount: string;
  retentionRate: string;
  retentionAmount: string;
  netPaid: string;
  date: string;
  description: string | null;
}

interface D101Result {
  fiscalYear: number;
  ingresosGravables: number;
  gastosDeducibles: number;
  rentaNetaImponible: number;
  taxBrackets: TaxBracket[];
  impuestoDeterminado: number;
  pagosParciales: number;
  retencionesRecibidas: number;
  impuestoAPagar: number;
  saldoAFavor: number;
  isSmallCompany: boolean;
  tipoEmpresa: 'PYME' | 'GRANDE';
  effectiveRate: string;
  partialPayments: PartialPayment[];
  retenciones: Retencion[];
  hasJournalData: boolean;
}

const CURRENT_YEAR = new Date().getFullYear();

const RETENCION_TYPES: Record<string, { label: string; rate: number }> = {
  SERVICIOS_PROFESIONALES: { label: 'Servicios Profesionales',  rate: 0.02 },
  ALQUILER:                { label: 'Alquiler',                  rate: 0.15 },
  DIVIDENDOS:              { label: 'Dividendos',                rate: 0.15 },
  TRANSPORTE:              { label: 'Transporte',                rate: 0.01 },
};

const QUARTER_NAMES = ['', 'I Trimestre (31 mar)', 'II Trimestre (30 jun)', 'III Trimestre (30 set)', 'IV Trimestre (15 dic)'];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number | string): string {
  return Number(n).toLocaleString('es-CR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function isPast(iso: string): boolean {
  return new Date(iso) < new Date();
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// Tintes de marca por semántica (solo presentación: no altera ningún cálculo).
const TINT: Record<string, string> = {
  gray:   '#94A3B8',
  green:  '#16A34A',
  red:    '#EF4444',
  blue:   '#2563EB',
  navy:   '#1B2E6E',
  gold:   '#B8860B',
  orange: '#D4A017',
};

/** Caja de cifra del formulario D-101 (etiqueta + monto en ₡ + nota). */
function StatBox({ label, value, sub, color = 'gray', icon, className }: {
  label: string; value: string; sub?: string; color?: string;
  icon?: React.ElementType; className?: string;
}) {
  return (
    <StatCard
      label={label}
      value={`₡ ${value}`}
      hint={sub}
      icon={icon}
      tint={TINT[color] ?? TINT.gray}
      className={className}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function RentaPage() {
  const params    = useParams();
  const attemptId = params.attemptId as string;

  const [companyId,   setCompanyId]   = useState<string | null>(null);
  const [fiscalYear,  setFiscalYear]  = useState<number>(CURRENT_YEAR);
  const [result,      setResult]      = useState<D101Result | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [calculating, setCalculating] = useState(false);

  // Partial payments state
  const [estimatedTax, setEstimatedTax] = useState('');
  const [scheduling,   setScheduling]   = useState(false);

  // Retencion form
  const [retForm, setRetForm] = useState({
    type: 'SERVICIOS_PROFESIONALES',
    supplierName: '',
    supplierCedula: '',
    grossAmount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });
  const [addingRet, setAddingRet] = useState(false);
  const [showRetForm, setShowRetForm] = useState(false);

  // ── Load company ID from attempt ────────────────────────────────────────
  useEffect(() => {
    api.get<any>(`/api/v1/attempts/${attemptId}/company`)
      .then(({ data }) => setCompanyId(data.id))
      .catch(() => {
        // Try companies endpoint as fallback
        api.get<any[]>('/api/v1/companies')
          .then(({ data }) => {
            if (data && data.length > 0) setCompanyId(data[0].id);
          })
          .catch(() => toast.error('No se encontró la empresa del ejercicio'));
      });
  }, [attemptId]);

  // ── Calculate D-101 ────────────────────────────────────────────────────
  const calculateD101 = useCallback(async () => {
    if (!companyId) return;
    setCalculating(true);
    try {
      const { data } = await api.post<D101Result>(
        `/api/v1/companies/${companyId}/tax/d101/calculate`,
        { fiscalYear },
      );
      setResult(data);
    } catch {
      toast.error('Error al calcular el impuesto. Intenta nuevamente.');
    } finally {
      setCalculating(false);
    }
  }, [companyId, fiscalYear]);

  useEffect(() => {
    if (companyId) calculateD101();
  }, [companyId, fiscalYear, calculateD101]);

  // ── Schedule partial payments ──────────────────────────────────────────
  async function handleSchedulePayments() {
    if (!companyId) return;
    const tax = parseFloat(estimatedTax);
    if (!tax || tax <= 0) {
      toast.error('Ingresa un monto de impuesto estimado válido');
      return;
    }
    setScheduling(true);
    try {
      await api.post(`/api/v1/companies/${companyId}/tax/d101/partial-payments`, {
        fiscalYear,
        estimatedTax: tax,
      });
      toast.success('Pagos parciales programados');
      await calculateD101();
    } catch {
      toast.error('Error al programar los pagos parciales');
    } finally {
      setScheduling(false);
    }
  }

  // ── Mark partial payment as paid ───────────────────────────────────────
  async function handleMarkPaid(paymentId: string) {
    if (!companyId) return;
    try {
      await api.patch(
        `/api/v1/companies/${companyId}/tax/d101/partial-payments/${paymentId}/pay`,
        { paidDate: new Date().toISOString() },
      );
      toast.success('Pago marcado como realizado');
      await calculateD101();
    } catch {
      toast.error('Error al marcar el pago');
    }
  }

  // ── Create retencion ───────────────────────────────────────────────────
  async function handleCreateRetencion(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    if (!retForm.supplierName || !retForm.grossAmount) {
      toast.error('Completa todos los campos requeridos');
      return;
    }
    setAddingRet(true);
    try {
      await api.post(`/api/v1/companies/${companyId}/tax/retenciones`, {
        type:           retForm.type,
        supplierName:   retForm.supplierName,
        supplierCedula: retForm.supplierCedula || undefined,
        grossAmount:    parseFloat(retForm.grossAmount),
        date:           retForm.date,
        description:    retForm.description || undefined,
      });
      toast.success('Retención registrada');
      setShowRetForm(false);
      setRetForm({
        type: 'SERVICIOS_PROFESIONALES',
        supplierName: '',
        supplierCedula: '',
        grossAmount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
      });
      await calculateD101();
    } catch {
      toast.error('Error al registrar la retención');
    } finally {
      setAddingRet(false);
    }
  }

  // ── Computed retention preview ─────────────────────────────────────────
  const retRate       = RETENCION_TYPES[retForm.type]?.rate ?? 0;
  const retGross      = parseFloat(retForm.grossAmount) || 0;
  const retAmount     = retGross * retRate;
  const retNet        = retGross - retAmount;

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/60 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm text-gray-500">Cargando datos fiscales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/60">

      <div className="max-w-5xl mx-auto px-6 lg:px-10 py-8 space-y-7">

        {/* Volver */}
        <Link
          href={`/estudiante/ejercicio/${attemptId}`}
          className="inline-flex items-center gap-2 -ml-1 text-sm font-medium text-gray-500 hover:text-blue-700 transition-colors cx-press"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al ejercicio
        </Link>

        {/* ── Encabezado ────────────────────────────────────────────────── */}
        <PageHeader
          eyebrow="Tributación · TRIBU-CR"
          title="D-101 — Impuesto sobre la Renta"
          subtitle={`Personas jurídicas — Régimen tradicional — Período fiscal ${fiscalYear}`}
          icon={Landmark}
          iconTint="#1B2E6E"
          className="lp-in"
          actions={
            <select
              value={fiscalYear}
              onChange={e => setFiscalYear(parseInt(e.target.value, 10))}
              className="text-sm font-semibold bg-white border border-gray-200 text-gray-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
            >
              {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(y => (
                <option key={y} value={y}>Año {y}</option>
              ))}
            </select>
          }
        />

        {/* ── Banda del módulo + aviso de simulación educativa ──────────── */}
        <Card variant="onDark" className="cx-pop">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-6 lg:px-7 py-6">
            <div className="flex-1 min-w-0">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-1.5">
                Declaración anual
              </p>
              <h2 className="text-lg font-bold leading-snug">La renta neta nace de tu contabilidad, no de una estimación.</h2>
              <p className="mt-1.5 text-sm text-blue-200/80 max-w-xl">
                Ingresos gravables menos gastos deducibles: el resultado se grava por tramos progresivos.
                Los pagos parciales y las retenciones se acreditan contra el impuesto determinado.
              </p>
            </div>
            <ArtFiscalCalendar size={140} className="lp-drift flex-shrink-0" />
          </div>
          <div className="flex items-start gap-2 px-6 lg:px-7 py-3 border-t border-white/10 text-xs font-semibold text-gold-500">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-px" />
            <span>
              SIMULACIÓN EDUCATIVA — Los cálculos son con fines académicos. Tasas 2026: PYME 5%–25%, grandes 30%.
            </span>
          </div>
        </Card>

        {/* ── No journal data warning ──────────────────────────────────── */}
        {result && !result.hasJournalData && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3 cx-pop">
            <Info className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-blue-800">Sin asientos contables para este período</p>
              <p className="text-xs text-blue-700 mt-1">
                Aún no hay ingresos ni gastos registrados en el año {fiscalYear}.
                Los cálculos aparecerán automáticamente al registrar asientos contables en las cuentas de ingresos (4.x.x) y gastos (5.x.x).
              </p>
            </div>
          </div>
        )}

        {/* ── SECCIÓN 1: Resumen del año fiscal ───────────────────────── */}
        <SectionCard
          eyebrow="Sección I"
          title="Resumen del año fiscal"
          icon={FileText}
          iconTint="#1B2E6E"
          className="cx-pop cx-d1"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatBox
              label="Ingresos gravables"
              value={fmt(result?.ingresosGravables ?? 0)}
              sub="Cuentas de ingresos (4.x.x)"
              color={result && result.ingresosGravables > 0 ? 'green' : 'gray'}
              icon={TrendingUp}
              className="cx-lift cx-hop-parent"
            />
            <StatBox
              label="Gastos deducibles"
              value={fmt(result?.gastosDeducibles ?? 0)}
              sub="Cuentas de gastos (5.x.x)"
              color={result && result.gastosDeducibles > 0 ? 'orange' : 'gray'}
              icon={TrendingDown}
              className="cx-lift cx-hop-parent"
            />
            <StatBox
              label="Renta neta imponible"
              value={fmt(result?.rentaNetaImponible ?? 0)}
              sub="Ingresos − Gastos"
              color={result && result.rentaNetaImponible > 0 ? 'blue' : 'gray'}
              icon={DollarSign}
              className="cx-lift cx-hop-parent"
            />
          </div>

          {result && (
            <div className={`mt-4 flex items-center gap-2 text-xs rounded-xl px-3.5 py-2.5 ${
              result.isSmallCompany
                ? 'bg-blue-50 text-blue-700 border border-blue-100'
                : 'bg-gold-50 text-gold-900 border border-gold-100'
            }`}>
              <Building2 className="w-4 h-4 flex-shrink-0" />
              {result.isSmallCompany
                ? `Empresa PYME — Ingresos brutos ≤ ₡${fmt(119_024_000)} — Aplican tramos progresivos`
                : `Empresa grande — Ingresos brutos > ₡${fmt(119_024_000)} — Tarifa plana 30%`}
            </div>
          )}
        </SectionCard>

        {/* ── SECCIÓN 2: Cálculo del impuesto ─────────────────────────── */}
        <SectionCard
          eyebrow="Sección II"
          title="Cálculo del impuesto"
          description="Tramos progresivos aplicados sobre la renta neta imponible."
          icon={TrendingUp}
          iconTint="#2563EB"
          className="cx-pop cx-d2"
        >
          <div>
            {result && result.rentaNetaImponible > 0 && result.taxBrackets.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200 text-[10px] text-gray-500 uppercase tracking-wide">
                      <th className="text-left py-2.5 pr-4 font-semibold">Tramo</th>
                      <th className="text-right py-2.5 px-4 font-semibold">Monto gravable</th>
                      <th className="text-right py-2.5 px-4 font-semibold">Tasa</th>
                      <th className="text-right py-2.5 pl-4 font-semibold">Impuesto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.taxBrackets.map((b, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/40 transition-colors">
                        <td className="py-2.5 pr-4 text-gray-600 text-xs">{b.label}</td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-right text-gray-800">₡ {fmt(b.taxableAmount)}</td>
                        <td className="py-2.5 px-4 text-right font-bold tabular-nums text-blue-700">
                          {(b.rate * 100).toFixed(0)}%
                        </td>
                        <td className="py-2.5 pl-4 font-mono tabular-nums text-right font-bold">₡ {fmt(b.tax)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-50 border-t-2 border-blue-100 font-bold">
                      <td className="py-3 pr-4 pl-3 text-blue-800" colSpan={3}>
                        Impuesto determinado (tasa efectiva {result.effectiveRate}%)
                      </td>
                      <td className="py-3 pl-4 pr-3 font-mono tabular-nums text-right text-blue-800 text-base">
                        ₡ {fmt(result.impuestoDeterminado)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <EmptyState
                illustration={<ArtReport size={180} className="lp-drift" />}
                title="Aún no hay impuesto que calcular"
                description="Registra ingresos y gastos en el diario para ver el cálculo por tramos progresivos."
                className="py-8"
              />
            )}
          </div>
        </SectionCard>

        {/* ── SECCIÓN 3: Créditos y resultado final ────────────────────── */}
        <SectionCard
          eyebrow="Sección III"
          title="Créditos y resultado final"
          description="Del impuesto determinado se restan los pagos parciales y las retenciones recibidas."
          icon={DollarSign}
          iconTint="#1B2E6E"
          className="cx-pop cx-d3"
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Impuesto determinado</p>
                <p className="font-mono tabular-nums font-bold text-gray-800">₡ {fmt(result?.impuestoDeterminado ?? 0)}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3.5 border border-emerald-200">
                <p className="text-xs text-emerald-600 mb-1">(-) Pagos parciales</p>
                <p className="font-mono tabular-nums font-bold text-emerald-700">₡ {fmt(result?.pagosParciales ?? 0)}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3.5 border border-blue-200">
                <p className="text-xs text-blue-700 mb-1">(-) Retenciones recibidas</p>
                <p className="font-mono tabular-nums font-bold text-blue-700">₡ {fmt(result?.retencionesRecibidas ?? 0)}</p>
              </div>
            </div>

            <div className={`flex items-center justify-between rounded-2xl p-4 border-2 ${
              (result?.impuestoAPagar ?? 0) > 0
                ? 'bg-red-50 border-red-300'
                : (result?.saldoAFavor ?? 0) > 0
                ? 'bg-emerald-50 border-emerald-300'
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div>
                {(result?.impuestoAPagar ?? 0) > 0 ? (
                  <>
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wide">Casilla 602 — Impuesto a pagar</p>
                    <p className="text-xs text-red-500 mt-0.5">Vence 15 de diciembre del año siguiente al período</p>
                  </>
                ) : (result?.saldoAFavor ?? 0) > 0 ? (
                  <>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Casilla 603 — Saldo a favor</p>
                    <p className="text-xs text-emerald-500 mt-0.5">Puede solicitarse devolución o aplicarse al siguiente período</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-500">Resultado del período</p>
                )}
              </div>
              <span className={`text-2xl font-extrabold font-mono tabular-nums cx-count ${
                (result?.impuestoAPagar ?? 0) > 0
                  ? 'text-red-700'
                  : (result?.saldoAFavor ?? 0) > 0
                  ? 'text-emerald-700'
                  : 'text-gray-400'
              }`}>
                ₡ {fmt(
                  (result?.impuestoAPagar ?? 0) > 0
                    ? (result?.impuestoAPagar ?? 0)
                    : (result?.saldoAFavor ?? 0)
                )}
              </span>
            </div>
          </div>
        </SectionCard>

        {/* ── SECCIÓN 4: Pagos parciales trimestrales ──────────────────── */}
        <SectionCard
          eyebrow="Sección IV"
          title="Pagos parciales trimestrales"
          description="Anticipos del impuesto: 25% del estimado en cada trimestre (Art. 22 LISR)."
          icon={Calendar}
          iconTint="#2563EB"
          className="cx-pop cx-d4"
        >
          <div className="space-y-4">

            {/* Educational note */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Las empresas deben realizar <strong>4 pagos parciales</strong> durante el año fiscal: 25% del impuesto estimado en
                cada trimestre (Art. 22 LISR). Los pagos son créditos contra el impuesto final del D-101.
              </p>
            </div>

            {/* Schedule form */}
            {(!result?.partialPayments || result.partialPayments.length === 0) && (
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                    Impuesto estimado para {fiscalYear}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">₡</span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={estimatedTax}
                      onChange={e => setEstimatedTax(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2.5 text-sm font-mono tabular-nums bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors"
                    />
                  </div>
                  {estimatedTax && parseFloat(estimatedTax) > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Cada trimestre: <span className="font-mono tabular-nums">₡ {fmt(parseFloat(estimatedTax) / 4)}</span>
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleSchedulePayments}
                  disabled={scheduling || !estimatedTax}
                  className="cx-press"
                >
                  {scheduling ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Programar pagos
                </Button>
              </div>
            )}

            {/* Payments table */}
            {result?.partialPayments && result.partialPayments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200 text-[10px] text-gray-500 uppercase tracking-wide">
                      <th className="text-left py-2.5 pr-4 font-semibold">Trimestre</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Fecha límite</th>
                      <th className="text-right py-2.5 px-4 font-semibold">Monto</th>
                      <th className="text-center py-2.5 pl-4 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.partialPayments.map(p => (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 pr-4 font-semibold text-gray-700">
                          {QUARTER_NAMES[p.quarter]}
                        </td>
                        <td className={`py-3 px-4 text-xs ${
                          !p.isPaid && isPast(p.dueDate) ? 'text-red-600 font-semibold' : 'text-gray-600'
                        }`}>
                          {fmtDate(p.dueDate)}
                          {!p.isPaid && isPast(p.dueDate) && (
                            <span className="ml-1 text-red-500">• Vencido</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-right font-bold">
                          ₡ {fmt(p.amount)}
                        </td>
                        <td className="py-3 pl-4 text-center">
                          {p.isPaid ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              Pagado
                            </span>
                          ) : (
                            <button
                              onClick={() => handleMarkPaid(p.id)}
                              className="inline-flex items-center gap-1 text-xs font-semibold bg-gold-50 text-gold-900 border border-gold-100 hover:bg-gold-100 px-2.5 py-1 rounded-full transition-colors cx-press"
                            >
                              <Clock className="w-3 h-3" />
                              Pendiente
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 font-bold bg-gray-50">
                      <td className="py-2.5 pr-4 pl-3 text-gray-700" colSpan={2}>Total pagos parciales</td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-right text-gray-800">
                        ₡ {fmt(result.partialPayments.reduce((s, p) => s + Number(p.amount), 0))}
                      </td>
                      <td className="py-2.5 pl-4 pr-3 text-center text-xs text-gray-500">
                        {result.partialPayments.filter(p => p.isPaid).length}/{result.partialPayments.length} pagados
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <EmptyState
                illustration={<ArtFiscalCalendar size={170} className="lp-drift" />}
                title="Sin pagos parciales programados"
                description="Ingresa el impuesto estimado del año y programa los cuatro anticipos trimestrales."
                className="py-6"
              />
            )}
          </div>
        </SectionCard>

        {/* ── SECCIÓN 5: Retenciones realizadas ───────────────────────── */}
        <SectionCard
          eyebrow="Sección V"
          title="Retenciones en la fuente realizadas"
          description="Lo que retienes al pagar servicios y remites a Hacienda."
          icon={TrendingDown}
          iconTint="#B8860B"
          className="cx-pop cx-d5"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRetForm(!showRetForm)}
              className="cx-press"
            >
              <Plus className="w-4 h-4" />
              {showRetForm ? 'Cancelar' : 'Registrar retención'}
            </Button>
          }
        >
          <div className="space-y-4">

            {/* Educational note */}
            <div className="bg-gold-50 border border-gold-100 rounded-xl p-3.5 flex items-start gap-2">
              <Info className="w-4 h-4 text-gold-700 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gold-900">
                Al pagar servicios, la empresa debe <strong>retener y remitir a Hacienda</strong> un porcentaje del pago.
                El proveedor recibe el neto y la retención es un crédito para él.
                Tasas: Servicios profesionales 2% · Alquiler 15% · Dividendos 15% · Transporte 1%.
              </p>
            </div>

            {/* Add retencion form */}
            {showRetForm && (
              <form onSubmit={handleCreateRetencion} className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4 cx-pop">
                <p className="text-sm font-bold text-gray-900">Nueva retención en la fuente</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Tipo de retención *</label>
                    <select
                      value={retForm.type}
                      onChange={e => setRetForm(f => ({ ...f, type: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors"
                    >
                      {Object.entries(RETENCION_TYPES).map(([k, v]) => (
                        <option key={k} value={k}>{v.label} ({(v.rate * 100).toFixed(0)}%)</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Nombre del proveedor *</label>
                    <input
                      type="text"
                      required
                      value={retForm.supplierName}
                      onChange={e => setRetForm(f => ({ ...f, supplierName: e.target.value }))}
                      placeholder="Ej. Consultora ABC S.A."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Cédula / RUC del proveedor</label>
                    <input
                      type="text"
                      value={retForm.supplierCedula}
                      onChange={e => setRetForm(f => ({ ...f, supplierCedula: e.target.value }))}
                      placeholder="Ej. 3-101-123456"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Monto bruto a pagar *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">₡</span>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={retForm.grossAmount}
                        onChange={e => setRetForm(f => ({ ...f, grossAmount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2.5 text-sm font-mono tabular-nums bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Fecha *</label>
                    <input
                      type="date"
                      required
                      value={retForm.date}
                      onChange={e => setRetForm(f => ({ ...f, date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Descripción</label>
                    <input
                      type="text"
                      value={retForm.description}
                      onChange={e => setRetForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Ej. Honorarios enero 2026"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors"
                    />
                  </div>
                </div>

                {/* Preview */}
                {retGross > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center rounded-2xl p-4 bg-gradient-to-br from-csq-mid to-csq-active text-white shadow-soft">
                    <div>
                      <p className="text-[0.68rem] uppercase tracking-[0.13em] font-bold text-blue-200/80">Monto bruto</p>
                      <p className="font-mono tabular-nums font-extrabold mt-0.5">₡ {fmt(retGross)}</p>
                    </div>
                    <div>
                      <p className="text-[0.68rem] uppercase tracking-[0.13em] font-bold text-gold-500">Retención ({(retRate * 100).toFixed(0)}%)</p>
                      <p className="font-mono tabular-nums font-extrabold mt-0.5 cx-count">₡ {fmt(retAmount)}</p>
                    </div>
                    <div>
                      <p className="text-[0.68rem] uppercase tracking-[0.13em] font-bold text-blue-200/80">Pago neto al proveedor</p>
                      <p className="font-mono tabular-nums font-extrabold mt-0.5">₡ {fmt(retNet)}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowRetForm(false)}
                    className="cx-press"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={addingRet} className="cx-press">
                    {addingRet ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Registrar retención
                  </Button>
                </div>
              </form>
            )}

            {/* Retenciones table */}
            {result?.retenciones && result.retenciones.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200 text-[10px] text-gray-500 uppercase tracking-wide">
                      <th className="text-left py-2.5 pr-4 font-semibold">Fecha</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Proveedor</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Tipo</th>
                      <th className="text-right py-2.5 px-4 font-semibold">Bruto</th>
                      <th className="text-right py-2.5 px-4 font-semibold">Tasa</th>
                      <th className="text-right py-2.5 pl-4 font-semibold">Retención</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.retenciones.map(r => (
                      <tr key={r.id} className="border-b border-gray-100 hover:bg-blue-50/40 transition-colors">
                        <td className="py-2.5 pr-4 text-xs text-gray-500">{fmtDate(r.date)}</td>
                        <td className="py-2.5 px-4">
                          <p className="font-semibold text-gray-800">{r.supplierName}</p>
                          {r.supplierCedula && (
                            <p className="text-xs text-gray-400 font-mono">{r.supplierCedula}</p>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-gray-600">
                          {RETENCION_TYPES[r.type]?.label ?? r.type}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-right text-gray-700">₡ {fmt(r.grossAmount)}</td>
                        <td className="py-2.5 px-4 text-right font-bold tabular-nums text-gold-700">
                          {(Number(r.retentionRate) * 100).toFixed(0)}%
                        </td>
                        <td className="py-2.5 pl-4 font-mono tabular-nums text-right font-bold text-gold-900">
                          ₡ {fmt(r.retentionAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 font-bold bg-gold-50">
                      <td className="py-2.5 pr-4 pl-3 text-gold-900" colSpan={5}>Total retenciones realizadas</td>
                      <td className="py-2.5 pl-4 pr-3 font-mono tabular-nums text-right text-gold-900">
                        ₡ {fmt(result.retenciones.reduce((s, r) => s + Number(r.retentionAmount), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <EmptyState
                illustration={<SceneEmptyBox size={180} className="lp-drift" />}
                title={`Sin retenciones en ${fiscalYear}`}
                description="Registra la primera retención que le practicaste a un proveedor de servicios."
                action={
                  !showRetForm ? (
                    <Button variant="outline" onClick={() => setShowRetForm(true)} className="cx-press">
                      <Plus className="w-4 h-4" /> Registrar retención
                    </Button>
                  ) : undefined
                }
                className="py-6"
              />
            )}
          </div>
        </SectionCard>

        {/* ── Legal reference ──────────────────────────────────────────── */}
        <div className="bg-gold-50 border border-gold-100 rounded-2xl p-5 cx-pop cx-d6">
          <p className="text-[0.68rem] font-bold text-gold-900 uppercase tracking-[0.13em] mb-2.5 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> Marco legal — Ley del Impuesto sobre la Renta N.° 7092
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-1 list-disc list-inside text-xs text-gold-900/80 space-y-0.5">
            <li>Período fiscal: <strong>1 enero al 31 diciembre</strong> (art. 4 LISR).</li>
            <li>Declaración D-101 debe presentarse antes del <strong>15 de marzo</strong>.</li>
            <li>PYME: ingresos brutos ≤ ₡119.024.000 → tramos 5%, 10%, 15%, 20%, 25%.</li>
            <li>Empresa grande: ingresos brutos {'>'} ₡119.024.000 → tarifa plana 30%.</li>
            <li>Pagos parciales: 4 trimestres (mar, jun, set, dic) — Art. 22 LISR.</li>
            <li>Retenciones en la fuente: Art. 23 LISR — crédito para el proveedor.</li>
          </ul>
        </div>

        {/* Recalculate button */}
        <div className="flex justify-center pb-4">
          <Button
            onClick={calculateD101}
            disabled={calculating || !companyId}
            size="lg"
            className="cx-press"
          >
            <RefreshCw className={`w-4 h-4 ${calculating ? 'animate-spin' : ''}`} />
            {calculating ? 'Calculando...' : 'Recalcular desde contabilidad'}
          </Button>
        </div>

      </div>
    </div>
  );
}
