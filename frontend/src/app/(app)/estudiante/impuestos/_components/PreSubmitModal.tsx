'use client';

import { CheckCircle2, AlertTriangle, XCircle, Send, X, FileText, Info } from 'lucide-react';
import type { Attachment } from './AttachmentPanel';
import type { PerfilTributarioData } from './PerfilTributario';

interface CheckItem {
  id: string;
  label: string;
  detail?: string;
  status: 'ok' | 'warn' | 'error';
}

interface D104Lines {
  ventas13: string; ventas8: string; ventas4: string;
  ventas2: string;  ventas1: string; ventasExentas: string;
  compras13: string; compras8: string; compras4: string;
  compras2: string;  compras1: string;
}

interface D101Lines {
  ingresosBrutos: string; ingresosExentos: string;
  gastosSueldos: string;  gastosCargas: string;     gastosAlquileres: string;
  gastosServicios: string; gastosDepreciacion: string; gastosPublicidad: string;
  gastosSerPublicos: string; gastosRepresentacion: string; gastosOtros: string;
  retencionesSource: string; pagosParciales: string;
}

interface Props {
  type: string;
  period: string;
  form: D104Lines | D101Lines | Record<string, any>;
  attachments: Attachment[];
  perfil: PerfilTributarioData | null;
  result: Record<string, any> | null;
  onConfirm: () => void;
  onCancel: () => void;
  submitting: boolean;
}

function hasAttachment(attachments: Attachment[], lineKey: string) {
  return attachments.some(a => a.lineKey === lineKey);
}

function hasValue(form: Record<string, string>, key: string) {
  return (parseFloat(form[key] || '0') || 0) > 0;
}

function statusIcon(status: 'ok' | 'warn' | 'error') {
  if (status === 'ok')   return <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
  if (status === 'warn') return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
  return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
}

function CheckRow({ item }: { item: CheckItem }) {
  return (
    <div className={`flex items-start gap-2.5 py-1.5 px-3 rounded-lg ${
      item.status === 'ok'   ? 'bg-emerald-50' :
      item.status === 'warn' ? 'bg-amber-50'   : 'bg-red-50'
    }`}>
      {statusIcon(item.status)}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium ${
          item.status === 'ok'   ? 'text-emerald-800' :
          item.status === 'warn' ? 'text-amber-800'   : 'text-red-800'
        }`}>{item.label}</p>
        {item.detail && (
          <p className={`text-xs mt-0.5 ${
            item.status === 'ok'   ? 'text-emerald-600' :
            item.status === 'warn' ? 'text-amber-600'   : 'text-red-600'
          }`}>{item.detail}</p>
        )}
      </div>
    </div>
  );
}

export function PreSubmitModal({ type, period, form, attachments, perfil, result, onConfirm, onCancel, submitting }: Props) {
  const f = form as unknown as Record<string, string>;
  const items: CheckItem[] = [];

  // 1. Datos del contribuyente
  const perfilCompleto = !!(perfil?.cedula && perfil?.razonSocial && perfil?.actividadCodigo);
  items.push({
    id: 'perfil',
    label: 'Datos del contribuyente',
    detail: perfilCompleto
      ? `${perfil?.cedula} — ${perfil?.razonSocial}`
      : 'Ingresa la cédula, razón social y actividad económica antes de presentar.',
    status: perfilCompleto ? 'ok' : 'warn',
  });

  // 2. Período
  items.push({
    id: 'period',
    label: `Período declarado: ${period}`,
    detail: type === 'D104_IVA'
      ? `Declaración mensual de IVA — venció el 15 del mes siguiente.`
      : `Período fiscal anual (1 oct – 30 set). Vence el 15 de diciembre.`,
    status: 'ok',
  });

  if (type === 'D104_IVA') {
    // 3. Ventas
    const ventasLines = [
      { key: 'ventas13', label: 'Ventas gravadas al 13%' },
      { key: 'ventas8',  label: 'Ventas gravadas al 8%' },
      { key: 'ventas4',  label: 'Ventas gravadas al 4%' },
      { key: 'ventas2',  label: 'Ventas gravadas al 2%' },
      { key: 'ventas1',  label: 'Ventas gravadas al 1%' },
      { key: 'ventasExentas', label: 'Ventas exentas' },
    ];
    for (const line of ventasLines) {
      if (hasValue(f, line.key)) {
        const ok = hasAttachment(attachments, line.key);
        items.push({
          id: line.key,
          label: ok
            ? `${line.label}: factura(s) adjunta(s) ✓`
            : `${line.label}: sin factura adjunta`,
          detail: ok
            ? `${attachments.filter(a => a.lineKey === line.key).length} archivo(s) de respaldo`
            : 'En TRIBU CR real se requiere respaldo con factura electrónica (receptor/emisor).',
          status: ok ? 'ok' : 'warn',
        });
      }
    }

    // 4. Compras
    const comprasLines = [
      { key: 'compras13', label: 'Compras gravadas al 13%' },
      { key: 'compras8',  label: 'Compras gravadas al 8%' },
      { key: 'compras4',  label: 'Compras gravadas al 4%' },
      { key: 'compras2',  label: 'Compras gravadas al 2%' },
      { key: 'compras1',  label: 'Compras gravadas al 1%' },
    ];
    for (const line of comprasLines) {
      if (hasValue(f, line.key)) {
        const ok = hasAttachment(attachments, line.key);
        items.push({
          id: line.key,
          label: ok
            ? `${line.label}: factura(s) adjunta(s) ✓`
            : `${line.label}: sin factura adjunta`,
          detail: ok
            ? `${attachments.filter(a => a.lineKey === line.key).length} archivo(s) de respaldo`
            : 'En el sistema real, el crédito fiscal solo aplica sobre facturas electrónicas válidas.',
          status: ok ? 'ok' : 'warn',
        });
      }
    }
  } else {
    // D-101 RENTA
    const ingresosLines = [
      { key: 'ingresosBrutos', label: 'Ingresos brutos del período' },
      { key: 'ingresosExentos', label: 'Ingresos exentos' },
    ];
    const gastosLines = [
      { key: 'gastosSueldos',      label: 'Sueldos y salarios' },
      { key: 'gastosCargas',       label: 'Cargas sociales patronales' },
      { key: 'gastosAlquileres',   label: 'Arrendamientos' },
      { key: 'gastosServicios',    label: 'Servicios profesionales' },
      { key: 'gastosDepreciacion', label: 'Depreciaciones' },
      { key: 'gastosPublicidad',   label: 'Publicidad y mercadeo' },
      { key: 'gastosSerPublicos',  label: 'Servicios públicos' },
      { key: 'gastosRepresentacion', label: 'Gastos de representación' },
      { key: 'gastosOtros',        label: 'Otros gastos deducibles' },
    ];
    const creditosLines = [
      { key: 'retencionesSource', label: 'Retenciones en la fuente' },
      { key: 'pagosParciales',    label: 'Pagos parciales a Hacienda' },
    ];

    for (const line of [...ingresosLines, ...gastosLines, ...creditosLines]) {
      if (hasValue(f, line.key)) {
        const ok = hasAttachment(attachments, line.key);
        items.push({
          id: line.key,
          label: ok
            ? `${line.label}: respaldo adjunto ✓`
            : `${line.label}: sin documento adjunto`,
          detail: ok
            ? `${attachments.filter(a => a.lineKey === line.key).length} archivo(s) de respaldo`
            : 'Adjunta la factura electrónica o comprobante que respalda este monto.',
          status: ok ? 'ok' : 'warn',
        });
      }
    }
  }

  const warnings = items.filter(i => i.status === 'warn').length;
  const errors   = items.filter(i => i.status === 'error').length;

  const fmtNum = (n: number) =>
    Number(n).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const impuestoPagar = type === 'D104_IVA'
    ? (result?.cas304_impuestoPagar ?? 0)
    : (result?.cas602_impuestoPagar ?? 0);
  const saldoFavor = type === 'D104_IVA'
    ? (result?.cas305_saldoFavor ?? 0)
    : (result?.cas603_saldoFavor ?? 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl my-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Verificación antes de presentar</h3>
              <p className="text-xs text-gray-500">
                {type === 'D104_IVA' ? 'D-104 IVA' : 'D-101 Renta'} — Período: {period}
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Banner TRIBU */}
        <div className="mx-6 mt-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-800 font-medium">
            SIMULACIÓN EDUCATIVA — Esta declaración NO se envía al sistema real de Hacienda de Costa Rica.
          </p>
        </div>

        {/* Checklist */}
        <div className="px-6 py-4 space-y-2 max-h-72 overflow-y-auto">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Lista de verificación</p>
          {items.map(item => <CheckRow key={item.id} item={item} />)}
          {items.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No hay datos declarados aún.</p>
          )}
        </div>

        {/* Info sobre facturas */}
        {warnings > 0 && (
          <div className="mx-6 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              <strong>¿Por qué se necesitan facturas?</strong> En el sistema TRIBU CR real, cada transacción debe
              respaldarse con una <strong>factura electrónica</strong> emitida o recibida y registrada en ATV
              (Administración Tributaria Virtual). Sin respaldo, Hacienda puede objetar la declaración.
              En esta simulación educativa puedes presentar sin adjuntos, pero anota la advertencia.
            </p>
          </div>
        )}

        {/* Resultado */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-none">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Resultado de la declaración</p>
              {impuestoPagar > 0 ? (
                <p className="text-sm font-bold text-red-700">
                  Impuesto a pagar: <span className="font-mono">₡ {fmtNum(impuestoPagar)}</span>
                </p>
              ) : saldoFavor > 0 ? (
                <p className="text-sm font-bold text-emerald-700">
                  Saldo a favor: <span className="font-mono">₡ {fmtNum(saldoFavor)}</span>
                </p>
              ) : (
                <p className="text-sm font-bold text-gray-500">Sin impuesto calculado</p>
              )}
            </div>
            <div className="text-right">
              {warnings > 0 && (
                <p className="text-xs text-amber-600 font-semibold">{warnings} advertencia(s)</p>
              )}
              {errors > 0 && (
                <p className="text-xs text-red-600 font-semibold">{errors} error(s) bloqueante(s)</p>
              )}
              {warnings === 0 && errors === 0 && (
                <p className="text-xs text-emerald-600 font-semibold">Todo listo ✓</p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex gap-3 border-t border-gray-100">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
            Revisar primero
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting || errors > 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Presentando...' : warnings > 0 ? 'Presentar con advertencias' : 'Presentar declaración'}
          </button>
        </div>
      </div>
    </div>
  );
}
