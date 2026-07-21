'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import { getErrorMessage, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconTile } from '@/components/ui/IconTile';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { SceneEmptyBox, SceneSearchEmpty } from '@/components/illustrations';
import toast from 'react-hot-toast';
import {
  Users, Search, X, UserCheck, UserX, KeyRound, Trash2, AlertTriangle,
  GraduationCap, BookOpen, ShieldCheck,
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
  { value: 'ADMIN',      label: 'Admin',       color: 'bg-slate-100 text-slate-700 border-slate-200' },
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

  async function handleReset() {
    setLoading(true);
    try {
      // Supabase envía un email de recuperación; el usuario define su contraseña
      // desde el enlace, que lo devuelve a /auth/change-password.
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/change-password`,
      });
      if (error) throw error;
      toast.success(`Se envió un email de recuperación a ${user.email}`);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-csq-dark/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200/70 rounded-card w-full max-w-sm shadow-card-hover p-6 cx-pop">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cx-press"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
        <IconTile icon={KeyRound} tint="#B8860B" size={46} className="mb-3" />
        <h3 className="font-bold text-gray-900 mb-1">Restablecer contraseña</h3>
        <p className="text-sm text-gray-500 mb-5">
          Se enviará un email de recuperación a <strong className="text-gray-700">{user.email}</strong> para
          que {user.name} establezca una nueva contraseña.
        </p>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading} className="flex-1 cx-press">
            Cancelar
          </Button>
          <Button onClick={handleReset} loading={loading} className="flex-1 cx-press">
            Enviar email
          </Button>
        </div>
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
      <div className="absolute inset-0 bg-csq-dark/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200/70 rounded-card w-full max-w-sm shadow-card-hover p-6 cx-pop">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cx-press"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <IconTile icon={AlertTriangle} tint="#DC2626" size={46} />
          <h3 className="font-bold text-gray-900">Eliminar usuario</h3>
        </div>
        <p className="text-sm text-gray-600 mb-1">
          ¿Seguro que deseas eliminar a <strong className="text-gray-800">{user.name}</strong>?
        </p>
        <p className="text-xs text-red-600 mb-5">Esta acción no se puede deshacer.</p>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading} className="flex-1 cx-press">
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={loading} className="flex-1 cx-press">
            Eliminar
          </Button>
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

  const counts = {
    students: users.filter((u) => u.role === 'STUDENT').length,
    teachers: users.filter((u) => u.role === 'TEACHER').length,
    admins:   users.filter((u) => u.role === 'ADMIN' || u.role === 'SUPERADMIN').length,
  };
  const hasFilters = Boolean(search || roleFilter || uniFilter);

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#FBF8F1]">
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

      <PageHeader
        eyebrow="Superadmin"
        title="Usuarios"
        subtitle="Todas las personas con acceso a la plataforma, en cualquier universidad."
        icon={Users}
        iconTint="#475569"
        className="mb-8"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          key={`tot-${users.length}`}
          label="Usuarios totales" value={String(users.length)}
          icon={Users} tint="#1B2E6E" className="cx-count"
        />
        <StatCard
          key={`stu-${counts.students}`}
          label="Estudiantes" value={String(counts.students)}
          icon={GraduationCap} tint="#2563EB" className="cx-count"
        />
        <StatCard
          key={`tea-${counts.teachers}`}
          label="Profesores" value={String(counts.teachers)}
          icon={BookOpen} tint="#059669" className="cx-count"
        />
        <StatCard
          key={`adm-${counts.admins}`}
          label="Administración" value={String(counts.admins)}
          icon={ShieldCheck} tint="#B8860B" className="cx-count"
        />
      </div>

      {/* Listado */}
      <SectionCard
        icon={Users}
        iconTint="#475569"
        eyebrow="Directorio global"
        title="Listado de usuarios"
        description={`Mostrando ${filtered.length} de ${users.length} usuario${users.length !== 1 ? 's' : ''}`}
        flushBody
      >
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 px-6 lg:px-7 py-4 border-b border-gray-100 bg-gray-50/60">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o correo…"
              className="w-full rounded-xl bg-white border border-gray-300 pl-9 pr-4 py-2.5 text-sm transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl bg-white border border-gray-300 px-3 py-2.5 text-sm text-gray-700 transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
          >
            <option value="">Todos los roles</option>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <select
            value={uniFilter}
            onChange={(e) => setUniFilter(e.target.value)}
            className="rounded-xl bg-white border border-gray-300 px-3 py-2.5 text-sm text-gray-700 transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
          >
            <option value="">Todas las universidades</option>
            {universities.map((u) => (
              <option key={u.id} value={u.id}>{u.shortName ?? u.name}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setRoleFilter(''); setUniFilter(''); }}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors cx-press"
            >
              <X className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : filtered.length === 0 ? (
          hasFilters ? (
            <EmptyState
              illustration={<SceneSearchEmpty size={190} className="lp-drift" />}
              title="Sin resultados"
              description="Ningún usuario coincide con los filtros aplicados. Ajusta la búsqueda para seguir explorando."
              action={
                <Button
                  variant="secondary"
                  onClick={() => { setSearch(''); setRoleFilter(''); setUniFilter(''); }}
                  className="cx-press"
                >
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              illustration={<SceneEmptyBox size={200} className="lp-drift" />}
              title="Aún no hay usuarios"
              description="Cuando las universidades registren a su gente, la verás aquí."
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
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
                  <tr key={u.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 truncate">{u.name}</p>
                          <p className="text-xs text-gray-400 truncate">{u.email}</p>
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
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${
                        u.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-red-400'}`} />
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
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gold-700 hover:bg-gold-50 transition-colors cx-press"
                          title="Restablecer contraseña"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggle(u)}
                          disabled={toggling === u.id}
                          title={u.isActive ? 'Desactivar' : 'Activar'}
                          className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 cx-press ${
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
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cx-press"
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
        )}
      </SectionCard>
    </div>
  );
}
