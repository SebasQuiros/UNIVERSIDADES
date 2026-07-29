'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { ArtInvoice, SceneEmptyBox, SceneSearchEmpty } from '@/components/illustrations';
import {
  ArrowLeft, ShoppingCart, Plus, RefreshCw, Search,
  AlertTriangle, CheckCircle2, Info, TrendingDown, TrendingUp,
  FileText, Building2, Receipt, Wallet,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PurchaseInvoice {
  id: string;
  supplierName: string;
  supplierCedula: string | null;
  invoiceNumber: string;
  date: string;
  subtotal: number | string;
  taxRate: number | string;
  taxAmount: number | string;
  total: number | string;
  description: string | null;
  isAccepted: boolean;
  createdAt: string;
}

interface IvaSummary {
  periodo: { inicio: string; fin: string };
  debitosFiscales: {
    casilla101: { tasa: number; base: number; iva: number };
    casilla102: { tasa: number; base: number; iva: number };
    casilla103: { tasa: number; base: number; iva: number };
    casilla104: { tasa: number; base: number; iva: number };
    casilla105: { tasa: number; base: number; iva: number };
    casilla106: { tasa: number; base: number; iva: number };
    cas301_total: number;
  };
  creditosFiscales: {
    casilla201: { tasa: number; base: number; iva: number };
    casilla202: { tasa: number; base: number; iva: number };
    casilla203: { tasa: number; base: number; iva: number };
    casilla204: { tasa: number; base: number; iva: number };
    casilla205: { tasa: number; base: number; iva: number };
    cas302_total: number;
  };
  liquidacion: {
    debitoFiscal: number;
    creditoFiscal: number;
    impuestoNeto: number;
    ivaAPagar: number;
    saldoAFavor: number;
  };
  asientoCierre: {
    descripcion: string;
    lineas: Array<{ cuenta: string; tipo: string; monto: number; descripcion: string }>;
  } | null;
}

interface Company {
  id: string;
  name: string;
  attemptId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Porcentaje, igual que en ventas y productos.
const TAX_RATES = [
  { value: 13, label: '13% — Tarifa general' },
  { value: 8,  label: '8% — Medicina privada / seguros' },
  { value: 4,  label: '4% — Boletos aéreos / espectáculos' },
  { value: 2,  label: '2% — Canasta básica tributaria' },
  { value: 1,  label: '1% — Medicamentos / insumos agropecuarios' },
  { value: 0,  label: '0% — Exento' },
];

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Setiembre','Octubre','Noviembre','Diciembre',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(n: number | string): string {
  return Number(n).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  supplierName: string;
  supplierCedula: string;
  invoiceNumber: string;
  date: string;
  subtotal: string;
  taxRate: string;
  description: string;
}

const EMPTY_FORM: FormState = {
  supplierName: '',
  supplierCedula: '',
  invoiceNumber: '',
  date: new Date().toISOString().split('T')[0],
  subtotal: '',
  taxRate: '13',
  description: '',
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ComprasPage() {
  const params = useParams();
  const router = useRouter();
  const attemptId = params.attemptId as string;

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());

  const [company,   setCompany]   = useState<Company | null>(null);
  const [invoices,  setInvoices]  = useState<PurchaseInvoice[]>([]);
  const [summary,   setSummary]   = useState<IvaSummary | null>(null);
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [query, setQuery] = useState('');

  // ── Load company tied to this attempt ─────────────────────────────
  useEffect(() => {
    api.get<any>(`/api/v1/attempts/${attemptId}/company`)
      .then(({ data }) => setCompany(data))
      .catch(() => {
        // Try loading company differently
        api.get<any>(`/api/v1/attempts/${attemptId}`)
          .then(({ data }) => {
            if (data.company) setCompany(data.company);
          })
          .catch(() => toast.error('No se pudo cargar la empresa'));
      });
  }, [attemptId]);

  // ── Load invoices once company is known ───────────────────────────
  const loadInvoices = useCallback(() => {
    if (!company) return;
    setLoading(true);
    api.get<any>(`/api/v1/companies/${company.id}/purchase-invoices`)
      .then(({ data }) => setInvoices(data.invoices ?? []))
      .catch(() => toast.error('Error al cargar facturas de compra'))
      .finally(() => setLoading(false));
  }, [company]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // ── Load IVA summary ───────────────────────────────────────────────
  const loadSummary = useCallback(() => {
    if (!company) return;
    setLoadingSummary(true);
    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    const lastDay   = new Date(selectedYear, selectedMonth, 0).getDate();
    const endDate   = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${lastDay}`;

    api.get<IvaSummary>(`/api/v1/companies/${company.id}/purchase-invoices/iva-summary`, {
      params: { startDate, endDate },
    })
      .then(({ data }) => setSummary(data))
      .catch(() => toast.error('Error al cargar resumen IVA'))
      .finally(() => setLoadingSummary(false));
  }, [company, selectedMonth, selectedYear]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // ── Computed values for form ───────────────────────────────────────
  const subtotalNum = parseFloat(form.subtotal || '0') || 0;
  const taxRateNum  = parseFloat(form.taxRate)  || 0;
  const taxAmount   = round2(subtotalNum * taxRateNum / 100);
  const total       = round2(subtotalNum + taxAmount);

  function setField(key: keyof FormState, val: string) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  // ── Submit new purchase invoice ───────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    if (!form.supplierName.trim()) { toast.error('Nombre del proveedor requerido'); return; }
    if (!form.invoiceNumber.trim()) { toast.error('Número de factura requerido'); return; }
    if (!form.date) { toast.error('Fecha requerida'); return; }
    if (subtotalNum <= 0) { toast.error('El subtotal debe ser mayor a cero'); return; }

    setSaving(true);
    try {
      await api.post(`/api/v1/companies/${company.id}/purchase-invoices`, {
        supplierName:   form.supplierName.trim(),
        supplierCedula: form.supplierCedula.trim() || undefined,
        invoiceNumber:  form.invoiceNumber.trim(),
        date:           form.date,
        subtotal:       subtotalNum,
        taxRate:        taxRateNum,
        description:    form.description.trim() || undefined,
        isAccepted:     true,
      });
      toast.success('Factura de compra registrada');
      setForm(EMPTY_FORM);
      setShowForm(false);
      loadInvoices();
      loadSummary();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : msg ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  const ivaAPagar   = summary?.liquidacion.ivaAPagar   ?? 0;
  const saldoAFavor = summary?.liquidacion.saldoAFavor ?? 0;
  const debitoTotal = summary?.liquidacion.debitoFiscal  ?? 0;
  const creditoTotal = summary?.liquidacion.creditoFiscal ?? 0;

  const filteredInvoices = useMemo(() => invoices.filter(inv =>
    !query.trim() ||
    inv.supplierName.toLowerCase().includes(query.toLowerCase()) ||
    inv.invoiceNumber.toLowerCase().includes(query.toLowerCase()) ||
    (inv.supplierCedula ?? '').includes(query)), [invoices, query]);

  const totalFacturas = invoices.length;
  const montoTotal = invoices.reduce((s, inv) => s + Number(inv.total), 0);

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

        {/* ── Encabezado ─────────────────────────────────────────────────── */}
        <PageHeader
          eyebrow="Crédito fiscal"
          title="Facturas de compra"
          subtitle={company ? `Empresa: ${company.name}` : 'Registra las facturas que recibes de tus proveedores.'}
          icon={ShoppingCart}
          iconTint="#1B2E6E"
          className="lp-in"
          actions={
            <Button onClick={() => setShowForm(v => !v)} className="cx-press">
              <Plus className="w-4 h-4" />
              Nueva factura de compra
            </Button>
          }
        />

        {/* ── KPIs ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Facturas recibidas"
            value={String(totalFacturas)}
            hint="Registradas en el libro de compras"
            icon={Receipt}
            tint="#1B2E6E"
            className="cx-pop cx-d1"
          />
          <StatCard
            label="Monto total"
            value={`₡ ${fmtMoney(montoTotal)}`}
            hint="Subtotal + IVA de todas las facturas"
            icon={ShoppingCart}
            tint="#2563EB"
            className="cx-pop cx-d2"
          />
          <StatCard
            label="IVA crédito fiscal (período)"
            value={`₡ ${fmtMoney(creditoTotal)}`}
            hint="Acumulado en el período seleccionado"
            icon={Wallet}
            tint="#D4A017"
            className="cx-pop cx-d3"
          />
        </div>

        {/* ── Banda del módulo (nota pedagógica) ─────────────────────────── */}
        <Card variant="onDark" className="cx-pop">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-6 lg:px-7 py-6">
            <div className="flex-1 min-w-0">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-1.5">
                ¿Qué es el crédito fiscal IVA?
              </p>
              <h2 className="text-lg font-bold leading-snug">El IVA que pagas se resta del IVA que cobras.</h2>
              <p className="mt-1.5 text-sm text-blue-200/80 max-w-xl">
                Cuando tu empresa compra bienes o servicios gravados, el IVA pagado se convierte en
                <strong className="text-white"> crédito fiscal</strong> y se deduce del IVA cobrado a tus clientes en la
                declaración D-104. Solo se acredita el IVA de facturas <em>electrónicas aceptadas</em> por Hacienda.
              </p>
            </div>
            <ArtInvoice size={140} className="lp-drift flex-shrink-0" />
          </div>
          {company && (
            <div className="flex items-center gap-2 px-6 lg:px-7 py-3 border-t border-white/10 text-xs text-blue-100/80">
              <Building2 className="w-3.5 h-3.5" /> {company.name}
            </div>
          )}
        </Card>

        {/* ── New invoice form ──────────────────────────────────────────── */}
        {showForm && (
          <SectionCard
            eyebrow="Nuevo registro"
            title="Registrar factura de compra"
            icon={FileText}
            iconTint="#2563EB"
            flushBody
            className="cx-pop"
            action={
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600 text-xs font-semibold cx-press"
              >
                Cancelar
              </button>
            }
          >
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Proveedor */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Nombre del proveedor <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" value={form.supplierName}
                    onChange={e => setField('supplierName', e.target.value)}
                    placeholder="Ej. Distribuidora ABC S.A."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors"
                    required
                  />
                </div>

                {/* Cédula proveedor */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Cédula jurídica / física del proveedor
                  </label>
                  <input
                    type="text" value={form.supplierCedula}
                    onChange={e => setField('supplierCedula', e.target.value)}
                    placeholder="3-101-000000"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors"
                  />
                </div>

                {/* Número de factura */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Número de factura <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" value={form.invoiceNumber}
                    onChange={e => setField('invoiceNumber', e.target.value)}
                    placeholder="FE-001-000000001"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors"
                    required
                  />
                </div>

                {/* Fecha */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Fecha de la factura <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date" value={form.date}
                    onChange={e => setField('date', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors"
                    required
                  />
                </div>

                {/* Subtotal */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Subtotal (₡) — sin IVA <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">₡</span>
                    <input
                      type="number" min="0.01" step="0.01" value={form.subtotal}
                      onChange={e => setField('subtotal', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono tabular-nums bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Tasa IVA */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Tasa de IVA <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.taxRate}
                    onChange={e => setField('taxRate', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors"
                  >
                    {TAX_RATES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Descripción / Concepto
                </label>
                <input
                  type="text" value={form.description}
                  onChange={e => setField('description', e.target.value)}
                  placeholder="Ej. Compra de mercadería para reventa"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors"
                />
              </div>

              {/* IVA calculado — readonly */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-2xl bg-gradient-to-br from-csq-mid to-csq-active text-white shadow-soft">
                <div>
                  <p className="text-[0.68rem] text-blue-200/80 font-bold uppercase tracking-[0.13em]">Subtotal</p>
                  <p className="text-lg font-extrabold font-mono tabular-nums mt-0.5">₡ {fmtMoney(subtotalNum)}</p>
                </div>
                <div>
                  <p className="text-[0.68rem] text-gold-500 font-bold uppercase tracking-[0.13em]">
                    IVA ({taxRateNum.toFixed(0)}%) — Crédito fiscal
                  </p>
                  <p className="text-lg font-extrabold font-mono tabular-nums mt-0.5 cx-count">₡ {fmtMoney(taxAmount)}</p>
                </div>
                <div>
                  <p className="text-[0.68rem] text-blue-200/80 font-bold uppercase tracking-[0.13em]">Total factura</p>
                  <p className="text-lg font-extrabold font-mono tabular-nums mt-0.5">₡ {fmtMoney(total)}</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowForm(false)}
                  className="cx-press"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving} className="cx-press">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {saving ? 'Guardando...' : 'Registrar factura'}
                </Button>
              </div>
            </form>
          </SectionCard>
        )}

        {/* ── Period selector + IVA Summary ─────────────────────────────── */}
        <SectionCard
          eyebrow="Liquidación D-104"
          title="Resumen de IVA del período"
          icon={FileText}
          iconTint="#B8860B"
          flushBody
          className="cx-pop cx-d1"
          action={
            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
              >
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
              >
                {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                onClick={loadSummary}
                disabled={loadingSummary}
                className="p-1.5 text-gray-400 hover:text-blue-700 rounded-lg hover:bg-gray-100 transition-colors cx-press"
                title="Actualizar resumen"
              >
                <RefreshCw className={`w-4 h-4 ${loadingSummary ? 'animate-spin' : ''}`} />
              </button>
            </div>
          }
        >
          {summary ? (
            <div className="p-6 space-y-5">
              {/* Row: Debitos / Creditos / Resultado */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* IVA en ventas */}
                <StatCard
                  label="IVA en ventas (casilla 301)"
                  value={`₡ ${fmtMoney(debitoTotal)}`}
                  hint="Débito fiscal del período"
                  icon={TrendingUp}
                  tint="#2563EB"
                  className="cx-pop cx-d1 cx-lift cx-hop-parent"
                />

                {/* IVA acreditable */}
                <StatCard
                  label="IVA acreditable (casilla 302)"
                  value={`₡ ${fmtMoney(creditoTotal)}`}
                  hint="Crédito fiscal de compras"
                  icon={TrendingDown}
                  tint="#16A34A"
                  className="cx-pop cx-d2 cx-lift cx-hop-parent"
                />

                {/* Resultado */}
                {ivaAPagar > 0 ? (
                  <StatCard
                    label="IVA a pagar (casilla 304)"
                    value={`₡ ${fmtMoney(ivaAPagar)}`}
                    hint="A cancelar a Hacienda antes del día 15"
                    icon={AlertTriangle}
                    tint="#EF4444"
                    className="cx-pop cx-d3 cx-lift cx-hop-parent"
                  />
                ) : saldoAFavor > 0 ? (
                  <StatCard
                    label="Saldo a favor (casilla 305)"
                    value={`₡ ${fmtMoney(saldoAFavor)}`}
                    hint="Se arrastra al siguiente período"
                    icon={CheckCircle2}
                    tint="#16A34A"
                    className="cx-pop cx-d3 cx-lift cx-hop-parent"
                  />
                ) : (
                  <StatCard
                    label="Resultado"
                    value="₡ 0.00"
                    hint="Sin movimientos en el período"
                    icon={Info}
                    tint="#94A3B8"
                    className="cx-pop cx-d3 cx-lift cx-hop-parent"
                  />
                )}
              </div>

              {/* Detail by rate */}
              {(debitoTotal > 0 || creditoTotal > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Ventas por tarifa */}
                  <div className="rounded-2xl border border-gray-200/70 overflow-hidden">
                    <p className="text-[0.68rem] font-bold text-gold-900 uppercase tracking-[0.13em] px-3 py-2.5 bg-gray-50 border-b border-gray-100">
                      Ventas por tarifa
                    </p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-white border-b border-gray-100">
                          <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide text-[10px]">Casilla</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide text-[10px]">Tarifa</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide text-[10px]">Base</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide text-[10px]">IVA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {[
                          { cas: '101', ...summary.debitosFiscales.casilla101 },
                          { cas: '102', ...summary.debitosFiscales.casilla102 },
                          { cas: '103', ...summary.debitosFiscales.casilla103 },
                          { cas: '104', ...summary.debitosFiscales.casilla104 },
                          { cas: '105', ...summary.debitosFiscales.casilla105 },
                          { cas: '106', ...summary.debitosFiscales.casilla106 },
                        ].filter(r => r.base > 0 || r.iva > 0).map(r => (
                          <tr key={r.cas} className="hover:bg-blue-50/40 transition-colors">
                            <td className="px-3 py-2 font-mono text-gray-400">{r.cas}</td>
                            <td className="px-3 py-2 text-gray-700 tabular-nums">{r.tasa}%</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-800">₡ {fmtMoney(r.base)}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-blue-700 font-bold">₡ {fmtMoney(r.iva)}</td>
                          </tr>
                        ))}
                        <tr className="bg-blue-50 font-bold border-t border-blue-100">
                          <td colSpan={3} className="px-3 py-2 text-blue-700">Cas. 301 — Total débito fiscal</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-blue-800">₡ {fmtMoney(debitoTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Compras por tarifa */}
                  <div className="rounded-2xl border border-gray-200/70 overflow-hidden">
                    <p className="text-[0.68rem] font-bold text-gold-900 uppercase tracking-[0.13em] px-3 py-2.5 bg-gray-50 border-b border-gray-100">
                      Compras por tarifa (crédito fiscal)
                    </p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-white border-b border-gray-100">
                          <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide text-[10px]">Casilla</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide text-[10px]">Tarifa</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide text-[10px]">Base</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide text-[10px]">IVA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {[
                          { cas: '201', ...summary.creditosFiscales.casilla201 },
                          { cas: '202', ...summary.creditosFiscales.casilla202 },
                          { cas: '203', ...summary.creditosFiscales.casilla203 },
                          { cas: '204', ...summary.creditosFiscales.casilla204 },
                          { cas: '205', ...summary.creditosFiscales.casilla205 },
                        ].filter(r => r.base > 0 || r.iva > 0).map(r => (
                          <tr key={r.cas} className="hover:bg-emerald-50/40 transition-colors">
                            <td className="px-3 py-2 font-mono text-gray-400">{r.cas}</td>
                            <td className="px-3 py-2 text-gray-700 tabular-nums">{r.tasa}%</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-800">₡ {fmtMoney(r.base)}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-700 font-bold">₡ {fmtMoney(r.iva)}</td>
                          </tr>
                        ))}
                        <tr className="bg-emerald-50 font-bold border-t border-emerald-100">
                          <td colSpan={3} className="px-3 py-2 text-emerald-700">Cas. 302 — Total crédito fiscal</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-800">₡ {fmtMoney(creditoTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Suggested closing journal entry */}
              {summary.asientoCierre && (
                <div className="border border-gold-100 bg-gold-50 rounded-2xl p-5">
                  <p className="text-[0.68rem] font-bold text-gold-900 uppercase tracking-[0.13em] mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Asiento de liquidación D-104 sugerido
                  </p>
                  <p className="text-xs text-gold-900/80 mb-3">{summary.asientoCierre.descripcion}</p>
                  <table className="w-full text-xs bg-white rounded-xl overflow-hidden border border-gold-100">
                    <thead className="bg-gold-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-gold-900 font-bold uppercase tracking-wide text-[10px]">Cuenta</th>
                        <th className="text-left px-3 py-2 text-gold-900 font-bold uppercase tracking-wide text-[10px]">Descripción</th>
                        <th className="text-right px-3 py-2 text-gold-900 font-bold uppercase tracking-wide text-[10px]">Débito</th>
                        <th className="text-right px-3 py-2 text-gold-900 font-bold uppercase tracking-wide text-[10px]">Crédito</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {summary.asientoCierre.lineas.map((l, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-mono text-gray-800">{l.cuenta}</td>
                          <td className="px-3 py-2 text-gray-700">{l.descripcion}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {l.tipo === 'debito' ? <span className="text-blue-700 font-bold">₡ {fmtMoney(l.monto)}</span> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {l.tipo === 'credito' ? <span className="text-emerald-700 font-bold">₡ {fmtMoney(l.monto)}</span> : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-gold-900/70 mt-2.5">
                    * Registra este asiento en el módulo de Diario Contable para completar la liquidación del IVA del período.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6">
              {loadingSummary ? (
                <div className="py-8 text-center">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                </div>
              ) : (
                <EmptyState
                  illustration={<SceneEmptyBox size={180} className="lp-drift" />}
                  title="Sin datos en el período"
                  description="No hay movimientos de IVA para el mes y año seleccionados. Cambia el período o registra una factura de compra."
                  className="py-8"
                />
              )}
            </div>
          )}
        </SectionCard>

        {/* ── Invoices table ────────────────────────────────────────────── */}
        <SectionCard
          eyebrow="Historial"
          title="Facturas de compra registradas"
          description={`${invoices.length} ${invoices.length === 1 ? 'factura' : 'facturas'} en el libro de compras.`}
          icon={ShoppingCart}
          iconTint="#2563EB"
          flushBody
          className="cx-pop cx-d2"
          action={
            <div className="flex items-center gap-2">
              {invoices.length > 0 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Buscar proveedor, factura, cédula…"
                    className="w-56 pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors"
                  />
                </div>
              )}
              <button
                onClick={loadInvoices}
                className="p-1.5 text-gray-400 hover:text-blue-700 rounded-lg hover:bg-gray-100 transition-colors cx-press"
                title="Actualizar facturas"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          }
        >
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
              <p className="text-sm text-gray-400 mt-2">Cargando facturas...</p>
            </div>
          ) : invoices.length === 0 ? (
            <EmptyState
              illustration={<ArtInvoice size={190} className="lp-drift" />}
              title="Aún no hay facturas de compra"
              description="Registra la primera factura que te emitió un proveedor para empezar a acumular crédito fiscal."
              action={
                <Button onClick={() => setShowForm(true)} className="cx-press">
                  <Plus className="w-4 h-4" /> Registra tu primera compra
                </Button>
              }
              className="py-14"
            />
          ) : filteredInvoices.length === 0 ? (
            <EmptyState
              illustration={<SceneSearchEmpty size={160} className="lp-drift" />}
              title="Sin resultados"
              description="No hay facturas que coincidan con la búsqueda."
              className="py-14"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Proveedor</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">N° Factura</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Subtotal</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Tasa</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">IVA (Crédito)</th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-xs">{inv.supplierName}</p>
                        {inv.supplierCedula && (
                          <p className="text-xs text-gray-400 font-mono">{inv.supplierCedula}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{fmtDate(inv.date)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-xs text-gray-800">
                        ₡ {fmtMoney(inv.subtotal)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="blue">{Number(inv.taxRate).toFixed(0)}%</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-xs font-bold text-emerald-700">
                        ₡ {fmtMoney(inv.taxAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-xs font-bold text-gray-900">
                        ₡ {fmtMoney(inv.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {inv.isAccepted ? (
                          <Badge variant="emerald">
                            <CheckCircle2 className="w-3 h-3" /> Aceptada
                          </Badge>
                        ) : (
                          <Badge variant="red">
                            <AlertTriangle className="w-3 h-3" /> Rechazada
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

      </div>
    </div>
  );
}
