'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft, ShoppingCart, Plus, Trash2, RefreshCw,
  AlertTriangle, CheckCircle2, Info, TrendingDown, TrendingUp,
  FileText, Building2,
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

const TAX_RATES = [
  { value: 0.13, label: '13% — Tarifa general' },
  { value: 0.08, label: '8% — Medicina privada / seguros' },
  { value: 0.04, label: '4% — Boletos aéreos / espectáculos' },
  { value: 0.02, label: '2% — Canasta básica tributaria' },
  { value: 0.01, label: '1% — Medicamentos / insumos agropecuarios' },
  { value: 0,    label: '0% — Exento' },
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
  taxRate: '0.13',
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
  const taxAmount   = round2(subtotalNum * taxRateNum);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/estudiante/ejercicio/${attemptId}`}
              className="text-gray-400 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
              <div>
                <h1 className="text-base font-bold text-gray-900">Facturas de Compra</h1>
                {company && (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> {company.name}
                  </p>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva Factura de Compra
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── Educational banner ────────────────────────────────────────── */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-blue-800">¿Qué es el Crédito Fiscal IVA?</p>
            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
              Cuando tu empresa compra bienes o servicios gravados con IVA, el monto pagado se convierte en un
              <strong> crédito fiscal</strong> que se deduce del IVA cobrado a tus clientes en la declaración D-104.
              Solo se puede acreditar el IVA de facturas <em>electrónicas aceptadas</em> por Hacienda.
            </p>
          </div>
        </div>

        {/* ── New invoice form ──────────────────────────────────────────── */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                Registrar Factura de Compra
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
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
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
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
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
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
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
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
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
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
                      className="w-full pl-7 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
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
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
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
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </div>

              {/* IVA calculado — readonly */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <div>
                  <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">Subtotal</p>
                  <p className="text-lg font-bold text-emerald-900 font-mono">₡ {fmtMoney(subtotalNum)}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">
                    IVA ({(taxRateNum * 100).toFixed(0)}%) — Crédito Fiscal
                  </p>
                  <p className="text-lg font-bold text-emerald-700 font-mono">₡ {fmtMoney(taxAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">Total factura</p>
                  <p className="text-lg font-bold text-emerald-900 font-mono">₡ {fmtMoney(total)}</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {saving ? 'Guardando...' : 'Registrar Factura'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Period selector + IVA Summary ─────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">Resumen IVA del Período</h2>
            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                onClick={loadSummary}
                disabled={loadingSummary}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loadingSummary ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {summary ? (
            <div className="p-5 space-y-4">
              {/* Row: Debitos / Creditos / Resultado */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* IVA en ventas */}
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">IVA en Ventas (Casilla 301)</p>
                  </div>
                  <p className="text-2xl font-black text-blue-800 font-mono">
                    ₡ {fmtMoney(debitoTotal)}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">Débito fiscal del período</p>
                </div>

                {/* IVA acreditable */}
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-4 h-4 text-emerald-600" />
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">IVA Acreditable (Casilla 302)</p>
                  </div>
                  <p className="text-2xl font-black text-emerald-800 font-mono">
                    ₡ {fmtMoney(creditoTotal)}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">Crédito fiscal de compras</p>
                </div>

                {/* Resultado */}
                {ivaAPagar > 0 ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <p className="text-xs font-bold text-red-700 uppercase tracking-wide">IVA a Pagar (Casilla 304)</p>
                    </div>
                    <p className="text-2xl font-black text-red-700 font-mono">
                      ₡ {fmtMoney(ivaAPagar)}
                    </p>
                    <p className="text-xs text-red-600 mt-1">A cancelar a Hacienda antes del día 15</p>
                  </div>
                ) : saldoAFavor > 0 ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-100 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Saldo a Favor (Casilla 305)</p>
                    </div>
                    <p className="text-2xl font-black text-emerald-800 font-mono">
                      ₡ {fmtMoney(saldoAFavor)}
                    </p>
                    <p className="text-xs text-emerald-600 mt-1">Se arrastra al siguiente período</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Resultado</p>
                    <p className="text-2xl font-black text-gray-400 font-mono">₡ 0.00</p>
                    <p className="text-xs text-gray-400 mt-1">Sin movimientos en el período</p>
                  </div>
                )}
              </div>

              {/* Detail by rate */}
              {(debitoTotal > 0 || creditoTotal > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Ventas por tarifa */}
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Ventas por tarifa</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-2 py-1.5 text-gray-600">Casilla</th>
                          <th className="text-left px-2 py-1.5 text-gray-600">Tarifa</th>
                          <th className="text-right px-2 py-1.5 text-gray-600">Base</th>
                          <th className="text-right px-2 py-1.5 text-gray-600">IVA</th>
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
                          <tr key={r.cas}>
                            <td className="px-2 py-1.5 font-mono text-gray-400">{r.cas}</td>
                            <td className="px-2 py-1.5 text-gray-700">{r.tasa}%</td>
                            <td className="px-2 py-1.5 text-right font-mono text-gray-800">₡ {fmtMoney(r.base)}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-blue-700 font-semibold">₡ {fmtMoney(r.iva)}</td>
                          </tr>
                        ))}
                        <tr className="bg-blue-50 font-bold">
                          <td colSpan={3} className="px-2 py-1.5 text-blue-700">Cas. 301 — Total débito fiscal</td>
                          <td className="px-2 py-1.5 text-right font-mono text-blue-800">₡ {fmtMoney(debitoTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Compras por tarifa */}
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Compras por tarifa (Crédito Fiscal)</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-2 py-1.5 text-gray-600">Casilla</th>
                          <th className="text-left px-2 py-1.5 text-gray-600">Tarifa</th>
                          <th className="text-right px-2 py-1.5 text-gray-600">Base</th>
                          <th className="text-right px-2 py-1.5 text-gray-600">IVA</th>
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
                          <tr key={r.cas}>
                            <td className="px-2 py-1.5 font-mono text-gray-400">{r.cas}</td>
                            <td className="px-2 py-1.5 text-gray-700">{r.tasa}%</td>
                            <td className="px-2 py-1.5 text-right font-mono text-gray-800">₡ {fmtMoney(r.base)}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-emerald-700 font-semibold">₡ {fmtMoney(r.iva)}</td>
                          </tr>
                        ))}
                        <tr className="bg-emerald-50 font-bold">
                          <td colSpan={3} className="px-2 py-1.5 text-emerald-700">Cas. 302 — Total crédito fiscal</td>
                          <td className="px-2 py-1.5 text-right font-mono text-emerald-800">₡ {fmtMoney(creditoTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Suggested closing journal entry */}
              {summary.asientoCierre && (
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Asiento de Liquidación D-104 Sugerido
                  </p>
                  <p className="text-xs text-amber-700 mb-3">{summary.asientoCierre.descripcion}</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-amber-100">
                        <th className="text-left px-2 py-1.5 text-amber-800">Cuenta</th>
                        <th className="text-left px-2 py-1.5 text-amber-800">Descripción</th>
                        <th className="text-right px-2 py-1.5 text-amber-800">Débito</th>
                        <th className="text-right px-2 py-1.5 text-amber-800">Crédito</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {summary.asientoCierre.lineas.map((l, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1.5 font-mono text-amber-900">{l.cuenta}</td>
                          <td className="px-2 py-1.5 text-amber-800">{l.descripcion}</td>
                          <td className="px-2 py-1.5 text-right font-mono">
                            {l.tipo === 'debito' ? <span className="text-blue-700 font-semibold">₡ {fmtMoney(l.monto)}</span> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono">
                            {l.tipo === 'credito' ? <span className="text-emerald-700 font-semibold">₡ {fmtMoney(l.monto)}</span> : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-amber-600 mt-2">
                    * Registra este asiento en el módulo de Diario Contable para completar la liquidación del IVA del período.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-5 text-center text-gray-400 text-sm">
              {loadingSummary ? (
                <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                'No hay datos para el período seleccionado'
              )}
            </div>
          )}
        </div>

        {/* ── Invoices table ────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">
              Facturas de Compra Registradas
              <span className="ml-2 text-xs font-normal text-gray-400">({invoices.length})</span>
            </h2>
            <button
              onClick={loadInvoices}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
              <p className="text-sm text-gray-400 mt-2">Cargando facturas...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center">
              <ShoppingCart className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">Aún no hay facturas de compra registradas</p>
              <p className="text-xs text-gray-400 mt-1">
                Haz clic en <strong>Nueva Factura de Compra</strong> para comenzar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Proveedor</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">N° Factura</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Subtotal</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tasa</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">IVA (Crédito)</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-xs">{inv.supplierName}</p>
                        {inv.supplierCedula && (
                          <p className="text-xs text-gray-400 font-mono">{inv.supplierCedula}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{fmtDate(inv.date)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-gray-800">
                        ₡ {fmtMoney(inv.subtotal)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block bg-emerald-50 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                          {(Number(inv.taxRate) * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-emerald-700">
                        ₡ {fmtMoney(inv.taxAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold text-gray-900">
                        ₡ {fmtMoney(inv.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {inv.isAccepted ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> Aceptada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600 font-semibold">
                            <AlertTriangle className="w-3 h-3" /> Rechazada
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
