'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatDate, getErrorMessage, cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { IconTile } from '@/components/ui/IconTile';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ArtInventory } from '@/components/illustrations';
import toast from 'react-hot-toast';
import { Inbox, Truck, Receipt, Check, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
// Cada propuesta es una PurchaseInvoice PENDING generada por la venta de otra
// empresa del curso en Modo Empresarial.
interface PurchaseProposal {
  id: string;
  supplierName: string;
  supplierCedula: string;
  invoiceNumber: string;
  date: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  description: string | null;
  createdAt: string;
}

// Formato monetario colonizado consistente con el resto de la app.
const money = (n: number) =>
  '₡' + (n ?? 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Skeleton de propuesta ───────────────────────────────────────────────────
function ProposalSkeleton() {
  return (
    <div className="bg-white border border-gray-200/70 rounded-card shadow-card p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Skeleton className="w-11 h-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
      <Skeleton className="h-9 rounded-xl" />
    </div>
  );
}

export function PurchaseProposalsInbox({ companyId }: { companyId: string }) {
  const [proposals, setProposals] = useState<PurchaseProposal[]>([]);
  const [loading, setLoading]     = useState(true);
  const [busyId, setBusyId]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<PurchaseProposal[]>(
        `/api/v1/companies/${companyId}/purchase-proposals`,
      );
      setProposals(data);
    } catch {
      toast.error('Error al cargar las propuestas de compra');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const handleAccept = async (p: PurchaseProposal) => {
    setBusyId(p.id);
    try {
      await api.post(`/api/v1/companies/${companyId}/purchase-proposals/${p.id}/accept`);
      toast.success('Compra aceptada: se registró el asiento y la cuenta por pagar');
      setProposals((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (p: PurchaseProposal) => {
    if (!confirm(`¿Rechazar la propuesta de compra de ${p.supplierName} (factura ${p.invoiceNumber})? Esta acción no se puede deshacer.`)) return;
    setBusyId(p.id);
    try {
      await api.post(`/api/v1/companies/${companyId}/purchase-proposals/${p.id}/reject`);
      toast.success('Propuesta rechazada');
      setProposals((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado explicativo */}
      <div className="flex items-start gap-3.5">
        <div className="relative">
          <IconTile icon={Inbox} tint="#1B2E6E" size={46} />
          {proposals.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full rounded-full bg-gold-500 cx-ping" aria-hidden />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-gold-600 border border-white" />
            </span>
          )}
        </div>
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900 mb-0.5">
            Modo empresarial
          </p>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Propuestas de compra</h2>
          <p className="text-gray-500 text-sm mt-1 max-w-2xl leading-relaxed">
            Cuando otra empresa del curso te vende, recibís una propuesta de compra pendiente. Al
            aceptarla se registra el inventario, el asiento contable y la cuenta por pagar.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => <ProposalSkeleton key={i} />)}
        </div>
      ) : proposals.length === 0 ? (
        <Card>
          <EmptyState
            illustration={<ArtInventory size={190} className="cx-float" />}
            title="No tenés propuestas pendientes"
            description="Aparecerán aquí cuando otra empresa del curso te venda en Modo Empresarial. Revisá los montos antes de aceptar: el asiento se registra al confirmar."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {proposals.map((p, i) => {
            const busy = busyId === p.id;
            return (
              <div
                key={p.id}
                className={cn(
                  'bg-white border border-gray-200/70 rounded-card shadow-card hover:shadow-card-hover',
                  'p-5 flex flex-col gap-4 cx-lift cx-hop-parent cx-pop',
                  i < 6 ? `cx-d${i + 1}` : undefined,
                )}
              >
                {/* Encabezado: proveedor + factura */}
                <div className="flex items-start gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white cx-hop"
                    style={{
                      background: 'linear-gradient(145deg,#1E3A8A,#0F2657)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
                    }}
                  >
                    <Truck className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate tracking-tight">{p.supplierName}</h3>
                    {p.supplierCedula && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Cédula <span className="font-mono tabular-nums">{p.supplierCedula}</span>
                      </p>
                    )}
                  </div>
                  <Badge variant="gold" className="flex-shrink-0">
                    <Receipt className="w-3 h-3" />
                    <span className="font-mono tabular-nums">{p.invoiceNumber}</span>
                  </Badge>
                </div>

                {p.description && (
                  <p className="text-sm text-gray-600 -mt-1">{p.description}</p>
                )}

                {/* Montos */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-center">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wide">Subtotal</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5 font-mono tabular-nums">{money(p.subtotal)}</p>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-center">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wide">IVA</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5 font-mono tabular-nums">{money(p.taxAmount)}</p>
                  </div>
                  <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100 text-center">
                    <p className="text-[11px] text-blue-600 uppercase tracking-wide">Total</p>
                    <p className="text-sm font-extrabold text-blue-700 mt-0.5 font-mono tabular-nums">{money(p.total)}</p>
                  </div>
                </div>

                {/* Pie: fecha + acciones */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100 mt-auto">
                  <span className="text-xs text-gray-400">{formatDate(p.date)}</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="danger" onClick={() => handleReject(p)} disabled={busy} className="cx-press">
                      <X className="w-3.5 h-3.5" /> Rechazar
                    </Button>
                    <Button size="sm" onClick={() => handleAccept(p)} loading={busy} className="cx-press">
                      <Check className="w-3.5 h-3.5" /> Aceptar
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
