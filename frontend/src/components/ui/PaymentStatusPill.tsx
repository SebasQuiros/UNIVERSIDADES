import { cn } from '@/lib/utils';

export type PaymentStatus = 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE' | 'CANCELLED';

const CFG: Record<PaymentStatus, { label: string; cls: string; dot: string }> = {
  PAID:      { label: 'Pagado',    cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  PARTIAL:   { label: 'Parcial',   cls: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500'    },
  PENDING:   { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500'   },
  OVERDUE:   { label: 'Vencido',   cls: 'bg-red-100 text-red-700',         dot: 'bg-red-500'     },
  CANCELLED: { label: 'Anulado',   cls: 'bg-gray-100 text-gray-600',       dot: 'bg-gray-400'    },
};

export function PaymentStatusPill({ status }: { status: PaymentStatus }) {
  const c = CFG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
        c.cls,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  );
}

/**
 * Deriva el estado de pago a partir de balance, total y due date.
 */
export function derivePaymentStatus(params: {
  balance: number;
  total:   number;
  dueDate: Date | string | null;
}): PaymentStatus {
  const { balance, total } = params;
  if (balance <= 0)      return 'PAID';
  if (balance < total)   return params.dueDate && new Date(params.dueDate) < new Date() ? 'OVERDUE' : 'PARTIAL';
  if (params.dueDate && new Date(params.dueDate) < new Date()) return 'OVERDUE';
  return 'PENDING';
}
