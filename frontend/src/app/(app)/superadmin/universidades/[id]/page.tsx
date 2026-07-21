'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import { formatDate, getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconTile } from '@/components/ui/IconTile';
import { Skeleton } from '@/components/ui/Skeleton';
import { ArtLedger, SceneEmptyBox } from '@/components/illustrations';
import toast from 'react-hot-toast';
import {
  Building2, Users, BookOpen, ArrowLeft, Globe,
  ToggleLeft, ToggleRight, GraduationCap, ShieldCheck,
  KeyRound, UserX, UserCheck, CreditCard, Activity, Edit2, X,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UniversityDetail {
  id: string; name: string; shortName: string | null; country: string;
  website: string | null; isActive: boolean; maxStudents: number; createdAt: string;
  plan: { id: string; name: string; priceUsd: string } | null;
  _count: { courses: number; users: number };
  stats: { totalStudents: number; totalTeachers: number; totalAdmins: number; totalCourses: number };
  users: UserItem[];
  courses: CourseItem[];
}

interface UserItem {
  id: string; name: string; email: string; role: string;
  isActive: boolean; lastLogin: string | null; createdAt: string;
}

interface CourseItem {
  id: string; name: string; code: string | null; period: string | null; isActive: boolean;
  createdAt: string;
  teacher: { name: string } | null;
  _count: { enrollments: number; exercises: number };
}

interface ActivityEntry {
  id: string; action: string; entity: string | null; createdAt: string;
  user: { name: string; email: string; role: string };
}

const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Estudiante', TEACHER: 'Profesor', ADMIN: 'Admin', SUPERADMIN: 'Superadmin',
};
const ROLE_COLORS: Record<string, string> = {
  STUDENT:    'bg-blue-50 text-blue-700 border border-blue-200',
  TEACHER:    'bg-emerald-50 text-emerald-700 border border-emerald-200',
  ADMIN:      'bg-slate-100 text-slate-700 border border-slate-200',
  SUPERADMIN: 'bg-red-50 text-red-700 border border-red-200',
};

type Tab = 'cursos' | 'usuarios' | 'actividad';

const TAB_LABELS: Record<Tab, string> = {
  cursos: 'Cursos', usuarios: 'Usuarios', actividad: 'Actividad',
};

// Campos de texto editables de la universidad.
type EditableField = 'name' | 'shortName' | 'country' | 'website';

const EDIT_FIELDS: Array<{ label: string; key: EditableField; placeholder: string }> = [
  { label: 'Nombre completo *', key: 'name',      placeholder: 'Nombre oficial de la institución' },
  { label: 'Nombre corto',      key: 'shortName', placeholder: 'Siglas' },
  { label: 'País',              key: 'country',   placeholder: 'Costa Rica' },
  { label: 'Sitio web',         key: 'website',   placeholder: 'https://institucion.ac.cr' },
];

// Textura de puntos sutil para la banda hero (fondo azul noche).
const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
};

const MODAL_INPUT =
  'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm transition-colors ' +
  'hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500';

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
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1 cx-press">Cancelar</Button>
          <Button loading={loading} onClick={handleReset} className="flex-1 cx-press">Enviar email</Button>
        </div>
      </div>
    </div>
  );
}

// ── Edit University Modal ─────────────────────────────────────────────────────

function EditUniversityModal({
  university,
  onClose,
  onSaved,
}: {
  university: UniversityDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name:      university.name,
    shortName: university.shortName ?? '',
    country:   university.country,
    website:   university.website ?? '',
    maxStudents: String(university.maxStudents),
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/api/v1/superadmin/universities/${university.id}`, {
        name:        form.name,
        shortName:   form.shortName || undefined,
        country:     form.country,
        website:     form.website || undefined,
        maxStudents: parseInt(form.maxStudents) || university.maxStudents,
      });
      toast.success('Universidad actualizada');
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-csq-dark/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200/70 rounded-card w-full max-w-md shadow-card-hover cx-pop">
        <div className="flex items-center justify-between gap-3 p-5 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <IconTile icon={Edit2} tint="#1B2E6E" size={42} />
            <div className="min-w-0">
              <p className="text-[0.66rem] font-bold uppercase tracking-[0.13em] text-gold-900">Superadmin</p>
              <h3 className="font-bold text-gray-900 truncate">Editar universidad</h3>
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
          {EDIT_FIELDS.map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder}
                className={MODAL_INPUT}
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Máx. estudiantes</label>
            <input
              type="number" min={10}
              value={form.maxStudents}
              onChange={(e) => setForm({ ...form, maxStudents: e.target.value })}
              className={`${MODAL_INPUT} font-mono tabular-nums`}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 cx-press">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1 cx-press">Guardar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#FBF8F1]">
      <Skeleton className="h-4 w-56 mb-6" />
      <Skeleton className="h-24 w-full rounded-card mb-8" />
      <Skeleton className="h-44 w-full rounded-card mb-8" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-card" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UniversidadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [university, setUniversity] = useState<UniversityDetail | null>(null);
  const [activity,   setActivity]   = useState<ActivityEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState<Tab>('cursos');
  const [toggling,   setToggling]   = useState(false);
  const [resetUser,  setResetUser]  = useState<UserItem | null>(null);
  const [showEdit,   setShowEdit]   = useState(false);
  const [togglingUser, setTogglingUser] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [uniRes, actRes] = await Promise.all([
        api.get<UniversityDetail>(`/api/v1/superadmin/universities/${id}`),
        api.get<ActivityEntry[]>(`/api/v1/superadmin/activity?universityId=${id}&limit=20`),
      ]);
      setUniversity(uniRes.data);
      setActivity(actRes.data);
    } catch {
      toast.error('Error al cargar universidad');
      router.push('/superadmin/universidades');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  async function handleToggleActive() {
    if (!university) return;
    setToggling(true);
    try {
      await api.patch(`/api/v1/superadmin/universities/${id}/toggle-status`);
      toast.success(university.isActive ? 'Universidad desactivada' : 'Universidad activada');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setToggling(false);
    }
  }

  async function handleToggleUser(user: UserItem) {
    setTogglingUser(user.id);
    try {
      await api.patch(`/api/v1/superadmin/users/${user.id}/toggle-status`);
      toast.success(user.isActive ? 'Usuario desactivado' : 'Usuario activado');
      setUniversity((prev) =>
        prev
          ? {
              ...prev,
              users: prev.users.map((u) =>
                u.id === user.id ? { ...u, isActive: !u.isActive } : u,
              ),
            }
          : prev,
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTogglingUser(null);
    }
  }

  if (loading) return <DetailSkeleton />;
  if (!university) return null;

  const users   = university.users   ?? [];
  const courses = university.courses ?? [];

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#FBF8F1]">
      {resetUser && (
        <ResetPwdModal user={resetUser} onClose={() => setResetUser(null)} />
      )}
      {showEdit && (
        <EditUniversityModal
          university={university}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load(); }}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/superadmin/universidades" className="hover:text-gray-800 flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Universidades
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-medium truncate max-w-xs">{university.name}</span>
      </div>

      <PageHeader
        eyebrow="Ficha institucional"
        title={university.name}
        subtitle={university.shortName ?? undefined}
        icon={Building2}
        className="mb-6"
        actions={
          <>
            <button
              onClick={() => setShowEdit(true)}
              className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-blue-700 hover:border-blue-200 hover:bg-blue-50 transition-colors cx-press"
              title="Editar universidad"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <Button
              onClick={handleToggleActive}
              loading={toggling}
              variant={university.isActive ? 'danger' : 'primary'}
              className="cx-press"
            >
              {university.isActive
                ? <><ToggleLeft className="w-4 h-4" /> Desactivar</>
                : <><ToggleRight className="w-4 h-4" /> Activar</>}
            </Button>
          </>
        }
      />

      {/* Banda hero — identidad + metadatos */}
      <div className="relative overflow-hidden rounded-card shadow-soft mb-8 lp-in bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
        <div aria-hidden className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 hidden xl:block opacity-95">
          <ArtLedger size={150} className="lp-drift" />
        </div>
        <div className="relative p-6 lg:p-8">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
              university.isActive
                ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
                : 'bg-red-500/15 text-red-200 border-red-400/30'
            }`}>
              {university.isActive ? 'Activa' : 'Inactiva'}
            </span>
            {university.plan && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-blue-100 border border-white/15 font-semibold flex items-center gap-1.5">
                <CreditCard className="w-3 h-3" /> {university.plan.name}
              </span>
            )}
          </div>
          <h2 className="text-xl lg:text-2xl font-extrabold text-white tracking-tight">
            {university.name}
          </h2>
          <div className="flex items-center gap-x-5 gap-y-2 mt-3 text-sm text-blue-200/80 flex-wrap">
            <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> {university.country}</span>
            {university.website && (
              <a
                href={university.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-300 hover:text-white transition-colors underline underline-offset-2"
              >
                {university.website}
              </a>
            )}
            <span>Creada el {formatDate(university.createdAt)}</span>
            <span className="font-mono tabular-nums">Máx. {university.maxStudents} estudiantes</span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          key={`c-${university.stats.totalCourses}`}
          label="Cursos" value={String(university.stats.totalCourses)}
          icon={BookOpen} tint="#2563EB" className="cx-count"
        />
        <StatCard
          key={`s-${university.stats.totalStudents}`}
          label="Estudiantes" value={String(university.stats.totalStudents)}
          icon={GraduationCap} tint="#059669" className="cx-count"
        />
        <StatCard
          key={`t-${university.stats.totalTeachers}`}
          label="Profesores" value={String(university.stats.totalTeachers)}
          icon={Users} tint="#475569" className="cx-count"
        />
        <StatCard
          key={`a-${university.stats.totalAdmins}`}
          label="Admins" value={String(university.stats.totalAdmins)}
          icon={ShieldCheck} tint="#B8860B" className="cx-count"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-gray-200/70 shadow-card p-1 rounded-xl mb-5 w-fit">
        {(['cursos', 'usuarios', 'actividad'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cx-press ${
              tab === t
                ? 'bg-gradient-to-br from-blue-600 to-[#1B2E6E] text-white shadow-[0_6px_16px_rgba(27,46,110,0.25)]'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {t === 'cursos'   ? `${TAB_LABELS[t]} (${courses.length})` :
             t === 'usuarios' ? `${TAB_LABELS[t]} (${users.length})`   :
             TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Cursos tab */}
      {tab === 'cursos' && (
        <SectionCard icon={BookOpen} eyebrow="Docencia" title="Cursos de la institución" flushBody>
          {courses.length === 0 ? (
            <EmptyState
              illustration={<SceneEmptyBox size={190} className="lp-drift" />}
              title="Todavía no hay cursos"
              description="Cuando el equipo docente cree cursos en esta universidad, los verás aquí."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                    <th className="text-left p-4">Curso</th>
                    <th className="text-left p-4">Profesor</th>
                    <th className="text-right p-4">Matriculados</th>
                    <th className="text-right p-4">Ejercicios</th>
                    <th className="text-left p-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {courses.map((c) => (
                    <tr key={c.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="p-4">
                        <p className="font-semibold text-gray-800">{c.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {c.code   && <span className="text-xs text-gray-400 font-mono">{c.code}</span>}
                          {c.period && <span className="text-xs text-gray-400">{c.period}</span>}
                        </div>
                      </td>
                      <td className="p-4 text-gray-500 text-xs">{c.teacher?.name ?? '—'}</td>
                      <td className="p-4 text-right text-gray-600 font-mono tabular-nums">{c._count?.enrollments ?? 0}</td>
                      <td className="p-4 text-right text-gray-600 font-mono tabular-nums">{c._count?.exercises ?? 0}</td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${c.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {c.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* Usuarios tab */}
      {tab === 'usuarios' && (
        <SectionCard icon={Users} iconTint="#475569" eyebrow="Comunidad" title="Usuarios de la institución" flushBody>
          {users.length === 0 ? (
            <EmptyState
              illustration={<SceneEmptyBox size={190} className="lp-drift" />}
              title="Todavía no hay usuarios"
              description="Los profesores, estudiantes y admins de esta universidad aparecerán en esta lista."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                    <th className="text-left p-4">Usuario</th>
                    <th className="text-left p-4">Rol</th>
                    <th className="text-left p-4">Estado</th>
                    <th className="text-left p-4">Último acceso</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{u.name}</p>
                            <p className="text-xs text-gray-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${u.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
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
                            onClick={() => handleToggleUser(u)}
                            disabled={togglingUser === u.id}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 cx-press ${
                              u.isActive
                                ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={u.isActive ? 'Desactivar' : 'Activar'}
                          >
                            {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* Actividad tab */}
      {tab === 'actividad' && (
        <SectionCard icon={Activity} iconTint="#B8860B" eyebrow="Bitácora" title="Actividad reciente" flushBody>
          {activity.length === 0 ? (
            <EmptyState
              illustration={<SceneEmptyBox size={190} className="lp-drift" />}
              title="Sin actividad registrada"
              description="Las acciones de los usuarios de esta universidad se registran automáticamente."
            />
          ) : (
            <div className="divide-y divide-gray-100">
              {activity.map((entry) => (
                <div key={entry.id} className="px-6 lg:px-7 py-4 flex items-start gap-3 hover:bg-blue-50/40 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0 mt-0.5">
                    {entry.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{entry.user.name}</p>
                    <p className="text-xs text-gray-500">{entry.action}</p>
                    {entry.entity && (
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">{entry.entity}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[entry.user.role] ?? 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                      {ROLE_LABELS[entry.user.role] ?? entry.user.role}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(entry.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
