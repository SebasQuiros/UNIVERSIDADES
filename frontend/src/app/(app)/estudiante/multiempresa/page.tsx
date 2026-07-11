'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { ProcurementOrders } from '@/components/business/ProcurementOrders';
import toast from 'react-hot-toast';
import {
  Users, Plus, Copy, LogOut, Store, ChevronDown, ChevronRight,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface PracticeCompany {
  id: string;
  name: string;
  legalId: string | null;
}

interface GroupMember {
  id: string;
  companyId: string;
  studentId: string;
  company?: { name: string; legalId: string | null } | null;
}

interface PracticeGroup {
  id: string;
  name: string;
  code: string;
  members: GroupMember[];
}

const GOLD = '#D4A017';
const INPUT =
  'w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition';

// ─── Page ────────────────────────────────────────────────────────────────────
export default function GruposPage() {
  const { user } = useAuth();
  const [groups, setGroups]       = useState<PracticeGroup[]>([]);
  const [companies, setCompanies] = useState<PracticeCompany[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, c] = await Promise.all([
        api.get<PracticeGroup[]>('/api/v1/practice/groups/mine'),
        api.get<PracticeCompany[]>('/api/v1/practice/companies'),
      ]);
      setGroups(Array.isArray(g.data) ? g.data : []);
      setCompanies(Array.isArray(c.data) ? c.data : []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refetchGroups = useCallback(async () => {
    try {
      const { data } = await api.get<PracticeGroup[]>('/api/v1/practice/groups/mine');
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, []);

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code)
      .then(() => toast.success('Código copiado'))
      .catch(() => toast.error('No se pudo copiar'));
  };

  const leaveGroup = async (group: PracticeGroup) => {
    const mine = group.members.find((m) => m.studentId === user?.id);
    if (!mine) { toast.error('No participás en este grupo con ninguna empresa'); return; }
    if (!confirm(`¿Salir del grupo "${group.name}"? Tu empresa dejará de comerciar en él.`)) return;
    try {
      await api.delete(`/api/v1/practice/groups/${group.id}/members/${mine.companyId}`);
      toast.success('Saliste del grupo');
      if (expanded === group.id) setExpanded(null);
      await refetchGroups();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,160,23,0.14)' }}>
            <Users className="w-5 h-5" style={{ color: '#B8860B' }} />
          </span>
          Multiempresa — grupos de práctica
        </h2>
        <p className="text-gray-500 text-sm mt-1 max-w-3xl">
          Formá un grupo con otros estudiantes-contadores; sus empresas de práctica pueden comerciar
          entre sí (comprar/vender, con inventario, CxC/CxP y asientos reales).
        </p>
      </div>

      {/* Acciones: crear / unirse */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <CreateGroupCard companies={companies} onDone={refetchGroups} />
        <JoinGroupCard companies={companies} onDone={refetchGroups} />
      </div>

      {/* Lista de mis grupos */}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'rgba(212,160,23,0.12)' }}>
            <Users className="w-10 h-10" style={{ color: GOLD }} />
          </div>
          <h3 className="text-gray-800 font-semibold text-lg">Todavía no estás en ningún grupo</h3>
          <p className="text-gray-500 text-sm mt-1.5 max-w-md">
            Creá un grupo con una de tus empresas de práctica y compartí el código, o unite al grupo
            de un compañero con el código que te pase.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => {
            const mine = group.members.find((m) => m.studentId === user?.id);
            const isOpen = expanded === group.id;
            return (
              <div key={group.id} className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
                {/* Encabezado del grupo */}
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold flex-shrink-0 text-white" style={{ background: GOLD }}>
                        {group.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{group.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">Código:</span>
                          <code className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md" style={{ background: 'rgba(212,160,23,0.14)', color: '#8a6d0f' }}>
                            {group.code}
                          </code>
                          <button
                            onClick={() => copyCode(group.code)}
                            title="Copiar código"
                            className="text-gray-400 hover:text-amber-600 transition-colors">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => leaveGroup(group)} className="flex-shrink-0">
                      <LogOut className="w-3.5 h-3.5" /> Salir
                    </Button>
                  </div>

                  {/* Miembros */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">
                      Empresas del grupo ({group.members.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.members.map((m) => {
                        const isMine = m.studentId === user?.id;
                        return (
                          <span key={m.id}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border"
                            style={isMine
                              ? { background: 'rgba(212,160,23,0.14)', color: '#8a6d0f', borderColor: 'rgba(212,160,23,0.35)' }
                              : { background: '#F8FAFC', color: '#475569', borderColor: '#E2E8F0' }}>
                            <Store className="w-3 h-3" />
                            {m.company?.name ?? 'Empresa'}
                            {m.company?.legalId && <span className="text-gray-400">· {m.company.legalId}</span>}
                            {isMine && <span className="font-semibold">(vos)</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Toggle comercio */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : group.id)}
                    className="self-start inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:underline">
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    {isOpen ? 'Ocultar comercio del grupo' : 'Comerciar en este grupo'}
                  </button>
                </div>

                {/* Comercio (ERP) dentro del grupo */}
                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50/50 p-5">
                    {mine ? (
                      <ProcurementOrders companyId={mine.companyId} practiceGroupId={group.id} />
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-6">
                        No tenés ninguna empresa de práctica en este grupo, por lo que no podés emitir órdenes.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Crear grupo ─────────────────────────────────────────────────────────────
function CreateGroupCard({ companies, onDone }: { companies: PracticeCompany[]; onDone: () => void }) {
  const [name, setName]         = useState('');
  const [companyId, setCompany] = useState('');
  const [saving, setSaving]     = useState(false);
  const [created, setCreated]   = useState<PracticeGroup | null>(null);

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code)
      .then(() => toast.success('Código copiado'))
      .catch(() => toast.error('No se pudo copiar'));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Poné un nombre para el grupo'); return; }
    if (!companyId)   { toast.error('Elegí con cuál de tus empresas entrás'); return; }
    setSaving(true);
    try {
      const { data } = await api.post<PracticeGroup>('/api/v1/practice/groups', {
        name: name.trim(),
        companyId,
      });
      toast.success('Grupo creado');
      setCreated(data);
      setName('');
      setCompany('');
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212,160,23,0.14)' }}>
          <Plus className="w-4 h-4" style={{ color: '#B8860B' }} />
        </span>
        <h3 className="font-bold text-gray-900">Crear grupo</h3>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-gray-600 mb-1 block">Nombre del grupo</span>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Cadena de suministro 4B" className={INPUT} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600 mb-1 block">¿Con cuál de tus empresas de práctica entrás?</span>
          <select value={companyId} onChange={(e) => setCompany(e.target.value)} className={INPUT}>
            <option value="">Seleccioná una empresa…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.legalId ? ` · ${c.legalId}` : ''}</option>
            ))}
          </select>
        </label>
        <Button type="submit" loading={saving} style={{ background: GOLD, borderColor: GOLD, color: '#1a1205' }}>
          <Plus className="w-4 h-4" /> Crear grupo
        </Button>
      </form>

      {created && (
        <div className="p-3 rounded-xl flex items-center justify-between gap-3" style={{ background: 'rgba(212,160,23,0.10)' }}>
          <div className="min-w-0">
            <p className="text-xs text-gray-600">Compartí este código con tu grupo:</p>
            <code className="text-lg font-mono font-bold" style={{ color: '#8a6d0f' }}>{created.code}</code>
          </div>
          <Button size="sm" variant="secondary" onClick={() => copyCode(created.code)} className="flex-shrink-0">
            <Copy className="w-3.5 h-3.5" /> Copiar
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Unirme a un grupo ───────────────────────────────────────────────────────
function JoinGroupCard({ companies, onDone }: { companies: PracticeCompany[]; onDone: () => void }) {
  const [code, setCode]         = useState('');
  const [companyId, setCompany] = useState('');
  const [saving, setSaving]     = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim())  { toast.error('Pegá el código del grupo'); return; }
    if (!companyId)    { toast.error('Elegí con cuál de tus empresas te unís'); return; }
    setSaving(true);
    try {
      await api.post('/api/v1/practice/groups/join', {
        code: code.trim(),
        companyId,
      });
      toast.success('Te uniste al grupo');
      setCode('');
      setCompany('');
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212,160,23,0.14)' }}>
          <Users className="w-4 h-4" style={{ color: '#B8860B' }} />
        </span>
        <h3 className="font-bold text-gray-900">Unirme a un grupo</h3>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-gray-600 mb-1 block">Código del grupo</span>
          <input value={code} onChange={(e) => setCode(e.target.value)}
            placeholder="Ej. ABC123" className={INPUT + ' font-mono uppercase'} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600 mb-1 block">¿Con cuál de tus empresas de práctica te unís?</span>
          <select value={companyId} onChange={(e) => setCompany(e.target.value)} className={INPUT}>
            <option value="">Seleccioná una empresa…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.legalId ? ` · ${c.legalId}` : ''}</option>
            ))}
          </select>
        </label>
        <Button type="submit" loading={saving} variant="secondary">
          <Users className="w-4 h-4" /> Unirme
        </Button>
      </form>
    </div>
  );
}
