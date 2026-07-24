'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate, getErrorMessage } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { IconTile } from '@/components/ui/IconTile';
import { EmptyState } from '@/components/ui/EmptyState';
import { SceneEmptyBox, SceneSearchEmpty } from '@/components/illustrations';
import toast from 'react-hot-toast';
import {
  Calculator, Building2, Plus, ChevronRight, Receipt, FileText, Users,
  Search, Trash2, X, Briefcase,
} from 'lucide-react';

interface PracticeCompany {
  id: string;
  name: string;
  legalId: string | null;
  economicActivity: string | null;
  createdAt: string;
  _count: { invoices: number; journalEntries: number; clients: number };
}

export default function ContadorPage() {
  const [companies, setCompanies] = useState<PracticeCompany[]>([]);
  const [loading, setLoading]     = useState(true);
  const [query, setQuery]         = useState('');
  const [showForm, setShowForm]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<PracticeCompany[]>('/api/v1/practice/companies');
      setCompanies(data);
    } catch {
      toast.error('Error al cargar tus empresas de práctica');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => companies.filter(c =>
    !query.trim() ||
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    (c.legalId ?? '').includes(query)), [companies, query]);

  const handleDelete = async (c: PracticeCompany) => {
    if (!confirm(`¿Eliminar la empresa de práctica "${c.name}"? Se borrarán sus registros. Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/api/v1/practice/companies/${c.id}`);
      toast.success('Empresa de práctica eliminada');
      setCompanies((prev) => prev.filter((x) => x.id !== c.id));
    } catch {
      toast.error('No se pudo eliminar');
    }
  };

  const totals = useMemo(() => ({
    invoices:      companies.reduce((s, c) => s + c._count.invoices, 0),
    journalEntries: companies.reduce((s, c) => s + c._count.journalEntries, 0),
    clients:       companies.reduce((s, c) => s + c._count.clients, 0),
  }), [companies]);

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      {/* Encabezado */}
      <PageHeader
        eyebrow="Mis empresas"
        title="Mis empresas-clientes"
        subtitle="Administrá las empresas a las que les llevás la contabilidad."
        icon={Calculator}
        iconTint="#1B2E6E"
        actions={(
          <Button variant="primary" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Nueva empresa
          </Button>
        )}
      />

      {/* KPIs */}
      {companies.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <StatCard label="Empresas activas" value={String(companies.length)} icon={Briefcase} tint="#1B2E6E" />
          <StatCard label="Facturas totales" value={String(totals.invoices)} icon={Receipt} tint="#2563EB" />
          <StatCard label="Asientos registrados" value={String(totals.journalEntries)} icon={FileText} tint="#D4A017" />
          <StatCard label="Clientes gestionados" value={String(totals.clients)} icon={Users} tint="#1D4ED8" />
        </div>
      )}

      {/* Buscador */}
      {companies.length > 0 && (
        <div className="relative w-full sm:w-72 mt-6 mb-4">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar empresa…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition"
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200/70 shadow-card rounded-card">
          <EmptyState
            illustration={
              companies.length === 0
                ? <SceneEmptyBox size={200} />
                : <SceneSearchEmpty size={200} />
            }
            title={companies.length === 0 ? 'Aún no tenés empresas registradas' : 'Sin resultados'}
            description={
              companies.length === 0
                ? 'Registrá una empresa-cliente para empezar a llevar su contabilidad: catálogo de cuentas, asientos, mayor, balances y estados financieros.'
                : 'Probá con otra búsqueda.'
            }
            action={companies.length === 0 ? (
              <Button variant="primary" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4" /> Registrar mi primera empresa
              </Button>
            ) : undefined}
          />
        </div>
      ) : (
        <div className="bg-white border border-gray-200/70 shadow-card rounded-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-semibold">Empresa</th>
                <th className="px-5 py-3 font-semibold">Cédula</th>
                <th className="px-5 py-3 font-semibold">Actividad</th>
                <th className="px-5 py-3 font-semibold text-right">Facturas</th>
                <th className="px-5 py-3 font-semibold text-right">Asientos</th>
                <th className="px-5 py-3 font-semibold text-right">Clientes</th>
                <th className="px-5 py-3 font-semibold">Creada</th>
                <th className="px-5 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-blue-50/40 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 text-white"
                        style={{ background: 'linear-gradient(135deg,#2563EB,#1D4ED8)' }}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-gray-900 truncate">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500 font-mono tabular-nums">{c.legalId ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500 truncate max-w-[180px]">{c.economicActivity ?? '—'}</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-gray-700">{c._count.invoices}</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-gray-700">{c._count.journalEntries}</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-gray-700">{c._count.clients}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(c.createdAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/estudiante/contador/${c.id}`}>
                        <Button size="sm" variant="secondary">Abrir <ChevronRight className="w-3.5 h-3.5" /></Button>
                      </Link>
                      <button
                        onClick={() => handleDelete(c)}
                        title="Eliminar"
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <NewPracticeModal
          onClose={() => setShowForm(false)}
          onCreated={(c) => { setCompanies((prev) => [c, ...prev]); setShowForm(false); }}
        />
      )}
    </div>
  );
}

function NewPracticeModal({
  onClose, onCreated,
}: {
  onClose: () => void;
  onCreated: (c: PracticeCompany) => void;
}) {
  const [form, setForm] = useState({
    name: '', legalId: '', legalIdType: '02', economicActivity: '',
    address: '', phone: '', email: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('El nombre de la empresa es obligatorio'); return; }
    if (!form.legalId.trim()) { toast.error('La cédula es obligatoria'); return; }
    if (!form.economicActivity || form.economicActivity.length !== 6) {
      toast.error('La actividad económica debe tener exactamente 6 dígitos (código CIIU)'); return;
    }
    setSaving(true);
    try {
      const { data } = await api.post<PracticeCompany>('/api/v1/practice/companies', {
        name: form.name.trim(),
        legalId: form.legalId.trim(),
        legalIdType: form.legalIdType,
        economicActivity: form.economicActivity,
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
      });
      toast.success('Empresa de práctica creada');
      onCreated({ ..._blankCounts(data) });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-card shadow-card-hover my-8 lp-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <IconTile icon={Building2} tint="#B8860B" size={40} />
            <h3 className="font-bold text-gray-900">Nueva empresa de práctica</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <Field label="Nombre de la empresa *">
            <input autoFocus value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="Ej. Distribuidora El Sol S.A." className={INPUT} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de cédula">
              <select value={form.legalIdType} onChange={(e) => set('legalIdType', e.target.value)} className={INPUT}>
                <option value="01">01 — Física</option>
                <option value="02">02 — Jurídica</option>
                <option value="03">03 — DIMEX</option>
                <option value="04">04 — NITE</option>
              </select>
            </Field>
            <Field label="Cédula">
              <input value={form.legalId} onChange={(e) => set('legalId', e.target.value)}
                placeholder="3101999999" className={INPUT} />
            </Field>
          </div>

          <Field label="Actividad económica CIIU * (6 dígitos)">
            <input value={form.economicActivity}
              onChange={(e) => set('economicActivity', e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Ej: 702001" maxLength={6} className={INPUT} />
          </Field>
          <p className="text-xs text-gray-500 -mt-2">Código de actividad económica de Hacienda CR (ej: 702001 = Consultoría)</p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Teléfono">
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="2222-2222" className={INPUT} />
            </Field>
            <Field label="Correo">
              <input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="empresa@correo.com" className={INPUT} />
            </Field>
          </div>

          <Field label="Dirección">
            <input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="San José, Costa Rica" className={INPUT} />
          </Field>

          <div className="flex items-center gap-2 p-3 rounded-xl text-xs bg-blue-50 text-blue-700">
            <Building2 className="w-4 h-4 flex-shrink-0" />
            Se creará con el catálogo de cuentas base listo para empezar a registrar.
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" variant="gold" loading={saving} disabled={saving}>
              {saving ? 'Creando…' : 'Crear empresa'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const INPUT = 'w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-600 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

// Backend create() returns the raw company (no _count) — normalize for the card.
function _blankCounts(c: any): PracticeCompany {
  return {
    id: c.id, name: c.name, legalId: c.legalId ?? null,
    economicActivity: c.economicActivity ?? null,
    createdAt: c.createdAt ?? new Date().toISOString(),
    _count: c._count ?? { invoices: 0, journalEntries: 0, clients: 0 },
  };
}
