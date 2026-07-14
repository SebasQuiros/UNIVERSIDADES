'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { IconTile } from '@/components/ui/IconTile';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArtLedger, SceneEmptyBox, SceneSearchEmpty } from '@/components/illustrations';
import toast from 'react-hot-toast';
import {
  Calculator, Building2, Plus, ChevronRight, Receipt, FileText, Users,
  Search, Trash2, X, Sparkles,
} from 'lucide-react';

interface PracticeCompany {
  id: string;
  name: string;
  legalId: string | null;
  economicActivity: string | null;
  createdAt: string;
  _count: { invoices: number; journalEntries: number; clients: number };
}

const GOLD = '#D4A017';

const ACTIVITIES = [
  'Comercio al por menor',
  'Comercio al por mayor',
  'Servicios profesionales',
  'Servicios de tecnología',
  'Manufactura / Producción',
  'Construcción',
  'Restaurante / Alimentos',
  'Consultoría',
  'Otro',
];

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

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      {/* Encabezado */}
      <PageHeader
        eyebrow="Espacio Contador"
        title="Practicá como contador"
        subtitle="Gestioná varias empresas-cliente sin nota. Perfecto para replicar ejercicios del libro."
        icon={Calculator}
        iconTint="#B8860B"
        actions={(
          <Button variant="gold" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Nueva empresa de práctica
          </Button>
        )}
        className="lp-in"
      />

      {/* Hero: taller de contabilidad */}
      <Card variant="onDark" className="lp-in lp-in-d1 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-6 lg:px-7 py-6">
          <div className="flex-1 min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-1.5">
              Ciclo contable completo
            </p>
            <h2 className="text-lg font-bold leading-snug">Tu taller de contabilidad, a tu ritmo.</h2>
            <p className="mt-1.5 text-sm text-blue-200/80 max-w-xl">
              Catálogo de cuentas, asientos, mayor, balances y estados financieros. Sin límite y sin calificación.
            </p>
          </div>
          <ArtLedger size={160} className="lp-drift flex-shrink-0" />
        </div>
      </Card>

      {/* Buscador */}
      {companies.length > 0 && (
        <div className="relative w-full sm:w-72 mt-6 mb-6">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar empresa-cliente…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition"
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <Card className="lp-in">
          <EmptyState
            illustration={
              companies.length === 0
                ? <SceneEmptyBox size={220} className="lp-drift" />
                : <SceneSearchEmpty size={220} className="lp-drift" />
            }
            title={companies.length === 0 ? 'Aún no tenés empresas de práctica' : 'Sin resultados'}
            description={
              companies.length === 0
                ? 'Creá una empresa-cliente para practicar el ciclo contable completo a tu ritmo: catálogo de cuentas, asientos, mayor, balances y estados financieros. Sin límite y sin calificación.'
                : 'Probá con otra búsqueda.'
            }
            action={companies.length === 0 ? (
              <Button variant="gold" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4" /> Crear mi primera empresa
              </Button>
            ) : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c, i) => (
            <div key={c.id}
              className={`group bg-white border border-gray-200/70 shadow-card rounded-card p-5 flex flex-col gap-4 lp-card-pro lp-in lp-in-d${Math.min(i + 1, 5)}`}>
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold flex-shrink-0 text-white" style={{ background: GOLD }}>
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                  {c.legalId && <p className="text-xs text-gray-500 mt-0.5">Cédula: {c.legalId}</p>}
                  {c.economicActivity && <p className="text-xs text-gray-400 mt-0.5 truncate">{c.economicActivity}</p>}
                </div>
                <button
                  onClick={() => handleDelete(c)}
                  title="Eliminar"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full self-start" style={{ background: 'rgba(212,160,23,0.14)', color: '#8a6d0f' }}>
                <Sparkles className="w-3 h-3" /> Práctica libre · sin nota
              </span>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Receipt,  n: c._count.invoices,      l: 'Facturas' },
                  { icon: FileText, n: c._count.journalEntries, l: 'Asientos' },
                  { icon: Users,    n: c._count.clients,        l: 'Clientes' },
                ].map((k, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                    <k.icon className="w-4 h-4 text-amber-600" />
                    <p className="text-sm font-bold text-gray-900 leading-none font-mono tabular-nums">{k.n}</p>
                    <p className="text-[11px] text-gray-400">{k.l}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-auto">
                <span className="text-xs text-gray-400">Creada {formatDate(c.createdAt)}</span>
                <Link href={`/estudiante/contador/${c.id}`}>
                  <Button size="sm" variant="secondary">Abrir <ChevronRight className="w-3.5 h-3.5" /></Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <NewPracticeModal
          activities={ACTIVITIES}
          onClose={() => setShowForm(false)}
          onCreated={(c) => { setCompanies((prev) => [c, ...prev]); setShowForm(false); }}
        />
      )}
    </div>
  );
}

function NewPracticeModal({
  activities, onClose, onCreated,
}: {
  activities: string[];
  onClose: () => void;
  onCreated: (c: PracticeCompany) => void;
}) {
  const [form, setForm] = useState({
    name: '', legalId: '', legalIdType: 'JURIDICA', economicActivity: activities[0],
    address: '', phone: '', email: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('El nombre de la empresa es obligatorio'); return; }
    setSaving(true);
    try {
      const { data } = await api.post<PracticeCompany>('/api/v1/practice/companies', {
        name: form.name.trim(),
        legalId: form.legalId.trim() || null,
        legalIdType: form.legalIdType,
        economicActivity: form.economicActivity,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      });
      toast.success('Empresa de práctica creada');
      onCreated({ ..._blankCounts(data) });
    } catch {
      toast.error('No se pudo crear la empresa');
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
                <option value="JURIDICA">Jurídica</option>
                <option value="FISICA">Física</option>
                <option value="DIMEX">DIMEX</option>
              </select>
            </Field>
            <Field label="Cédula">
              <input value={form.legalId} onChange={(e) => set('legalId', e.target.value)}
                placeholder="3-101-123456" className={INPUT} />
            </Field>
          </div>

          <Field label="Actividad económica">
            <select value={form.economicActivity} onChange={(e) => set('economicActivity', e.target.value)} className={INPUT}>
              {activities.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>

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

          <div className="flex items-center gap-2 p-3 rounded-xl text-xs" style={{ background: 'rgba(212,160,23,0.10)', color: '#8a6d0f' }}>
            <Sparkles className="w-4 h-4 flex-shrink-0" />
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
