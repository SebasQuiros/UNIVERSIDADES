'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SectionCard } from '@/components/ui/SectionCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import {
  History, FileText, BookOpen, ShoppingCart, Receipt, User,
  Coins, FileMinus, Users, Building2,
  ArrowUpRight, ArrowDownLeft, CalendarPlus, Lock, Upload, PackageSearch,
} from 'lucide-react';

interface LogRow {
  id: string; action: string; entity: string | null; entityId: string | null;
  details: Record<string, any>; createdAt: string; userId: string; userName: string | null;
}

/** Etiqueta legible + estilo por tipo de acción. */
const ACTION_META: Record<string, { label: string; icon: any; variant: any }> = {
  INVOICE_ISSUED:        { label: 'Factura emitida',      icon: Receipt,      variant: 'blue'    },
  JOURNAL_ENTRY_CREATED: { label: 'Asiento contable',     icon: BookOpen,     variant: 'purple'  },
  PURCHASE_RECORDED:     { label: 'Compra registrada',    icon: ShoppingCart, variant: 'amber'   },
  PAYMENT_RECEIVED:      { label: 'Cobro recibido',       icon: Coins,        variant: 'green'   },
  CREDIT_NOTE_ISSUED:    { label: 'Nota de crédito',      icon: FileMinus,    variant: 'red'     },
  PAYROLL_PROCESSED:     { label: 'Planilla procesada',   icon: Users,        variant: 'blue'    },
  ASSET_DEPRECIATED:     { label: 'Depreciación',         icon: Building2,    variant: 'slate'   },
  TRANSFER_SENT:         { label: 'Transferencia enviada',   icon: ArrowUpRight,   variant: 'red'    },
  TRANSFER_RECEIVED:     { label: 'Transferencia recibida',  icon: ArrowDownLeft,  variant: 'green'  },
  PERIOD_OPENED:         { label: 'Período abierto',         icon: CalendarPlus,   variant: 'blue'   },
  PERIOD_CLOSED:         { label: 'Período cerrado',         icon: Lock,           variant: 'purple' },
  CHART_OF_ACCOUNTS_IMPORTED: { label: 'Catálogo importado', icon: Upload,         variant: 'amber'  },
  INVENTORY_ADJUSTED:    { label: 'Ajuste de inventario',    icon: PackageSearch,  variant: 'amber'  },
  LOGIN:                 { label: 'Inicio de sesión',     icon: User,         variant: 'slate'   },
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-CR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}

/** Resumen legible de los detalles guardados. */
function describe(row: LogRow): string {
  const d = row.details ?? {};
  if (row.action === 'INVOICE_ISSUED') {
    return [d.cliente && `Cliente: ${d.cliente}`, d.total && `₡${Number(d.total).toLocaleString('es-CR')}`]
      .filter(Boolean).join(' · ');
  }
  if (row.action === 'JOURNAL_ENTRY_CREATED') {
    return [d.numero && `Asiento #${d.numero}`, d.descripcion, d.monto && `₡${Number(d.monto).toLocaleString('es-CR')}`]
      .filter(Boolean).join(' · ');
  }
  if (row.action === 'PURCHASE_RECORDED') {
    return [d.proveedor && `Proveedor: ${d.proveedor}`, d.factura && `Fact. ${d.factura}`,
      d.total && `₡${Number(d.total).toLocaleString('es-CR')}`].filter(Boolean).join(' · ');
  }
  if (row.action === 'PAYMENT_RECEIVED') {
    return [d.cliente && `Cliente: ${d.cliente}`, d.monto && `₡${Number(d.monto).toLocaleString('es-CR')}`,
      d.metodo].filter(Boolean).join(' · ');
  }
  if (row.action === 'CREDIT_NOTE_ISSUED') {
    return [d.numero && `NC-${d.numero}`, d.factura && `sobre factura ${d.factura}`,
      d.total && `₡${Number(d.total).toLocaleString('es-CR')}`].filter(Boolean).join(' · ');
  }
  if (row.action === 'PAYROLL_PROCESSED') {
    return [d.periodo, d.empleados != null && `${d.empleados} empleado(s)`,
      d.neto && `neto ₡${Number(d.neto).toLocaleString('es-CR')}`].filter(Boolean).join(' · ');
  }
  if (row.action === 'ASSET_DEPRECIATED') {
    return [d.periodo, d.monto && `₡${Number(d.monto).toLocaleString('es-CR')}`].filter(Boolean).join(' · ');
  }
  if (row.action === 'TRANSFER_SENT') {
    return [d.destino && `A ${d.destino}`, d.concepto,
      d.monto && `₡${Number(d.monto).toLocaleString('es-CR')}`].filter(Boolean).join(' · ');
  }
  if (row.action === 'TRANSFER_RECEIVED') {
    return [d.origen && `De ${d.origen}`, d.concepto,
      d.monto && `₡${Number(d.monto).toLocaleString('es-CR')}`].filter(Boolean).join(' · ');
  }
  if (row.action === 'PERIOD_OPENED') {
    return [d.periodo, d.desde && d.hasta && `${d.desde} → ${d.hasta}`].filter(Boolean).join(' · ');
  }
  if (row.action === 'PERIOD_CLOSED') {
    return [d.periodo, d.asientosDeCierre != null && `${d.asientosDeCierre} asiento(s) de cierre`,
      d.notas].filter(Boolean).join(' · ');
  }
  if (row.action === 'CHART_OF_ACCOUNTS_IMPORTED') {
    return [d.archivo, d.creadas != null && `${d.creadas} cuenta(s) creada(s)`,
      d.omitidas ? `${d.omitidas} omitida(s)` : null,
      d.errores ? `${d.errores} error(es)` : null].filter(Boolean).join(' · ');
  }
  if (row.action === 'INVENTORY_ADJUSTED') {
    return [d.producto, d.tipo, d.cantidad != null && `${d.cantidad} unid.`,
      d.motivo].filter(Boolean).join(' · ');
  }
  const keys = Object.keys(d);
  return keys.length ? keys.slice(0, 3).map((k) => `${k}: ${d[k]}`).join(' · ') : '';
}

/**
 * Bitácora de acciones de la empresa: quién hizo qué y cuándo.
 * Solo lectura — el registro se escribe en el backend.
 */
export function ActivityLogPanel({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.get<LogRow[]>(`/api/v1/companies/${companyId}/activity-log?limit=100`)
      .then(({ data }) => { if (alive) setRows(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [companyId]);

  return (
    <SectionCard
      icon={History}
      iconTint="#1B2E6E"
      eyebrow="Auditoría"
      title="Bitácora de acciones"
      description="Registro de quién hizo qué y cuándo en esta empresa."
    >
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">
          Todavía no hay acciones registradas. Emití una factura o registrá un asiento para verlas acá.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((r) => {
            const meta = ACTION_META[r.action] ?? { label: r.action, icon: FileText, variant: 'slate' };
            const Icon = meta.icon;
            return (
              <li key={r.id} className="flex items-start gap-3 py-2.5">
                <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <span className="text-xs text-gray-500">{r.userName ?? 'Usuario'}</span>
                  </div>
                  {describe(r) && (
                    <p className="mt-0.5 truncate text-sm text-gray-700">{describe(r)}</p>
                  )}
                </div>
                <span className="flex-shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-gray-400">
                  {fmtDate(r.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
