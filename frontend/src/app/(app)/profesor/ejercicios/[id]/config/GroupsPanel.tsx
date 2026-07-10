'use client';

/**
 * GroupsPanel — gestión de empresas grupales (Fase 1).
 *
 * Solo visible cuando ExerciseConfig.companyMode === 'GROUP'. Permite al
 * profesor crear empresas, agregar/quitar miembros y togglear la disponibilidad
 * (`isCompanyEnabled`).
 *
 * Bloqueado completo (no permite mutaciones) cuando el ejercicio ya fue
 * publicado, igual que el resto de la página de config.
 */

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Building2, Plus, UserPlus, Trash2, Power, X, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/utils';

type CompanyRole = 'OWNER' | 'MEMBER';

interface UserLite {
  id: string; name: string; email: string;
}
interface MembershipLite {
  id: string; role: CompanyRole; user: UserLite;
}
interface GroupCompany {
  id: string;
  name: string;
  legalId: string;
  isCompanyEnabled: boolean;
  memberships: MembershipLite[];
}

export function GroupsPanel({
  exerciseId, locked,
}: {
  exerciseId: string;
  locked: boolean;
}) {
  const [companies, setCompanies] = useState<GroupCompany[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [creating,  setCreating]  = useState(false);
  const [newName,   setNewName]   = useState('');
  const [newLegal,  setNewLegal]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<GroupCompany[]>(
        `/api/v1/exercises/${exerciseId}/group-companies`,
      );
      setCompanies(data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [exerciseId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) { toast.error('El nombre es obligatorio'); return; }
    setCreating(true);
    try {
      await api.post(`/api/v1/exercises/${exerciseId}/group-companies`, {
        name:    newName.trim(),
        legalId: newLegal.trim() || undefined,
      });
      setNewName('');
      setNewLegal('');
      toast.success('Empresa creada');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function toggleEnabled(c: GroupCompany) {
    try {
      await api.patch(`/api/v1/companies/${c.id}/enabled`, {
        enabled: !c.isCompanyEnabled,
      });
      toast.success(c.isCompanyEnabled ? 'Empresa deshabilitada' : 'Empresa habilitada');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-700" />
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Empresas del ejercicio
          </h2>
        </div>
        <span className="text-xs text-gray-500">
          {companies.length} {companies.length === 1 ? 'empresa' : 'empresas'}
        </span>
      </div>

      {/* Form de creación */}
      {!locked && (
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-5 p-3 bg-gray-50 rounded-xl">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-gray-500 block mb-1">Nombre</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Empresa Grupo 1"
              disabled={creating}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-gray-500 block mb-1">Cédula jurídica (opcional)</label>
            <Input
              value={newLegal}
              onChange={(e) => setNewLegal(e.target.value)}
              placeholder="3-101-000000"
              disabled={creating}
            />
          </div>
          <Button type="submit" disabled={creating} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {creating ? 'Creando…' : 'Crear empresa'}
          </Button>
        </form>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-sm text-gray-500 py-4">Cargando…</div>
      ) : companies.length === 0 ? (
        <div className="text-sm text-gray-500 py-6 text-center">
          Aún no creaste ninguna empresa para este ejercicio.
        </div>
      ) : (
        <div className="space-y-3">
          {companies.map(c => (
            <CompanyRow
              key={c.id}
              company={c}
              locked={locked}
              onChange={load}
              onToggleEnabled={() => toggleEnabled(c)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function CompanyRow({
  company, locked, onChange, onToggleEnabled,
}: {
  company: GroupCompany;
  locked: boolean;
  onChange: () => void;
  onToggleEnabled: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [adding, setAdding] = useState(false);

  async function addByEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!memberEmail.trim()) return;
    setAdding(true);
    try {
      // Resolución por email (UI-friendly): primero buscamos al user; si no
      // existe el endpoint /users/by-email, el profe pega un userId UUID.
      let userId = memberEmail.trim();
      if (memberEmail.includes('@')) {
        try {
          const { data } = await api.get<UserLite>(
            `/api/v1/users/by-email?email=${encodeURIComponent(memberEmail.trim())}`,
          );
          userId = data.id;
        } catch {
          toast.error('No se encontró un usuario con ese email');
          setAdding(false);
          return;
        }
      }
      await api.post(`/api/v1/companies/${company.id}/members`, { userId });
      setMemberEmail('');
      setShowAdd(false);
      toast.success('Miembro agregado');
      onChange();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  async function removeMember(userId: string) {
    if (!confirm('¿Quitar este miembro?')) return;
    try {
      await api.delete(`/api/v1/companies/${company.id}/members/${userId}`);
      toast.success('Miembro removido');
      onChange();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className={`p-4 rounded-xl border ${
      company.isCompanyEnabled ? 'border-gray-200 bg-white' : 'border-amber-300 bg-amber-50'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            company.isCompanyEnabled ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
          }`}>
            <Building2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-gray-900 truncate">{company.name}</div>
            <div className="text-xs text-gray-500">
              {company.legalId} · {company.memberships.length}{' '}
              {company.memberships.length === 1 ? 'miembro' : 'miembros'}
              {!company.isCompanyEnabled && (
                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-amber-800 bg-amber-200">
                  deshabilitada
                </span>
              )}
            </div>
          </div>
        </div>
        {!locked && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onToggleEnabled}
              title={company.isCompanyEnabled ? 'Deshabilitar' : 'Habilitar'}
              className="p-1.5 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100"
            >
              <Power className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAdd(s => !s)}
              title="Agregar miembro"
              className="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-gray-100"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Lista de miembros */}
      {company.memberships.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          {company.memberships.map(m => (
            <div key={m.id} className="flex items-center justify-between text-xs">
              <span className="text-gray-700">
                <span className="font-medium">{m.user.name}</span>
                <span className="text-gray-400"> · {m.user.email}</span>
                {m.role === 'OWNER' && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold text-blue-800 bg-blue-100">
                    owner
                  </span>
                )}
              </span>
              {!locked && (
                <button
                  onClick={() => removeMember(m.user.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Quitar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form agregar miembro */}
      {showAdd && !locked && (
        <form onSubmit={addByEmail} className="mt-3 pt-3 border-t border-gray-100 flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Email del estudiante</label>
            <Input
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="estudiante@utn.ac.cr"
              disabled={adding}
            />
          </div>
          <Button type="submit" disabled={adding} variant="secondary">
            {adding ? '…' : 'Agregar'}
          </Button>
          <button type="button" onClick={() => setShowAdd(false)} className="p-2 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
}
