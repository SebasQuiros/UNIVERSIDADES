'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Receipt, FileText, AlertTriangle, CheckCircle2,
  Clock, Trash2, ChevronRight, Calendar, Bell,
  Building2, Info, TrendingDown, TrendingUp, X, Edit2, Download,
} from 'lucide-react';
import { usePerfilTributario } from './_components/PerfilTributario';
import { downloadDeclarationPdf } from './_components/downloadPdf';

function DeleteDeclarationModal({
  onConfirm, onClose, loading,
}: {
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="font-bold text-gray-900">Eliminar declaración</h3>
        </div>
        <p className="text-sm text-gray-600 mb-2">
          ¿Estás seguro de que deseas eliminar esta declaración de práctica?
        </p>
        <p className="text-xs text-red-500 mb-6">Esta acción no se puede deshacer.</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface TaxDeclaration {
  id: string;
  type: 'D104_IVA' | 'D101_RENTA' | 'D103_RETENCION' | 'D115_DIVIDENDOS';
  period: string;
  status: 'DRAFT' | 'SUBMITTED';
  referenceNo: string | null;
  submittedAt: string | null;
  createdAt: string;
  result: Record<string, any>;
}

const TYPE_LABEL: Record<string, string> = {
  D104_IVA:        'D-104 — Declaración de IVA',
  D101_RENTA:      'D-101 — Declaración de Renta',
  D103_RETENCION:  'D-103 — Retención en la Fuente',
  D115_DIVIDENDOS: 'D-115 — Dividendos y Participaciones',
};

const TYPE_ROUTE: Record<string, string> = {
  D104_IVA:        'd104',
  D101_RENTA:      'd101',
  D103_RETENCION:  'd103',
  D115_DIVIDENDOS: 'd115',
};

const TYPE_COLOR: Record<string, string> = {
  D104_IVA:        'bg-blue-100 text-blue-600',
  D101_RENTA:      'bg-emerald-100 text-emerald-600',
  D103_RETENCION:  'bg-orange-100 text-orange-600',
  D115_DIVIDENDOS: 'bg-purple-100 text-purple-600',
};

function fmtNum(n: number) {
  return Number(n).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getD104DueDate(): { text: string; urgent: boolean; overdue: boolean } {
  const now = new Date();
  const dueYear  = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const dueMonth = (now.getMonth() + 1) % 12; // next month index (0-based)
  const due = new Date(dueYear, dueMonth, 15);
  const diffMs   = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const MONTHS   = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Set','Oct','Nov','Dic'];
  const text = `15 ${MONTHS[dueMonth]} ${dueYear}`;
  return { text, urgent: diffDays <= 5 && diffDays >= 0, overdue: diffDays < 0 };
}

function getD101DueDate(): { text: string } {
  // D-101 vence el 15 de diciembre de cada año
  const now = new Date();
  const year = now.getMonth() >= 11 && now.getDate() > 15 ? now.getFullYear() + 1 : now.getFullYear();
  return { text: `15 Dic ${year}` };
}

export default function ImpuestosPage() {
  const [declarations, setDeclarations] = useState<TaxDeclaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);
  const { perfil } = usePerfilTributario();

  useEffect(() => {
    api.get<TaxDeclaration[]>('/api/v1/tax-declarations')
      .then(({ data }) => setDeclarations(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/tax-declarations/${toDelete}`);
      setDeclarations(prev => prev.filter(d => d.id !== toDelete));
      toast.success('Declaración eliminada');
      setToDelete(null);
    } catch {
      toast.error('No se pudo eliminar');
    } finally {
      setDeleting(false);
    }
  }

  const d104Due = getD104DueDate();
  const d101Due = getD101DueDate();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {toDelete && (
        <DeleteDeclarationModal
          onConfirm={handleDelete}
          onClose={() => setToDelete(null)}
          loading={deleting}
        />
      )}

      {/* ── Banner TRIBU ── */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-amber-800">
          <span className="font-bold">SIMULACIÓN EDUCATIVA</span> — Este módulo simula el sistema{' '}
          <span className="font-semibold">TRIBU CR</span> del Ministerio de Hacienda de Costa Rica con fines académicos.{' '}
          <strong>No constituye una declaración tributaria real.</strong> Tasas y tramos: período fiscal 2025-2026.
        </div>
      </div>

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <Receipt className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Declaraciones Tributarias</h1>
          <p className="text-sm text-gray-500">Práctica TRIBU CR — Ministerio de Hacienda · Costa Rica</p>
        </div>
      </div>

      {/* ── Perfil contribuyente (si existe) ── */}
      {perfil && (
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 uppercase truncate">{perfil.razonSocial || 'Razón social no registrada'}</p>
            <p className="text-xs text-gray-500">
              {perfil.cedula || 'Sin cédula'} ·{' '}
              <span className="text-blue-600 font-medium">{perfil.actividadCodigo} – {perfil.actividadNombre}</span>
            </p>
          </div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            perfil.tipoPersona === 'JURIDICA' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
          }`}>
            {perfil.tipoPersona === 'JURIDICA' ? 'Jurídica' : 'Física'}
          </span>
        </div>
      )}

      {/* ── Calendario de obligaciones ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-700 text-white px-4 py-2.5 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span className="text-sm font-bold tracking-wide">Próximas Obligaciones Tributarias</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
          {/* D-104 */}
          <div className={`px-4 py-3 ${d104Due.urgent ? 'bg-red-50' : d104Due.overdue ? 'bg-red-100' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800">D-104 — IVA Mensual</p>
                <p className={`text-xs font-bold ${d104Due.urgent || d104Due.overdue ? 'text-red-600' : 'text-gray-500'}`}>
                  Vence: {d104Due.text}
                  {d104Due.urgent && ' ⚠️ Próximo a vencer'}
                  {d104Due.overdue && ' 🔴 Vencida'}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Presentar a más tardar el día 15 del mes siguiente al período declarado.
            </p>
          </div>
          {/* D-101 */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800">D-101 — Renta Anual</p>
                <p className="text-xs text-gray-500">Vence: {d101Due.text}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Período fiscal: 1 oct – 30 set. Declaración anual de personas jurídicas.
            </p>
          </div>
          {/* Info ATV */}
          <div className="px-4 py-3 bg-gray-50">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center">
                <Info className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <p className="text-xs font-bold text-gray-700">Facturas electrónicas</p>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Toda declaración debe respaldarse con facturas electrónicas registradas en ATV
              (Administración Tributaria Virtual).
            </p>
          </div>
        </div>
      </div>

      {/* ── Flujo real de TRIBU CR ── */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5" /> ¿Cómo funciona el proceso real en Hacienda?
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { step: '1', title: 'Emitir facturas', desc: 'Emite y recibe facturas electrónicas en el sistema de Hacienda (ATV). Cada transacción queda registrada.' },
            { step: '2', title: 'Registrar en libro', desc: 'Contabiliza ventas y compras en los libros contables. El IVA cobrado es débito; el IVA pagado es crédito.' },
            { step: '3', title: 'Completar D-104', desc: 'Ingresa los totales por tarifa. El sistema calcula automáticamente el impuesto neto o saldo a favor.' },
            { step: '4', title: 'Presentar y pagar', desc: 'Presenta antes del día 15. Si hay impuesto a pagar, cancela en el banco o directamente en ATV.' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">
                {step}
              </div>
              <div>
                <p className="text-xs font-bold text-blue-800">{title}</p>
                <p className="text-xs text-blue-600 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cards de formularios disponibles ── */}
      <div>
        <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">Formularios disponibles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/estudiante/impuestos/d104"
            className="group block bg-white border-2 border-gray-200 hover:border-blue-400 rounded-2xl p-5 transition-all hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors mt-1" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-gray-900">D-104</h2>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                d104Due.urgent ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-600'
              }`}>
                {d104Due.urgent ? '¡Vence pronto!' : `Vence ${d104Due.text}`}
              </span>
            </div>
            <p className="text-sm font-semibold text-blue-700 mb-2">Declaración IVA mensual</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Impuesto al Valor Agregado. Ventas gravadas por tarifa (13%, 8%, 4%, 2%, 1%),
              crédito fiscal de compras e impuesto neto del período.
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              {['13%', '8%', '4%', '2%', '1%'].map(t => (
                <span key={t} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{t}</span>
              ))}
            </div>
          </Link>

          <Link href="/estudiante/impuestos/d101"
            className="group block bg-white border-2 border-gray-200 hover:border-emerald-400 rounded-2xl p-5 transition-all hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 transition-colors mt-1" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-gray-900">D-101</h2>
              <span className="text-xs font-semibold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
                Vence {d101Due.text}
              </span>
            </div>
            <p className="text-sm font-semibold text-emerald-700 mb-2">Declaración Renta anual — personas jurídicas</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Impuesto sobre la Renta. Calcula renta neta imponible, aplica tramos progresivos para PYMES
              o tarifa plana 30% para empresas grandes.
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              {['5%','10%','15%','20%','25%','30%'].map(t => (
                <span key={t} className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">{t}</span>
              ))}
            </div>
          </Link>
        </div>

        {/* D-103 y D-115 — ahora disponibles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Link href="/estudiante/impuestos/d103"
            className="group block bg-white border-2 border-gray-200 hover:border-orange-400 rounded-2xl p-5 transition-all hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-orange-600" />
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-orange-500 transition-colors mt-1" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-gray-900">D-103</h2>
              <span className="text-xs font-semibold bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">Mensual — día 15</span>
            </div>
            <p className="text-sm font-semibold text-orange-700 mb-2">Retención en la fuente</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Retención del 3% sobre compras de bienes y 8% sobre pagos de servicios profesionales a proveedores locales.
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              {['3% bienes', '8% servicios'].map(t => (
                <span key={t} className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">{t}</span>
              ))}
            </div>
          </Link>

          <Link href="/estudiante/impuestos/d115"
            className="group block bg-white border-2 border-gray-200 hover:border-purple-400 rounded-2xl p-5 transition-all hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-purple-500 transition-colors mt-1" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-gray-900">D-115</h2>
              <span className="text-xs font-semibold bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">Anual — 15 Dic</span>
            </div>
            <p className="text-sm font-semibold text-purple-700 mb-2">Dividendos y participaciones</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Impuesto sobre dividendos, participaciones de utilidades y rentas de capital mobiliario. Tarifa única del 15%.
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              {['15% dividendos', '15% participaciones', '15% capital'].map(t => (
                <span key={t} className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium">{t}</span>
              ))}
            </div>
          </Link>
        </div>
      </div>

      {/* ── Historial ── */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4">Mis declaraciones de práctica</h2>

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Cargando...</div>
        ) : declarations.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Aún no has completado ninguna declaración de práctica.</p>
            <p className="text-xs text-gray-400 mt-1">Elige D-104 o D-101 arriba para empezar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {declarations.map(d => {
              const pagar =
                d.type === 'D104_IVA'        ? (d.result?.cas304_impuestoPagar ?? 0) :
                d.type === 'D101_RENTA'      ? (d.result?.cas602_impuestoPagar ?? 0) :
                d.type === 'D103_RETENCION'  ? (d.result?.cas304_impuestoPagar ?? 0) :
                d.type === 'D115_DIVIDENDOS' ? (d.result?.cas305_impuestoPagar ?? 0) : 0;
              const favor =
                d.type === 'D104_IVA'        ? (d.result?.cas305_saldoFavor ?? 0) :
                d.type === 'D101_RENTA'      ? (d.result?.cas603_saldoFavor ?? 0) :
                d.type === 'D103_RETENCION'  ? (d.result?.cas305_saldoFavor ?? 0) :
                d.type === 'D115_DIVIDENDOS' ? (d.result?.cas306_saldoFavor ?? 0) : 0;

              return (
                <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${TYPE_COLOR[d.type] ?? 'bg-gray-100 text-gray-600'}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{TYPE_LABEL[d.type]}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Período: {d.period}
                      </span>
                      {d.referenceNo && (
                        <span className="text-xs text-gray-400 font-mono">Ref: {d.referenceNo}</span>
                      )}
                    </div>
                    {d.status === 'SUBMITTED' && (pagar > 0 || favor > 0) && (
                      <div className="flex items-center gap-1.5 mt-1">
                        {pagar > 0 ? (
                          <>
                            <TrendingDown className="w-3 h-3 text-red-500" />
                            <span className="text-xs text-red-600 font-semibold">A pagar: ₡{fmtNum(pagar)}</span>
                          </>
                        ) : (
                          <>
                            <TrendingUp className="w-3 h-3 text-emerald-500" />
                            <span className="text-xs text-emerald-600 font-semibold">Saldo a favor: ₡{fmtNum(favor)}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {d.status === 'SUBMITTED' ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Presentada
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                        <Clock className="w-3.5 h-3.5" /> Borrador
                      </span>
                    )}
                    {d.status === 'DRAFT' ? (
                      <Link
                        href={`/estudiante/impuestos/${TYPE_ROUTE[d.type] ?? 'd104'}?id=${d.id}`}
                        className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-full transition-colors"
                      >
                        <Edit2 className="w-3 h-3" /> Editar
                      </Link>
                    ) : (
                      <>
                        <button
                          onClick={async () => {
                            try {
                              await downloadDeclarationPdf(d.id, `${d.type}-${d.period}.pdf`);
                            } catch { toast.error('No se pudo descargar el PDF'); }
                          }}
                          className="flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-full transition-colors"
                          title="Descargar comprobante PDF"
                        >
                          <Download className="w-3 h-3" /> PDF
                        </button>
                        <Link
                          href={`/estudiante/impuestos/${TYPE_ROUTE[d.type] ?? 'd104'}?id=${d.id}`}
                          className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
                        >
                          Ver comprobante
                        </Link>
                      </>
                    )}
                    <button
                      onClick={() => setToDelete(d.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
