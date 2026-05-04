'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { getErrorMessage, formatDate } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import {
  Users, Search, X, UserCheck, UserX, KeyRound, Trash2, AlertTriangle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface University { id: string; name: string; shortName: string | null; }

interface UserItem {
  id:           string;
  name:         string;
  email:        string;
  role:         string;
  isActive:     boolean;
  emailVerified: boolean;
  lastLogin:    string | null;
  createdAt:    string;
  university:   { id: string; name: string; shortName: string | null } | null;
}

// ── Role helpers ──────────────────────────────────────────────────────────────

const ROLES = [
  { value: 'SUPERADMIN', label: 'Super Admin', color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'ADMIN',      label: 'Admin',       color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'TEACHER',    label: 'Profesor',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'STUDENT',    label: 'Estudiante',  color: 'bg-blue-50 text-blue-700 border-blue-200' },
];

function roleBadge(role: string) {
  const r = ROLES.find((x) => x.value === role);
  return r
    ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${r.color}`}>{r.label}</span>
    : <span className="text-xs text-gray-400">{role}</span>;
}

// ── Reset Password Modal ──────────────────────────────────────────────────────

function ResetPwdModal({ user, onClose }: { user: UserItem; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [temp, setTemp]       = useState<string | null>(null);

  async function handleReset() {
    setLoading(true);
    try {
      const { data } = await api.post<{ tempPassword: string }>(`/api/v1/superadmin/users/${user.id}/reset-password`);
      setTemp(data.tempPassword);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 rounded-2xl w-full max-w-sm shadow-xl p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
        <KeyRound className="w-8 h-8 text-amber-500 mb-3" />
        <h3 className="font-semibold text-gray-900 mb-1">Resetear contraseña</h3>
        <p className="text-sm text-gray-500 mb-4">
          {temp
            ? 'Contraseña temporal generada:'
            : `¿Resetear la contraseña de ${user.name}?`}
        </p>
        {temp ? (
          <>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-mono text-lg font-bold text-gray-900 mb-3 tracking-widest text-center">
              {temp}
            </div>
            <p className="text-xs text-amber-600 mb-4">El usuario deberá cambiar esta contraseña al ingresar.</p>
            <button onClick={onClose}
              className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold rounded-xl transition-colors">
              Cerrar
            </button>
          </>
        ) : (
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button onClick={handleReset} disabled={loading}
              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
              {loading ? 'Reseteando...' : 'Resetear'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────

function DeleteModal({
  user,
  onClose,
  onDeleted,
}: {
  user:      UserItem;
  onClose:   () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      await api.delete(`/api/v1/superadmin/users/${user.id}`);
      toast.success('Usuario eliminado');
      onDeleted();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 rounded-2xl w-full max-w-sm shadow-xl p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="font-bold text-gray-900">Eliminar usuario</h3>
        </div>
        <p className="text-sm text-gray-600 mb-1">
          ¿Estás seguro de que deseas eliminar a <strong>{user.name}</strong>?
        </p>
        <p className="text-xs text-red-500 mb-5">Esta acción no se puede deshacer.</p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={handleDelete} disabled={loading}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
            {loading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const [users,        setUsers]        = useState<UserItem[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState('');
  const [uniFilter,    setUniFilter]    = useState('');
  const [resetUser,    setResetUser]    = useState<UserItem | null>(null);
  const [deleteUser,   setDeleteUser]   = useState<UserItem | null>(null);
  const [toggling,     setToggling]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, univRes] = await Promise.all([
        api.get<UserItem[]>('/api/v1/superadmin/users'),
        api.get<University[]>('/api/v1/superadmin/universities'),
      ]);
      setUsers(usersRes.data);
      setUniversities(univRes.data);
    } catch {
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(u: UserItem) {
    setToggling(u.id);
    try {
      await api.patch(`/api/v1/superadmin/users/${u.id}/toggle-status`);
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, isActive: !x.isActive } : x));
      toast.success(u.isActive ? 'Usuario desactivado' : 'Usuario activado');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setToggling(null);
    }
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch   = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole     = !roleFilter || u.role === roleFilter;
    const matchUni      = !uniFilter  || u.university?.id === uniFilter;
    return matchSearch && matchRole && matchUni;
  });

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      {resetUser && (
        <ResetPwdModal user={resetUser} onClose={() => setResetUser(null)} />
      )}
      {deleteUser && (
        <DeleteModal
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onDeleted={() => {
            setUsers((prev) => prev.filter((u) => u.id !== deleteUser.id));
            setDeleteUser(null);
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Usuarios</h2>
          <p className="text-gray-500 text-sm mt-1">
            {users.length} usuario{users.length !== 1 ? 's' : ''} en la plataforma
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="w-full rounded-xl bg-white border border-gray-300 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Todos los roles</option>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select
          value={uniFilter}
          onChange={(e) => setUniFilter(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Todas las universidades</option>
          {universities.map((u) => (
            <option key={u.id} value={u.id}>{u.shortName ?? u.name}</option>
          ))}
        </select>
      </div>

      {/* Results summary */}
      {(search || roleFilter || uniFilter) && (
        <p className="text-xs text-gray-500 mb-3">
          Mostrando {filtered.length} de {users.length} usuarios
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Users className="w-8 h-8 text-gray-300 mb-3" />
          <p className="text-gray-500">
            {search || roleFilter || uniFilter ? 'Sin resultados para los filtros aplicados' : 'No hay usuarios registrados'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-200">
                  <th className="text-left p-4">Usuario</th>
                  <th className="text-left p-4">Rol</th>
                  <th className="text-left p-4">Universidad</th>
                  <th className="text-left p-4">Estado</th>
                  <th className="text-left p-4">Último acceso</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">{roleBadge(u.role)}</td>
                    <td className="p-4 text-xs text-gray-500">
                      {u.university
                        ? (u.university.shortName ?? u.university.name)
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                        u.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {u.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-gray-400">
                      {u.lastLogin ? formatDate(u.lastLogin) : 'Nunca'}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setResetUser(u)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title="Resetear contraseña"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggle(u)}
                          disabled={toggling === u.id}
                          title={u.isActive ? 'Desactivar' : 'Activar'}
                          className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                            u.isActive
                              ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                              : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                        {u.role !== 'SUPERADMIN' && (
                          <button
                            onClick={() => setDeleteUser(u)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
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
