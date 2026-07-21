'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { fmtNum, formatDate } from '@/lib/utils';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { SceneEmptyBox, SceneSearchEmpty } from '@/components/illustrations';
import {
  FileMinus, FilePlus, AlertTriangle, Plus, Trash2, X,
  Send, Info, ReceiptText, Coins,
} from 'lucide-react';

// ── Tipos del backend real ─────────────────────────────────────
// GET /api/v1/companies/:companyId/credit-notes  (y .../debit-notes)
//   → Note[] con `lines`. La lista NO incluye el nº de la factura origen,
//     solo `invoiceId`; lo resolvemos contra la lista de facturas.
// POST .../credit-notes            { invoiceId, issueDate, reason?, restoreInventory?, lines[] }
// POST .../credit-notes/:id/issue  → genera el asiento contable.
type NoteStatus = 'DRAFT' | 'ISSUED';

interface Note {
  id: string;
  number: number;
  invoiceId: string;
  issueDate: string;
  reason: string | null;
  subtotal: number | string;
  tax: number | string;
  total: number | string;
  status: NoteStatus;
  restoreInventory?: boolean;
  createdAt: string;
}

// GET /api/v1/companies/:companyId/invoices → shape paginado { invoices, total, ... }
// (se normaliza a array). Estados relevantes: 'ISSUED' = emitida.
interface Invoice {
  id: string;
  consecutiveNumber: string;
  clientName: string;
  issueDate: string;
  status: string;
  subtotal?: number | string;
  tax?: number | string;
  total: number | string;
}

// GET /api/v1/companies/:companyId/invoices/:id → factura con `items`.
interface InvoiceItem {
  id: string;
  productId: string | null;
  lineNo: number;
  description: string;
  quantity: number | string;
  unit: string | null;
  unitPrice: number | string;
  taxRate: number | string;
  cabysCode: string | null;
}
interface InvoiceDetail extends Invoice {
  items?: InvoiceItem[];
}

// Línea editable del formulario de nota.
interface DraftLine {
  productId?: string;
  description: string;
  quantity: string;
  unit?: string;
  unitPrice: string;
  taxRate: string;
  cabysCode: string;
}

const VALID_TAX_RATES = [0, 1, 2, 4, 8, 13];

// ── Config por tipo de nota ────────────────────────────────────
const KIND_META = {
  credito: {
    endpoint: 'credit-notes',
    eyebrow: 'Ingresos',
    title: 'Notas de crédito',
    subtitle: 'Documentá devoluciones o anulaciones que revierten una venta ya facturada.',
    icon: FileMinus,
    tint: '#2563EB',
    abbr: 'NC',
    what:
      'Una nota de crédito reduce el valor de una factura emitida: sirve para devoluciones, ' +
      'descuentos posteriores o anulaciones. Al emitirla se genera el asiento que revierte la venta.',
    newLabel: 'Nueva nota de crédito',
    emptyTitle: 'Aún no hay notas de crédito',
    emptyHint: 'Se generan a partir de una factura de venta ya emitida.',
    creditedLabel: 'Total acreditado',
    isCredit: true,
  },
  debito: {
    endpoint: 'debit-notes',
    eyebrow: 'Ingresos',
    title: 'Notas de débito',
    subtitle: 'Registrá cargos adicionales sobre una factura ya emitida (intereses, ajustes).',
    icon: FilePlus,
    tint: '#B8860B',
    abbr: 'ND',
    what:
      'Una nota de débito aumenta el valor de una factura emitida: sirve para intereses, ' +
      'cargos por mora u otros ajustes al alza. Al emitirla se genera el asiento que incrementa la venta.',
    newLabel: 'Nueva nota de débito',
    emptyTitle: 'Aún no hay notas de débito',
    emptyHint: 'Se emiten sobre una factura de venta ya emitida.',
    creditedLabel: 'Total cargado',
    isCredit: false,
  },
} as const;

type Kind = keyof typeof KIND_META;

function apiErrorMessage(err: unknown, fallback: string): string {
  const msg = (err as any)?.response?.data?.message;
  if (Array.isArray(msg) && msg.length > 0) return String(msg[0]);
  if (typeof msg === 'string' && msg) return msg;
  return fallback;
}

// Total de una línea del formulario (subtotal + IVA), tolerante a campos vacíos.
function lineTotal(l: DraftLine): number {
  const qty = Number(l.quantity) || 0;
  const price = Number(l.unitPrice) || 0;
  const rate = Number(l.taxRate) || 0;
  const sub = qty * price;
  return sub + (sub * rate) / 100;
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'no-company' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; companyId: string; notes: Note[]; invoices: Invoice[] };

export function NotasView({ kind }: { kind: Kind }) {
  const meta = KIND_META[kind];
  const [state, setState] = useState<LoadState>({ phase: 'loading' });

  // Emisión de una nota DRAFT existente (id en curso).
  const [issuingId, setIssuingId] = useState<string | null>(null);

  // ── Modal "Nueva nota" ───────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [invoiceId, setInvoiceId] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [restoreInventory, setRestoreInventory] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async (companyId: string) => {
    const [notesRes, invRes] = await Promise.all([
      api.get<Note[]>(`/api/v1/companies/${companyId}/${meta.endpoint}`),
      api.get<Invoice[] | { invoices: Invoice[] }>(`/api/v1/companies/${companyId}/invoices`),
    ]);
    const notes = Array.isArray(notesRes.data) ? notesRes.data : [];
    const invoices: Invoice[] = Array.isArray(invRes.data)
      ? invRes.data
      : (invRes.data?.invoices ?? []);
    return { notes, invoices };
  }, [meta.endpoint]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // 1) Resolver la empresa igual que el sidebar: attempt activo → company.
        const { data } = await api.get<any[]>('/api/v1/attempts');
        const list = Array.isArray(data) ? data : [];
        const active =
          list.find((x) => x.status === 'IN_PROGRESS') ??
          list.find((x) => x.company) ??
          list.find((x) => x.status === 'NOT_STARTED') ??
          list[0];

        const companyId: string | undefined = active?.company?.id;
        if (!companyId) {
          if (alive) setState({ phase: 'no-company' });
          return;
        }

        // 2) Traer notas + facturas (para resolver el nº de factura origen).
        const { notes, invoices } = await fetchAll(companyId);
        if (alive) setState({ phase: 'ready', companyId, notes, invoices });
      } catch {
        if (alive) {
          setState({
            phase: 'error',
            message: `No pudimos cargar tus ${meta.title.toLowerCase()}. Intentá de nuevo en un momento.`,
          });
        }
      }
    })();

    return () => {
      alive = false;
    };
    // meta.title/fetchAll dependen solo de `kind`; se re-ejecuta al cambiar de tipo.
  }, [fetchAll, meta.title]);

  const refresh = async (companyId: string) => {
    try {
      const { notes, invoices } = await fetchAll(companyId);
      setState({ phase: 'ready', companyId, notes, invoices });
    } catch {
      // Silencioso: la mutación ya avisó por toast; conservamos los datos previos.
    }
  };

  // Facturas emitidas (únicas elegibles como origen de una nota).
  const issuedInvoices =
    state.phase === 'ready' ? state.invoices.filter((i) => i.status === 'ISSUED') : [];

  // Índice invoiceId → factura, para pintar el nº en la tabla de notas.
  const invoiceById = new Map<string, Invoice>();
  if (state.phase === 'ready') for (const inv of state.invoices) invoiceById.set(inv.id, inv);

  // ── Abrir / cerrar modal ─────────────────────────────────────
  const openModal = () => {
    setInvoiceId('');
    setIssueDate(new Date().toISOString().split('T')[0]);
    setReason('');
    setRestoreInventory(false);
    setLines([]);
    setShowModal(true);
  };
  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
  };

  // Al elegir factura → prefill de líneas desde su detalle (nota total de un click).
  const handleSelectInvoice = async (id: string) => {
    setInvoiceId(id);
    setLines([]);
    if (!id || state.phase !== 'ready') return;

    setLoadingLines(true);
    try {
      const { data } = await api.get<InvoiceDetail>(
        `/api/v1/companies/${state.companyId}/invoices/${id}`,
      );
      const items = Array.isArray(data.items) ? data.items : [];
      setLines(
        items.map((it) => ({
          productId: it.productId ?? undefined,
          description: it.description,
          quantity: String(Number(it.quantity)),
          unit: it.unit ?? undefined,
          unitPrice: String(Number(it.unitPrice)),
          taxRate: String(Number(it.taxRate)),
          cabysCode: it.cabysCode ?? '',
        })),
      );
    } catch (err) {
      toast.error(apiErrorMessage(err, 'No pudimos cargar las líneas de la factura.'));
    } finally {
      setLoadingLines(false);
    }
  };

  const updateLine = (i: number, field: keyof DraftLine, val: string) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: val } : l)));
  };
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const selectedInvoice = issuedInvoices.find((i) => i.id === invoiceId);
  const notesTotal = lines.reduce((acc, l) => acc + lineTotal(l), 0);
  const exceedsInvoice =
    !!selectedInvoice && meta.isCredit && notesTotal > Number(selectedInvoice.total) + 0.005;

  // ── Crear (POST) ─────────────────────────────────────────────
  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (state.phase !== 'ready' || saving) return;

    if (!invoiceId) {
      toast.error('Elegí la factura de origen.');
      return;
    }
    const filled = lines.filter((l) => l.description.trim());
    if (filled.length === 0) {
      toast.error('La nota debe tener al menos una línea con descripción.');
      return;
    }
    // El backend exige un CABYS de 13 dígitos por línea (igual que la factura).
    const badCabys = filled.findIndex((l) => !/^\d{13}$/.test((l.cabysCode || '').trim()));
    if (badCabys >= 0) {
      toast.error(`Línea ${badCabys + 1}: el código CABYS debe tener exactamente 13 dígitos.`);
      return;
    }
    const badRate = filled.findIndex((l) => !VALID_TAX_RATES.includes(Number(l.taxRate)));
    if (badRate >= 0) {
      toast.error(`Línea ${badRate + 1}: la tasa de IVA debe ser 0, 1, 2, 4, 8 o 13.`);
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        invoiceId,
        issueDate,
        reason: reason.trim() || undefined,
        lines: filled.map((l) => ({
          productId: l.productId || undefined,
          description: l.description.trim(),
          quantity: Number(l.quantity) || 0,
          unit: l.unit || undefined,
          unitPrice: Number(l.unitPrice) || 0,
          taxRate: Number(l.taxRate) || 0,
          cabysCode: l.cabysCode.trim(),
        })),
      };
      if (meta.isCredit) body.restoreInventory = restoreInventory;

      await api.post(`/api/v1/companies/${state.companyId}/${meta.endpoint}`, body);
      toast.success(`${meta.title.replace(/s$/, '')} creada como borrador.`);
      setShowModal(false);
      await refresh(state.companyId);
    } catch (err) {
      toast.error(apiErrorMessage(err, `No pudimos crear la ${meta.abbr}.`));
    } finally {
      setSaving(false);
    }
  };

  // ── Emitir una nota DRAFT ────────────────────────────────────
  const handleIssue = async (note: Note) => {
    if (state.phase !== 'ready' || issuingId) return;
    setIssuingId(note.id);
    try {
      await api.post(`/api/v1/companies/${state.companyId}/${meta.endpoint}/${note.id}/issue`);
      toast.success(`${meta.abbr}-${note.number} emitida. Se generó su asiento contable.`);
      await refresh(state.companyId);
    } catch (err) {
      toast.error(apiErrorMessage(err, `No pudimos emitir la ${meta.abbr}.`));
    } finally {
      setIssuingId(null);
    }
  };

  const Icon = meta.icon;
  const header = (
    <PageHeader
      eyebrow={meta.eyebrow}
      title={meta.title}
      subtitle={meta.subtitle}
      icon={Icon}
      iconTint={meta.tint}
      className="mb-6"
      actions={
        state.phase === 'ready' && issuedInvoices.length > 0 ? (
          <Button onClick={openModal} className="cx-press">
            <Plus className="w-4 h-4" /> {meta.newLabel}
          </Button>
        ) : undefined
      }
    />
  );

  // ── Loading ──────────────────────────────────────────────────
  if (state.phase === 'loading') {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
        <div className="max-w-6xl mx-auto">
          {header}
          <SectionCard>
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Spinner size="lg" />
              <p className="text-sm text-gray-500">Cargando tus {meta.title.toLowerCase()}…</p>
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  // ── Sin empresa activa ───────────────────────────────────────
  if (state.phase === 'no-company') {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
        <div className="max-w-6xl mx-auto">
          {header}
          <Card>
            <EmptyState
              illustration={<SceneSearchEmpty size={200} className="cx-float" />}
              title="Aún no tenés una empresa activa"
              description="Iniciá un ejercicio para constituir tu empresa; ahí podrás facturar y emitir notas sobre tus ventas."
              action={
                <Link href="/estudiante" className={buttonClasses({ variant: 'primary', className: 'cx-press' })}>
                  Ir a mis ejercicios
                </Link>
              }
            />
          </Card>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────
  if (state.phase === 'error') {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
        <div className="max-w-6xl mx-auto">
          {header}
          <Card>
            <EmptyState
              illustration={
                <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center">
                  <AlertTriangle className="w-9 h-9 text-amber-600" />
                </div>
              }
              title={`No pudimos cargar las ${meta.title.toLowerCase()}`}
              description={state.message}
            />
          </Card>
        </div>
      </div>
    );
  }

  // ── Ready ────────────────────────────────────────────────────
  const { notes } = state;
  const issuedNotes = notes.filter((n) => n.status === 'ISSUED');
  const totalIssued = issuedNotes.reduce((acc, n) => acc + Number(n.total), 0);
  const draftCount = notes.filter((n) => n.status === 'DRAFT').length;
  const noIssuedInvoices = issuedInvoices.length === 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
      <div className="max-w-6xl mx-auto">
        {header}

        {/* Aviso explicativo */}
        <Card className="mb-6 cx-pop cx-d1">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${meta.tint}14` }}
            >
              <Info className="w-4.5 h-4.5" style={{ color: meta.tint }} />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-gray-700 leading-relaxed">{meta.what}</p>
              <p className="mt-1 text-xs text-gray-400">
                Solo se puede emitir una nota sobre una factura que ya esté <strong>emitida</strong>.
              </p>
            </div>
          </div>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatCard label="Notas emitidas" value={issuedNotes.length.toLocaleString('es-CR')} icon={ReceiptText} tint={meta.tint} className="cx-pop cx-d1" />
          <StatCard label={meta.creditedLabel} value={`₡${fmtNum(totalIssued)}`} icon={Coins} tint="#B8860B" className="cx-pop cx-d2" />
          <StatCard label="Borradores" value={draftCount.toLocaleString('es-CR')} icon={Icon} tint="#6D28D9" className="cx-pop cx-d3" />
        </div>

        {/* Lista de notas */}
        <SectionCard flushBody className="cx-pop cx-d2">
          {notes.length === 0 ? (
            <EmptyState
              illustration={<SceneEmptyBox size={180} className="cx-float" />}
              title={meta.emptyTitle}
              description={
                noIssuedInvoices
                  ? 'Primero emití una factura de venta: las notas se generan sobre una factura ya emitida.'
                  : meta.emptyHint
              }
              action={
                noIssuedInvoices ? (
                  <Link
                    href="/estudiante"
                    className={buttonClasses({ variant: 'primary', className: 'cx-press' })}
                  >
                    Ir a mis ejercicios
                  </Link>
                ) : (
                  <Button onClick={openModal} variant="primary" className="cx-press">
                    <Plus className="w-4 h-4" /> {meta.newLabel}
                  </Button>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-2.5 font-semibold w-20">N°</th>
                    <th className="px-4 py-2.5 font-semibold">Factura origen</th>
                    <th className="px-4 py-2.5 font-semibold w-32">Fecha</th>
                    <th className="px-4 py-2.5 font-semibold w-36 text-right">Total</th>
                    <th className="px-4 py-2.5 font-semibold w-28">Estado</th>
                    <th className="px-4 py-2.5 font-semibold w-28 text-right">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {notes.map((note) => {
                    const inv = invoiceById.get(note.invoiceId);
                    const isIssuing = issuingId === note.id;
                    return (
                      <tr key={note.id} className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-2.5 font-mono tabular-nums text-xs text-gray-500 whitespace-nowrap">
                          {meta.abbr}-{note.number}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-mono tabular-nums text-xs text-blue-700">
                            {inv?.consecutiveNumber ?? '—'}
                          </span>
                          {inv?.clientName && (
                            <span className="block text-xs text-gray-400 truncate max-w-[220px]">{inv.clientName}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{formatDate(note.issueDate)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-800 tabular-nums whitespace-nowrap">
                          ₡{fmtNum(note.total)}
                        </td>
                        <td className="px-4 py-2.5">
                          {note.status === 'ISSUED' ? (
                            <Badge variant="emerald">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Emitida
                            </Badge>
                          ) : (
                            <Badge variant="slate">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                              Borrador
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end">
                            {note.status === 'DRAFT' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                loading={isIssuing}
                                disabled={Boolean(issuingId)}
                                onClick={() => void handleIssue(note)}
                                className="cx-press"
                              >
                                {!isIssuing && <Send className="w-3.5 h-3.5" />} Emitir
                              </Button>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            <span className="font-mono tabular-nums">{notes.length}</span>{' '}
            {notes.length === 1 ? 'nota' : 'notas'} · las más recientes primero · al emitir una nota se genera su asiento contable
          </div>
        </SectionCard>
      </div>

      {/* ── Modal: nueva nota ─────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white border border-gray-200 shadow-xl rounded-card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${meta.tint}14` }}
                >
                  <Icon className="w-4 h-4" style={{ color: meta.tint }} />
                </span>
                <h3 className="font-semibold text-gray-900">{meta.newLabel}</h3>
              </div>
              <button
                onClick={closeModal}
                disabled={saving}
                aria-label="Cerrar"
                className="text-gray-400 hover:text-gray-700 disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {/* Factura de origen */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Factura de origen *</label>
                <select
                  value={invoiceId}
                  onChange={(e) => void handleSelectInvoice(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-xl bg-white border border-gray-300 text-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                >
                  <option value="">Seleccioná una factura emitida…</option>
                  {issuedInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.consecutiveNumber} · {inv.clientName} · ₡{fmtNum(inv.total)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400">
                  Al elegirla se copian sus líneas; editá cantidades/precios o borrá líneas para una nota parcial.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Fecha de emisión"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  disabled={saving}
                />
                <Input
                  label="Motivo (opcional)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={meta.isCredit ? 'Ej: Devolución de mercadería' : 'Ej: Interés por mora'}
                  maxLength={500}
                  disabled={saving}
                />
              </div>

              {/* NC: devolución de bienes → restaura inventario */}
              {meta.isCredit && (
                <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-gray-200 bg-gray-50/60 px-3.5 py-3">
                  <input
                    type="checkbox"
                    checked={restoreInventory}
                    onChange={(e) => setRestoreInventory(e.target.checked)}
                    disabled={saving}
                    className="mt-0.5 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    Es una devolución de bienes <span className="text-gray-400">(restaura inventario y revierte el costo de venta de las líneas con producto)</span>
                  </span>
                </label>
              )}

              {/* Líneas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Líneas de la nota</label>
                  {selectedInvoice && (
                    <span className="text-xs text-gray-400">Factura {selectedInvoice.consecutiveNumber} · ₡{fmtNum(selectedInvoice.total)}</span>
                  )}
                </div>

                {loadingLines ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                    <Spinner size="sm" /> Cargando líneas de la factura…
                  </div>
                ) : !invoiceId ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-8 text-center text-sm text-gray-400">
                    Elegí una factura para copiar sus líneas.
                  </div>
                ) : lines.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-8 text-center text-sm text-gray-400">
                    La factura no tiene líneas.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {lines.map((line, i) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                        <div className="flex items-start gap-2">
                          <input
                            value={line.description}
                            onChange={(e) => updateLine(i, 'description', e.target.value)}
                            placeholder="Descripción *"
                            disabled={saving}
                            className="flex-1 rounded-lg bg-white border border-gray-300 text-gray-900 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                          />
                          <button
                            type="button"
                            onClick={() => removeLine(i)}
                            disabled={saving}
                            aria-label={`Quitar línea ${i + 1}`}
                            className="text-gray-400 hover:text-red-600 px-1 pt-1.5 disabled:opacity-40"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <span className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Cantidad</span>
                            <input
                              type="number" min="0.001" step="0.001"
                              value={line.quantity}
                              onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                              disabled={saving}
                              className="w-full rounded-lg bg-white border border-gray-300 text-gray-900 px-3 py-2 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                            />
                          </div>
                          <div>
                            <span className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Precio unit.</span>
                            <input
                              type="number" min="0" step="0.01"
                              value={line.unitPrice}
                              onChange={(e) => updateLine(i, 'unitPrice', e.target.value)}
                              disabled={saving}
                              className="w-full rounded-lg bg-white border border-gray-300 text-gray-900 px-3 py-2 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                            />
                          </div>
                          <div>
                            <span className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">IVA</span>
                            <select
                              value={line.taxRate}
                              onChange={(e) => updateLine(i, 'taxRate', e.target.value)}
                              disabled={saving}
                              className="w-full rounded-lg bg-white border border-gray-300 text-gray-900 px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                            >
                              {VALID_TAX_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                            </select>
                          </div>
                          <div>
                            <span className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Total línea</span>
                            <div className="rounded-lg bg-white border border-gray-200 text-gray-700 px-3 py-2 text-xs tabular-nums text-right">
                              ₡{fmtNum(lineTotal(line))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total + aviso de exceso */}
              {lines.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-gray-500">Total de la nota</span>
                  <span className="text-lg font-bold tabular-nums" style={{ color: meta.tint }}>
                    ₡{fmtNum(notesTotal)}
                  </span>
                </div>
              )}
              {exceedsInvoice && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    El total de la nota (₡{fmtNum(notesTotal)}) excede el total de la factura origen
                    (₡{fmtNum(selectedInvoice!.total)}). El sistema rechazará una nota de crédito por más de lo facturado.
                  </span>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="secondary" onClick={closeModal} disabled={saving} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" loading={saving} disabled={saving || !invoiceId || lines.length === 0} className="flex-1">
                  Crear borrador
                </Button>
              </div>
              <p className="text-xs text-gray-400 text-center">
                Se crea como <strong>borrador</strong>. Luego usá <strong>Emitir</strong> en la lista para generar el asiento contable.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrappers finos para cada tipo (usados por page.tsx).
export function NotasCreditoView() {
  return <NotasView kind="credito" />;
}
export function NotasDebitoView() {
  return <NotasView kind="debito" />;
}
