'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatDate, getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import {
  Users, Plus, Search, X, GraduationCap, BookOpen,
  ShieldCheck, Copy, CheckCheck, AlertTriangle, ToggleLeft,
  ToggleRight, ChevronDown, RefreshCw, UserCheck, UserX,
  KeyRound, Download,
} from 'lucide-react';

// ── CSV export helper ─────────────────────────────────────────────────────────
function exportUsersCSV(users: UserItem[], universityName: string) {
  const ROLE_LABELS_CSV: Record<string, string> = {
    STUDENT: 'Estudiante', TEACHER: 'Profesor', ADMIN: 'Admin', SUPERADMIN: 'Superadmin',
  };
  const rows = [
    ['Nombre', 'Correo', 'Rol', 'Estado', 'Contraseña temporal', 'Registrado', 'Último acceso'],
    ...users.map(u => [
      u.name,
      u.email,
      ROLE_LABELS_CSV[u.role] ?? u.role,
      u.isActive ? 'Activo' : 'Inactivo',
      u.mustChangePassword ? 'Pendiente' : 'Cambiada',
      new Date(u.createdAt).toLocaleDateString('es-CR'),
      u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('es-CR') : 'Nunca',
    ]),
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `usuarios_${universityName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserItem {
  id:                 string;
  name:               string;
  email:              string;
  role:               string;
  isActive:           boolean;
  createdAt:          string;
  universityId:       string | null;
  mustChangePassword: boolean;
  lastLogin?:         string | null;
}

interface CreatedUserResult extends UserItem {
  temporaryPassword: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  STUDENT:    'Estudiante',
  TEACHER:    'Profesor',
  ADMIN:      'Admin',
  SUPERADMIN: 'Superadmin',
};

const ROLE_COLORS: Record<string, string> = {
  STUDENT:    'bg-blue-50 text-blue-700 border-blue-200',
  TEACHER:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  ADMIN:      'bg-purple-50 text-purple-700 border-purple-200',
  SUPERADMIN: 'bg-red-50 text-red-700 border-red-200',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

// ── Modal: Create User ────────────────────────────────────────────────────────

function CreateUserModal({
  universityId,
  onClose,
  onCreated,
}: {
  universityId: string;
  onClose: () => void;
  onCreated: (user: CreatedUserResult) => void;
}) {
  const [form, setForm]   = useState({ name: '', email: '', role: 'STUDENT' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 3) e.name = 'Mínimo 3 caracteres';
    if (!form.email.trim()) e.email = 'Email requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email no válido';
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const { data } = await api.post<CreatedUserResult>(
        `/api/v1/universities/${universityId}/users`,
        { name: form.name.trim(), email: form.email.trim().toLowerCase(), role: form.role },
      );
      onCreated(data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">Nuevo Usuario</h3>
            <p className="text-xs text-gray-400 mt-0.5">Se generará una contraseña temporal automáticamente</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors rounded-lg p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Input
            label="Nombre completo *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Juan Pérez Solano"
            error={errors.name}
            autoFocus
          />
          <Input
            label="Correo institucional *"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="usuario@utn.ac.cr"
            error={errors.email}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Rol *</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-xl bg-white border border-gray-300 text-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            >
              <option value="STUDENT">Estudiante</option>
              <option value="TEACHER">Profesor</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              La contraseña temporal se mostrará <strong>una sola vez</strong> después de crear el usuario. Anótela o cópiela antes de cerrar.
            </p>
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1">
              <Plus className="w-4 h-4" /> Crear usuario
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Credentials (shown ONCE after creation) ────────────────────────────

function CredentialsModal({
  user,
  onClose,
}: {
  user: CreatedUserResult;
  onClose: () => void;
}) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPass,  setCopiedPass]  = useState(false);
  const [copiedAll,   setCopiedAll]   = useState(false);

  function copy(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2000);
    });
  }

  function copyAll() {
    const text = `Usuario: ${user.email}\nContraseña temporal: ${user.temporaryPassword}`;
    copy(text, setCopiedAll);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white border border-gray-200 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <UserCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Usuario creado exitosamente</h3>
            <p className="text-xs text-gray-400 mt-0.5">{user.name}</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Warning banner */}
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex gap-2.5">
            <KeyRound className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 leading-relaxed font-medium">
              ⚠️ Esta contraseña temporal se muestra <strong>una sola vez</strong>. Cópiala ahora — no podrás verla de nuevo.
            </p>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Correo</label>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200">
              <span className="flex-1 text-sm font-mono text-gray-800 truncate">{user.email}</span>
              <button
                onClick={() => copy(user.email, setCopiedEmail)}
                className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Copiar email"
              >
                {copiedEmail ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contraseña temporal</label>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-300">
              <span className="flex-1 text-sm font-mono font-bold text-amber-800 tracking-widest select-all">
                {user.temporaryPassword}
              </span>
              <button
                onClick={() => copy(user.temporaryPassword, setCopiedPass)}
                className="flex-shrink-0 p-1.5 rounded-lg text-amber-500 hover:text-amber-700 hover:bg-amber-100 transition-colors"
                title="Copiar contraseña"
              >
                {copiedPass ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Copy all button */}
          <button
            onClick={copyAll}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
          >
            {copiedAll ? (
              <><CheckCheck className="w-4 h-4 text-emerald-500" /><span className="text-emerald-600">¡Credenciales copiadas!</span></>
            ) : (
              <><Copy className="w-4 h-4" /> Copiar usuario y contraseña</>
            )}
          </button>

          {/* Info */}
          <p className="text-xs text-center text-gray-400">
            El usuario deberá cambiar su contraseña al iniciar sesión por primera vez.
          </p>
        </div>

        <div className="px-5 pb-5">
          <Button onClick={onClose} className="w-full">Entendido, cerrar</Button>
        </div>
      </div>
    </div>
  );
}

// ── Component: Role inline editor ─────────────────────────────────────────────

function RoleEditor({
  user,
  universityId,
  onUpdated,
}: {
  user: UserItem;
  universityId: string;
  onUpdated: (updated: UserItem) => void;
}) {
  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);

  if (user.role === 'SUPERADMIN') return <RoleBadge role={user.role} />;

  async function handleRoleChange(newRole: string) {
    if (newRole === user.role) { setOpen(false); return; }
    setSaving(true);
    try {
      const { data } = await api.patch<UserItem>(
        `/api/v1/universities/${universityId}/users/${user.id}/role`,
        { role: newRole },
      );
      onUpdated(data);
      toast.success(`Rol actualizado a ${ROLE_LABELS[newRole] ?? newRole}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={saving}
        className="flex items-center gap-1.5 group"
        title="Cambiar rol"
      >
        <RoleBadge role={user.role} />
        {saving
          ? <Spinner size="sm" />
          : <ChevronDown className="w-3 h-3 text-gray-400 group-hover:text-gray-600 transition-colors" />
        }
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px]">
            {['STUDENT', 'TEACHER', 'ADMIN'].map((r) => (
              <button
                key={r}
                onClick={() => handleRoleChange(r)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${r === user.role ? 'font-semibold text-blue-600' : 'text-gray-700'}`}
              >
                {r === user.role && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                {r !== user.role && <span className="w-1.5 h-1.5 flex-shrink-0" />}
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const { user }                          = useAuth();
  const [users, setUsers]                 = useState<UserItem[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [roleFilter, setRoleFilter]       = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [showCreate, setShowCreate]       = useState(false);
  const [createdUser, setCreatedUser]     = useState<CreatedUserResult | null>(null);
  const [togglingId, setTogglingId]       = useState<string | null>(null);

  const universityId = user?.universityId ?? '';

  const load = useCallback(async () => {
    if (!universityId) return;
    setLoading(true);
    try {
      const { data } = await api.get<UserItem[]>(`/api/v1/universities/${universityId}/users`);
      setUsers(data);
    } catch {
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, [universityId]);

  useEffect(() => { load(); }, [load]);

  // ── Inline role update ────────────────────────────────────────────────────────
  function handleUserUpdated(updated: UserItem) {
    setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u));
  }

  // ── Toggle active / inactive ──────────────────────────────────────────────────
  async function handleToggle(userId: string, currentActive: boolean) {
    setTogglingId(userId);
    try {
      const { data } = await api.patch<UserItem>(
        `/api/v1/universities/${universityId}/users/${userId}/toggle`,
      );
      setUsers((prev) => prev.map((u) => u.id === data.id ? data : u));
      toast.success(data.isActive ? 'Usuario activado' : 'Usuario desactivado');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTogglingId(null);
    }
  }

  // ── After user creation ───────────────────────────────────────────────────────
  function handleCreated(result: CreatedUserResult) {
    setShowCreate(false);
    setCreatedUser(result);
    // Add to list immediately (without awaiting reload)
    setUsers((prev) => [result, ...prev]);
  }

  // ── Filtering ─────────────────────────────────────────────────────────────────
  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole   = !roleFilter || u.role === roleFilter;
    const matchStatus = !statusFilter
      || (statusFilter === 'active'   &&  u.isActive)
      || (statusFilter === 'inactive' && !u.isActive)
      || (statusFilter === 'pending'  &&  u.mustChangePassword);
    return matchSearch && matchRole && matchStatus;
  });

  const counts = {
    STUDENT: users.filter((u) => u.role === 'STUDENT').length,
    TEACHER: users.filter((u) => u.role === 'TEACHER').length,
    ADMIN:   users.filter((u) => u.role === 'ADMIN').length,
    pending: users.filter((u) => u.mustChangePassword).length,
  };

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">

      {/* Modals */}
      {showCreate && universityId && (
        <CreateUserModal
          universityId={universityId}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
      {createdUser && (
        <CredentialsModal
          user={createdUser}
          onClose={() => setCreatedUser(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h2>
          <p className="text-gray-500 text-sm mt-1">
            {users.length} usuario{users.length !== 1 ? 's' : ''} en esta institución
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            title="Recargar"
            className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {users.length > 0 && (
            <button
              onClick={() => exportUsersCSV(users, universityId)}
              title="Exportar lista de usuarios en CSV"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
          )}
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Nuevo usuario
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Estudiantes',        value: counts.STUDENT, icon: GraduationCap, color: 'text-blue-600',   bg: 'bg-blue-50',   filter: 'STUDENT' },
          { label: 'Profesores',         value: counts.TEACHER, icon: BookOpen,      color: 'text-emerald-600',bg: 'bg-emerald-50',filter: 'TEACHER' },
          { label: 'Admins',             value: counts.ADMIN,   icon: ShieldCheck,   color: 'text-purple-600', bg: 'bg-purple-50', filter: 'ADMIN'   },
          { label: 'Contraseña pendiente',value: counts.pending, icon: KeyRound,     color: 'text-amber-600',  bg: 'bg-amber-50',  filter: ''        },
        ].map((s) => (
          <button
            key={s.label}
            onClick={() => s.filter ? setRoleFilter(roleFilter === s.filter ? '' : s.filter) : setStatusFilter(statusFilter === 'pending' ? '' : 'pending')}
            className={`p-4 rounded-xl border border-gray-200 bg-white shadow-sm text-center transition-all hover:shadow-md hover:border-gray-300 ${
              (s.filter && roleFilter === s.filter) || (!s.filter && statusFilter === 'pending')
                ? 'ring-2 ring-blue-500 border-blue-300'
                : ''
            }`}
          >
            <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mx-auto mb-2`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-tight">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex-1 min-w-52 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email…"
            className="w-full rounded-xl bg-white border border-gray-300 text-gray-900 placeholder-gray-400 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-xl bg-white border border-gray-300 text-gray-700 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los roles</option>
          <option value="STUDENT">Estudiantes</option>
          <option value="TEACHER">Profesores</option>
          <option value="ADMIN">Admins</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl bg-white border border-gray-300 text-gray-700 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="pending">Con contraseña temporal</option>
        </select>
        {(search || roleFilter || statusFilter) && (
          <button
            onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 border border-gray-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Limpiar
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center py-24 gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-400">Cargando usuarios…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center bg-white rounded-2xl border border-gray-200">
          <Users className="w-10 h-10 text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">
            {search || roleFilter || statusFilter ? 'Sin resultados para los filtros aplicados' : 'No hay usuarios registrados'}
          </p>
          {!search && !roleFilter && !statusFilter && (
            <button onClick={() => setShowCreate(true)} className="mt-4 text-sm text-blue-600 hover:underline">
              Crear el primer usuario
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50/70">
                  <th className="text-left px-5 py-3.5">Usuario</th>
                  <th className="text-left px-5 py-3.5">Rol</th>
                  <th className="text-left px-5 py-3.5">Estado</th>
                  <th className="text-left px-5 py-3.5 hidden md:table-cell">Registrado</th>
                  <th className="text-left px-5 py-3.5 hidden lg:table-cell">Último acceso</th>
                  <th className="text-right px-5 py-3.5">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((u) => (
                  <tr key={u.id} className={`hover:bg-gray-50/60 transition-colors ${!u.isActive ? 'opacity-60' : ''}`}>
                    {/* User info */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          u.isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-medium text-gray-800 truncate">{u.name}</p>
                            {u.mustChangePassword && (
                              <span
                                title="Debe cambiar contraseña"
                                className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-medium"
                              >
                                <KeyRound className="w-2.5 h-2.5" /> Temporal
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate max-w-[200px]">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role (editable) */}
                    <td className="px-5 py-3.5">
                      <RoleEditor
                        user={u}
                        universityId={universityId}
                        onUpdated={handleUserUpdated}
                      />
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${
                        u.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-50 text-gray-500 border-gray-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {u.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>

                    {/* Created */}
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-gray-400">{formatDate(u.createdAt)}</span>
                    </td>

                    {/* Last login */}
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-gray-400">
                        {u.lastLogin ? formatDate(u.lastLogin) : '—'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {u.role !== 'SUPERADMIN' && (
                          <button
                            onClick={() => handleToggle(u.id, u.isActive)}
                            disabled={togglingId === u.id}
                            title={u.isActive ? 'Desactivar usuario' : 'Activar usuario'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              u.isActive
                                ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {togglingId === u.id ? (
                              <Spinner size="sm" />
                            ) : u.isActive ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-400">
              Mostrando {filtered.length} de {users.length} usuario{users.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
