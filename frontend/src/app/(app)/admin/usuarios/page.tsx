'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatDate, getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconTile } from '@/components/ui/IconTile';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { SceneEmptyBox, SceneSearchEmpty } from '@/components/illustrations';
import toast from 'react-hot-toast';
import {
  Users, Plus, Search, X, GraduationCap, BookOpen,
  ShieldCheck, Copy, CheckCheck, AlertTriangle,
  ChevronDown, RefreshCw, UserCheck, UserX,
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
  ADMIN:      'bg-slate-100 text-slate-700 border-slate-200',
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

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-csq-dark/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white border border-gray-200/70 rounded-card w-full max-w-md shadow-card-hover cx-pop ${hasErrors ? 'cx-shake' : ''}`}>
        <div className="flex items-center justify-between gap-3 p-5 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <IconTile icon={Plus} tint="#2563EB" size={42} />
            <div className="min-w-0">
              <p className="text-[0.66rem] font-bold uppercase tracking-[0.13em] text-gold-900">Administración</p>
              <h3 className="font-bold text-gray-900 truncate">Nuevo usuario</h3>
              <p className="text-xs text-gray-400 mt-0.5">Se generará una contraseña temporal automáticamente</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cx-press"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Input
            label="Nombre completo *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nombre y apellidos"
            error={errors.name}
            autoFocus
          />
          <Input
            label="Correo institucional *"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="usuario@institucion.ac.cr"
            error={errors.email}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Rol *</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-xl bg-white border border-gray-300 text-gray-900 px-4 py-2.5 text-sm transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
            >
              <option value="STUDENT">Estudiante</option>
              <option value="TEACHER">Profesor</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <div className="rounded-xl bg-gold-50 border border-gold-100 p-3 flex gap-2.5">
            <AlertTriangle className="w-4 h-4 text-gold-700 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gold-900 leading-relaxed">
              La contraseña temporal se mostrará <strong>una sola vez</strong> después de crear el usuario.
              Cópiala antes de cerrar la ventana.
            </p>
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 cx-press">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1 cx-press">
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
      <div className="absolute inset-0 bg-csq-dark/50 backdrop-blur-sm" />
      <div className="relative bg-white border border-gray-200/70 rounded-card w-full max-w-md shadow-card-hover cx-pop">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="cx-tada">
            <IconTile icon={UserCheck} tint="#059669" size={46} />
          </div>
          <div className="min-w-0">
            <p className="text-[0.66rem] font-bold uppercase tracking-[0.13em] text-gold-900">Listo</p>
            <h3 className="font-bold text-gray-900 truncate">Usuario creado</h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{user.name}</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Aviso */}
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex gap-2.5">
            <KeyRound className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 leading-relaxed font-medium">
              Esta contraseña temporal se muestra <strong>una sola vez</strong>. Cópiala ahora — no podrás verla de nuevo.
            </p>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">Correo</label>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200">
              <span className="flex-1 text-sm font-mono text-gray-800 truncate">{user.email}</span>
              <button
                onClick={() => copy(user.email, setCopiedEmail)}
                className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-blue-700 hover:bg-blue-50 transition-colors cx-press"
                title="Copiar correo"
              >
                {copiedEmail ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">Contraseña temporal</label>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gold-50 border border-gold-100">
              <span className="flex-1 text-sm font-mono font-bold text-gold-900 tracking-widest select-all">
                {user.temporaryPassword}
              </span>
              <button
                onClick={() => copy(user.temporaryPassword, setCopiedPass)}
                className="flex-shrink-0 p-1.5 rounded-lg text-gold-700 hover:text-gold-900 hover:bg-gold-100 transition-colors cx-press"
                title="Copiar contraseña"
              >
                {copiedPass ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Copiar todo */}
          <button
            onClick={copyAll}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition-all cx-press"
          >
            {copiedAll ? (
              <><CheckCheck className="w-4 h-4 text-emerald-500" /><span className="text-emerald-600">¡Credenciales copiadas!</span></>
            ) : (
              <><Copy className="w-4 h-4" /> Copiar usuario y contraseña</>
            )}
          </button>

          <p className="text-xs text-center text-gray-400">
            La persona usuaria deberá cambiar su contraseña al iniciar sesión por primera vez.
          </p>
        </div>

        <div className="px-5 pb-5">
          <Button onClick={onClose} className="w-full cx-press">Entendido, cerrar</Button>
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
        className="flex items-center gap-1.5 group cx-press"
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
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200/70 rounded-xl shadow-card-hover py-1 min-w-[140px] cx-pop">
            {['STUDENT', 'TEACHER', 'ADMIN'].map((r) => (
              <button
                key={r}
                onClick={() => handleRoleChange(r)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50/60 transition-colors flex items-center gap-2 ${r === user.role ? 'font-semibold text-blue-700' : 'text-gray-700'}`}
              >
                {r === user.role && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />}
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
  async function handleToggle(userId: string) {
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

  const STAT_CARDS = [
    { label: 'Estudiantes',           value: counts.STUDENT, icon: GraduationCap, tint: '#2563EB', filter: 'STUDENT' },
    { label: 'Profesores',            value: counts.TEACHER, icon: BookOpen,      tint: '#059669', filter: 'TEACHER' },
    { label: 'Admins',                value: counts.ADMIN,   icon: ShieldCheck,   tint: '#475569', filter: 'ADMIN'   },
    { label: 'Contraseña pendiente',  value: counts.pending, icon: KeyRound,      tint: '#B8860B', filter: ''        },
  ];

  const hasFilters = Boolean(search || roleFilter || statusFilter);

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#FBF8F1]">

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

      <PageHeader
        eyebrow="Administración"
        title="Gestión de usuarios"
        subtitle={`${users.length} persona${users.length !== 1 ? 's' : ''} con acceso en esta institución.`}
        icon={Users}
        iconTint="#475569"
        className="mb-8"
        actions={
          <>
            <button
              onClick={load}
              title="Recargar"
              aria-label="Recargar la lista de personas"
              className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors cx-press"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {users.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => exportUsersCSV(users, universityId)}
                title="Exportar lista de usuarios en CSV"
                className="cx-press"
              >
                <Download className="w-4 h-4" /> CSV
              </Button>
            )}
            <Button onClick={() => setShowCreate(true)} className="cx-press">
              <Plus className="w-4 h-4" /> Nuevo usuario
            </Button>
          </>
        }
      />

      {/* KPIs — clic para filtrar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {STAT_CARDS.map((s) => {
          const active = (s.filter && roleFilter === s.filter) || (!s.filter && statusFilter === 'pending');
          return (
            <button
              key={s.label}
              onClick={() => s.filter
                ? setRoleFilter(roleFilter === s.filter ? '' : s.filter)
                : setStatusFilter(statusFilter === 'pending' ? '' : 'pending')}
              className={`text-left rounded-card transition-all cx-press cx-hop-parent ${
                active ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-[#FBF8F1]' : ''
              }`}
            >
              <div className="bg-white border border-gray-200/70 shadow-card hover:shadow-card-hover rounded-card p-5 h-full">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500 leading-tight">
                      {s.label}
                    </p>
                    <p
                      key={`${s.label}-${s.value}`}
                      className="mt-2 text-3xl font-extrabold tabular-nums leading-tight text-gray-900 cx-count"
                    >
                      {s.value}
                    </p>
                  </div>
                  <IconTile icon={s.icon} tint={s.tint} size={46} className="cx-hop" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Listado */}
      <SectionCard
        icon={Users}
        iconTint="#475569"
        eyebrow="Directorio"
        title="Personas de la institución"
        description={`Mostrando ${filtered.length} de ${users.length} usuario${users.length !== 1 ? 's' : ''}`}
        flushBody
      >
        {/* Filtros */}
        <div className="flex gap-3 flex-wrap px-6 lg:px-7 py-4 border-b border-gray-100 bg-gray-50/60">
          <div className="flex-1 min-w-52 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o correo…"
              className="w-full rounded-xl bg-white border border-gray-300 text-gray-900 placeholder-gray-400 pl-9 pr-4 py-2.5 text-sm transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl bg-white border border-gray-300 text-gray-700 px-4 py-2.5 text-sm transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
          >
            <option value="">Todos los roles</option>
            <option value="STUDENT">Estudiantes</option>
            <option value="TEACHER">Profesores</option>
            <option value="ADMIN">Admins</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl bg-white border border-gray-300 text-gray-700 px-4 py-2.5 text-sm transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
          >
            <option value="">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="pending">Con contraseña temporal</option>
          </select>
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); }}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors cx-press"
            >
              <X className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
        </div>

        {/* Tabla */}
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : filtered.length === 0 ? (
          hasFilters ? (
            <EmptyState
              illustration={<SceneSearchEmpty size={190} className="lp-drift" />}
              title="Sin resultados"
              description="Ninguna persona coincide con los filtros aplicados. Ajusta la búsqueda para seguir."
              action={
                <Button
                  variant="secondary"
                  onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); }}
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
              description="Crea la primera cuenta para que profesores y estudiantes entren a la plataforma."
              action={
                <Button onClick={() => setShowCreate(true)} className="cx-press">
                  <Plus className="w-4 h-4" /> Crear el primer usuario
                </Button>
              }
            />
          )
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-6 py-3.5">Usuario</th>
                    <th className="text-left px-5 py-3.5">Rol</th>
                    <th className="text-left px-5 py-3.5">Estado</th>
                    <th className="text-left px-5 py-3.5 hidden md:table-cell">Registrado</th>
                    <th className="text-left px-5 py-3.5 hidden lg:table-cell">Último acceso</th>
                    <th className="text-right px-6 py-3.5">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((u) => (
                    <tr key={u.id} className={`hover:bg-blue-50/40 transition-colors ${!u.isActive ? 'opacity-60' : ''}`}>
                      {/* Usuario */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 border ${
                            u.isActive
                              ? 'bg-gradient-to-br from-blue-100 to-blue-50 border-blue-100 text-blue-700'
                              : 'bg-gray-100 border-gray-200 text-gray-500'
                          }`}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-semibold text-gray-800 truncate">{u.name}</p>
                              {u.mustChangePassword && (
                                <span
                                  title="Debe cambiar contraseña"
                                  className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-gold-50 text-gold-900 border border-gold-100 font-medium"
                                >
                                  <KeyRound className="w-2.5 h-2.5" /> Temporal
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 truncate max-w-[200px]">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Rol (editable) */}
                      <td className="px-5 py-3.5">
                        <RoleEditor
                          user={u}
                          universityId={universityId}
                          onUpdated={handleUserUpdated}
                        />
                      </td>

                      {/* Estado */}
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

                      {/* Registrado */}
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <span className="text-xs text-gray-400">{formatDate(u.createdAt)}</span>
                      </td>

                      {/* Último acceso */}
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        <span className="text-xs text-gray-400">
                          {u.lastLogin ? formatDate(u.lastLogin) : '—'}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {u.role !== 'SUPERADMIN' && (
                            <button
                              onClick={() => handleToggle(u.id)}
                              disabled={togglingId === u.id}
                              title={u.isActive ? 'Desactivar usuario' : 'Activar usuario'}
                              className={`p-1.5 rounded-lg transition-colors cx-press ${
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

            {/* Pie de tabla */}
            <div className="px-6 lg:px-7 py-3 border-t border-gray-100 bg-gray-50/60">
              <p className="text-xs text-gray-400">
                Mostrando {filtered.length} de {users.length} usuario{users.length !== 1 ? 's' : ''}
              </p>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
