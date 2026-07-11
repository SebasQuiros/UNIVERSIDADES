'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate, getErrorMessage, esc } from '@/lib/utils';
import { exportToExcel } from '@/lib/excel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { CabysSearch, type CabysItem } from '@/components/cabys/CabysSearch';
import { ExchangeRateWidget } from '@/components/ui/ExchangeRateWidget';
import toast from 'react-hot-toast';
import {
  Building2, Users, Package, FileText, FileSpreadsheet,
  BookOpen, BarChart2, CheckCircle2, Send, Plus, Trash2,
  X, ChevronRight, AlertCircle, Truck,
  Printer, Landmark, Upload,
  Scale, ClipboardList, ClipboardCheck, Download,
  Lightbulb, Search,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface Client  { id: string; name: string; email: string | null; identification: string | null; isActive: boolean; }
export interface Product { id: string; name: string; price: number | string; stock: number | string; isActive: boolean; cabysCode: string | null; taxRate: number | string; category: { id: string; name: string } | null; }
export interface Invoice {
  id: string; consecutiveNumber: string; issueDate: string; total: number | string; status: string;
  clientName: string;
  subtotal?: number | string; tax?: number | string;
  items?: Array<{ description: string; quantity: number; unitPrice: number; total: number; taxRate?: number }>;
}
export interface JournalEntry {
  id: string; entryDate: string; entryNumber: number; description: string; reference: string | null;
  lines: Array<{ account: { code: string; name: string }; debit: number | string; credit: number | string }>;
}
export interface Account { id: string; code: string; name: string; type: string; level: number; isHeader: boolean; }

export const TYPE_LABELS: Record<string, string> = {
  FULL_CYCLE: 'Ciclo Completo', JOURNAL_ONLY: 'Solo Diario',
  INVOICING_ONLY: 'Solo Facturación', INVENTORY_ONLY: 'Solo Inventario',
};

// ─── Modal wrapper ────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 shadow-xl rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Hint Button ─────────────────────────────────────────────────────────────
export function HintButton({ hint, attemptId, tabId }: { hint: string; attemptId: string; tabId: string }) {
  const [open, setOpen] = useState(false);
  function handleOpen() {
    setOpen(true);
    api.post(`/api/v1/attempts/${attemptId}/track`, { event: 'REPORT_VIEWED', metadata: { type: 'hint', tab: tabId } }).catch(() => {});
  }
  return (
    <>
      <button onClick={handleOpen} title="Ver pista" className="ml-1 text-yellow-500 hover:text-yellow-600 transition-colors">
        <Lightbulb className="w-4 h-4" />
      </button>
      {open && (
        <Modal title="Pista" onClose={() => setOpen(false)}>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{hint}</p>
        </Modal>
      )}
    </>
  );
}

// ─── Ledger shared types ──────────────────────────────────────────────────────
export interface LedgerAccount {
  accountId: string; code: string; name: string; type: string;
  totalDebit: string; totalCredit: string; balance: string; normalBalance: string;
}
export interface LedgerMovement {
  entryId: string; entryDate: string; entryNumber: number; description: string;
  debit: string; credit: string; balance: string;
}

// ─── Invoices validation types ────────────────────────────────────────────────
export interface Supplier { id: string; name: string; email: string | null; identification: string | null; isActive: boolean; }
export interface ValidationCheck { field: string; status: 'ok' | 'missing' | 'invalid' | 'warning'; message: string; }
export interface ValidationResult { isValid: boolean; checks: ValidationCheck[]; }

// ─── Bank types ───────────────────────────────────────────────────────────────
export interface BankTx { id: string; date: string; description: string; amount: string | number; type: string; reference: string | null; isReconciled: boolean; }

// ─── Payroll helpers ──────────────────────────────────────────────────────────
export const SALARIO_MINIMO_2026 = 381_000;

export function fmt(n: number | string) {
  return '₡' + Number(n).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Clients tab ─────────────────────────────────────────────────────────────
export function ClientsTab({ companyId, readonly, attemptId }: { companyId: string; readonly: boolean; attemptId?: string }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', identification: '', idType: '01', phone: '' });

  const load = useCallback(() => {
    api.get<Client[]>(`/api/v1/companies/${companyId}/clients`)
      .then(({ data }) => setClients(data.filter((c) => c.isActive)))
      .catch(() => toast.error('Error al cargar clientes'))
      .finally(() => setLoading(false));
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (!form.identification.trim()) { toast.error('La cédula/identificación es requerida'); return; }
    setSaving(true);
    try {
      await api.post(`/api/v1/companies/${companyId}/clients`, {
        name: form.name, email: form.email || undefined,
        identification: form.identification, idType: form.idType,
        phone: form.phone || undefined,
      });
      if (attemptId) api.post(`/api/v1/attempts/${attemptId}/track`, { event: 'CLIENT_CREATED', metadata: { name: form.name } }).catch(() => {});
      toast.success('Cliente creado');
      setShowModal(false);
      setForm({ name: '', email: '', identification: '', idType: '01', phone: '' });
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  return (
    <div>
      {showModal && (
        <Modal title="Nuevo Cliente" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input label="Nombre *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Empresa ABC S.A." />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="cliente@empresa.com" />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Tipo ID *</label>
                <select value={form.idType} onChange={(e) => setForm({ ...form, idType: e.target.value })}
                  className="rounded-xl bg-white border border-gray-300 text-gray-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="01">01 — Física</option>
                  <option value="02">02 — Jurídica</option>
                  <option value="03">03 — DIMEX</option>
                  <option value="04">04 — NITE</option>
                </select>
              </div>
              <Input label="Identificación *" value={form.identification} onChange={(e) => setForm({ ...form, identification: e.target.value })} placeholder="Ej: 301110000" />
            </div>
            <Input label="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="2222-3333" />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" loading={saving} className="flex-1">Crear cliente</Button>
            </div>
          </form>
        </Modal>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{clients.length} cliente{clients.length !== 1 ? 's' : ''}</p>
        {!readonly && (
          <Button size="sm" onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> Nuevo cliente</Button>
        )}
      </div>

      {clients.length === 0 ? (
        <div className="text-center py-10">
          <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No hay clientes aún</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-700 font-semibold text-sm flex-shrink-0">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                <p className="text-xs text-gray-500">{c.email ?? c.identification ?? '—'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Products tab ─────────────────────────────────────────────────────────────
export function ProductsTab({ companyId, readonly, attemptId }: { companyId: string; readonly: boolean; attemptId?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', cabysCode: '', cabysDesc: '', price: '', taxRate: '13', stock: '', unit: 'UNI', isService: false });

  const load = useCallback(() => {
    api.get<Product[]>(`/api/v1/companies/${companyId}/products`)
      .then(({ data }) => setProducts(data.filter((p) => p.isActive)))
      .catch(() => toast.error('Error al cargar productos'))
      .finally(() => setLoading(false));
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (!form.price) { toast.error('El precio es requerido'); return; }
    if (!/^\d{13}$/.test(form.cabysCode)) { toast.error('El código CABYS debe tener exactamente 13 dígitos'); return; }
    setSaving(true);
    try {
      // cabysDesc se mantiene en el state sólo para mostrar la descripción del CABYS
      // en la UI (al elegir un código del buscador). El backend no lo persiste —
      // su DTO usa forbidNonWhitelisted: true, así que NO debe ir en el POST.
      await api.post(`/api/v1/companies/${companyId}/products`, {
        name: form.name, description: form.description || undefined,
        cabysCode: form.cabysCode,
        price: Number(form.price),
        taxRate: Number(form.taxRate), stock: Number(form.stock) || 0,
        unit: form.unit, isService: form.isService,
      });
      if (attemptId) api.post(`/api/v1/attempts/${attemptId}/track`, { event: 'PRODUCT_CREATED', metadata: { name: form.name } }).catch(() => {});
      toast.success('Producto creado');
      setShowModal(false);
      setForm({ name: '', description: '', cabysCode: '', cabysDesc: '', price: '', taxRate: '13', stock: '', unit: 'UNI', isService: false });
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  return (
    <div>
      {showModal && (
        <Modal title="Nuevo Producto / Servicio" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input label="Nombre *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Servicio de Consultoría" />
            <Input label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción opcional" />
            <CabysSearch
              label="Código CABYS * (13 dígitos)"
              value={form.cabysCode}
              disabled={saving}
              onSelect={(item: CabysItem) => {
                setForm((prev) => ({
                  ...prev,
                  cabysCode: item.codigo,
                  cabysDesc: item.descripcion,
                  taxRate: String(item.impuesto),
                }));
              }}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Precio unitario *" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">IVA *</label>
                <select value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
                  className="rounded-xl bg-white border border-gray-300 text-gray-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {[0,1,2,4,8,13].map((r) => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Stock inicial" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="0" />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Unidad</label>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="w-full rounded-xl bg-white border border-gray-300 text-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {['UNI', 'SRV', 'KG', 'LT', 'MT', 'HRS'].map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isService} onChange={(e) => setForm({ ...form, isService: e.target.checked })} className="rounded" />
              <span className="text-sm text-gray-700">Es un servicio (no consume stock)</span>
            </label>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" loading={saving} className="flex-1">Crear producto</Button>
            </div>
          </form>
        </Modal>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">{products.length} producto{products.length !== 1 ? 's' : ''}</p>
          {attemptId && (
            <Link href={`/estudiante/ejercicio/${attemptId}/cabys`}
              className="text-xs text-blue-700 hover:text-blue-700 hover:underline flex items-center gap-1">
              <Search className="w-3 h-3" /> Buscar CABYS
            </Link>
          )}
        </div>
        {!readonly && (
          <Button size="sm" onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> Nuevo producto</Button>
        )}
      </div>

      {products.length === 0 ? (
        <div className="text-center py-10">
          <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No hay productos aún</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
              <th className="text-left pb-3">Nombre</th>
              <th className="text-right pb-3">Precio</th>
              <th className="text-right pb-3">Stock</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="py-3 text-gray-700">{p.name}</td>
                  <td className="py-3 text-right text-gray-600">₡{Number(p.price).toLocaleString('es-CR', { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 text-right text-gray-600">{p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
// ─── Suppliers tab ────────────────────────────────────────────────────────────

export function SuppliersTab({ companyId, readonly }: { companyId: string; readonly: boolean }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', identification: '', idType: '02', phone: '', address: '' });

  const load = useCallback(() => {
    api.get<Supplier[]>(`/api/v1/companies/${companyId}/suppliers`)
      .then(({ data }) => setSuppliers(data.filter((s) => s.isActive)))
      .catch(() => toast.error('Error al cargar proveedores'))
      .finally(() => setLoading(false));
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.post(`/api/v1/companies/${companyId}/suppliers`, {
        name: form.name,
        identification: form.identification || undefined,
        idType: form.idType || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
      });
      toast.success('Proveedor creado');
      setShowModal(false);
      setForm({ name: '', email: '', identification: '', idType: '02', phone: '', address: '' });
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  return (
    <div>
      {showModal && (
        <Modal title="Nuevo Proveedor" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input label="Nombre *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Distribuidora ABC S.A." />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="proveedor@empresa.com" />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Tipo ID</label>
                <select value={form.idType} onChange={(e) => setForm({ ...form, idType: e.target.value })}
                  className="rounded-xl bg-white border border-gray-300 text-gray-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="01">01 — Física</option>
                  <option value="02">02 — Jurídica</option>
                  <option value="03">03 — DIMEX</option>
                  <option value="04">04 — NITE</option>
                </select>
              </div>
              <Input label="Identificación" value={form.identification} onChange={(e) => setForm({ ...form, identification: e.target.value })} placeholder="Ej: 3101000000" />
            </div>
            <Input label="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="2222-3333" />
            <Input label="Dirección" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="San José, Costa Rica" />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" loading={saving} className="flex-1">Crear proveedor</Button>
            </div>
          </form>
        </Modal>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{suppliers.length} proveedor{suppliers.length !== 1 ? 'es' : ''}</p>
        {!readonly && (
          <Button size="sm" onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> Nuevo proveedor</Button>
        )}
      </div>

      {suppliers.length === 0 ? (
        <div className="text-center py-10">
          <Truck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No hay proveedores aún</p>
        </div>
      ) : (
        <div className="space-y-2">
          {suppliers.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                {s.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                <p className="text-xs text-gray-500">{s.email ?? s.identification ?? '—'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ─── Invoices tab ─────────────────────────────────────────────────────────────
// ── Validate check type ───────────────────────────────────────────────────────

export function InvoicesTab({ companyId, readonly, attemptId }: { companyId: string; readonly: boolean; attemptId?: string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients]   = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [issuing, setIssuing]   = useState<string | null>(null);
  const [downloadingXml, setDownloadingXml] = useState<string | null>(null);
  const [validating, setValidating]   = useState<string | null>(null);
  const [validation, setValidation]   = useState<{ invoiceId: string; result: ValidationResult } | null>(null);
  const [form, setForm] = useState({ clientId: '', issueDate: new Date().toISOString().split('T')[0], notes: '', currency: 'CRC', exchangeRate: '' });
  const [lines, setLines] = useState([{ productId: '', description: '', quantity: '1', unitPrice: '', taxRate: '13', cabysCode: '' }]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, cli, prod] = await Promise.all([
        api.get<Invoice[] | { invoices: Invoice[] }>(`/api/v1/companies/${companyId}/invoices`),
        api.get<Client[]>(`/api/v1/companies/${companyId}/clients`),
        api.get<Product[]>(`/api/v1/companies/${companyId}/products`),
      ]);
      // Backend returns paginated shape `{ invoices, total, page, ... }` — normalize to array
      const invoicesList: Invoice[] = Array.isArray(inv.data)
        ? inv.data
        : (inv.data?.invoices ?? []);
      setInvoices(invoicesList);
      setClients(Array.isArray(cli.data) ? cli.data.filter((c) => c.isActive) : []);
      setProducts(Array.isArray(prod.data) ? prod.data.filter((p) => p.isActive) : []);
    } catch { toast.error('Error al cargar facturas'); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  function addLine() { setLines([...lines, { productId: '', description: '', quantity: '1', unitPrice: '', taxRate: '13', cabysCode: '' }]); }
  function removeLine(i: number) { setLines(lines.filter((_, idx) => idx !== i)); }
  function updateLine(i: number, field: string, val: string) {
    const updated = lines.map((l, idx) => {
      if (idx !== i) return l;
      const newLine = { ...l, [field]: val };
      if (field === 'productId' && val) {
        const prod = products.find((p) => p.id === val);
        if (prod) {
          newLine.description = prod.name;
          newLine.unitPrice   = String(prod.price);
          newLine.cabysCode   = prod.cabysCode ?? '';
          newLine.taxRate     = String(prod.taxRate ?? 13);
        }
      }
      return newLine;
    });
    setLines(updated);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientId) { toast.error('Selecciona un cliente'); return; }
    if (lines.every((l) => !l.description)) { toast.error('Agrega al menos una línea'); return; }

    // Validación de CABYS antes de enviar — el DTO del backend exige 13 dígitos
    // y rechaza cualquier otra cosa con un 400 que el usuario no entendía.
    const filledLines = lines.filter((l) => l.description);
    const badCabys = filledLines.findIndex((l) => !/^\d{13}$/.test((l.cabysCode || '').trim()));
    if (badCabys >= 0) {
      toast.error(
        `Línea ${badCabys + 1}: el código CABYS debe tener exactamente 13 dígitos. ` +
        `Seleccioná un producto del catálogo o ingresá un CABYS válido.`,
      );
      return;
    }

    setSaving(true);
    try {
      await api.post(`/api/v1/companies/${companyId}/invoices`, {
        clientId: form.clientId,
        issueDate: form.issueDate,
        notes: form.notes || undefined,
        currency: form.currency,
        exchangeRate: form.currency === 'USD' && form.exchangeRate ? Number(form.exchangeRate) : undefined,
        lines: filledLines.map((l) => ({
          productId:   l.productId || undefined,
          description: l.description,
          quantity:    Number(l.quantity) || 1,
          unitPrice:   Number(l.unitPrice) || 0,
          taxRate:     Number(l.taxRate) || 0,
          cabysCode:   l.cabysCode.trim(),
        })),
      });
      if (attemptId) api.post(`/api/v1/attempts/${attemptId}/track`, { event: 'INVOICE_CREATED' }).catch(() => {});
      toast.success('Factura creada como borrador');
      setShowModal(false);
      setLines([{ productId: '', description: '', quantity: '1', unitPrice: '', taxRate: '13', cabysCode: '' }]);
      setForm({ clientId: '', issueDate: new Date().toISOString().split('T')[0], notes: '', currency: 'CRC', exchangeRate: '' });
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  }

  async function handleIssue(invoiceId: string) {
    setIssuing(invoiceId);
    try {
      await api.post(`/api/v1/companies/${companyId}/invoices/${invoiceId}/issue`);
      if (attemptId) api.post(`/api/v1/attempts/${attemptId}/track`, { event: 'INVOICE_ISSUED' }).catch(() => {});
      toast.success('Factura emitida exitosamente');
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setIssuing(null); }
  }

  async function handleDownloadXml(inv: Invoice) {
    setDownloadingXml(inv.id);
    try {
      const response = await api.get(
        `/api/v1/companies/${companyId}/invoices/${inv.id}/xml`,
        { responseType: 'blob' },
      );
      const url  = URL.createObjectURL(new Blob([response.data], { type: 'application/xml' }));
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `FE-${inv.consecutiveNumber}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('XML descargado correctamente');
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDownloadingXml(null); }
  }

  async function handleValidate(inv: Invoice) {
    setValidating(inv.id);
    try {
      const { data } = await api.get<ValidationResult>(
        `/api/v1/companies/${companyId}/invoices/${inv.id}/validate`,
      );
      setValidation({ invoiceId: inv.id, result: data });
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setValidating(null); }
  }

  function handlePrintInvoice(inv: Invoice) {
    const win = window.open('', '_blank');
    if (!win) return;
    const statusLabel = inv.status === 'DRAFT' ? 'Borrador'
      : inv.status === 'ACCEPTED' ? 'Emitida'
      : inv.status === 'ISSUED'   ? 'Emitida' : inv.status;
    const fmt = (n: any) =>
      Number(n ?? 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const logoUrl = `${window.location.origin}/sjqa-logo.png`;
    const issueDateStr = new Date(inv.issueDate).toLocaleDateString('es-CR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    const isDraft = inv.status === 'DRAFT';

    // ── XSS hardening: todos los valores del usuario van por esc().
    //    Los numéricos pasan por Number() antes de interpolarse.
    const itemRows = (inv.items ?? []).map((item, i) => `
      <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
        <td class="cell num">${i + 1}</td>
        <td class="cell">${esc(item.description)}</td>
        <td class="cell right">${Number(item.quantity)}</td>
        <td class="cell right">₡ ${fmt(item.unitPrice)}</td>
        <td class="cell right">${Number(item.taxRate ?? 0)}%</td>
        <td class="cell right strong">₡ ${fmt(item.total)}</td>
      </tr>`).join('');

    win.document.write(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Factura ${esc(inv.consecutiveNumber)} — ContaSJ</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{background:#EEF2F7;color:#0F172A;font-family:'Inter','Segoe UI',system-ui,sans-serif;font-size:13px;line-height:1.45}
  .page{
    max-width:820px;margin:24px auto;background:#FFF;border-radius:14px;overflow:hidden;
    box-shadow:0 8px 28px rgba(15,23,42,0.10);position:relative;
  }
  /* Watermark "ContaSJ" diagonal */
  .watermark{
    position:absolute;top:36%;left:-3%;font-weight:900;font-size:230px;color:#F1F5FB;
    transform:rotate(-22deg);letter-spacing:-12px;pointer-events:none;user-select:none;z-index:0;
  }
  /* Cabecera con gradiente azul */
  .header{
    position:relative;background:#03080F;
    color:#FFF;padding:28px 36px 22px;display:flex;align-items:flex-start;justify-content:space-between;gap:24px;
    border-bottom:3px solid #2563EB;
  }
  .brand{display:flex;align-items:center;gap:14px}
  .brand .logo-wrap{
    width:56px;height:56px;border-radius:14px;background:#FFF;padding:6px;
    display:flex;align-items:center;justify-content:center;flex-shrink:0;
    box-shadow:0 4px 14px rgba(0,0,0,0.18);
  }
  .brand .logo-wrap img{width:100%;height:100%;object-fit:contain}
  .brand .text .name{font-size:18px;font-weight:800;letter-spacing:-.01em}
  .brand .text .sub{font-size:11px;color:#BFD2F4;letter-spacing:.04em;text-transform:uppercase}
  .brand .text .url{font-size:10.5px;color:#92B5EE;margin-top:2px}
  .header .invoice-box{
    background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);
    border-radius:12px;padding:14px 18px;min-width:230px;text-align:right;
  }
  .header .invoice-box .tag{
    display:inline-block;background:#2563EB;color:#FFF;font-size:10px;font-weight:800;
    letter-spacing:.12em;padding:4px 10px;border-radius:999px;margin-bottom:6px;
  }
  .header .invoice-box .number{font-size:18px;font-weight:800}
  .header .invoice-box .date{font-size:11px;color:#BFD2F4;margin-top:4px}
  .header .invoice-box .badge{
    display:inline-block;margin-top:6px;font-size:10px;font-weight:700;letter-spacing:.05em;
    padding:3px 9px;border-radius:999px;
    background:${isDraft ? 'rgba(255,255,255,0.18)' : '#10B981'};
    color:#FFF;
  }
  /* Cuerpo */
  .body{position:relative;z-index:1;padding:26px 36px}
  .row{display:flex;gap:14px;margin-bottom:22px}
  .card{
    flex:1;background:#F8FAFC;border:1px solid #E5EAF0;border-radius:12px;padding:16px 18px;
    box-shadow:0 2px 8px rgba(15,23,42,0.04);
  }
  .card .label{
    display:inline-block;background:#03080F;color:#FFF;font-size:9px;font-weight:800;
    letter-spacing:.12em;padding:3px 9px;border-radius:6px;margin-bottom:8px;
  }
  .card .name{font-size:14px;font-weight:700;color:#0F172A;margin-bottom:4px}
  .card .meta{font-size:11.5px;color:#64748B;line-height:1.6}
  /* Tabla */
  table{width:100%;border-collapse:separate;border-spacing:0;border-radius:10px;overflow:hidden;
    border:1px solid #E5EAF0}
  thead tr{background:#03080F}
  thead th{
    padding:10px 12px;font-size:10.5px;font-weight:700;color:#E0EAFE;
    letter-spacing:.08em;text-transform:uppercase;text-align:right;
  }
  thead th:nth-child(1){text-align:center;width:34px}
  thead th:nth-child(2){text-align:left}
  tbody td.cell{padding:10px 12px;font-size:12.5px;color:#1E293B;border-bottom:1px solid #EEF2F7}
  tbody tr:last-child td{border-bottom:none}
  tbody tr.even{background:#FAFBFD}
  tbody td.right{text-align:right}
  tbody td.num{text-align:center;color:#94A3B8;font-weight:600;font-size:11.5px}
  tbody td.strong{font-weight:700;color:#0F172A}
  /* Totales */
  .totals-wrap{display:flex;justify-content:flex-end;margin-top:16px}
  .totals{min-width:280px}
  .totals .row-line{
    display:flex;justify-content:space-between;padding:6px 14px;font-size:12.5px;color:#475569;
  }
  .totals .row-line.sub{background:#F8FAFC;border-radius:8px 8px 0 0}
  .totals .row-line.iva{background:#F8FAFC;border-bottom:1px solid #E5EAF0;border-radius:0 0 8px 8px;margin-bottom:8px}
  .totals .row-line strong{color:#0F172A;font-weight:600}
  .totals .total-block{
    position:relative;background:#03080F;color:#FFF;
    border-radius:12px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;
    box-shadow:0 1px 2px rgba(16,24,40,0.04);
  }
  .totals .total-block::before{
    content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:#2563EB;border-radius:12px 0 0 12px;
  }
  .totals .total-block .lbl{font-size:11px;font-weight:700;letter-spacing:.12em;color:#BFD2F4}
  .totals .total-block .val{font-size:20px;font-weight:800;letter-spacing:-.01em}
  /* Sello educativo */
  .stamp{
    margin-top:26px;padding:12px 16px;border:1px dashed #FBBF24;border-radius:10px;
    background:#FFFBEB;color:#92400E;font-size:11px;display:flex;gap:10px;align-items:center;
  }
  .stamp svg{flex-shrink:0}
  /* Footer */
  .footer{
    margin-top:14px;padding:16px 36px;background:#0F172A;color:#94A3B8;
    display:flex;justify-content:space-between;align-items:center;font-size:10.5px;
  }
  .footer .l{display:flex;align-items:center;gap:10px}
  .footer .l .ico{
    width:26px;height:26px;border-radius:6px;background:#FFF;padding:3px;
    display:flex;align-items:center;justify-content:center;
  }
  .footer .l .ico img{width:100%;height:100%;object-fit:contain}
  .footer .r{font-style:italic;color:#FBBF24}
  /* Print */
  @media print{
    html,body{background:#FFF}
    .page{margin:0;border-radius:0;box-shadow:none}
    .watermark{display:block !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .header,.totals .total-block,thead tr,.footer{
      -webkit-print-color-adjust:exact;print-color-adjust:exact;
    }
  }
</style></head>
<body>
<div class="page">
  <div class="watermark">ContaSJ</div>

  <div class="header">
    <div class="brand">
      <div class="logo-wrap"><img src="${logoUrl}" alt="ContaSJ" onerror="this.style.display='none'"></div>
      <div class="text">
        <div class="name">ContaSJ</div>
        <div class="sub">Sistema Educativo Contable · Costa Rica</div>
        <div class="url">www.sjqa.cr  ·  hola@sjqa.cr</div>
      </div>
    </div>
    <div class="invoice-box">
      <div class="tag">FACTURA ELECTRÓNICA</div>
      <div class="number">No. ${esc(inv.consecutiveNumber)}</div>
      <div class="date">${esc(issueDateStr)}</div>
      <div class="badge">${esc(statusLabel)}</div>
    </div>
  </div>

  <div class="body">
    <div class="row">
      <div class="card">
        <span class="label">EMISOR</span>
        <div class="name">ContaSJ — Empresa de Práctica</div>
        <div class="meta">
          Cédula jurídica: 3-101-000000<br>
          San José, Costa Rica<br>
          hola@sjqa.cr
        </div>
      </div>
      <div class="card">
        <span class="label">CLIENTE</span>
        <div class="name">${esc(inv.clientName)}</div>
        <div class="meta">
          Fecha de emisión: <strong>${esc(issueDateStr)}</strong><br>
          Condición de venta: Contado<br>
          Moneda: CRC (Colón costarricense)
        </div>
      </div>
    </div>

    <table>
      <thead><tr>
        <th>#</th>
        <th>Descripción</th>
        <th>Cant.</th>
        <th>Precio unit.</th>
        <th>IVA</th>
        <th>Total</th>
      </tr></thead>
      <tbody>${itemRows || '<tr><td colspan="6" style="padding:18px;text-align:center;color:#94A3B8">Sin líneas en esta factura</td></tr>'}</tbody>
    </table>

    <div class="totals-wrap">
      <div class="totals">
        ${inv.subtotal != null ? `<div class="row-line sub"><span>Subtotal</span><strong>₡ ${fmt(inv.subtotal)}</strong></div>` : ''}
        ${inv.tax != null ? `<div class="row-line iva"><span>IVA total</span><strong>₡ ${fmt(inv.tax)}</strong></div>` : ''}
        <div class="total-block">
          <span class="lbl">TOTAL A PAGAR</span>
          <span class="val">₡ ${fmt(inv.total)}</span>
        </div>
      </div>
    </div>

    <div class="stamp">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <div>
        <strong>Documento educativo</strong> — Esta factura es generada por el sistema ContaSJ con fines académicos.
        No tiene validez fiscal ante el Ministerio de Hacienda de Costa Rica.
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="l">
      <div class="ico"><img src="${logoUrl}" alt="" onerror="this.style.display='none'"></div>
      <div>
        <div style="color:#FFF;font-weight:700">ContaSJ</div>
        <div>Documento educativo · ${new Date().getFullYear()}</div>
      </div>
    </div>
    <div class="r">DOCUMENTO EDUCATIVO  ·  Sin validez fiscal</div>
  </div>
</div>
<script>setTimeout(() => window.print(), 350);</script>
</body></html>`);
    win.document.close();
  }

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  return (
    <div>
      {/* ── Validation modal ─────────────────────────────────── */}
      {validation && (
        <Modal title="Validacion Hacienda v4.4" onClose={() => setValidation(null)}>
          <div className="space-y-3">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
              validation.result.isValid ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {validation.result.isValid
                ? <><CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Factura valida para envio a Hacienda</>
                : <><AlertCircle className="w-4 h-4 flex-shrink-0" /> La factura tiene problemas que deben corregirse</>}
            </div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {validation.result.checks.map((check, i) => (
                <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs border ${
                  check.status === 'ok'      ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                  check.status === 'warning' ? 'bg-amber-50  border-amber-100  text-amber-800' :
                  check.status === 'missing' ? 'bg-gray-50   border-gray-200   text-gray-600' :
                                              'bg-red-50    border-red-100    text-red-800'
                }`}>
                  <span className="font-mono font-bold flex-shrink-0 w-3 text-center">
                    {check.status === 'ok' ? '✓' : check.status === 'warning' ? '!' : check.status === 'missing' ? '?' : '✗'}
                  </span>
                  <div>
                    <span className="font-semibold">{check.field}:</span> {check.message}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setValidation(null)}
              className="w-full mt-2 px-4 py-2 text-sm rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
              Cerrar
            </button>
          </div>
        </Modal>
      )}

      {showModal && (
        <Modal title="Nueva Factura" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Currency selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Moneda</label>
              <div className="flex gap-2">
                {['CRC', 'USD'].map((cur) => (
                  <button key={cur} type="button"
                    onClick={() => setForm({ ...form, currency: cur })}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${form.currency === cur ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                    {cur === 'CRC' ? '₡ Colones (CRC)' : '$ Dólares (USD)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Exchange rate widget — only shown when USD */}
            {form.currency === 'USD' && (
              <ExchangeRateWidget
                onRateLoaded={(venta) => setForm((prev) => ({ ...prev, exchangeRate: String(venta) }))}
              />
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Cliente *</label>
              <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                className="w-full rounded-xl bg-white border border-gray-300 text-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecciona un cliente...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Input label="Fecha emisión" type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Líneas</label>
                <button type="button" onClick={addLine} className="text-xs text-blue-700 hover:text-blue-700">+ Agregar línea</button>
              </div>
              <div className="space-y-3">
                {lines.map((line, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                    <div className="flex gap-2">
                      <select value={line.productId} onChange={(e) => updateLine(i, 'productId', e.target.value)}
                        className="flex-1 rounded-lg bg-white border border-gray-300 text-gray-900 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="">Seleccionar producto...</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <button type="button" onClick={() => removeLine(i)} className="text-gray-400 hover:text-red-600 px-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <input value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)}
                      placeholder="Descripción de la línea *" className="w-full rounded-lg bg-white border border-gray-300 text-gray-900 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <div className="grid grid-cols-4 gap-2">
                      <input type="number" value={line.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                        placeholder="Cant." min="0.001" step="0.001" className="rounded-lg bg-white border border-gray-300 text-gray-900 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <input type="number" value={line.unitPrice} onChange={(e) => updateLine(i, 'unitPrice', e.target.value)}
                        placeholder="Precio" min="0" step="0.01" className="rounded-lg bg-white border border-gray-300 text-gray-900 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <select value={line.taxRate} onChange={(e) => updateLine(i, 'taxRate', e.target.value)}
                        className="rounded-lg bg-white border border-gray-300 text-gray-900 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
                        {[0,1,2,4,8,13].map((r) => <option key={r} value={r}>IVA {r}%</option>)}
                      </select>
                      <input value={line.cabysCode} onChange={(e) => updateLine(i, 'cabysCode', e.target.value)}
                        placeholder="CABYS (13d)" maxLength={13} className="rounded-lg bg-white border border-gray-300 text-gray-900 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" loading={saving} className="flex-1">Crear borrador</Button>
            </div>
          </form>
        </Modal>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{invoices.length} factura{invoices.length !== 1 ? 's' : ''}</p>
        {!readonly && (
          <Button size="sm" onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> Nueva factura</Button>
        )}
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-10">
          <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No hay facturas aún</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
              <th className="text-left pb-3">Número</th>
              <th className="text-left pb-3">Cliente</th>
              <th className="text-left pb-3">Fecha</th>
              <th className="text-right pb-3">Total</th>
              <th className="text-right pb-3">Estado</th>
              <th className="pb-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="py-3 font-mono text-xs text-blue-700">{inv.consecutiveNumber}</td>
                  <td className="py-3 text-gray-700">{inv.clientName}</td>
                  <td className="py-3 text-gray-500">{formatDate(inv.issueDate)}</td>
                  <td className="py-3 text-right text-gray-700 font-medium">
                    ₡{Number(inv.total).toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      inv.status === 'ACCEPTED' || inv.status === 'ISSUED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      inv.status === 'DRAFT'    ? 'bg-gray-100 text-gray-600 border border-gray-200' :
                      'bg-red-50 text-red-700 border border-red-200'
                    }`}>{inv.status === 'DRAFT' ? 'Borrador' : inv.status === 'ACCEPTED' || inv.status === 'ISSUED' ? 'Emitida' : inv.status}</span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => handlePrintInvoice(inv)} title="Imprimir / PDF"
                        className="p-1.5 text-gray-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors">
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      {(inv.status === 'ISSUED' || inv.status === 'ACCEPTED') && (
                        <>
                          <button
                            onClick={() => handleDownloadXml(inv)}
                            disabled={downloadingXml === inv.id}
                            title="Descargar XML Hacienda v4.4"
                            className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-40">
                            {downloadingXml === inv.id
                              ? <Spinner />
                              : <Download className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleValidate(inv)}
                            disabled={validating === inv.id}
                            title="Validar formato Hacienda"
                            className="p-1.5 text-gray-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-40">
                            {validating === inv.id
                              ? <Spinner />
                              : <ClipboardCheck className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      )}
                      {!readonly && inv.status === 'DRAFT' && (
                        <Button size="sm" variant="secondary" onClick={() => handleIssue(inv.id)}
                          loading={issuing === inv.id}>
                          <Send className="w-3 h-3" /> Emitir
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
// ─── Journal tab ──────────────────────────────────────────────────────────────
export function JournalTab({ companyId, attemptId }: { companyId: string; readonly?: boolean; attemptId?: string }) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ent = await api.get<{ entries: JournalEntry[] }>(`/api/v1/companies/${companyId}/journal`);
      setEntries(Array.isArray(ent.data) ? ent.data : (ent.data as any).entries ?? []);
    } catch { toast.error('Error al cargar asientos'); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  return (
    <div className="space-y-4">
      {/* Info box — auto-generated entries */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <div className="text-blue-600 mt-0.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </div>
        <div>
          <p className="font-semibold text-blue-800 text-sm">Asientos generados automáticamente</p>
          <p className="text-blue-700 text-sm mt-1">
            El sistema registra los asientos contables automáticamente cuando realizas
            operaciones (facturas, compras, pagos, planillas). Los asientos se muestran
            a continuación para tu revisión.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{entries.length} asiento{entries.length !== 1 ? 's' : ''}</p>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button
              onClick={async () => {
                try {
                  const response = await api.get(
                    `/api/v1/companies/${companyId}/reports/journal-book/excel`,
                    { responseType: 'blob' },
                  );
                  const date = new Date().toISOString().split('T')[0];
                  const url  = URL.createObjectURL(new Blob([response.data]));
                  const a    = document.createElement('a');
                  a.href     = url;
                  a.download = `libro-diario-${date}.xlsx`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  toast.error('Error al exportar');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm">
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </button>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-10">
          <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No hay asientos aún</p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-700">{entry.description}</p>
                  {entry.reference && <p className="text-xs text-gray-500">Ref: {entry.reference}</p>}
                </div>
                <span className="text-xs text-gray-400">{formatDate(entry.entryDate)}</span>
              </div>
              <table className="w-full text-xs">
                <thead><tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left p-3">Cuenta</th>
                  <th className="text-right p-3">Débito</th>
                  <th className="text-right p-3">Crédito</th>
                </tr></thead>
                <tbody>
                  {entry.lines.map((line, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="p-3 text-gray-600">
                        <span className="font-mono text-gray-400">{line.account.code}</span> {line.account.name}
                      </td>
                      <td className="p-3 text-right text-gray-700">
                        {Number(line.debit) > 0 ? `₡${Number(line.debit).toLocaleString('es-CR', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="p-3 text-right text-gray-700">
                        {Number(line.credit) > 0 ? `₡${Number(line.credit).toLocaleString('es-CR', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ─── Ledger tab ───────────────────────────────────────────────────────────────

export function LedgerTab({ companyId }: { companyId: string }) {
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [selected, setSelected] = useState<LedgerAccount | null>(null);
  const [movements, setMovements] = useState<LedgerMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMov, setLoadingMov] = useState(false);

  useEffect(() => {
    api.get<LedgerAccount[]>(`/api/v1/companies/${companyId}/ledger`)
      .then(({ data }) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Error al cargar libro mayor'))
      .finally(() => setLoading(false));
  }, [companyId]);

  async function selectAccount(acc: LedgerAccount) {
    setSelected(acc);
    setLoadingMov(true);
    try {
      const { data } = await api.get<{ movements: LedgerMovement[] }>(
        `/api/v1/companies/${companyId}/ledger/${acc.accountId}`
      );
      setMovements(data.movements ?? []);
    } catch { toast.error('Error al cargar movimientos'); }
    finally { setLoadingMov(false); }
  }

  const typeColors: Record<string, string> = {
    ASSET:     'bg-blue-50 text-blue-700 border-blue-200',
    LIABILITY: 'bg-red-50 text-red-700 border-red-200',
    EQUITY:    'bg-slate-50 text-slate-700 border-slate-200',
    INCOME:   'bg-emerald-50 text-emerald-700 border-emerald-200',
    EXPENSE:   'bg-amber-50 text-amber-700 border-amber-200',
  };
  const typeLabels: Record<string, string> = {
    ASSET: 'Activo', LIABILITY: 'Pasivo', EQUITY: 'Patrimonio',
    INCOME: 'Ingreso', EXPENSE: 'Gasto',
  };

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  if (accounts.length === 0) return (
    <div className="text-center py-10">
      <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
      <p className="text-gray-500 text-sm">No hay movimientos contables aún</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Account list */}
      <div className="lg:col-span-1">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cuentas con movimientos</p>
          <button
            onClick={() => exportToExcel('libro-mayor', accounts.map(a => ({
              Codigo: a.code, Cuenta: a.name, Tipo: a.type,
              'Total Debitos': Number(a.totalDebit), 'Total Creditos': Number(a.totalCredit), Saldo: Number(a.balance),
            })))}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
        </div>
        <div className="space-y-1.5">
          {accounts.map((acc) => (
            <button key={acc.accountId} onClick={() => selectAccount(acc)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                selected?.accountId === acc.accountId
                  ? 'bg-blue-50 border-blue-300'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-mono text-gray-400">{acc.code}</p>
                  <p className="text-sm font-medium text-gray-800 truncate">{acc.name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-700">₡{Number(acc.balance).toLocaleString('es-CR', { minimumFractionDigits: 0 })}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${typeColors[acc.type] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {typeLabels[acc.type] ?? acc.type}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Movements */}
      <div className="lg:col-span-2">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <ChevronRight className="w-8 h-8 text-gray-200 mb-2" />
            <p className="text-gray-400 text-sm">Selecciona una cuenta para ver sus movimientos</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div>
                <p className="text-xs font-mono text-gray-400">{selected.code}</p>
                <h3 className="font-semibold text-gray-900">{selected.name}</h3>
              </div>
              <div className="ml-auto grid grid-cols-3 gap-3 text-center">
                {[
                  { label: 'Débitos',  value: selected.totalDebit,  color: 'text-blue-700' },
                  { label: 'Créditos', value: selected.totalCredit, color: 'text-red-600' },
                  { label: 'Saldo',    value: selected.balance,     color: 'text-gray-900' },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                    <p className={`text-sm font-bold ${s.color}`}>₡{Number(s.value).toLocaleString('es-CR', { minimumFractionDigits: 0 })}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {loadingMov ? <div className="flex justify-center py-10"><Spinner /></div> : (
              <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-3">#</th>
                      <th className="text-left p-3">Fecha</th>
                      <th className="text-left p-3">Descripción</th>
                      <th className="text-right p-3">Débito</th>
                      <th className="text-right p-3">Crédito</th>
                      <th className="text-right p-3">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {movements.map((m, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-3 text-xs text-gray-400">#{m.entryNumber}</td>
                        <td className="p-3 text-xs text-gray-500">{formatDate(m.entryDate)}</td>
                        <td className="p-3 text-gray-700 text-xs max-w-[200px] truncate">{m.description}</td>
                        <td className="p-3 text-right text-blue-700 font-mono text-xs">
                          {Number(m.debit) > 0 ? `₡${Number(m.debit).toLocaleString('es-CR', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="p-3 text-right text-red-600 font-mono text-xs">
                          {Number(m.credit) > 0 ? `₡${Number(m.credit).toLocaleString('es-CR', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="p-3 text-right text-gray-900 font-mono text-xs font-medium">
                          ₡{Number(m.balance).toLocaleString('es-CR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
// ─── Reports tab ──────────────────────────────────────────────────────────────
export function ReportsTab({ companyId, companyName }: { companyId: string; companyName?: string }) {
  const [report, setReport] = useState<'balance-sheet' | 'income-statement'>('balance-sheet');
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  function load(type: typeof report) {
    setReport(type);
    setData(null);
    setLoading(true);
    api.get(`/api/v1/companies/${companyId}/reports/${type}`)
      .then(({ data: d }) => setData(d))
      .catch(() => toast.error('Error al cargar reporte'))
      .finally(() => setLoading(false));
  }

  async function handleExport(type: 'excel' | 'pdf') {
    if (exporting) return;
    setExporting(true);
    try {
      const response = await api.get(
        `/api/v1/companies/${companyId}/reports/${report}/${type}`,
        { responseType: 'blob' },
      );
      const date = new Date().toISOString().split('T')[0];
      const ext  = type === 'excel' ? 'xlsx' : 'pdf';
      const name = report === 'balance-sheet' ? 'balance-general' : 'estado-resultados';
      const url  = URL.createObjectURL(new Blob([response.data]));
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${name}-${date}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al exportar');
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => { load('balance-sheet'); }, [companyId]);

  function ReportRow({ label, value, bold, indent }: { label: string; value: number; bold?: boolean; indent?: boolean }) {
    return (
      <div className={`flex items-center justify-between py-2 border-b border-gray-100 last:border-0 ${bold ? 'font-semibold' : ''}`}>
        <span className={`text-sm ${bold ? 'text-gray-900' : 'text-gray-600'} ${indent ? 'pl-4' : ''}`}>{label}</span>
        <span className={`text-sm ${bold ? 'text-gray-900' : 'text-gray-700'}`}>
          ₡{(value ?? 0).toLocaleString('es-CR', { minimumFractionDigits: 2 })}
        </span>
      </div>
    );
  }

  function fmt(n: number) {
    return '₡' + (n ?? 0).toLocaleString('es-CR', { minimumFractionDigits: 2 });
  }

  function buildBalanceSheetHtml(d: any): string {
    const assets      = d.assets?.accounts      ?? [];
    const liabilities = d.liabilities?.accounts ?? [];
    const equity      = d.equity?.accounts      ?? [];
    const totalA = Number(d.assets?.total      ?? d.totals?.totalAssets      ?? 0);
    const totalL = Number(d.liabilities?.total ?? d.totals?.totalLiabilities ?? 0);
    const totalE = Number(d.equity?.total      ?? d.totals?.totalEquity      ?? 0);
    const balanced = Math.abs(totalA - totalL - totalE) < 1;

    const section = (title: string, color: string, accounts: any[], total: number, totalLabel: string) => `
      <div class="section">
        <div class="section-header" style="color:${color}">${title}</div>
        ${accounts.map((a: any) => `
          <div class="row">
            <span class="code">${esc(a.code)}</span>
            <span class="name">${esc(a.name)}</span>
            <span class="amount">${fmt(Number(a.balance ?? a.balanceNum ?? 0))}</span>
          </div>`).join('')}
        <div class="row total">
          <span class="code"></span>
          <span class="name">${totalLabel}</span>
          <span class="amount">${fmt(total)}</span>
        </div>
      </div>`;

    return `
      ${section('ACTIVOS', '#1d4ed8', assets, totalA, 'TOTAL ACTIVOS')}
      ${section('PASIVOS', '#dc2626', liabilities, totalL, 'TOTAL PASIVOS')}
      ${section('PATRIMONIO', '#7c3aed', equity, totalE, 'TOTAL PATRIMONIO')}
      <div class="balance-check ${balanced ? 'ok' : 'fail'}">
        ${balanced
          ? `✓ Balance cuadrado — Activos (${fmt(totalA)}) = Pasivos + Patrimonio (${fmt(totalL + totalE)})`
          : `✗ Balance descuadrado — Activos: ${fmt(totalA)} / Pasivos + Patrimonio: ${fmt(totalL + totalE)}`}
      </div>`;
  }

  function buildIncomeStatementHtml(d: any): string {
    const income   = d.income?.accounts   ?? [];
    const expenses = d.expenses?.accounts ?? [];
    const totalI   = Number(d.income?.total   ?? d.totals?.totalIncome   ?? 0);
    const totalE   = Number(d.expenses?.total ?? d.totals?.totalExpenses ?? 0);
    const net      = Number(d.totals?.netIncome ?? (totalI - totalE));

    // Tax simulation (CR 2026)
    let taxHtml = '';
    if (net > 0) {
      const brackets = [
        { limit: 5554000,  rate: 0.05 },
        { limit: 8334000,  rate: 0.10 },
        { limit: 11120000, rate: 0.15 },
        { limit: Infinity, rate: 0.30 },
      ];
      let remaining = net, prev = 0, totalTax = 0;
      const rows: string[] = [];
      for (const b of brackets) {
        if (remaining <= 0) break;
        const taxable = Math.min(remaining, b.limit - prev);
        const tax     = taxable * b.rate;
        const bracket = b.limit === Infinity ? `Más de ₡${prev.toLocaleString('es-CR')}` : `₡${prev.toLocaleString('es-CR')} – ₡${b.limit.toLocaleString('es-CR')}`;
        rows.push(`<tr><td>${bracket}</td><td style="text-align:center;font-weight:bold;color:#b45309">${(b.rate*100).toFixed(0)}%</td><td style="text-align:right">${fmt(taxable)}</td><td style="text-align:right;color:#92400e">${fmt(tax)}</td></tr>`);
        totalTax += tax;
        remaining -= taxable;
        prev = b.limit;
      }
      taxHtml = `
        <div class="section" style="margin-top:24px">
          <div class="section-header" style="color:#b45309">IMPUESTO SOBRE LA RENTA — SIMULACIÓN CR 2026</div>
          <div style="padding:8px 14px;font-size:11px;color:#78350f;font-style:italic">
            SIMULACIÓN EDUCATIVA — No constituye asesoría fiscal
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:12px;padding:0 14px">
            <thead><tr style="color:#6b7280;border-bottom:1px solid #fde68a">
              <th style="text-align:left;padding:4px 14px">Tramo</th>
              <th style="text-align:center;padding:4px">Tasa</th>
              <th style="text-align:right;padding:4px">Base imponible</th>
              <th style="text-align:right;padding:4px 14px">Impuesto</th>
            </tr></thead>
            <tbody>${rows.join('')}</tbody>
          </table>
          <div class="row total" style="color:#991b1b">
            <span class="code"></span><span class="name">Total Impuesto</span><span class="amount">${fmt(totalTax)}</span>
          </div>
          <div class="row total" style="color:#065f46;background:#ecfdf5">
            <span class="code"></span><span class="name">Utilidad neta después de impuestos</span><span class="amount">${fmt(net - totalTax)}</span>
          </div>
        </div>`;
    }

    return `
      <div class="section">
        <div class="section-header" style="color:#059669">INGRESOS</div>
        ${income.map((a: any) => `
          <div class="row">
            <span class="code">${a.code}</span>
            <span class="name">${a.name}</span>
            <span class="amount">${fmt(Number(a.balance ?? a.balanceNum ?? 0))}</span>
          </div>`).join('')}
        <div class="row total"><span class="code"></span><span class="name">TOTAL INGRESOS</span><span class="amount">${fmt(totalI)}</span></div>
      </div>
      <div class="section">
        <div class="section-header" style="color:#dc2626">GASTOS</div>
        ${expenses.map((a: any) => `
          <div class="row">
            <span class="code">${a.code}</span>
            <span class="name">${a.name}</span>
            <span class="amount">${fmt(Number(a.balance ?? a.balanceNum ?? 0))}</span>
          </div>`).join('')}
        <div class="row total"><span class="code"></span><span class="name">TOTAL GASTOS</span><span class="amount">${fmt(totalE)}</span></div>
      </div>
      <div class="row total ${net >= 0 ? 'profit' : 'loss'}">
        <span class="code"></span>
        <span class="name">${net >= 0 ? 'UTILIDAD NETA' : 'PÉRDIDA NETA'}</span>
        <span class="amount">${fmt(net)}</span>
      </div>
      ${taxHtml}`;
  }

  function handlePrint() {
    if (!data) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const isBS     = report === 'balance-sheet';
    const title    = isBS ? 'Balance General' : 'Estado de Resultados';
    const body     = isBS ? buildBalanceSheetHtml(data) : buildIncomeStatementHtml(data);
    const dateStr  = new Date().toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' });
    win.document.write(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>${esc(title)} — ${esc(companyName ?? 'Empresa')}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial', sans-serif; font-size: 12px; color: #111827; background: #fff; padding: 32px 40px; }
  /* ── Header ── */
  .doc-header { text-align: center; margin-bottom: 28px; border-bottom: 2px solid #1e40af; padding-bottom: 16px; }
  .doc-header .company { font-size: 20px; font-weight: bold; color: #1e3a8a; letter-spacing: 0.02em; margin-bottom: 4px; }
  .doc-header .report-title { font-size: 15px; font-weight: 600; color: #374151; margin-bottom: 2px; }
  .doc-header .meta { font-size: 11px; color: #6b7280; }
  /* ── Sections ── */
  .section { margin-bottom: 18px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; page-break-inside: avoid; }
  .section-header { background: #f9fafb; padding: 8px 14px; font-weight: bold; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #e5e7eb; }
  /* ── Rows ── */
  .row { display: flex; align-items: center; padding: 5px 14px; border-top: 1px solid #f3f4f6; gap: 8px; }
  .row:first-child { border-top: none; }
  .code { font-family: monospace; font-size: 11px; color: #6b7280; width: 56px; flex-shrink: 0; }
  .name { flex: 1; color: #374151; }
  .amount { font-family: monospace; font-size: 12px; text-align: right; white-space: nowrap; }
  .row.total { background: #f9fafb; font-weight: bold; font-size: 12px; color: #111827; border-top: 1px solid #d1d5db; }
  .row.total .amount { color: #1e3a8a; }
  .row.profit { background: #ecfdf5; font-weight: bold; font-size: 13px; border: 1px solid #d1fae5; border-radius: 6px; color: #065f46; margin-bottom: 18px; }
  .row.profit .amount { color: #047857; }
  .row.loss { background: #fef2f2; font-weight: bold; font-size: 13px; border: 1px solid #fecaca; border-radius: 6px; color: #991b1b; margin-bottom: 18px; }
  .row.loss .amount { color: #b91c1c; }
  /* ── Balance check ── */
  .balance-check { margin-top: 12px; padding: 10px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; }
  .balance-check.ok   { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .balance-check.fail { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  /* ── Footer ── */
  .doc-footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }
  /* ── Print ── */
  @media print {
    body { padding: 16px 20px; }
    @page { margin: 1.5cm; size: A4 portrait; }
  }
</style></head><body>
  <div class="doc-header">
    <div class="company">${esc(companyName ?? 'Mi Empresa')}</div>
    <div class="report-title">${esc(title)}</div>
    <div class="meta">Al ${dateStr} · ContaSJ — Documento educativo</div>
  </div>
  ${body}
  <div class="doc-footer">
    <span>Generado con ContaSJ · ${dateStr}</span>
    <span>${esc(title)} — ${esc(companyName ?? '')}</span>
  </div>
  <script>window.onload = function() { window.print(); }<\/script>
</body></html>`);
    win.document.close();
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
      <div className="flex gap-2">
        {([
          { id: 'balance-sheet',    label: 'Balance General' },
          { id: 'income-statement', label: 'Estado de Resultados' },
        ] as const).map(({ id, label }) => (
          <button key={id} onClick={() => load(id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              report === id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {label}
          </button>
        ))}
      </div>
      {data && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Server-side Excel export */}
          <button
            onClick={() => handleExport('excel')}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exporting ? 'Exportando…' : 'Excel'}
          </button>
          {/* Server-side PDF export */}
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60 transition-colors shadow-sm"
          >
            <FileText className="w-4 h-4" />
            {exporting ? 'Exportando…' : 'PDF'}
          </button>
          {/* Browser print fallback */}
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : !data ? null : report === 'balance-sheet' ? (
        <div id="print-report-area"><div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">Activos</p>
            {(data.assets?.accounts ?? []).map((a: any) => (
              <ReportRow key={a.id} label={`${a.code} ${a.name}`} value={Number(a.balance ?? a.balanceNum ?? 0)} />
            ))}
            <ReportRow label="Total Activos" value={Number(data.assets?.total ?? data.totals?.totalAssets ?? 0)} bold />
          </div>
          <div className="space-y-4">
            <div className="bg-red-50 rounded-xl p-4 border border-red-100">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-3">Pasivos</p>
              {(data.liabilities?.accounts ?? []).map((a: any) => (
                <ReportRow key={a.id} label={`${a.code} ${a.name}`} value={Number(a.balance ?? a.balanceNum ?? 0)} />
              ))}
              <ReportRow label="Total Pasivos" value={Number(data.liabilities?.total ?? data.totals?.totalLiabilities ?? 0)} bold />
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">Patrimonio</p>
              {(data.equity?.accounts ?? []).map((a: any) => (
                <ReportRow key={a.id} label={`${a.code} ${a.name}`} value={Number(a.balance ?? a.balanceNum ?? 0)} />
              ))}
              <ReportRow label="Total Patrimonio" value={Number(data.equity?.total ?? data.totals?.totalEquity ?? 0)} bold />
            </div>
          </div>
        </div></div>
      ) : (
        <div id="print-report-area">
          <div className="bg-emerald-50 rounded-xl p-4 max-w-md border border-emerald-100">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-3">Estado de Resultados</p>
            <ReportRow label="Ingresos totales"  value={Number(data.income?.total  ?? data.totals?.totalIncome   ?? 0)} />
            <ReportRow label="Gastos totales"    value={Number(data.expenses?.total ?? data.totals?.totalExpenses ?? 0)} />
            <ReportRow label="Utilidad neta"     value={Number(data.totals?.netIncome ?? 0)} bold />
          </div>
          {/* Feature 9: Income Tax Simulation */}
          {(() => {
            const netIncome = Number(data.totals?.netIncome ?? 0);
            if (netIncome <= 0) return null;
            // CR 2026 progressive brackets
            const brackets = [
              { limit: 5554000, rate: 0.05 },
              { limit: 8334000, rate: 0.10 },
              { limit: 11120000, rate: 0.15 },
              { limit: Infinity, rate: 0.30 },
            ];
            let remaining = netIncome;
            let prev = 0;
            let totalTax = 0;
            const rows: { bracket: string; rate: string; taxable: number; tax: number }[] = [];
            for (const b of brackets) {
              if (remaining <= 0) break;
              const taxable = Math.min(remaining, b.limit - prev);
              const tax = taxable * b.rate;
              rows.push({ bracket: b.limit === Infinity ? `Más de ₡${prev.toLocaleString('es-CR')}` : `₡${prev.toLocaleString('es-CR')} – ₡${b.limit.toLocaleString('es-CR')}`, rate: `${(b.rate*100).toFixed(0)}%`, taxable, tax });
              totalTax += tax;
              remaining -= taxable;
              prev = b.limit;
            }
            const netAfterTax = netIncome - totalTax;
            return (
              <div className="mt-6 bg-amber-50 rounded-xl p-4 max-w-xl border border-amber-100">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Impuesto sobre la Renta (Simulado CR 2026)</p>
                <p className="text-xs text-amber-500 mb-3 italic">SIMULACIÓN EDUCATIVA — No constituye asesoría fiscal</p>
                <table className="w-full text-xs mb-3">
                  <thead><tr className="text-gray-500 border-b border-amber-200">
                    <th className="text-left py-1">Tramo</th>
                    <th className="text-center py-1">Tasa</th>
                    <th className="text-right py-1">Base imponible</th>
                    <th className="text-right py-1">Impuesto</th>
                  </tr></thead>
                  <tbody>
                    {rows.map((r,i) => (
                      <tr key={i} className="border-b border-amber-100">
                        <td className="py-1 text-gray-600">{r.bracket}</td>
                        <td className="py-1 text-center font-bold text-amber-700">{r.rate}</td>
                        <td className="py-1 text-right">₡{r.taxable.toLocaleString('es-CR',{minimumFractionDigits:2})}</td>
                        <td className="py-1 text-right text-amber-800">₡{r.tax.toLocaleString('es-CR',{minimumFractionDigits:2})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-between font-semibold text-sm border-t border-amber-300 pt-2">
                  <span>Total Impuesto:</span><span className="text-red-700">₡{totalTax.toLocaleString('es-CR',{minimumFractionDigits:2})}</span>
                </div>
                <div className="flex justify-between font-bold text-sm mt-1">
                  <span>Utilidad neta después de impuestos:</span><span className="text-emerald-700">₡{netAfterTax.toLocaleString('es-CR',{minimumFractionDigits:2})}</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
// ─── Bank tab ─────────────────────────────────────────────────────────────────
export function BankTab({ companyId, readonly }: { companyId: string; readonly: boolean }) {
  const [txs, setTxs]           = useState<BankTx[]>([]);
  const [summary, setSummary]   = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [importing, setImporting] = useState(false);
  const [form, setForm]         = useState({ date: '', description: '', amount: '', type: 'CREDIT', reference: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    Promise.all([
      api.get<BankTx[]>(`/api/v1/companies/${companyId}/bank`),
      api.get(`/api/v1/companies/${companyId}/bank/summary`),
    ]).then(([txRes, sumRes]) => { setTxs(txRes.data); setSummary(sumRes.data); })
      .catch(() => toast.error('Error al cargar movimientos bancarios'))
      .finally(() => setLoading(false));
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date || !form.description || !form.amount) { toast.error('Completa todos los campos'); return; }
    setSaving(true);
    try {
      await api.post(`/api/v1/companies/${companyId}/bank`, {
        date: form.date, description: form.description,
        amount: Number(form.amount), type: form.type,
        reference: form.reference || undefined,
      });
      toast.success('Movimiento registrado');
      setShowModal(false);
      setForm({ date: '', description: '', amount: '', type: 'CREDIT', reference: '' });
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  }

  async function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const text = await file.text();
      const rows = text.split('\n').map((r) => r.trim()).filter(Boolean);
      // Skip header row if it starts with non-date text
      const dataRows = rows[0]?.toLowerCase().startsWith('fecha') ? rows.slice(1) : rows;
      const items = dataRows.map((row) => {
        const cols = row.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        // Expected: fecha, descripcion, monto, tipo(CREDIT/DEBIT/C/D/E/S), referencia?
        const [date, description, amount, type, reference] = cols;
        const typeNorm = (type ?? '').toUpperCase();
        const txType = typeNorm === 'C' || typeNorm === 'CREDIT' || typeNorm === 'E' || typeNorm === 'ENTRADA' ? 'CREDIT' : 'DEBIT';
        return { date, description, amount: Number(amount) || 0, type: txType, reference: reference || undefined };
      }).filter((r) => r.date && r.description && r.amount > 0);
      if (items.length === 0) { toast.error('No se encontraron filas válidas en el CSV'); return; }
      const { data } = await api.post(`/api/v1/companies/${companyId}/bank/import`, { items });
      toast.success(`${(data as any).count} movimientos importados`);
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setImporting(false); }
  }

  async function toggleReconciled(tx: BankTx) {
    try {
      await api.patch(`/api/v1/companies/${companyId}/bank/${tx.id}`, { isReconciled: !tx.isReconciled });
      load();
    } catch { toast.error('Error al actualizar'); }
  }

  async function remove(tx: BankTx) {
    try {
      await api.delete(`/api/v1/companies/${companyId}/bank/${tx.id}`);
      toast.success('Eliminado');
      load();
    } catch { toast.error('Error al eliminar'); }
  }

  const fmtMoney = (v: string | number) =>
    `₡${Number(v).toLocaleString('es-CR', { minimumFractionDigits: 2 })}`;

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  return (
    <div>
      {showModal && !readonly && (
        <Modal title="Nuevo movimiento bancario" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Fecha *</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Tipo *</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="CREDIT">Crédito (entrada)</option>
                  <option value="DEBIT">Débito (salida)</option>
                </select>
              </div>
            </div>
            <Input label="Descripción *" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ej. Depósito cliente" />
            <Input label="Monto *" type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
            <Input label="Referencia" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="Número de transacción (opcional)" />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" loading={saving} className="flex-1">Registrar</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Entradas',    value: fmtMoney(summary.credits), color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
            { label: 'Salidas',     value: fmtMoney(summary.debits),  color: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
            { label: 'Saldo banco', value: fmtMoney(summary.balance), color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
            { label: 'Conciliados', value: `${summary.reconciled}/${summary.total}`, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-4 text-center border ${s.bg}`}>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{txs.length} movimiento{txs.length !== 1 ? 's' : ''}</p>
        {!readonly && (
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCSV} />
            <button onClick={() => fileRef.current?.click()} disabled={importing}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 bg-white rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50">
              <Upload className="w-3.5 h-3.5" />
              {importing ? 'Importando...' : 'Importar CSV'}
            </button>
            <Button size="sm" onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4" /> Nuevo movimiento
            </Button>
          </div>
        )}
      </div>

      {txs.length === 0 ? (
        <div className="text-center py-10">
          <Landmark className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No hay movimientos bancarios aún</p>
          {!readonly && <p className="text-gray-400 text-xs mt-1">Registra los movimientos de tu cuenta bancaria</p>}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-200">
                  <th className="text-left p-4">Fecha</th>
                  <th className="text-left p-4">Descripción</th>
                  <th className="text-left p-4">Ref.</th>
                  <th className="text-right p-4">Monto</th>
                  <th className="text-center p-4">Tipo</th>
                  <th className="text-center p-4">Conciliado</th>
                  {!readonly && <th className="p-4" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {txs.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-gray-500 text-xs">{formatDate(tx.date)}</td>
                    <td className="p-4 text-gray-700 font-medium">{tx.description}</td>
                    <td className="p-4 text-gray-400 text-xs font-mono">{tx.reference ?? '—'}</td>
                    <td className={`p-4 text-right font-semibold ${tx.type === 'CREDIT' ? 'text-emerald-700' : 'text-red-700'}`}>
                      {tx.type === 'DEBIT' ? '-' : '+'}{fmtMoney(tx.amount)}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        tx.type === 'CREDIT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {tx.type === 'CREDIT' ? 'Entrada' : 'Salida'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {!readonly ? (
                        <button onClick={() => toggleReconciled(tx)} title="Marcar conciliado"
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mx-auto transition-colors ${
                            tx.isReconciled ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-emerald-400'
                          }`}>
                          {tx.isReconciled && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </button>
                      ) : (
                        <span>{tx.isReconciled ? '✓' : '—'}</span>
                      )}
                    </td>
                    {!readonly && (
                      <td className="p-4">
                        <button onClick={() => remove(tx)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
// ─── Mayorización tab ─────────────────────────────────────────────────────────
export function MayorizacionTab({ companyId }: { companyId: string }) {
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<LedgerAccount[]>(`/api/v1/companies/${companyId}/ledger`)
      .then(({ data }) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Error al cargar datos'))
      .finally(() => setLoading(false));
  }, [companyId]);

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;
  if (accounts.length === 0) return (
    <div className="text-center py-10">
      <Scale className="w-8 h-8 text-gray-300 mx-auto mb-2" />
      <p className="text-gray-500 text-sm">No hay cuentas con movimientos aún</p>
    </div>
  );

  const totalD = accounts.reduce((s, a) => s + Number(a.totalDebit), 0);
  const totalC = accounts.reduce((s, a) => s + Number(a.totalCredit), 0);
  const balanced = Math.abs(totalD - totalC) < 0.01;

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">Cuentas T — resumen de movimientos por cuenta</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {accounts.map((acc) => (
          <div key={acc.accountId} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 text-center">
              <p className="text-xs font-mono text-gray-400">{acc.code}</p>
              <p className="text-sm font-semibold text-gray-800 truncate">{acc.name}</p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-200">
              <div className="p-3 text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">DEBE</p>
                <p className="text-sm font-bold text-blue-700">₡{Number(acc.totalDebit).toLocaleString('es-CR', { minimumFractionDigits: 0 })}</p>
              </div>
              <div className="p-3 text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">HABER</p>
                <p className="text-sm font-bold text-red-600">₡{Number(acc.totalCredit).toLocaleString('es-CR', { minimumFractionDigits: 0 })}</p>
              </div>
            </div>
            <div className="border-t border-dashed border-gray-300 px-4 py-2 text-center bg-gray-50">
              <span className="text-xs text-gray-500">Saldo: </span>
              <span className="text-sm font-bold text-gray-800">₡{Number(acc.balance).toLocaleString('es-CR', { minimumFractionDigits: 0 })}</span>
              <span className="text-xs text-gray-400 ml-1">({acc.normalBalance === 'DEBIT' ? 'D' : 'H'})</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 justify-end flex-wrap">
        {[
          { label: 'Total Débitos',  value: totalD, color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { label: 'Total Créditos', value: totalC, color: 'bg-red-50 border-red-200 text-red-700' },
        ].map((s) => (
          <div key={s.label} className={`border rounded-xl px-5 py-3 text-center ${s.color}`}>
            <p className="text-xs opacity-70">{s.label}</p>
            <p className="text-base font-bold">₡{s.value.toLocaleString('es-CR', { minimumFractionDigits: 0 })}</p>
          </div>
        ))}
        <div className={`border rounded-xl px-5 py-3 text-center ${balanced ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className="text-xs text-gray-500">Verificación</p>
          <p className={`text-sm font-bold ${balanced ? 'text-emerald-700' : 'text-amber-700'}`}>
            {balanced ? '✓ Cuadra' : `⚠ Dif: ₡${Math.abs(totalD - totalC).toLocaleString('es-CR')}`}
          </p>
        </div>
      </div>
    </div>
  );
}
// ─── Balance de Comprobación (reusable) ───────────────────────────────────────
export function BalanceComprobacionTab({
  companyId, filterTypes, note,
}: { companyId: string; filterTypes?: string[]; note?: string }) {
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<LedgerAccount[]>(`/api/v1/companies/${companyId}/ledger`)
      .then(({ data }) => {
        let accs = Array.isArray(data) ? data : [];
        if (filterTypes && filterTypes.length > 0) accs = accs.filter((a) => filterTypes.includes(a.type));
        setAccounts(accs);
      })
      .catch(() => toast.error('Error al cargar datos'))
      .finally(() => setLoading(false));
  }, [companyId]);

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  const totalD = accounts.reduce((s, a) => s + Number(a.totalDebit), 0);
  const totalC = accounts.reduce((s, a) => s + Number(a.totalCredit), 0);
  const balanced = Math.abs(totalD - totalC) < 0.01;

  const typeLabels: Record<string, string> = { ASSET: 'Activo', LIABILITY: 'Pasivo', EQUITY: 'Patrimonio', INCOME: 'Ingreso', EXPENSE: 'Gasto' };
  const typeColors: Record<string, string> = { ASSET: 'text-blue-700', LIABILITY: 'text-red-600', EQUITY: 'text-slate-600', INCOME: 'text-emerald-600', EXPENSE: 'text-amber-600' };

  if (accounts.length === 0) return (
    <div className="text-center py-10">
      <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
      <p className="text-gray-500 text-sm">No hay cuentas con movimientos aún</p>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <p className="text-sm text-gray-500">{accounts.length} cuentas</p>
          {note && <p className="text-xs text-blue-700 mt-0.5">{note}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={async () => {
              try {
                const response = await api.get(
                  `/api/v1/companies/${companyId}/reports/trial-balance/excel`,
                  { responseType: 'blob' },
                );
                const date = new Date().toISOString().split('T')[0];
                const url  = URL.createObjectURL(new Blob([response.data]));
                const a    = document.createElement('a');
                a.href     = url;
                a.download = `balance-comprobacion-${date}.xlsx`;
                a.click();
                URL.revokeObjectURL(url);
              } catch {
                toast.error('Error al exportar');
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium ${
            balanced ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            {balanced ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {balanced ? 'ΣDébitos = ΣCréditos ✓' : 'No balanceado ⚠'}
          </div>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left p-4">Código</th>
                <th className="text-left p-4">Cuenta</th>
                <th className="text-left p-4">Tipo</th>
                <th className="text-right p-4">Débitos</th>
                <th className="text-right p-4">Créditos</th>
                <th className="text-right p-4">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map((acc) => (
                <tr key={acc.accountId} className="hover:bg-gray-50">
                  <td className="p-4 font-mono text-xs text-gray-400">{acc.code}</td>
                  <td className="p-4 font-medium text-gray-700">{acc.name}</td>
                  <td className="p-4"><span className={`text-xs font-medium ${typeColors[acc.type] ?? 'text-gray-500'}`}>{typeLabels[acc.type] ?? acc.type}</span></td>
                  <td className="p-4 text-right font-mono text-xs text-blue-700">₡{Number(acc.totalDebit).toLocaleString('es-CR', { minimumFractionDigits: 2 })}</td>
                  <td className="p-4 text-right font-mono text-xs text-red-600">₡{Number(acc.totalCredit).toLocaleString('es-CR', { minimumFractionDigits: 2 })}</td>
                  <td className="p-4 text-right font-mono text-xs font-bold text-gray-800">₡{Number(acc.balance).toLocaleString('es-CR', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-400 font-bold text-sm">
                <td colSpan={3} className="p-4 text-gray-700 uppercase tracking-wide text-xs">Totales</td>
                <td className="p-4 text-right font-mono text-blue-700">₡{totalD.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</td>
                <td className="p-4 text-right font-mono text-red-700">₡{totalC.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</td>
                <td className="p-4" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
// ─── Asientos especiales (Ajustes / Cierre) ───────────────────────────────────
export function SpecialJournalTab({
  companyId, readonly, attemptId, prefix, emptyLabel,
}: { companyId: string; readonly: boolean; attemptId?: string; prefix: 'ADJ' | 'CIER'; emptyLabel: string }) {
  const [entries, setEntries]   = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({ entryDate: new Date().toISOString().split('T')[0], description: '', reference: '' });
  const [lines, setLines] = useState([{ accountId: '', debit: '', credit: '' }, { accountId: '', debit: '', credit: '' }]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ent, acc] = await Promise.all([
        api.get<any>(`/api/v1/companies/${companyId}/journal`),
        api.get<Account[]>(`/api/v1/companies/${companyId}/accounts`),
      ]);
      const all: JournalEntry[] = Array.isArray(ent.data) ? ent.data : (ent.data?.entries ?? []);
      setEntries(all.filter((e) => e.reference?.startsWith(`${prefix}-`)));
      setAccounts((acc.data as Account[]).filter((a) => a.level >= 4 && !a.isHeader));
    } catch { toast.error('Error al cargar asientos'); }
    finally { setLoading(false); }
  }, [companyId, prefix]);

  useEffect(() => { load(); }, [load]);

  function addLine() { setLines([...lines, { accountId: '', debit: '', credit: '' }]); }
  function removeLine(i: number) { if (lines.length > 2) setLines(lines.filter((_, idx) => idx !== i)); }
  function updateLine(i: number, field: string, val: string) {
    setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  }
  const totalDebit  = lines.reduce((s, l) => s + (Number(l.debit)  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim()) { toast.error('Ingresa una descripción'); return; }
    if (!balanced) { toast.error('El asiento debe estar balanceado'); return; }
    const validLines = lines.filter((l) => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (validLines.length < 2) { toast.error('Se necesitan al menos 2 líneas'); return; }
    setSaving(true);
    try {
      const ref = `${prefix}-${form.reference || String(entries.length + 1).padStart(3, '0')}`;
      await api.post(`/api/v1/companies/${companyId}/journal`, {
        entryDate:   form.entryDate,
        description: form.description,
        reference:   ref,
        lines: validLines.map((l) => ({ accountId: l.accountId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
      });
      if (attemptId) api.post(`/api/v1/attempts/${attemptId}/track`, { event: 'JOURNAL_ENTRY_SAVED', metadata: { type: prefix } }).catch(() => {});
      toast.success('Asiento registrado');
      setShowModal(false);
      setLines([{ accountId: '', debit: '', credit: '' }, { accountId: '', debit: '', credit: '' }]);
      setForm({ entryDate: new Date().toISOString().split('T')[0], description: '', reference: '' });
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  const modalTitle = prefix === 'ADJ' ? 'Nuevo Asiento de Ajuste' : 'Nuevo Asiento de Cierre';

  return (
    <div>
      {showModal && !readonly && (
        <Modal title={modalTitle} onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Fecha" type="date" value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })} />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Referencia</label>
                <div className="flex items-center gap-1">
                  <span className="text-xs bg-gray-100 border border-gray-200 rounded-xl px-2 py-2.5 text-gray-500 font-mono flex-shrink-0">{prefix}-</span>
                  <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    placeholder="001" className="flex-1 rounded-xl bg-white border border-gray-300 text-gray-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            <Input label="Descripción *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={`Descripción del asiento de ${prefix === 'ADJ' ? 'ajuste' : 'cierre'}`} />
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Partidas</label>
                <button type="button" onClick={addLine} className="text-xs text-blue-700 hover:text-blue-700">+ Agregar línea</button>
              </div>
              <div className="space-y-2">
                {lines.map((line, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6">
                      <select value={line.accountId} onChange={(e) => updateLine(i, 'accountId', e.target.value)}
                        className="w-full rounded-lg bg-white border border-gray-300 text-gray-900 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="">Cuenta...</option>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input type="number" value={line.debit} onChange={(e) => updateLine(i, 'debit', e.target.value)}
                        placeholder="Débito" min="0" step="0.01"
                        className="w-full rounded-lg bg-white border border-gray-300 text-gray-900 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div className="col-span-2">
                      <input type="number" value={line.credit} onChange={(e) => updateLine(i, 'credit', e.target.value)}
                        placeholder="Crédito" min="0" step="0.01"
                        className="w-full rounded-lg bg-white border border-gray-300 text-gray-900 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <button type="button" onClick={() => removeLine(i)} disabled={lines.length <= 2}
                        className="text-gray-400 hover:text-red-600 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className={`mt-2 text-xs flex gap-4 ${balanced ? 'text-emerald-600' : 'text-amber-600'}`}>
                <span>Débitos: ₡{totalDebit.toFixed(2)}</span>
                <span>Créditos: ₡{totalCredit.toFixed(2)}</span>
                {balanced && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Balanceado</span>}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" loading={saving} disabled={!balanced} className="flex-1">Registrar</Button>
            </div>
          </form>
        </Modal>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{entries.length} asiento{entries.length !== 1 ? 's' : ''}</p>
        {!readonly && (
          <Button size="sm" onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> Nuevo asiento</Button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-10">
          <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">{emptyLabel}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-700">{entry.description}</p>
                  {entry.reference && <p className="text-xs text-gray-500 font-mono">Ref: {entry.reference}</p>}
                </div>
                <span className="text-xs text-gray-400">{formatDate(entry.entryDate)}</span>
              </div>
              <table className="w-full text-xs">
                <thead><tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left p-3">Cuenta</th>
                  <th className="text-right p-3">Débito</th>
                  <th className="text-right p-3">Crédito</th>
                </tr></thead>
                <tbody>
                  {entry.lines.map((line, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="p-3 text-gray-600"><span className="font-mono text-gray-400">{line.account.code}</span> {line.account.name}</td>
                      <td className="p-3 text-right text-gray-700">{Number(line.debit)  > 0 ? `₡${Number(line.debit).toLocaleString('es-CR',  { minimumFractionDigits: 2 })}` : '—'}</td>
                      <td className="p-3 text-right text-gray-700">{Number(line.credit) > 0 ? `₡${Number(line.credit).toLocaleString('es-CR', { minimumFractionDigits: 2 })}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ─── Fixed Assets Tab (Feature 6) ─────────────────────────────────────────────
export function FixedAssetsTab({ companyId }: { companyId: string }) {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [depreciating, setDepreciating] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', acquisitionDate: new Date().toISOString().split('T')[0], acquisitionCost: '', salvageValue: '0', usefulLifeYears: '5', depreciationMethod: 'STRAIGHT_LINE' });

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/api/v1/companies/${companyId}/fixed-assets`)
      .then(({ data }) => setAssets(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Error al cargar activos fijos'))
      .finally(() => setLoading(false));
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.acquisitionCost) { toast.error('Completa los campos requeridos'); return; }
    setSaving(true);
    try {
      await api.post(`/api/v1/companies/${companyId}/fixed-assets`, {
        name: form.name, description: form.description || undefined,
        acquisitionDate: form.acquisitionDate, acquisitionCost: Number(form.acquisitionCost),
        salvageValue: Number(form.salvageValue) || 0, usefulLifeYears: Number(form.usefulLifeYears),
        depreciationMethod: form.depreciationMethod,
      });
      toast.success('Activo fijo creado');
      setShowModal(false);
      setForm({ name: '', description: '', acquisitionDate: new Date().toISOString().split('T')[0], acquisitionCost: '', salvageValue: '0', usefulLifeYears: '5', depreciationMethod: 'STRAIGHT_LINE' });
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  }

  async function handleDepreciate(assetId: string) {
    const period = new Date().toISOString().slice(0, 7); // YYYY-MM
    setDepreciating(assetId);
    try {
      await api.post(`/api/v1/companies/${companyId}/fixed-assets/${assetId}/depreciate`, { period });
      toast.success(`Depreciación de ${period} registrada`);
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDepreciating(null); }
  }

  const methodLabels: Record<string, string> = { STRAIGHT_LINE: 'Línea recta', SUM_OF_DIGITS: 'Suma de dígitos', DOUBLE_DECLINING: 'Doble saldo' };

  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  return (
    <div>
      {showModal && (
        <Modal title="Nuevo Activo Fijo" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input label="Nombre *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Computadora portátil" />
            <Input label="Descripción" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Opcional" />
            <Input label="Fecha de adquisición *" type="date" value={form.acquisitionDate} onChange={e => setForm({ ...form, acquisitionDate: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Costo de adquisición *" type="number" min="0" step="0.01" value={form.acquisitionCost} onChange={e => setForm({ ...form, acquisitionCost: e.target.value })} placeholder="0.00" />
              <Input label="Valor residual" type="number" min="0" step="0.01" value={form.salvageValue} onChange={e => setForm({ ...form, salvageValue: e.target.value })} placeholder="0.00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Vida útil (años) *" type="number" min="1" value={form.usefulLifeYears} onChange={e => setForm({ ...form, usefulLifeYears: e.target.value })} />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Método</label>
                <select value={form.depreciationMethod} onChange={e => setForm({ ...form, depreciationMethod: e.target.value })}
                  className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="STRAIGHT_LINE">Línea recta</option>
                  <option value="SUM_OF_DIGITS">Suma de dígitos</option>
                  <option value="DOUBLE_DECLINING">Doble saldo decreciente</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" loading={saving} className="flex-1">Crear activo</Button>
            </div>
          </form>
        </Modal>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{assets.length} activo{assets.length !== 1 ? 's' : ''} fijo{assets.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> Nuevo activo</Button>
      </div>

      {assets.length === 0 ? (
        <div className="text-center py-10">
          <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No hay activos fijos registrados</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assets.map((asset: any) => (
            <div key={asset.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
                <div>
                  <p className="font-semibold text-gray-800">{asset.name}</p>
                  {asset.description && <p className="text-xs text-gray-500">{asset.description}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">Método: {methodLabels[asset.depreciationMethod] ?? asset.depreciationMethod} · Vida útil: {asset.usefulLifeYears} años</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => handleDepreciate(asset.id)} loading={depreciating === asset.id}>
                  Depreciar este mes
                </Button>
              </div>
              <div className="grid grid-cols-3 divide-x divide-gray-100 text-center p-3">
                {[
                  { label: 'Costo', value: Number(asset.acquisitionCost), color: 'text-gray-700' },
                  { label: 'Depreciación acum.', value: Number(asset.accumulatedDeprec), color: 'text-red-600' },
                  { label: 'Valor en libros', value: Number(asset.bookValue), color: 'text-blue-700' },
                ].map(s => (
                  <div key={s.label} className="px-2">
                    <p className={`text-sm font-bold ${s.color}`}>₡{s.value.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-gray-400">{s.label}</p>
                  </div>
                ))}
              </div>
              {asset.depreciationRecords?.length > 0 && (
                <div className="border-t border-gray-100 p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Historial de depreciaciones</p>
                  <table className="w-full text-xs">
                    <thead><tr className="text-gray-400 border-b border-gray-100">
                      <th className="text-left pb-1">Período</th>
                      <th className="text-right pb-1">Monto</th>
                      <th className="text-right pb-1">Valor libros</th>
                    </tr></thead>
                    <tbody>
                      {asset.depreciationRecords.map((r: any) => (
                        <tr key={r.id} className="border-b border-gray-50">
                          <td className="py-1 text-gray-600 font-mono">{r.period}</td>
                          <td className="py-1 text-right text-red-600">₡{Number(r.amount).toLocaleString('es-CR',{minimumFractionDigits:2})}</td>
                          <td className="py-1 text-right text-gray-700">₡{Number(r.bookValueAfter).toLocaleString('es-CR',{minimumFractionDigits:2})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ─── Payroll Tab — CCSS Costa Rica 2026 ──────────────────────────────────────
function PayrollBreakdownModal({ line, onClose }: { line: any; onClose: () => void }) {
  const emp  = line.employee ?? {};
  const bd   = line.breakdown ?? {};
  const pat  = bd.patrono  ?? {};
  const trab = bd.trabajador ?? {};
  const tax  = bd.taxBrackets ?? [];
  return (
    <Modal title={`Detalle de nómina — ${emp.name ?? 'Empleado'}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        {/* Ingresos */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="font-semibold text-gray-700 mb-2">Ingresos</p>
          <div className="flex justify-between"><span className="text-gray-500">Salario bruto</span><span className="font-mono">{fmt(line.salaryGross)}</span></div>
          {Number(line.overtime) > 0 && <div className="flex justify-between"><span className="text-gray-500">Horas extra</span><span className="font-mono">{fmt(line.overtime)}</span></div>}
          {Number(line.bonus) > 0 && <div className="flex justify-between"><span className="text-gray-500">Bonificación</span><span className="font-mono">{fmt(line.bonus)}</span></div>}
          <div className="flex justify-between font-semibold border-t border-gray-200 mt-1 pt-1"><span>Total bruto</span><span className="font-mono">{fmt(line.totalGross)}</span></div>
        </div>

        {/* Deducciones trabajador */}
        <div className="bg-orange-50 rounded-lg p-3">
          <p className="font-semibold text-orange-700 mb-2">Deducciones del trabajador</p>
          <p className="text-xs text-gray-500 font-medium mb-1">CCSS Trabajador (10.34%)</p>
          <div className="flex justify-between text-xs"><span className="text-gray-500">SEM 5.50%</span><span className="font-mono">{fmt(trab.sem ?? 0)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-gray-500">IVM 3.84%</span><span className="font-mono">{fmt(trab.ivm ?? 0)}</span></div>
          <div className="flex justify-between text-xs border-b border-orange-200 pb-1 mb-1"><span className="text-gray-500">Banco Popular 1.00%</span><span className="font-mono">{fmt(trab.bancoPop ?? 0)}</span></div>
          <div className="flex justify-between text-xs font-semibold text-orange-800"><span>Subtotal CCSS</span><span className="font-mono">{fmt(trab.total ?? 0)}</span></div>

          {Number(line.rentaDeduccion) > 0 && (
            <>
              <p className="text-xs text-gray-500 font-medium mt-2 mb-1">Impuesto sobre la Renta (escalas)</p>
              {tax.map((b: any, i: number) => b.amount > 0 && (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-gray-500">{(b.rate*100).toFixed(0)}% sobre {fmt(b.from)} – {b.to ? fmt(b.to) : '∞'}</span>
                  <span className="font-mono">{fmt(b.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs font-semibold text-orange-800 border-t border-orange-200 pt-1 mt-1">
                <span>Subtotal renta</span><span className="font-mono">{fmt(line.rentaDeduccion)}</span>
              </div>
            </>
          )}

          <div className="flex justify-between font-semibold border-t border-orange-300 mt-2 pt-1 text-orange-900">
            <span>Total deducciones</span><span className="font-mono">{fmt(line.totalDeductions)}</span>
          </div>
          <div className="flex justify-between font-bold text-emerald-700 mt-1">
            <span>Salario neto</span><span className="font-mono">{fmt(line.netSalary)}</span>
          </div>
        </div>

        {/* Cargas patronales */}
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="font-semibold text-blue-700 mb-2">Cargas Sociales Patronales (22.17%)</p>
          <div className="flex justify-between text-xs"><span className="text-gray-500">SEM 9.25%</span><span className="font-mono">{fmt(pat.sem ?? 0)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-gray-500">IVM 5.42%</span><span className="font-mono">{fmt(pat.ivm ?? 0)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-gray-500">Banco Popular 0.25%</span><span className="font-mono">{fmt(pat.bancoPop ?? 0)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-gray-500">ASFA 0.50%</span><span className="font-mono">{fmt(pat.asfa ?? 0)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-gray-500">FODESAF 0.50%</span><span className="font-mono">{fmt(pat.fodesaf ?? 0)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-gray-500">INA 1.50%</span><span className="font-mono">{fmt(pat.ina ?? 0)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-gray-500">FCL 3.00%</span><span className="font-mono">{fmt(pat.fcl ?? 0)}</span></div>
          <div className="flex justify-between text-xs border-b border-blue-200 pb-1 mb-1"><span className="text-gray-500">INS 1.75%</span><span className="font-mono">{fmt(pat.ins ?? 0)}</span></div>
          <div className="flex justify-between text-xs font-semibold text-blue-800"><span>Subtotal CCSS patrono</span><span className="font-mono">{fmt(pat.total ?? 0)}</span></div>
          <div className="flex justify-between text-xs mt-1"><span className="text-gray-500">Aguinaldo prov. 8.33%</span><span className="font-mono">{fmt(line.aguinaldo)}</span></div>
          <div className="flex justify-between font-bold text-blue-900 border-t border-blue-300 mt-2 pt-1">
            <span>Costo total empleador</span><span className="font-mono">{fmt(line.totalEmployerCost)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function PayrollTab({ companyId }: { companyId: string }) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [section, setSection] = useState<'employees' | 'process' | 'history'>('employees');
  const [employees, setEmployees]   = useState<any[]>([]);
  const [payrolls, setPayrolls]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showEmpModal, setShowEmpModal]   = useState(false);
  const [savingEmp, setSavingEmp]         = useState(false);
  const [processing, setProcessing]       = useState(false);
  const [previewData, setPreviewData]     = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [detailLine, setDetailLine]       = useState<any | null>(null);
  const [expandedPayroll, setExpandedPayroll] = useState<string | null>(null);

  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [period, setPeriod] = useState(defaultPeriod);

  const [empForm, setEmpForm] = useState({
    name: '', identification: '', position: '', department: '', salary: '',
    startDate: now.toISOString().split('T')[0],
  });

  // ── Load data ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, payRes] = await Promise.all([
        api.get(`/api/v1/companies/${companyId}/employees`),
        api.get(`/api/v1/companies/${companyId}/payrolls`),
      ]);
      setEmployees(Array.isArray(empRes.data) ? empRes.data : []);
      setPayrolls(Array.isArray(payRes.data) ? payRes.data : []);
    } catch { toast.error('Error al cargar nómina'); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleCreateEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!empForm.name || !empForm.identification || !empForm.salary) {
      toast.error('Nombre, cédula y salario son requeridos'); return;
    }
    if (Number(empForm.salary) < SALARIO_MINIMO_2026) {
      const ok = window.confirm(
        `El salario ₡${Number(empForm.salary).toLocaleString('es-CR')} es menor al salario mínimo legal 2026 (₡${SALARIO_MINIMO_2026.toLocaleString('es-CR')}). ¿Continuar de todas formas?`
      );
      if (!ok) return;
    }
    setSavingEmp(true);
    try {
      await api.post(`/api/v1/companies/${companyId}/employees`, {
        name:           empForm.name,
        identification: empForm.identification,
        position:       empForm.position   || undefined,
        department:     empForm.department || undefined,
        salary:         Number(empForm.salary),
        startDate:      empForm.startDate,
      });
      toast.success('Empleado registrado');
      setShowEmpModal(false);
      setEmpForm({ name: '', identification: '', position: '', department: '', salary: '', startDate: now.toISOString().split('T')[0] });
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSavingEmp(false); }
  }

  async function handlePreview() {
    if (!period) { toast.error('Selecciona el período'); return; }
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const res = await api.post(`/api/v1/companies/${companyId}/payrolls/preview`, { period });
      setPreviewData(res.data);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setPreviewLoading(false); }
  }

  async function handleProcessPayroll() {
    if (!previewData) return;
    setProcessing(true);
    try {
      await api.post(`/api/v1/companies/${companyId}/payrolls`, { period });
      toast.success(`Planilla ${period} procesada y asiento contable registrado`);
      setPreviewData(null);
      setSection('history');
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setProcessing(false); }
  }

  async function handleDeleteEmployee(empId: string, name: string) {
    if (!window.confirm(`¿Desactivar al empleado "${name}"?`)) return;
    try {
      await api.delete(`/api/v1/companies/${companyId}/employees/${empId}`);
      toast.success('Empleado desactivado');
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
  }

  // ── CCSS summary from latest payroll ──────────────────────────────────────
  const latestPayroll = payrolls[0] ?? null;
  const ccssPayable = latestPayroll
    ? Number(latestPayroll.totalPatrono) + Number(latestPayroll.totalTrabajador)
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;

  return (
    <div className="space-y-5">
      {/* CCSS Summary card */}
      {ccssPayable !== null && (
        <div className="bg-blue-600 text-white rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-100">CCSS a pagar — {latestPayroll.period}</p>
            <p className="text-2xl font-bold mt-0.5">{fmt(ccssPayable)}</p>
            <p className="text-xs text-blue-200 mt-0.5">
              Trabajadores: {fmt(latestPayroll.totalTrabajador)} &nbsp;|&nbsp; Patrono: {fmt(latestPayroll.totalPatrono)}
            </p>
          </div>
          <div className="text-right text-xs text-blue-100 shrink-0">
            <p className="font-semibold">Vence el día 15</p>
            <p>del mes siguiente</p>
            <p className="mt-1 text-blue-200">Formulario D-121 CCSS</p>
          </div>
        </div>
      )}

      {/* Section tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['employees', 'process', 'history'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              section === s ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s === 'employees' ? `Empleados (${employees.length})` : s === 'process' ? 'Procesar Planilla' : 'Historial'}
          </button>
        ))}
      </div>

      {/* ── Section 1: Employees ── */}
      {section === 'employees' && (
        <div className="space-y-4">
          {detailLine && <PayrollBreakdownModal line={detailLine} onClose={() => setDetailLine(null)} />}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">Nómina de empleados</p>
              <p className="text-xs text-gray-400">Salario mínimo 2026 (no calificado): {fmt(SALARIO_MINIMO_2026)}/mes</p>
            </div>
            <Button size="sm" onClick={() => setShowEmpModal(true)}>
              <Plus className="w-4 h-4" /> Agregar empleado
            </Button>
          </div>

          {showEmpModal && (
            <Modal title="Nuevo Empleado" onClose={() => setShowEmpModal(false)}>
              <form onSubmit={handleCreateEmployee} className="space-y-3">
                <Input label="Nombre completo *" value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} placeholder="Juan Pérez López" />
                <Input label="Cédula *" value={empForm.identification} onChange={e => setEmpForm({ ...empForm, identification: e.target.value })} placeholder="1-0000-0000" />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Cargo / Puesto" value={empForm.position} onChange={e => setEmpForm({ ...empForm, position: e.target.value })} placeholder="Contador" />
                  <Input label="Departamento" value={empForm.department} onChange={e => setEmpForm({ ...empForm, department: e.target.value })} placeholder="Administración" />
                </div>
                <Input label="Salario bruto mensual (₡) *" type="number" min="0" step="1" value={empForm.salary} onChange={e => setEmpForm({ ...empForm, salary: e.target.value })} placeholder="600000" />
                {empForm.salary && Number(empForm.salary) < SALARIO_MINIMO_2026 && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Salario por debajo del mínimo legal 2026 (₡{SALARIO_MINIMO_2026.toLocaleString('es-CR')})
                  </p>
                )}
                <Input label="Fecha de ingreso" type="date" value={empForm.startDate} onChange={e => setEmpForm({ ...empForm, startDate: e.target.value })} />
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setShowEmpModal(false)} className="flex-1">Cancelar</Button>
                  <Button type="submit" loading={savingEmp} className="flex-1">Crear empleado</Button>
                </div>
              </form>
            </Modal>
          )}

          {employees.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No hay empleados registrados</p>
              <p className="text-gray-400 text-sm mt-1">Agrega empleados para procesar la planilla</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Empleado</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cargo</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Salario bruto</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.map((emp: any) => (
                    <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{emp.name}</p>
                        <p className="text-xs text-gray-400">{emp.identification}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-600">{emp.position ?? '—'}</p>
                        {emp.department && <p className="text-xs text-gray-400">{emp.department}</p>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-mono font-semibold ${Number(emp.salary) < SALARIO_MINIMO_2026 ? 'text-amber-600' : 'text-gray-800'}`}>
                          {fmt(emp.salary)}
                        </span>
                        {Number(emp.salary) < SALARIO_MINIMO_2026 && (
                          <p className="text-xs text-amber-500">Bajo mínimo legal</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${emp.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                          {emp.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                          title="Desactivar empleado"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Section 2: Process Payroll ── */}
      {section === 'process' && (
        <div className="space-y-5">
          {detailLine && <PayrollBreakdownModal line={detailLine} onClose={() => setDetailLine(null)} />}

          {/* Period selector + calculate button */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Calcular planilla</p>
            <div className="flex gap-3 items-end flex-wrap">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Período (YYYY-MM)</label>
                <input
                  type="month"
                  value={period}
                  onChange={e => { setPeriod(e.target.value); setPreviewData(null); }}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Button onClick={handlePreview} loading={previewLoading} disabled={employees.length === 0}>
                <BarChart2 className="w-4 h-4" /> Calcular planilla
              </Button>
            </div>
            {employees.length === 0 && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Debes registrar empleados primero
              </p>
            )}
          </div>

          {/* Preview table */}
          {previewData && (
            <div className="space-y-4">
              {previewData.minWageWarnings?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-700">
                    <span className="font-semibold">Alerta salario mínimo:</span> {previewData.minWageWarnings.join(', ')} — salario menor a {fmt(SALARIO_MINIMO_2026)}/mes.
                  </p>
                </div>
              )}

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <p className="text-sm font-semibold text-gray-700">Vista previa — Planilla {previewData.period}</p>
                  <p className="text-xs text-gray-400">Haga clic en una fila para ver el desglose completo</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b border-gray-200">
                      <tr className="text-gray-400">
                        <th className="text-left px-3 py-2">Empleado</th>
                        <th className="text-right px-3 py-2">Sal. Bruto</th>
                        <th className="text-right px-3 py-2 text-orange-500">CCSS Trab.</th>
                        <th className="text-right px-3 py-2 text-orange-500">Renta</th>
                        <th className="text-right px-3 py-2 text-emerald-600">Sal. Neto</th>
                        <th className="text-right px-3 py-2 text-blue-600">CCSS Pat.</th>
                        <th className="text-right px-3 py-2 text-blue-600">Aguinaldo</th>
                        <th className="text-right px-3 py-2">Costo Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {previewData.lines.map((l: any) => (
                        <tr
                          key={l.employeeId}
                          className="hover:bg-blue-50 cursor-pointer transition-colors"
                          onClick={() => setDetailLine({ ...l.calc, employee: { name: l.employeeName, position: l.position } })}
                        >
                          <td className="px-3 py-2 font-medium text-gray-800">
                            {l.employeeName}
                            {l.position && <span className="text-gray-400 font-normal"> · {l.position}</span>}
                            {l.calc.belowMinWage && <span className="ml-1 text-amber-500" title="Bajo salario mínimo">⚠</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{fmt(l.calc.totalGross)}</td>
                          <td className="px-3 py-2 text-right font-mono text-orange-600">-{fmt(l.calc.ccssWorker)}</td>
                          <td className="px-3 py-2 text-right font-mono text-orange-600">-{fmt(l.calc.rentaDeduccion)}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">{fmt(l.calc.netSalary)}</td>
                          <td className="px-3 py-2 text-right font-mono text-blue-700">{fmt(l.calc.ccssPatrono)}</td>
                          <td className="px-3 py-2 text-right font-mono text-blue-700">{fmt(l.calc.aguinaldo)}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold">{fmt(l.calc.totalEmployerCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                      <tr>
                        <td className="px-3 py-2 text-gray-700">TOTALES</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(previewData.totals.totalGross)}</td>
                        <td className="px-3 py-2 text-right font-mono text-orange-600">-{fmt(previewData.totals.totalTrabajador)}</td>
                        <td className="px-3 py-2 text-right font-mono text-orange-600">-{fmt(previewData.totals.totalRenta)}</td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-700">{fmt(previewData.totals.totalNet)}</td>
                        <td className="px-3 py-2 text-right font-mono text-blue-700">{fmt(previewData.totals.totalPatrono)}</td>
                        <td className="px-3 py-2 text-right font-mono text-blue-700">{fmt(previewData.totals.totalAguinaldo)}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(previewData.totals.totalCost)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* CCSS summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
                  <p className="text-xs text-orange-500 font-medium">CCSS Trabajadores</p>
                  <p className="text-lg font-bold text-orange-700 font-mono mt-0.5">{fmt(previewData.totals.totalTrabajador)}</p>
                  <p className="text-xs text-orange-400">10.34% del bruto</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-600 font-medium">CCSS Patrono</p>
                  <p className="text-lg font-bold text-blue-700 font-mono mt-0.5">{fmt(previewData.totals.totalPatrono)}</p>
                  <p className="text-xs text-blue-500">22.17% del bruto</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-600 font-medium">Aguinaldo provisión</p>
                  <p className="text-lg font-bold text-blue-700 font-mono mt-0.5">{fmt(previewData.totals.totalAguinaldo)}</p>
                  <p className="text-xs text-blue-500">8.33% del bruto</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 font-medium">Total a pagar CCSS</p>
                  <p className="text-lg font-bold text-gray-800 font-mono mt-0.5">{fmt(previewData.ccssPayableToday)}</p>
                  <p className="text-xs text-gray-400">Patrono + trabajador</p>
                </div>
              </div>

              {/* Journal entry preview */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Asiento contable que se generará</p>
                <table className="w-full text-xs font-mono">
                  <thead><tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-1">Cuenta</th>
                    <th className="text-right pb-1">Débito</th>
                    <th className="text-right pb-1">Crédito</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    <tr><td className="py-1 text-gray-700">6.1.01.01 Sueldos y Salarios</td><td className="py-1 text-right">{fmt(previewData.totals.totalGross)}</td><td className="py-1 text-right text-gray-300">—</td></tr>
                    <tr><td className="py-1 text-gray-700">6.1.02.01 Cargas Sociales Patrono</td><td className="py-1 text-right">{fmt(previewData.totals.totalPatrono)}</td><td className="py-1 text-right text-gray-300">—</td></tr>
                    <tr><td className="py-1 text-gray-700">6.1.03.01 Aguinaldo — Provisión</td><td className="py-1 text-right">{fmt(previewData.totals.totalAguinaldo)}</td><td className="py-1 text-right text-gray-300">—</td></tr>
                    <tr><td className="py-1 text-gray-700">2.1.04.01 Sueldos por Pagar</td><td className="py-1 text-right text-gray-300">—</td><td className="py-1 text-right">{fmt(previewData.totals.totalNet)}</td></tr>
                    <tr><td className="py-1 text-gray-700">2.1.04.02 CCSS por Pagar</td><td className="py-1 text-right text-gray-300">—</td><td className="py-1 text-right">{fmt(previewData.totals.totalTrabajador + previewData.totals.totalPatrono)}</td></tr>
                    <tr><td className="py-1 text-gray-700">2.1.04.03 Aguinaldo por Pagar</td><td className="py-1 text-right text-gray-300">—</td><td className="py-1 text-right">{fmt(previewData.totals.totalAguinaldo)}</td></tr>
                    {previewData.totals.totalRenta > 0 && (
                      <tr><td className="py-1 text-gray-700">2.1.04.04 Retención Imp. Renta</td><td className="py-1 text-right text-gray-300">—</td><td className="py-1 text-right">{fmt(previewData.totals.totalRenta)}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setPreviewData(null)} className="flex-1">Cancelar</Button>
                <Button onClick={handleProcessPayroll} loading={processing} className="flex-1">
                  <CheckCircle2 className="w-4 h-4" /> Confirmar y registrar planilla
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Section 3: History ── */}
      {section === 'history' && (
        <div className="space-y-3">
          {detailLine && <PayrollBreakdownModal line={detailLine} onClose={() => setDetailLine(null)} />}

          {payrolls.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No hay planillas procesadas</p>
              <p className="text-gray-400 text-sm mt-1">Procesa la planilla del mes actual para comenzar</p>
            </div>
          ) : (
            payrolls.map((p: any) => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedPayroll(expandedPayroll === p.id ? null : p.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 text-blue-700 font-mono text-sm font-bold px-3 py-1.5 rounded-lg">{p.period}</div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{p.lines?.length ?? 0} empleado{(p.lines?.length ?? 0) !== 1 ? 's' : ''}</p>
                      <p className="text-xs text-gray-400">Neto: <span className="text-emerald-600 font-semibold">{fmt(p.totalNet)}</span></p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Costo total</p>
                    <p className="font-bold text-gray-800 font-mono">{fmt(Number(p.totalGross) + Number(p.totalPatrono) + Number(p.totalAguinaldo))}</p>
                    {p.journalEntryId && (
                      <p className="text-xs text-emerald-500 mt-0.5">Asiento registrado</p>
                    )}
                  </div>
                </div>

                {expandedPayroll === p.id && (
                  <div className="border-t border-gray-200 p-4 space-y-4">
                    {/* Aggregate summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                      <div className="bg-gray-50 rounded-lg p-2 text-center"><p className="text-gray-400">Bruto total</p><p className="font-bold font-mono">{fmt(p.totalGross)}</p></div>
                      <div className="bg-orange-50 rounded-lg p-2 text-center"><p className="text-orange-400">CCSS trab.</p><p className="font-bold font-mono text-orange-700">{fmt(p.totalTrabajador)}</p></div>
                      <div className="bg-emerald-50 rounded-lg p-2 text-center"><p className="text-emerald-400">Neto</p><p className="font-bold font-mono text-emerald-700">{fmt(p.totalNet)}</p></div>
                      <div className="bg-blue-50 rounded-lg p-2 text-center"><p className="text-blue-500">CCSS patrono</p><p className="font-bold font-mono text-blue-700">{fmt(p.totalPatrono)}</p></div>
                      <div className="bg-blue-50 rounded-lg p-2 text-center"><p className="text-blue-500">Aguinaldo</p><p className="font-bold font-mono text-blue-700">{fmt(p.totalAguinaldo)}</p></div>
                    </div>

                    {/* Employee lines */}
                    {p.lines && p.lines.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead><tr className="text-gray-400 border-b border-gray-100">
                            <th className="text-left pb-1">Empleado</th>
                            <th className="text-right pb-1">Bruto</th>
                            <th className="text-right pb-1 text-orange-500">CCSS Trab.</th>
                            <th className="text-right pb-1 text-orange-500">Renta</th>
                            <th className="text-right pb-1 text-emerald-600">Neto</th>
                            <th className="text-right pb-1 text-blue-600">CCSS Pat.</th>
                            <th className="text-right pb-1 text-blue-600">Aguinaldo</th>
                            <th className="text-right pb-1">Costo total</th>
                            <th className="pb-1" />
                          </tr></thead>
                          <tbody className="divide-y divide-gray-50">
                            {p.lines.map((l: any) => (
                              <tr key={l.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => setDetailLine(l)}>
                                <td className="py-1 font-medium text-gray-700">{l.employee?.name ?? '—'}</td>
                                <td className="py-1 text-right font-mono">{fmt(l.totalGross)}</td>
                                <td className="py-1 text-right font-mono text-orange-600">-{fmt(l.ccssWorker)}</td>
                                <td className="py-1 text-right font-mono text-orange-600">-{fmt(l.rentaDeduccion)}</td>
                                <td className="py-1 text-right font-mono font-bold text-emerald-700">{fmt(l.netSalary)}</td>
                                <td className="py-1 text-right font-mono text-blue-700">{fmt(l.ccssPatrono)}</td>
                                <td className="py-1 text-right font-mono text-blue-700">{fmt(l.aguinaldo)}</td>
                                <td className="py-1 text-right font-mono font-bold">{fmt(l.totalEmployerCost)}</td>
                                <td className="py-1 pl-2">
                                  <button className="text-blue-500 hover:text-blue-700" title="Ver desglose"><Search className="w-3.5 h-3.5" /></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
