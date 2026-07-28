'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { buttonClasses, Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { SceneEmptyBox, SceneSearchEmpty } from '@/components/illustrations';
import { BookOpen, AlertTriangle, FolderTree, Plus, X, Upload, Download, Loader2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportToExcel } from '@/lib/excel';

// ── Tipos del endpoint real ────────────────────────────────────
// GET /api/v1/companies/:companyId/accounts
//   → Account[] (Prisma), ordenado por `code` asc, incluye `parent`.
type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
type NormalBalance = 'DEBIT' | 'CREDIT';

interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  parentId: string | null;
  level: number;
  isActive: boolean;
  isHeader: boolean;
  description?: string | null;
}

// ── Etiquetas y color de acento por tipo de cuenta (paleta de marca) ──
const TYPE_META: Record<AccountType, { label: string; tint: string; chip: string }> = {
  ASSET:     { label: 'Activo',     tint: '#2563EB', chip: 'bg-blue-50 text-blue-700 ring-blue-100' },
  LIABILITY: { label: 'Pasivo',     tint: '#B8860B', chip: 'bg-amber-50 text-amber-800 ring-amber-100' },
  EQUITY:    { label: 'Patrimonio', tint: '#6D28D9', chip: 'bg-violet-50 text-violet-700 ring-violet-100' },
  INCOME:    { label: 'Ingreso',    tint: '#0369A1', chip: 'bg-sky-50 text-sky-700 ring-sky-100' },
  EXPENSE:   { label: 'Gasto',      tint: '#1B2E6E', chip: 'bg-indigo-50 text-indigo-700 ring-indigo-100' },
};

const NATURE_LABEL: Record<NormalBalance, string> = {
  DEBIT:  'Deudora',
  CREDIT: 'Acreedora',
};

type LoadState =
  | { phase: 'loading' }
  | { phase: 'no-company' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; accounts: Account[] };

export function CatalogoCuentasView() {
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    exportToExcel('plantilla-catalogo-cuentas', [
      { codigo: '1',          nombre: 'ACTIVOS',            tipo: 'Activo',     naturaleza: 'Debe'  },
      { codigo: '1.1',        nombre: 'Activo Corriente',   tipo: 'Activo',     naturaleza: 'Debe'  },
      { codigo: '1.1.01',     nombre: 'Caja y Bancos',      tipo: 'Activo',     naturaleza: 'Debe'  },
      { codigo: '1.1.01.01',  nombre: 'Caja General',       tipo: 'Activo',     naturaleza: 'Debe'  },
      { codigo: '2.1.01.01',  nombre: 'Proveedores',        tipo: 'Pasivo',     naturaleza: 'Haber' },
      { codigo: '3.1.01.01',  nombre: 'Capital Social',     tipo: 'Patrimonio', naturaleza: 'Haber' },
      { codigo: '4.1.01.01',  nombre: 'Ventas',             tipo: 'Ingreso',    naturaleza: 'Haber' },
      { codigo: '5.1.01.01',  nombre: 'Costo de Ventas',    tipo: 'Gasto',      naturaleza: 'Debe'  },
    ]);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('El archivo supera el límite de 5 MB'); return; }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post<{ created: number; skipped: number; total: number; errors: string[] }>(
        `/api/v1/companies/${companyId}/accounts/import`, fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      toast.success(`Importado: ${data.created} creadas, ${data.skipped} omitidas de ${data.total}.`);
      if (data.errors?.length) toast(`Avisos: ${data.errors[0]}${data.errors.length > 1 ? ` (+${data.errors.length - 1})` : ''}`, { icon: '⚠️' });
      load();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'No se pudo importar el catálogo');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const load = async () => {
    try {
      // 1) Resolver la empresa igual que el sidebar: attempt activo → company.
      const { data } = await api.get<any[]>('/api/v1/attempts');
      const list = Array.isArray(data) ? data : [];
      const active =
        list.find((x) => x.status === 'IN_PROGRESS') ??
        list.find((x) => x.company) ??
        list.find((x) => x.status === 'NOT_STARTED') ??
        list[0];

      const cId: string | undefined = active?.company?.id;
      if (!cId) {
        setState({ phase: 'no-company' });
        return;
      }
      setCompanyId(cId);

      // 2) Traer el plan de cuentas de la empresa.
      const res = await api.get<Account[]>(`/api/v1/companies/${cId}/accounts`);
      const accounts = Array.isArray(res.data) ? res.data : [];
      setState({ phase: 'ready', accounts });
    } catch {
      setState({
        phase: 'error',
        message: 'No pudimos cargar tu catálogo de cuentas. Intentá de nuevo en un momento.',
      });
    }
  };

  useEffect(() => { load(); }, []);

  const header = (
    <PageHeader
      eyebrow="Contabilidad"
      title="Catálogo de cuentas"
      subtitle="El plan de cuentas de tu empresa bajo NIIF (Costa Rica)."
      icon={BookOpen}
      iconTint="#1B2E6E"
      className="mb-6"
      actions={
        state.phase === 'ready' && companyId ? (
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
            <Button variant="secondary" onClick={downloadTemplate} className="cx-press">
              <Download className="w-4 h-4" /> Plantilla
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={importing} className="cx-press">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Importar Excel
            </Button>
            <Button variant="primary" onClick={() => setShowModal(true)} className="cx-press">
              <Plus className="w-4 h-4" /> Nueva cuenta
            </Button>
          </div>
        ) : undefined
      }
    />
  );

  // ── Loading ───────────────────────────────────────────────────
  if (state.phase === 'loading') {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
        <div className="max-w-6xl mx-auto">
          {header}
          <SectionCard>
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Spinner size="lg" />
              <p className="text-sm text-gray-500">Cargando tu catálogo de cuentas…</p>
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  // ── Sin empresa activa ────────────────────────────────────────
  if (state.phase === 'no-company') {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
        <div className="max-w-6xl mx-auto">
          {header}
          <Card>
            <EmptyState
              illustration={<SceneSearchEmpty size={200} className="cx-float" />}
              title="Aún no tenés una empresa activa"
              description="Iniciá un ejercicio para constituir tu empresa; ahí se genera automáticamente el plan de cuentas completo."
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

  // ── Error ─────────────────────────────────────────────────────
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
              title="No pudimos cargar el catálogo"
              description={state.message}
            />
          </Card>
        </div>
      </div>
    );
  }

  // ── Ready ─────────────────────────────────────────────────────
  const { accounts } = state;

  if (accounts.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
        <div className="max-w-6xl mx-auto">
          {header}
          <Card>
            <EmptyState
              illustration={<SceneEmptyBox size={180} className="cx-float" />}
              title="El catálogo está vacío"
              description="Al constituir tu empresa en un ejercicio, se genera el plan de cuentas completo."
            />
          </Card>
        </div>
      </div>
    );
  }

  const detailCount = accounts.filter((a) => !a.isHeader).length;
  const headerCount = accounts.filter((a) => a.isHeader).length;

  // Búsqueda por código o nombre. Al filtrar mostramos las cuentas que coinciden
  // y también sus cuentas padre (por prefijo de código), para no perder el
  // contexto jerárquico del plan de cuentas.
  const q = query.trim().toLowerCase();
  const visibles = !q ? accounts : (() => {
    const hits = accounts.filter((a) =>
      a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
    const keep = new Set<string>();
    hits.forEach((h) => {
      keep.add(h.id);
      accounts.forEach((a) => { if (a.isHeader && h.code.startsWith(a.code + '.')) keep.add(a.id); });
    });
    return accounts.filter((a) => keep.has(a.id));
  })();

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#FBF8F1]">
      <div className="max-w-6xl mx-auto">
        {header}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatCard label="Cuentas en total" value={accounts.length.toLocaleString('es-CR')} icon={BookOpen} tint="#1B2E6E" className="cx-pop cx-d1" />
          <StatCard label="Cuentas de detalle" value={detailCount.toLocaleString('es-CR')} icon={FolderTree} tint="#2563EB" className="cx-pop cx-d2" />
          <StatCard label="Cuentas de mayor" value={headerCount.toLocaleString('es-CR')} icon={FolderTree} tint="#B8860B" className="cx-pop cx-d3" />
        </div>

        {/* Buscador de cuentas */}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-gray-200/70 bg-white px-4 py-3 shadow-card">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cuenta por código o nombre… (ej. 1.1.01 o Caja)"
              className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-9 text-sm text-gray-900 placeholder-gray-400 transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Limpiar búsqueda"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <span className="whitespace-nowrap font-mono text-xs tabular-nums text-gray-400">
            {query ? `${visibles.filter((a) => !a.isHeader).length} coincidencias` : `${accounts.length} cuentas`}
          </span>
        </div>

        {/* Árbol / tabla del plan de cuentas */}
        <SectionCard flushBody className="cx-pop cx-d2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-2.5 font-semibold w-40">Código</th>
                  <th className="px-4 py-2.5 font-semibold">Cuenta</th>
                  <th className="px-4 py-2.5 font-semibold w-32">Tipo</th>
                  <th className="px-4 py-2.5 font-semibold w-32">Naturaleza</th>
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500">
                    Sin resultados para “{query}”.
                  </td></tr>
                )}
                {visibles.map((acc) => {
                  const meta = TYPE_META[acc.type];
                  // Indentación por nivel (level 1 = raíz). Los niveles arrancan en 1.
                  const indent = Math.max(0, acc.level - 1) * 18;
                  return (
                    <tr
                      key={acc.id}
                      className={
                        acc.isHeader
                          ? 'border-b border-gray-100 bg-gray-50/40'
                          : 'border-b border-gray-100 hover:bg-gray-50/60 transition-colors'
                      }
                    >
                      <td className="px-4 py-2.5 font-mono tabular-nums text-xs text-gray-500 whitespace-nowrap">
                        {acc.code}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          style={{ paddingLeft: indent }}
                          className={
                            acc.isHeader
                              ? 'inline-block font-bold text-gray-900'
                              : 'inline-block text-gray-700'
                          }
                        >
                          {acc.name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ring-1 ring-inset ${meta.chip}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={
                            acc.normalBalance === 'DEBIT'
                              ? 'inline-flex items-center gap-1.5 text-xs font-medium text-blue-700'
                              : 'inline-flex items-center gap-1.5 text-xs font-medium text-gold-900'
                          }
                        >
                          <span
                            aria-hidden
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: acc.normalBalance === 'DEBIT' ? '#2563EB' : '#B8860B' }}
                          />
                          {NATURE_LABEL[acc.normalBalance]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            <span className="font-mono tabular-nums">{accounts.length}</span> cuentas · ordenadas por código
          </div>
        </SectionCard>
      </div>

      {showModal && companyId && (
        <NewAccountModal
          companyId={companyId}
          existingAccounts={accounts}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

// ── Crear cuenta personalizada ──────────────────────────────────────────────
const TYPE_OPTIONS: { value: AccountType; label: string; defaultBalance: NormalBalance }[] = [
  { value: 'ASSET',     label: 'Activo',     defaultBalance: 'DEBIT' },
  { value: 'LIABILITY', label: 'Pasivo',     defaultBalance: 'CREDIT' },
  { value: 'EQUITY',    label: 'Patrimonio', defaultBalance: 'CREDIT' },
  { value: 'INCOME',    label: 'Ingreso',    defaultBalance: 'CREDIT' },
  { value: 'EXPENSE',   label: 'Gasto',      defaultBalance: 'DEBIT' },
];

const ACCOUNT_INPUT = 'w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition';

function NewAccountModal({
  companyId, existingAccounts, onClose, onCreated,
}: {
  companyId: string;
  existingAccounts: Account[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    code: '', name: '', type: 'ASSET' as AccountType, normalBalance: 'DEBIT' as NormalBalance,
    parentId: '', description: '',
  });
  const [saving, setSaving] = useState(false);

  // Solo cuentas de mayor (header) del mismo tipo — es lo lógico para anidar
  // una cuenta de detalle nueva.
  const parentOptions = existingAccounts.filter((a) => a.isHeader && a.type === form.type);

  const setType = (type: AccountType) => {
    const meta = TYPE_OPTIONS.find((t) => t.value === type)!;
    setForm((f) => ({ ...f, type, normalBalance: meta.defaultBalance, parentId: '' }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) { toast.error('El código es obligatorio'); return; }
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const parent = existingAccounts.find((a) => a.id === form.parentId);
      await api.post(`/api/v1/companies/${companyId}/accounts`, {
        code: form.code.trim(),
        name: form.name.trim(),
        type: form.type,
        normalBalance: form.normalBalance,
        parentId: form.parentId || undefined,
        level: parent ? Math.min(4, parent.level + 1) : 4,
        isHeader: false,
        description: form.description.trim() || undefined,
      });
      toast.success('Cuenta creada');
      onCreated();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-card shadow-card-hover my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Nueva cuenta contable</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Código *</label>
              <input autoFocus value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="Ej. 1.1.06.01" className={ACCOUNT_INPUT} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Tipo</label>
              <select value={form.type} onChange={(e) => setType(e.target.value as AccountType)} className={ACCOUNT_INPUT}>
                {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Nombre de la cuenta *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej. Caja Chica Sucursal Norte" className={ACCOUNT_INPUT} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Naturaleza</label>
              <select value={form.normalBalance} onChange={(e) => setForm({ ...form, normalBalance: e.target.value as NormalBalance })} className={ACCOUNT_INPUT}>
                <option value="DEBIT">Deudora</option>
                <option value="CREDIT">Acreedora</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Agrupar bajo</label>
              <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} className={ACCOUNT_INPUT}>
                <option value="">Sin agrupar</option>
                {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Descripción (opcional)</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Para qué vas a usar esta cuenta" className={ACCOUNT_INPUT} />
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl text-xs bg-blue-50 text-blue-700">
            Esta cuenta queda personalizada solo para tu empresa — no la ven otros estudiantes.
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={saving} disabled={saving}>
              {saving ? 'Creando…' : 'Crear cuenta'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
