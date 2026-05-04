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
  TrendingUp, TrendingDown, FileText, DollarSign,
} from 'lucide-react';
import Link from 'next/link';

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

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, color = 'emerald' }: {
  icon: any; title: string; color?: string;
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-700 text-white',
    blue:    'bg-blue-700 text-white',
    purple:  'bg-purple-700 text-white',
    orange:  'bg-orange-600 text-white',
    red:     'bg-red-700 text-white',
    gray:    'bg-gray-700 text-white',
  };
  return (
    <div className={`flex items-center gap-3 px-5 py-3 ${colors[color] ?? colors.emerald}`}>
      <Icon className="w-4 h-4 opacity-80" />
      <span className="text-sm font-bold uppercase tracking-wide">{title}</span>
    </div>
  );
}

function StatBox({ label, value, sub, color = 'gray' }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    gray:    'bg-gray-50  border-gray-200  text-gray-800',
    green:   'bg-emerald-50 border-emerald-200 text-emerald-800',
    red:     'bg-red-50   border-red-200   text-red-800',
    blue:    'bg-blue-50  border-blue-200  text-blue-800',
    purple:  'bg-purple-50 border-purple-200 text-purple-800',
    orange:  'bg-orange-50 border-orange-200 text-orange-800',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">{label}</p>
      <p className="text-xl font-black font-mono">₡ {value}</p>
      {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
    </div>
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-sm text-gray-500">Cargando datos fiscales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-emerald-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/estudiante/ejercicio/${attemptId}`}
              className="text-emerald-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">
                  Ministerio de Hacienda
                </span>
                <span className="text-emerald-600">|</span>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">
                  TRIBU CR
                </span>
              </div>
              <h1 className="text-lg font-black">D-101 — Declaración del Impuesto sobre la Renta</h1>
              <p className="text-xs text-emerald-300">
                Personas Jurídicas — Régimen Tradicional — Período fiscal {fiscalYear}
              </p>
            </div>
          </div>

          {/* Year selector */}
          <select
            value={fiscalYear}
            onChange={e => setFiscalYear(parseInt(e.target.value, 10))}
            className="text-sm font-semibold bg-emerald-800 border border-emerald-600 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(y => (
              <option key={y} value={y}>Año {y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Educational banner */}
      <div className="bg-amber-400 text-amber-900">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-2 text-xs font-bold">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          SIMULACIÓN EDUCATIVA — Los cálculos son con fines académicos. Tasas 2026: PYME 5%–25%, grandes 30%.
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── No journal data warning ──────────────────────────────────── */}
        {result && !result.hasJournalData && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-blue-800">Sin asientos contables para este período</p>
              <p className="text-xs text-blue-600 mt-1">
                Aún no hay ingresos ni gastos registrados en el año {fiscalYear}.
                Los cálculos aparecerán automáticamente al registrar asientos contables en las cuentas de ingresos (4.x.x) y gastos (5.x.x).
              </p>
            </div>
          </div>
        )}

        {/* ── SECCIÓN 1: Resumen del año fiscal ───────────────────────── */}
        <Card>
          <SectionTitle icon={FileText} title="Sección I — Resumen del Año Fiscal" color="emerald" />
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatBox
              label="Ingresos gravables"
              value={fmt(result?.ingresosGravables ?? 0)}
              sub="Cuentas de ingresos (4.x.x)"
              color={result && result.ingresosGravables > 0 ? 'green' : 'gray'}
            />
            <StatBox
              label="Gastos deducibles"
              value={fmt(result?.gastosDeducibles ?? 0)}
              sub="Cuentas de gastos (5.x.x)"
              color={result && result.gastosDeducibles > 0 ? 'orange' : 'gray'}
            />
            <StatBox
              label="Renta neta imponible"
              value={fmt(result?.rentaNetaImponible ?? 0)}
              sub="Ingresos − Gastos"
              color={result && result.rentaNetaImponible > 0 ? 'blue' : 'gray'}
            />
          </div>

          {result && (
            <div className="px-5 pb-4">
              <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                result.isSmallCompany
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-purple-50 text-purple-700 border border-purple-200'
              }`}>
                <Building2 className="w-4 h-4 flex-shrink-0" />
                {result.isSmallCompany
                  ? `Empresa PYME — Ingresos brutos ≤ ₡${fmt(119_024_000)} — Aplican tramos progresivos`
                  : `Empresa grande — Ingresos brutos > ₡${fmt(119_024_000)} — Tarifa plana 30%`}
              </div>
            </div>
          )}
        </Card>

        {/* ── SECCIÓN 2: Cálculo del impuesto ─────────────────────────── */}
        <Card>
          <SectionTitle icon={TrendingUp} title="Sección II — Cálculo del Impuesto" color="purple" />
          <div className="p-5">
            {result && result.rentaNetaImponible > 0 && result.taxBrackets.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="text-left py-2 pr-4">Tramo</th>
                      <th className="text-right py-2 px-4">Monto gravable</th>
                      <th className="text-right py-2 px-4">Tasa</th>
                      <th className="text-right py-2 pl-4">Impuesto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.taxBrackets.map((b, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2.5 pr-4 text-gray-600 text-xs">{b.label}</td>
                        <td className="py-2.5 px-4 font-mono text-right text-gray-800">₡ {fmt(b.taxableAmount)}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-purple-700">
                          {(b.rate * 100).toFixed(0)}%
                        </td>
                        <td className="py-2.5 pl-4 font-mono text-right font-semibold">₡ {fmt(b.tax)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-purple-50 border-t-2 border-purple-200 font-bold">
                      <td className="py-3 pr-4 text-purple-800" colSpan={3}>
                        Impuesto determinado (tasa efectiva {result.effectiveRate}%)
                      </td>
                      <td className="py-3 pl-4 font-mono text-right text-purple-800 text-base">
                        ₡ {fmt(result.impuestoDeterminado)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Registra ingresos y gastos para ver el cálculo del impuesto</p>
              </div>
            )}
          </div>
        </Card>

        {/* ── SECCIÓN 3: Créditos y resultado final ────────────────────── */}
        <Card>
          <SectionTitle icon={DollarSign} title="Sección III — Créditos y Resultado Final" color="gray" />
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Impuesto determinado</p>
                <p className="font-mono font-bold text-gray-800">₡ {fmt(result?.impuestoDeterminado ?? 0)}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                <p className="text-xs text-emerald-600 mb-1">(-) Pagos parciales</p>
                <p className="font-mono font-bold text-emerald-700">₡ {fmt(result?.pagosParciales ?? 0)}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <p className="text-xs text-blue-600 mb-1">(-) Retenciones recibidas</p>
                <p className="font-mono font-bold text-blue-700">₡ {fmt(result?.retencionesRecibidas ?? 0)}</p>
              </div>
            </div>

            <div className={`flex items-center justify-between rounded-xl p-4 border-2 ${
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
              <span className={`text-2xl font-black font-mono ${
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
        </Card>

        {/* ── SECCIÓN 4: Pagos parciales trimestrales ──────────────────── */}
        <Card>
          <SectionTitle icon={Calendar} title="Sección IV — Pagos Parciales Trimestrales" color="blue" />
          <div className="p-5 space-y-4">

            {/* Educational note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
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
                      className="w-full pl-7 pr-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  {estimatedTax && parseFloat(estimatedTax) > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Cada trimestre: ₡ {fmt(parseFloat(estimatedTax) / 4)}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleSchedulePayments}
                  disabled={scheduling || !estimatedTax}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {scheduling ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Programar pagos
                </button>
              </div>
            )}

            {/* Payments table */}
            {result?.partialPayments && result.partialPayments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="text-left py-2 pr-4">Trimestre</th>
                      <th className="text-left py-2 px-4">Fecha límite</th>
                      <th className="text-right py-2 px-4">Monto</th>
                      <th className="text-center py-2 pl-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.partialPayments.map(p => (
                      <tr key={p.id} className="border-b border-gray-100">
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
                        <td className="py-3 px-4 font-mono text-right font-semibold">
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
                              className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 px-2.5 py-1 rounded-full transition-colors"
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
                      <td className="py-2 pr-4 text-gray-700" colSpan={2}>Total pagos parciales</td>
                      <td className="py-2 px-4 font-mono text-right text-gray-800">
                        ₡ {fmt(result.partialPayments.reduce((s, p) => s + Number(p.amount), 0))}
                      </td>
                      <td className="py-2 pl-4 text-center text-xs text-gray-500">
                        {result.partialPayments.filter(p => p.isPaid).length}/{result.partialPayments.length} pagados
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400">
                <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Ingresa el impuesto estimado y programa los pagos trimestrales</p>
              </div>
            )}
          </div>
        </Card>

        {/* ── SECCIÓN 5: Retenciones realizadas ───────────────────────── */}
        <Card>
          <div className="flex items-center justify-between">
            <SectionTitle icon={TrendingDown} title="Sección V — Retenciones en la Fuente Realizadas" color="orange" />
            <button
              onClick={() => setShowRetForm(!showRetForm)}
              className="flex items-center gap-2 mr-4 text-xs font-semibold text-orange-700 hover:text-orange-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {showRetForm ? 'Cancelar' : 'Registrar retención'}
            </button>
          </div>

          <div className="p-5 space-y-4">

            {/* Educational note */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-orange-700">
                Al pagar servicios, la empresa debe <strong>retener y remitir a Hacienda</strong> un porcentaje del pago.
                El proveedor recibe el neto y la retención es un crédito para él.
                Tasas: Servicios profesionales 2% · Alquiler 15% · Dividendos 15% · Transporte 1%.
              </p>
            </div>

            {/* Add retencion form */}
            {showRetForm && (
              <form onSubmit={handleCreateRetencion} className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-4">
                <p className="text-sm font-bold text-orange-800">Nueva retención en la fuente</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Tipo de retención *</label>
                    <select
                      value={retForm.type}
                      onChange={e => setRetForm(f => ({ ...f, type: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
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
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Cédula / RUC del proveedor</label>
                    <input
                      type="text"
                      value={retForm.supplierCedula}
                      onChange={e => setRetForm(f => ({ ...f, supplierCedula: e.target.value }))}
                      placeholder="Ej. 3-101-123456"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
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
                        className="w-full pl-7 pr-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
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
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Descripción</label>
                    <input
                      type="text"
                      value={retForm.description}
                      onChange={e => setRetForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Ej. Honorarios enero 2026"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                  </div>
                </div>

                {/* Preview */}
                {retGross > 0 && (
                  <div className="grid grid-cols-3 gap-3 text-center bg-white rounded-lg p-3 border border-orange-200">
                    <div>
                      <p className="text-xs text-gray-500">Monto bruto</p>
                      <p className="font-mono font-bold text-gray-800">₡ {fmt(retGross)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-red-500">Retención ({(retRate * 100).toFixed(0)}%)</p>
                      <p className="font-mono font-bold text-red-700">₡ {fmt(retAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-emerald-600">Pago neto al proveedor</p>
                      <p className="font-mono font-bold text-emerald-700">₡ {fmt(retNet)}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowRetForm(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={addingRet}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {addingRet ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Registrar retención
                  </button>
                </div>
              </form>
            )}

            {/* Retenciones table */}
            {result?.retenciones && result.retenciones.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="text-left py-2 pr-4">Fecha</th>
                      <th className="text-left py-2 px-4">Proveedor</th>
                      <th className="text-left py-2 px-4">Tipo</th>
                      <th className="text-right py-2 px-4">Bruto</th>
                      <th className="text-right py-2 px-4">Tasa</th>
                      <th className="text-right py-2 pl-4">Retención</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.retenciones.map(r => (
                      <tr key={r.id} className="border-b border-gray-100">
                        <td className="py-2.5 pr-4 text-xs text-gray-500">{fmtDate(r.date)}</td>
                        <td className="py-2.5 px-4">
                          <p className="font-semibold text-gray-800">{r.supplierName}</p>
                          {r.supplierCedula && (
                            <p className="text-xs text-gray-400">{r.supplierCedula}</p>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-gray-600">
                          {RETENCION_TYPES[r.type]?.label ?? r.type}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-right text-gray-700">₡ {fmt(r.grossAmount)}</td>
                        <td className="py-2.5 px-4 text-right font-semibold text-orange-700">
                          {(Number(r.retentionRate) * 100).toFixed(0)}%
                        </td>
                        <td className="py-2.5 pl-4 font-mono text-right font-bold text-orange-700">
                          ₡ {fmt(r.retentionAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 font-bold bg-orange-50">
                      <td className="py-2 pr-4 text-orange-800" colSpan={5}>Total retenciones realizadas</td>
                      <td className="py-2 pl-4 font-mono text-right text-orange-800">
                        ₡ {fmt(result.retenciones.reduce((s, r) => s + Number(r.retentionAmount), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400">
                <TrendingDown className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay retenciones registradas para el año {fiscalYear}</p>
              </div>
            )}
          </div>
        </Card>

        {/* ── Legal reference ──────────────────────────────────────────── */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> Marco legal — Ley del Impuesto sobre la Renta N° 7092
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-1 list-disc list-inside text-xs text-emerald-600 space-y-0.5">
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
          <button
            onClick={calculateD101}
            disabled={calculating || !companyId}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${calculating ? 'animate-spin' : ''}`} />
            {calculating ? 'Calculando...' : 'Recalcular desde contabilidad'}
          </button>
        </div>

      </div>
    </div>
  );
}
