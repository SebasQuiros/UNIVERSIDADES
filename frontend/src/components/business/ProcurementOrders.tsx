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
import {
  Truck, PackageCheck, Plus, X, ShoppingCart, Receipt, CreditCard,
  Ban, Building2, Check,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
// Órdenes de aprovisionamiento (F2.3 "Modo ERP") entre dos empresas del mismo
// exercise. El backend devuelve `role` y `counterpartyName` ya resueltos según
// la empresa consultada.
type OrderStatus =
  | 'PO_ISSUED' | 'DISPATCHED' | 'RECEIVED' | 'INVOICED' | 'PAID' | 'CANCELLED';

interface OrderItem {
  description: string;
  cabysCode?: string | null;
  quantity: number;
  unitPrice: number;
}

interface ProcurementOrder {
  id: string;
  exerciseId: string;
  buyerCompanyId: string;
  sellerCompanyId: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  purchaseInvoiceId?: string | null;
  notes?: string | null;
  createdAt: string;
  role: 'BUYER' | 'SELLER';
  counterpartyName: string | null;
}

// Empresa hermana del ejercicio o grupo de práctica (candidata a vendedora).
interface SiblingCompany { id: string; name: string; }

// Forma mínima de las empresas que devuelven los endpoints de candidatas.
interface TradingCompanyDto { id?: string; name?: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const money = (n: number) =>
  '₡' + (Number(n) ?? 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Pasos del flujo ERP (el orden importa para el stepper).
const STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'PO_ISSUED',  label: 'Emitida' },
  { key: 'DISPATCHED', label: 'Despachada' },
  { key: 'RECEIVED',   label: 'Recibida' },
  { key: 'INVOICED',   label: 'Facturada' },
  { key: 'PAID',       label: 'Pagada' },
];

const STATUS_META: Record<OrderStatus, { label: string; bg: string; color: string }> = {
  PO_ISSUED:  { label: 'Orden emitida', bg: '#EFF6FF', color: '#1D4ED8' },
  DISPATCHED: { label: 'Despachada',    bg: '#FDF6E3', color: '#B8860B' },
  RECEIVED:   { label: 'Recibida',      bg: '#EDE9FE', color: '#6D28D9' },
  INVOICED:   { label: 'Facturada',     bg: '#E0F2FE', color: '#0369A1' },
  PAID:       { label: 'Pagada',        bg: '#DCFCE7', color: '#15803D' },
  CANCELLED:  { label: 'Cancelada',     bg: '#FEE2E2', color: '#B91C1C' },
};

// Acciones disponibles según (rol, estado). Cada una hace POST al endpoint y
// muestra el toast de éxito indicado.
interface OrderAction {
  key: string;
  label: string;
  icon: React.ElementType;
  endpoint: string;
  toast: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

function actionsFor(order: ProcurementOrder): OrderAction[] {
  const { role, status } = order;
  const acts: OrderAction[] = [];
  if (role === 'SELLER' && status === 'PO_ISSUED')
    acts.push({ key: 'dispatch', label: 'Despachar', icon: Truck, endpoint: 'dispatch', toast: 'Orden despachada' });
  if (role === 'BUYER' && status === 'DISPATCHED')
    acts.push({ key: 'receive', label: 'Recibir', icon: PackageCheck, endpoint: 'receive', toast: 'Orden recibida: inventario actualizado' });
  if (role === 'SELLER' && status === 'RECEIVED')
    acts.push({ key: 'invoice', label: 'Facturar', icon: Receipt, endpoint: 'invoice', toast: 'Factura registrada: asiento y CxP creados' });
  if (role === 'BUYER' && status === 'INVOICED')
    acts.push({ key: 'pay', label: 'Pagar', icon: CreditCard, endpoint: 'pay', toast: 'Pago registrado' });
  if (status === 'PO_ISSUED' || status === 'DISPATCHED')
    acts.push({ key: 'cancel', label: 'Cancelar', icon: Ban, endpoint: 'cancel', toast: 'Orden cancelada', variant: 'danger' });
  return acts;
}

// ─── Stepper ─────────────────────────────────────────────────────────────────
function Stepper({ status }: { status: OrderStatus }) {
  if (status === 'CANCELLED') {
    const m = STATUS_META.CANCELLED;
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
        style={{ background: m.bg, color: m.color }}>
        <Ban className="w-3 h-3" /> {m.label}
      </span>
    );
  }
  const currentIdx = STEPS.findIndex((s) => s.key === status);
  return (
    <div className="flex items-center">
      {STEPS.map((s, i) => {
        const done = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={s.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1" style={{ minWidth: 54 }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold font-mono tabular-nums transition-colors"
                style={{
                  background: done ? 'linear-gradient(145deg,#2563EB,#1B2E6E)' : '#E2E8F0',
                  color: done ? '#fff' : '#94A3B8',
                  boxShadow: isCurrent ? '0 0 0 3px rgba(37,99,235,0.18)' : 'none',
                }}>
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className="text-[10px] font-semibold text-center leading-tight"
                style={{ color: done ? '#334155' : '#94A3B8' }}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="h-0.5 rounded self-start mt-3 transition-colors"
                style={{ width: 20, background: i < currentIdx ? '#2563EB' : '#E2E8F0' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Skeleton de tarjeta de orden ────────────────────────────────────────────
function OrderCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200/70 rounded-card shadow-card p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Skeleton className="w-11 h-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-12 rounded-xl" />
      <Skeleton className="h-20 rounded-xl" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export function ProcurementOrders({
  companyId, exerciseId, practiceGroupId,
}: { companyId: string; exerciseId?: string; practiceGroupId?: string }) {
  // El modal de "Nueva orden de compra" se muestra cuando participamos en un
  // ejercicio (comportamiento original) O en un grupo de práctica multiempresa.
  const canCreate = Boolean(exerciseId || practiceGroupId);
  const [orders, setOrders]   = useState<ProcurementOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId]   = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ProcurementOrder[]>(
        `/api/v1/procurement/orders?companyId=${companyId}`,
      );
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Error al cargar las órdenes de aprovisionamiento');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const runAction = async (order: ProcurementOrder, action: OrderAction) => {
    if (action.key === 'cancel' &&
      !confirm('¿Cancelar esta orden de aprovisionamiento? Esta acción no se puede deshacer.')) return;
    setBusyId(order.id);
    try {
      await api.post(`/api/v1/procurement/orders/${order.id}/${action.endpoint}`);
      toast.success(action.toast);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado explicativo + acción */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <IconTile icon={Truck} tint="#1B2E6E" size={46} />
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900 mb-0.5">
              Modo ERP
            </p>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">
              Aprovisionamiento entre empresas
            </h2>
            <p className="text-gray-500 text-sm mt-1 max-w-2xl leading-relaxed">
              Órdenes de compra entre empresas del curso. El comprador emite la orden, el vendedor
              despacha, el comprador recibe (inventario), el vendedor factura (asiento y CxP) y el
              comprador paga.
            </p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={() => setShowModal(true)} className="flex-shrink-0 cx-press">
            <Plus className="w-4 h-4" /> Nueva orden de compra
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => <OrderCardSkeleton key={i} />)}
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <EmptyState
            illustration={<ArtInventory size={190} className="cx-float" />}
            title="Todavía no hay órdenes de aprovisionamiento"
            description={
              canCreate
                ? 'Emite una orden de compra a otra empresa del grupo y sigue el flujo completo: despacho, recepción, factura y pago.'
                : 'Aparecerán aquí las órdenes de compra donde participes como comprador o vendedor.'
            }
            action={
              canCreate ? (
                <Button onClick={() => setShowModal(true)} className="cx-press">
                  <Plus className="w-4 h-4" /> Nueva orden de compra
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {orders.map((o, idx) => {
            const busy = busyId === o.id;
            const acts = actionsFor(o);
            const isBuyer = o.role === 'BUYER';
            return (
              <div
                key={o.id}
                className={cn(
                  'bg-white border border-gray-200/70 rounded-card shadow-card hover:shadow-card-hover',
                  'p-5 flex flex-col gap-4 cx-lift cx-hop-parent cx-pop',
                  idx < 6 ? `cx-d${idx + 1}` : undefined,
                )}
              >
                {/* Encabezado: contraparte + rol */}
                <div className="flex items-start gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white cx-hop"
                    style={{
                      background: isBuyer
                        ? 'linear-gradient(145deg,#2563EB,#1B2E6E)'
                        : 'linear-gradient(145deg,#1E3A8A,#0F2657)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
                    }}
                  >
                    {isBuyer ? <ShoppingCart className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate tracking-tight">
                      {o.counterpartyName ?? 'Empresa del curso'}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(o.createdAt)}</p>
                  </div>
                  <Badge variant={isBuyer ? 'blue' : 'slate'} className="flex-shrink-0">
                    {isBuyer ? 'Comprador' : 'Vendedor'}
                  </Badge>
                </div>

                {/* Stepper de estado */}
                <div className="overflow-x-auto pb-1">
                  <Stepper status={o.status} />
                </div>

                {/* Tabla de líneas */}
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 uppercase tracking-wider">
                        <th className="text-left font-semibold px-3 py-2">Descripción</th>
                        <th className="text-right font-semibold px-3 py-2">Cant.</th>
                        <th className="text-right font-semibold px-3 py-2">Precio</th>
                        <th className="text-right font-semibold px-3 py-2">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.items.map((it, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-3 py-1.5 text-gray-700">{it.description}</td>
                          <td className="px-3 py-1.5 text-right text-gray-600 font-mono tabular-nums">{Number(it.quantity)}</td>
                          <td className="px-3 py-1.5 text-right text-gray-600 font-mono tabular-nums">{money(it.unitPrice)}</td>
                          <td className="px-3 py-1.5 text-right text-gray-900 font-semibold font-mono tabular-nums">
                            {money(Number(it.quantity) * Number(it.unitPrice))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {o.notes && <p className="text-xs text-gray-500 -mt-1">{o.notes}</p>}

                {/* Totales */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-center">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wide">Subtotal</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5 font-mono tabular-nums">{money(o.subtotal)}</p>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-center">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wide">IVA</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5 font-mono tabular-nums">{money(o.taxAmount)}</p>
                  </div>
                  <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100 text-center">
                    <p className="text-[11px] text-blue-600 uppercase tracking-wide">Total</p>
                    <p className="text-sm font-extrabold text-blue-700 mt-0.5 font-mono tabular-nums">{money(o.total)}</p>
                  </div>
                </div>

                {/* Acciones según (rol, estado) */}
                {acts.length > 0 && (
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 mt-auto">
                    {acts.map((a) => (
                      <Button
                        key={a.key}
                        size="sm"
                        variant={a.variant ?? 'primary'}
                        onClick={() => runAction(o, a)}
                        disabled={busy}
                        loading={busy && a.key !== 'cancel'}
                        className="cx-press"
                      >
                        <a.icon className="w-3.5 h-3.5" /> {a.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && canCreate && (
        <NewOrderModal
          companyId={companyId}
          exerciseId={exerciseId}
          practiceGroupId={practiceGroupId}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── Modal: nueva orden de compra ────────────────────────────────────────────
interface DraftItem { description: string; cabysCode: string; quantity: string; unitPrice: string; }

const BLANK_ITEM: DraftItem = { description: '', cabysCode: '', quantity: '1', unitPrice: '0' };
const INPUT = 'w-full px-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 outline-none transition';

function NewOrderModal({
  companyId, exerciseId, practiceGroupId, onClose, onCreated,
}: {
  companyId: string;
  exerciseId?: string;
  practiceGroupId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [siblings, setSiblings]     = useState<SiblingCompany[]>([]);
  const [sellerId, setSellerId]     = useState('');
  const [manualId, setManualId]     = useState('');
  const [useManual, setUseManual]   = useState(false);
  const [items, setItems]           = useState<DraftItem[]>([{ ...BLANK_ITEM }]);
  const [notes, setNotes]           = useState('');
  const [saving, setSaving]         = useState(false);

  // Poblar el selector de vendedor con las empresas candidatas:
  //  - En un grupo de práctica: las empresas miembro del grupo.
  //  - En un ejercicio: TODAS las empresas del ejercicio.
  // (endpoints accesibles al estudiante que participa). Si no hay ninguna
  // utilizable, el usuario pega el companyId manualmente como respaldo.
  useEffect(() => {
    const url = practiceGroupId
      ? `/api/v1/practice/groups/${practiceGroupId}/companies`
      : `/api/v1/exercises/${exerciseId}/trading-companies`;
    api.get<TradingCompanyDto[]>(url)
      .then(({ data }) => {
        const list = (Array.isArray(data) ? data : [])
          .map((c) => ({ id: c.id ?? '', name: c.name ?? '' }))
          .filter((c) => c.id && c.id !== companyId);
        setSiblings(list);
        if (list.length === 0) setUseManual(true);
      })
      .catch(() => setUseManual(true));
  }, [exerciseId, practiceGroupId, companyId]);

  const setItem = (i: number, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setItems((prev) => [...prev, { ...BLANK_ITEM }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const subtotal = items.reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
  const iva = subtotal * 0.13;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const seller = useManual ? manualId.trim() : sellerId;
    if (!seller) { toast.error('Elegí (o pegá) la empresa vendedora'); return; }
    if (seller === companyId) { toast.error('El vendedor no puede ser tu propia empresa'); return; }
    const cleanItems = items
      .map((it) => ({
        description: it.description.trim(),
        cabysCode:   it.cabysCode.trim() || undefined,
        quantity:    Number(it.quantity),
        unitPrice:   Number(it.unitPrice),
      }))
      .filter((it) => it.description && it.quantity > 0);
    if (cleanItems.length === 0) {
      toast.error('Agregá al menos una línea con descripción y cantidad'); return;
    }
    setSaving(true);
    try {
      await api.post('/api/v1/procurement/orders', {
        ...(practiceGroupId ? { practiceGroupId } : { exerciseId }),
        buyerCompanyId: companyId,
        sellerCompanyId: seller,
        items: cleanItems,
        taxRate: 0.13,
        notes: notes.trim() || undefined,
      });
      toast.success('Orden de compra emitida');
      onCreated();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-csq-dark/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}>
      <div
        className="bg-white w-full max-w-2xl rounded-card border border-gray-200/70 shadow-2xl my-8 overflow-hidden cx-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del modal */}
        <div className="relative flex items-center justify-between px-6 py-4 text-white bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent"
          />
          <div className="flex items-center gap-3">
            <IconTile icon={ShoppingCart} size={40} onDark />
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-gold-500">
                Aprovisionamiento
              </p>
              <h3 className="font-bold tracking-tight">Nueva orden de compra</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors cx-press"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {/* Vendedor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-700">Empresa vendedora *</span>
              {siblings.length > 0 && (
                <button type="button" onClick={() => setUseManual((v) => !v)}
                  className="text-[11px] font-semibold text-blue-700 hover:underline">
                  {useManual ? 'Elegir de la lista' : 'Pegar companyId'}
                </button>
              )}
            </div>
            {useManual ? (
              <>
                <input value={manualId} onChange={(e) => setManualId(e.target.value)}
                  placeholder="Pegá el ID de la empresa vendedora" className={INPUT} />
                <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                  No se encontraron empresas del curso disponibles automáticamente. Pedí el
                  identificador (companyId) de la empresa vendedora del curso y pegalo aquí.
                </p>
              </>
            ) : (
              <div className="relative">
                <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select value={sellerId} onChange={(e) => setSellerId(e.target.value)}
                  className={INPUT + ' pl-9 appearance-none'}>
                  <option value="">Seleccioná una empresa…</option>
                  {siblings.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Líneas */}
          <div>
            <span className="text-xs font-semibold text-gray-700 mb-2 block">Líneas de la orden *</span>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <input value={it.description} onChange={(e) => setItem(i, { description: e.target.value })}
                    placeholder="Descripción" className={INPUT + ' col-span-5'} />
                  <input value={it.cabysCode} onChange={(e) => setItem(i, { cabysCode: e.target.value })}
                    placeholder="CABYS (opc.)" className={INPUT + ' col-span-2 font-mono'} />
                  <input type="number" min="0" step="any" value={it.quantity}
                    onChange={(e) => setItem(i, { quantity: e.target.value })}
                    placeholder="Cant." className={INPUT + ' col-span-2 text-right font-mono tabular-nums'} />
                  <input type="number" min="0" step="any" value={it.unitPrice}
                    onChange={(e) => setItem(i, { unitPrice: e.target.value })}
                    placeholder="Precio" className={INPUT + ' col-span-2 text-right font-mono tabular-nums'} />
                  <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1}
                    aria-label="Quitar línea"
                    className="col-span-1 h-9 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:hover:text-gray-300 disabled:hover:bg-transparent cx-press">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addItem}
              className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline cx-press">
              <Plus className="w-3.5 h-3.5" /> Agregar línea
            </button>
          </div>

          {/* Notas */}
          <label className="block">
            <span className="text-xs font-semibold text-gray-700 mb-1.5 block">Notas (opcional)</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Referencia, condiciones…" className={INPUT} />
          </label>

          {/* Totales estimados */}
          <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 p-3.5 bg-gray-50 rounded-2xl border border-gray-100 text-sm">
            <span className="text-gray-500">
              Subtotal <b className="text-gray-900 font-mono tabular-nums ml-1">{money(subtotal)}</b>
            </span>
            <span className="text-gray-500">
              IVA (13%) <b className="text-gray-900 font-mono tabular-nums ml-1">{money(iva)}</b>
            </span>
            <span className="text-gray-500">
              Total <b className="text-blue-700 font-mono tabular-nums ml-1">{money(subtotal + iva)}</b>
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving} className="cx-press">
              Cancelar
            </Button>
            <Button type="submit" loading={saving} className="cx-press">
              <ShoppingCart className="w-4 h-4" /> Emitir orden
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
