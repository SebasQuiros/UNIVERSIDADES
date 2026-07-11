'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatDate, getErrorMessage } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
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
    <div className="flex flex-col gap-4">
      {/* Header explicativo */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Inbox className="w-5 h-5 text-blue-700" />
          Propuestas de compra
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          En Modo Empresarial, cuando otra empresa del curso te vende, recibís una propuesta
          de compra pendiente. Al aceptarla se registra el inventario, el asiento contable y
          la cuenta por pagar.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : proposals.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-gray-700 font-semibold">No tenés propuestas de compra pendientes</h3>
          <p className="text-gray-500 text-sm mt-1">
            Aparecerán aquí cuando otra empresa del curso te venda en Modo Empresarial.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {proposals.map((p) => {
            const busy = busyId === p.id;
            return (
              <div
                key={p.id}
                className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 flex flex-col gap-4"
              >
                {/* Encabezado: proveedor + factura */}
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{ background: '#475569' }}>
                    <Truck className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{p.supplierName}</h3>
                    {p.supplierCedula && (
                      <p className="text-xs text-gray-500 mt-0.5">Cédula: {p.supplierCedula}</p>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: '#FEF3C7', color: '#B45309' }}>
                    <Receipt className="w-3 h-3" /> {p.invoiceNumber}
                  </span>
                </div>

                {p.description && (
                  <p className="text-sm text-gray-600 -mt-1">{p.description}</p>
                )}

                {/* Montos */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-center">
                    <p className="text-[11px] text-gray-400">Subtotal</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5 font-mono tabular-nums">{money(p.subtotal)}</p>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-center">
                    <p className="text-[11px] text-gray-400">IVA</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5 font-mono tabular-nums">{money(p.taxAmount)}</p>
                  </div>
                  <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100 text-center">
                    <p className="text-[11px] text-blue-500">Total</p>
                    <p className="text-sm font-bold text-blue-700 mt-0.5 font-mono tabular-nums">{money(p.total)}</p>
                  </div>
                </div>

                {/* Footer: fecha + acciones */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 mt-auto">
                  <span className="text-xs text-gray-400">{formatDate(p.date)}</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="danger" onClick={() => handleReject(p)} disabled={busy}>
                      <X className="w-3.5 h-3.5" /> Rechazar
                    </Button>
                    <Button size="sm" onClick={() => handleAccept(p)} loading={busy}>
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
