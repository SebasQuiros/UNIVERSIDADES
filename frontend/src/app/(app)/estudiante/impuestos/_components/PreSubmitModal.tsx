'use client';

import { CheckCircle2, AlertTriangle, XCircle, Send, X, FileText, Info, ClipboardCheck } from 'lucide-react';
import { IconTile } from '@/components/ui/IconTile';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
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

/** Formularios soportados. Unión cerrada: hace exhaustivos los `Record` de abajo
 *  y evita que un tipo desconocido caiga en las casillas de OTRA declaración. */
export type DeclarationType = 'D101_RENTA' | 'D103_RETENCION' | 'D104_IVA' | 'D115_DIVIDENDOS';

interface Props {
  type: DeclarationType;
  period: string;
  form: D104Lines | D101Lines | Record<string, any>;
  attachments: Attachment[];
  perfil: PerfilTributarioData | null;
  result: Record<string, any> | null;
  onConfirm: () => void;
  onCancel: () => void;
  submitting: boolean;
}

/** Etiqueta de cabecera por formulario (solo presentación). */
const TYPE_TITLE: Record<DeclarationType, string> = {
  D104_IVA:        'D-104 · IVA',
  D101_RENTA:      'D-101 · Renta',
  D103_RETENCION:  'D-103 · Retenciones',
  D115_DIVIDENDOS: 'D-115 · Dividendos',
};

/**
 * Casillas de RESULTADO de cada formulario. Cada declaración numera sus casillas
 * distinto, así que el resumen debe leer la casilla que corresponde al tipo:
 *
 *   D-104 IVA        → 304 impuesto a pagar · 305 saldo a favor
 *   D-101 Renta      → 602 impuesto a pagar · 603 saldo a favor
 *   D-103 Retención  → 304 impuesto a pagar · 305 saldo a favor
 *   D-115 Dividendos → 305 impuesto a PAGAR · 306 saldo a favor
 *
 * OJO: la casilla 305 NO significa lo mismo en todos los formularios (en D-104 y
 * D-103 es saldo a favor; en D-115 es impuesto a pagar). Por eso el mapeo es
 * explícito por tipo y nunca una cadena de "primero la que exista".
 *
 * Fuente de la numeración: `_components/calc.ts`, espejo de
 * `backend/src/modules/tax-declarations/tax-declarations.service.ts`.
 */
const RESULT_KEYS: Record<DeclarationType, { pagar: string; favor: string }> = {
  D104_IVA:        { pagar: 'cas304_impuestoPagar', favor: 'cas305_saldoFavor' },
  D101_RENTA:      { pagar: 'cas602_impuestoPagar', favor: 'cas603_saldoFavor' },
  D103_RETENCION:  { pagar: 'cas304_impuestoPagar', favor: 'cas305_saldoFavor' },
  D115_DIVIDENDOS: { pagar: 'cas305_impuestoPagar', favor: 'cas306_saldoFavor' },
};

/** Periodicidad de cada formulario (coincide con las fichas del hub de Tributación). */
const PERIOD_HINT: Record<DeclarationType, string> = {
  D104_IVA:        'Declaración mensual de IVA — vence el 15 del mes siguiente.',
  D103_RETENCION:  'Declaración mensual de retenciones — vence el 15 del mes siguiente.',
  D101_RENTA:      'Período fiscal anual (1 oct – 30 set). Vence el 15 de diciembre.',
  D115_DIVIDENDOS: 'Período fiscal anual (1 oct – 30 set). Vence el 15 de diciembre.',
};

function hasAttachment(attachments: Attachment[], lineKey: string) {
  return attachments.some(a => a.lineKey === lineKey);
}

function hasValue(form: Record<string, string>, key: string) {
  return (parseFloat(form[key] || '0') || 0) > 0;
}

function statusIcon(status: 'ok' | 'warn' | 'error') {
  if (status === 'ok')   return <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />;
  if (status === 'warn') return <AlertTriangle className="h-4 w-4 flex-shrink-0 text-gold-700" />;
  return <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />;
}

function CheckRow({ item }: { item: CheckItem }) {
  return (
    <div className={cn(
      'flex items-start gap-2.5 rounded-xl border px-3 py-2',
      item.status === 'ok'   ? 'border-emerald-100 bg-emerald-50' :
      item.status === 'warn' ? 'border-gold-100 bg-gold-50' :
                               'border-red-100 bg-red-50',
    )}>
      {statusIcon(item.status)}
      <div className="min-w-0 flex-1">
        <p className={cn(
          'text-xs font-semibold',
          item.status === 'ok'   ? 'text-emerald-800' :
          item.status === 'warn' ? 'text-gold-900'    : 'text-red-800',
        )}>{item.label}</p>
        {item.detail && (
          <p className={cn(
            'mt-0.5 text-xs leading-relaxed',
            item.status === 'ok'   ? 'text-emerald-600' :
            item.status === 'warn' ? 'text-gold-700'    : 'text-red-600',
          )}>{item.detail}</p>
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
    detail: PERIOD_HINT[type],
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
            ? `${line.label}: factura(s) adjunta(s)`
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
            ? `${line.label}: factura(s) adjunta(s)`
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
            ? `${line.label}: respaldo adjunto`
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

  // Lee la casilla de resultado que corresponde al formulario. Antes solo se
  // contemplaba D-104 y todo lo demás caía en las casillas de D-101 (602/603),
  // por lo que D-103 y D-115 mostraban siempre "Sin impuesto calculado" aunque
  // el cálculo existiera. Solo cambia lo que se MUESTRA: el cálculo y lo que se
  // persiste siguen viniendo de `calc.ts` / del backend, intactos.
  //
  // SIN FALLBACK: si el tipo no está en el mapa (no debería, la unión lo impide),
  // se muestra "—". Enseñar las casillas de OTRA declaración sería peligroso.
  const keys: { pagar: string; favor: string } | undefined = RESULT_KEYS[type];
  const impuestoPagar = keys ? Number(result?.[keys.pagar] ?? 0) : 0;
  const saldoFavor    = keys ? Number(result?.[keys.favor] ?? 0) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-csq-dark/70 p-4 backdrop-blur-sm">
      <div className="cx-pop my-4 w-full max-w-lg overflow-hidden rounded-card bg-white shadow-soft">

        {/* Cabecera */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <IconTile icon={ClipboardCheck} tint="#1B2E6E" size={44} />
            <div className="min-w-0">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">
                Antes de presentar
              </p>
              <h3 className="truncate text-base font-bold tracking-tight text-gray-900">
                Verificación de la declaración
              </h3>
              <p className="truncate text-xs text-gray-500">
                {TYPE_TITLE[type] ?? type} — Período: {period}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            aria-label="Cerrar"
            className="cx-press flex-shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Aviso de simulación */}
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-gold-100 bg-gold-50 px-3 py-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-gold-700" />
          <p className="text-xs font-semibold text-gold-900">
            SIMULACIÓN EDUCATIVA — Esta declaración NO se envía al sistema real de Hacienda de Costa Rica.
          </p>
        </div>

        {/* Lista de verificación */}
        <div className="max-h-72 space-y-2 overflow-y-auto px-6 py-4">
          <p className="mb-2 flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">
            <FileText className="h-3.5 w-3.5" /> Lista de verificación
          </p>
          {items.map(item => <CheckRow key={item.id} item={item} />)}
          {items.length === 0 && (
            <p className="py-4 text-center text-xs text-gray-400">No hay datos declarados aún.</p>
          )}
        </div>

        {/* Por qué se piden facturas */}
        {warnings > 0 && (
          <div className="mx-6 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
            <p className="text-xs leading-relaxed text-blue-700">
              <strong>¿Por qué se necesitan facturas?</strong> En el sistema TRIBU CR real, cada transacción debe
              respaldarse con una <strong>factura electrónica</strong> emitida o recibida y registrada en ATV
              (Administración Tributaria Virtual). Sin respaldo, Hacienda puede objetar la declaración.
              En esta simulación educativa puedes presentar sin adjuntos, pero anota la advertencia.
            </p>
          </div>
        )}

        {/* Resultado */}
        <div className="mt-4 border-t border-gray-100 bg-gray-50 px-6 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Resultado de la declaración</p>
              {!keys ? (
                <p className="text-sm font-bold text-gray-500">—</p>
              ) : impuestoPagar > 0 ? (
                <p className="text-sm font-bold text-red-700">
                  Impuesto a pagar:{' '}
                  <span className="font-mono tabular-nums">₡ {fmtNum(impuestoPagar)}</span>
                </p>
              ) : saldoFavor > 0 ? (
                <p className="text-sm font-bold text-emerald-700">
                  Saldo a favor:{' '}
                  <span className="font-mono tabular-nums">₡ {fmtNum(saldoFavor)}</span>
                </p>
              ) : (
                <p className="text-sm font-bold text-gray-500">Sin impuesto calculado</p>
              )}
            </div>
            <div className="flex-shrink-0 text-right">
              {warnings > 0 && (
                <p className="text-xs font-semibold text-gold-700">{warnings} advertencia(s)</p>
              )}
              {errors > 0 && (
                <p className="cx-shake text-xs font-semibold text-red-600">{errors} error(es) bloqueante(s)</p>
              )}
              {warnings === 0 && errors === 0 && (
                <p className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Todo listo
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
          <Button variant="secondary" onClick={onCancel} className="flex-1 cx-press">
            Revisar primero
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            loading={submitting}
            disabled={errors > 0}
            className="flex-1 cx-press"
          >
            {!submitting && <Send className="h-4 w-4" />}
            {submitting ? 'Presentando...' : warnings > 0 ? 'Presentar con advertencias' : 'Presentar declaración'}
          </Button>
        </div>
      </div>
    </div>
  );
}
