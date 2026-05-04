'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate, getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import {
  Building2, Users, BookOpen, ArrowLeft, Globe,
  ToggleLeft, ToggleRight, GraduationCap, ShieldCheck,
  KeyRound, UserX, UserCheck, CreditCard, Activity, Edit2, X, Check,
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
  ADMIN:      'bg-purple-50 text-purple-700 border border-purple-200',
  SUPERADMIN: 'bg-red-50 text-red-700 border border-red-200',
};

type Tab = 'cursos' | 'usuarios' | 'actividad';

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
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        <KeyRound className="w-8 h-8 text-amber-500 mb-3" />
        <h3 className="font-semibold text-gray-900 mb-1">Resetear contraseña</h3>
        <p className="text-sm text-gray-500 mb-4">
          {temp ? 'Contraseña temporal generada:' : `¿Resetear la contraseña de ${user.name}?`}
        </p>
        {temp ? (
          <>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-mono text-lg font-bold text-gray-900 mb-3 tracking-widest text-center">
              {temp}
            </div>
            <p className="text-xs text-amber-600 mb-4">El usuario deberá cambiar esta contraseña al ingresar.</p>
            <Button onClick={onClose} className="w-full">Cerrar</Button>
          </>
        ) : (
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button loading={loading} onClick={handleReset} className="flex-1">Resetear</Button>
          </div>
        )}
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Editar universidad</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {[
            { label: 'Nombre completo *', key: 'name', placeholder: 'Universidad ...' },
            { label: 'Nombre corto',      key: 'shortName', placeholder: 'UTN' },
            { label: 'País',              key: 'country', placeholder: 'Costa Rica' },
            { label: 'Sitio web',         key: 'website', placeholder: 'https://...' },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                value={(form as any)[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Máx. estudiantes</label>
            <input
              type="number" min={10}
              value={form.maxStudents}
              onChange={(e) => setForm({ ...form, maxStudents: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1">Guardar</Button>
          </div>
        </form>
      </div>
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

  if (loading) return <div className="flex-1 flex items-center justify-center"><Spinner size="lg" /></div>;
  if (!university) return null;

  const users   = university.users   ?? [];
  const courses = university.courses ?? [];

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
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
        <Link href="/superadmin/universidades" className="hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Universidades
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium truncate max-w-xs">{university.name}</span>
      </div>

      {/* Header card */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${university.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                {university.isActive ? 'Activa' : 'Inactiva'}
              </span>
              {university.plan && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium flex items-center gap-1">
                  <CreditCard className="w-3 h-3" /> {university.plan.name}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900">{university.name}</h2>
            {university.shortName && <p className="text-gray-500 text-sm mt-0.5">{university.shortName}</p>}
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 flex-wrap">
              <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> {university.country}</span>
              {university.website && (
                <a href={university.website} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700">
                  {university.website}
                </a>
              )}
              <span>Creada: {formatDate(university.createdAt)}</span>
              <span>Máx. {university.maxStudents} est.</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEdit(true)}
              className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors"
              title="Editar"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <Button
              onClick={handleToggleActive}
              loading={toggling}
              variant={university.isActive ? 'danger' : 'primary'}
            >
              {university.isActive
                ? <><ToggleLeft className="w-4 h-4" /> Desactivar</>
                : <><ToggleRight className="w-4 h-4" /> Activar</>}
            </Button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-gray-100">
          {[
            { label: 'Cursos',      value: university.stats.totalCourses,   icon: BookOpen,      color: 'text-blue-600',    bg: 'bg-blue-50' },
            { label: 'Estudiantes', value: university.stats.totalStudents,  icon: GraduationCap, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Profesores',  value: university.stats.totalTeachers,  icon: Users,         color: 'text-purple-600',  bg: 'bg-purple-50' },
            { label: 'Admins',      value: university.stats.totalAdmins,    icon: ShieldCheck,   color: 'text-amber-600',   bg: 'bg-amber-50' },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4 w-fit">
        {(['cursos', 'usuarios', 'actividad'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'cursos'    ? `Cursos (${courses.length})`   :
             t === 'usuarios'  ? `Usuarios (${users.length})`   :
             'Actividad'}
          </button>
        ))}
      </div>

      {/* Cursos tab */}
      {tab === 'cursos' && (
        courses.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <BookOpen className="w-8 h-8 text-gray-300 mb-3" />
            <p className="text-gray-500">No hay cursos en esta universidad</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-200">
                    <th className="text-left p-4">Curso</th>
                    <th className="text-left p-4">Profesor</th>
                    <th className="text-right p-4">Matriculados</th>
                    <th className="text-right p-4">Ejercicios</th>
                    <th className="text-left p-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {courses.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <p className="font-medium text-gray-700">{c.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {c.code   && <span className="text-xs text-gray-400 font-mono">{c.code}</span>}
                          {c.period && <span className="text-xs text-gray-400">{c.period}</span>}
                        </div>
                      </td>
                      <td className="p-4 text-gray-500 text-xs">{c.teacher?.name ?? '—'}</td>
                      <td className="p-4 text-right text-gray-500">{c._count?.enrollments ?? 0}</td>
                      <td className="p-4 text-right text-gray-500">{c._count?.exercises ?? 0}</td>
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
          </div>
        )
      )}

      {/* Usuarios tab */}
      {tab === 'usuarios' && (
        users.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Users className="w-8 h-8 text-gray-300 mb-3" />
            <p className="text-gray-500">No hay usuarios en esta universidad</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-200">
                    <th className="text-left p-4">Usuario</th>
                    <th className="text-left p-4">Rol</th>
                    <th className="text-left p-4">Estado</th>
                    <th className="text-left p-4">Último acceso</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-700">{u.name}</p>
                            <p className="text-xs text-gray-400">{u.email}</p>
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
                            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Resetear contraseña"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleUser(u)}
                            disabled={togglingUser === u.id}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
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
          </div>
        )
      )}

      {/* Actividad tab */}
      {tab === 'actividad' && (
        activity.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Activity className="w-8 h-8 text-gray-300 mb-3" />
            <p className="text-gray-500">Sin actividad registrada</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden divide-y divide-gray-100">
            {activity.map((entry) => (
              <div key={entry.id} className="px-5 py-4 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0 mt-0.5">
                  {entry.user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{entry.user.name}</p>
                  <p className="text-xs text-gray-500">{entry.action}</p>
                  {entry.entity && (
                    <p className="text-xs text-gray-400 mt-0.5">{entry.entity}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${ROLE_COLORS[entry.user.role] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    {ROLE_LABELS[entry.user.role] ?? entry.user.role}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(entry.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
