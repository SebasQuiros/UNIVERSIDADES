'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconTile } from '@/components/ui/IconTile';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { ArtLedger, SceneEmptyBox, SceneSearchEmpty } from '@/components/illustrations';
import toast from 'react-hot-toast';
import {
  Building2, Plus, Search, X, Users, BookOpen, Globe,
  ToggleLeft, ToggleRight, Eye, CheckCircle2, GraduationCap,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface University {
  id:          string;
  name:        string;
  shortName:   string | null;
  country:     string;
  website:     string | null;
  isActive:    boolean;
  maxStudents: number;
  createdAt:   string;
  _count:      { users: number; courses: number };
}

// Textura de puntos sutil para la banda hero (fondo azul noche).
const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
};

// ── Create University Modal ───────────────────────────────────────────────────

function CreateUniversityModal({
  onClose,
  onCreated,
}: {
  onClose:   () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name:        '',
    shortName:   '',
    country:     'Costa Rica',
    website:     '',
    maxStudents: '200',
    adminName:   '',
    adminEmail:  '',
  });
  const [saving,  setSaving]  = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [created, setCreated] = useState<{ tempPassword: string; adminEmail: string } | null>(null);

  const inputCls =
    'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm transition-colors ' +
    'hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim())    errs.name    = 'Nombre requerido';
    if (!form.country.trim()) errs.country = 'País requerido';
    if (form.adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail)) {
      errs.adminEmail = 'Correo inválido';
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const { data } = await api.post<{ tempPassword?: string }>('/api/v1/superadmin/universities', {
        name:        form.name.trim(),
        shortName:   form.shortName.trim() || undefined,
        country:     form.country.trim(),
        website:     form.website.trim() || undefined,
        maxStudents: parseInt(form.maxStudents) || 200,
        adminName:   form.adminName.trim() || undefined,
        adminEmail:  form.adminEmail.trim() || undefined,
      });
      toast.success('Universidad creada exitosamente');
      if (data.tempPassword) {
        setCreated({ tempPassword: data.tempPassword, adminEmail: form.adminEmail });
      } else {
        onCreated();
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-csq-dark/50 backdrop-blur-sm" />
        <div className="relative bg-white border border-gray-200/70 rounded-card w-full max-w-sm shadow-card-hover p-7 text-center cx-pop">
          <div className="flex justify-center mb-4 cx-tada">
            <IconTile icon={CheckCircle2} tint="#059669" size={54} />
          </div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-900 mb-1">
            Alta completada
          </p>
          <h3 className="text-lg font-bold text-gray-900 mb-1.5">Universidad creada</h3>
          <p className="text-sm text-gray-500 mb-4">
            Se creó el administrador <strong className="text-gray-700">{created.adminEmail}</strong> con
            contraseña temporal:
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-mono tabular-nums text-lg font-bold text-gray-900 mb-4 tracking-widest select-all">
            {created.tempPassword}
          </div>
          <p className="text-xs text-gold-900 bg-gold-50 border border-gold-100 rounded-xl px-3 py-2 mb-5">
            Comparte esta contraseña de forma segura. La persona administradora deberá cambiarla al ingresar.
          </p>
          <Button onClick={() => { onCreated(); }} className="w-full cx-press">Entendido</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-csq-dark/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200/70 rounded-card w-full max-w-lg shadow-card-hover overflow-y-auto max-h-[90vh] cx-pop">
        <div className="flex items-center justify-between gap-3 p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3 min-w-0">
            <IconTile icon={Building2} tint="#1B2E6E" size={42} />
            <div className="min-w-0">
              <p className="text-[0.66rem] font-bold uppercase tracking-[0.13em] text-gold-900">Superadmin</p>
              <h3 className="font-bold text-gray-900 truncate">Nueva universidad</h3>
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
          <div className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gray-400">
            Datos de la institución
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nombre oficial de la institución"
              className={inputCls}
            />
            {errors.name && <p className="text-xs text-red-600 mt-1 cx-shake">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre corto</label>
              <input
                value={form.shortName}
                onChange={(e) => setForm({ ...form, shortName: e.target.value })}
                placeholder="Siglas"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">País *</label>
              <input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="Costa Rica"
                className={inputCls}
              />
              {errors.country && <p className="text-xs text-red-600 mt-1 cx-shake">{errors.country}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sitio web</label>
            <input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://institucion.ac.cr"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Máx. estudiantes</label>
            <input
              type="number"
              value={form.maxStudents}
              onChange={(e) => setForm({ ...form, maxStudents: e.target.value })}
              min={10}
              className={`${inputCls} font-mono tabular-nums`}
            />
          </div>

          {/* Admin inicial */}
          <div className="border-t border-gray-100 pt-4">
            <div className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gray-400 mb-3">
              Administrador inicial (opcional)
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del admin</label>
                <input
                  value={form.adminName}
                  onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                  placeholder="Nombre y apellidos"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email del admin</label>
                <input
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                  placeholder="admin@institucion.ac.cr"
                  className={inputCls}
                />
                {errors.adminEmail && <p className="text-xs text-red-600 mt-1 cx-shake">{errors.adminEmail}</p>}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 cx-press">
              Cancelar
            </Button>
            <Button type="submit" loading={saving} className="flex-1 cx-press">
              Crear universidad
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UniversidadesPage() {
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate,   setShowCreate]   = useState(false);
  const [toggling,     setToggling]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<University[]>('/api/v1/superadmin/universities');
      setUniversities(data);
    } catch {
      toast.error('Error al cargar universidades');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(u: University) {
    setToggling(u.id);
    try {
      await api.patch(`/api/v1/superadmin/universities/${u.id}/toggle-status`);
      setUniversities((prev) =>
        prev.map((x) => x.id === u.id ? { ...x, isActive: !x.isActive } : x),
      );
      toast.success(u.isActive ? 'Universidad desactivada' : 'Universidad activada');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setToggling(null);
    }
  }

  const filtered = universities.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      u.name.toLowerCase().includes(q) ||
      (u.shortName?.toLowerCase() ?? '').includes(q) ||
      u.country.toLowerCase().includes(q);
    const matchStatus =
      !statusFilter ||
      (statusFilter === 'active'   && u.isActive)  ||
      (statusFilter === 'inactive' && !u.isActive);
    return matchSearch && matchStatus;
  });

  const activeCount = universities.filter((u) => u.isActive).length;
  const totalUsers  = universities.reduce((s, u) => s + (u._count?.users ?? 0), 0);
  const hasFilters  = Boolean(search || statusFilter);

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#FBF8F1]">
      {showCreate && (
        <CreateUniversityModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      <PageHeader
        eyebrow="Superadmin"
        title="Universidades"
        subtitle="Instituciones registradas en la plataforma y su estado de servicio."
        icon={Building2}
        className="mb-8"
        actions={
          <Button onClick={() => setShowCreate(true)} className="cx-press">
            <Plus className="w-4 h-4" /> Nueva universidad
          </Button>
        }
      />

      {/* Banda hero — resumen de la red institucional */}
      <div className="relative overflow-hidden rounded-card shadow-soft mb-8 lp-in bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
        <div aria-hidden className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 hidden xl:block opacity-95">
          <ArtLedger size={170} className="lp-drift" />
        </div>
        <div className="relative p-6 lg:p-8">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-gold-500 mb-2">
            Red institucional
          </p>
          <h2 className="text-xl lg:text-2xl font-extrabold text-white tracking-tight">
            Instituciones conectadas
          </h2>
          <p className="text-sm text-blue-200/80 mt-1.5 max-w-md">
            Cada universidad opera con sus propios cursos, usuarios y empresas aisladas.
          </p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 xl:max-w-3xl">
            <StatCard
              key={`reg-${universities.length}`}
              variant="dark"
              label="Registradas"
              value={String(universities.length)}
              icon={Building2}
              className="cx-count"
            />
            <StatCard
              key={`act-${activeCount}`}
              variant="dark"
              label="Activas"
              value={String(activeCount)}
              icon={CheckCircle2}
              hint={`${universities.length - activeCount} inactivas`}
              className="cx-count"
            />
            <StatCard
              key={`usr-${totalUsers}`}
              variant="dark"
              label="Usuarios totales"
              value={String(totalUsers)}
              icon={GraduationCap}
              className="cx-count"
            />
          </div>
        </div>
      </div>

      {/* Listado */}
      <SectionCard
        icon={Building2}
        eyebrow="Directorio"
        title="Listado de universidades"
        description={`${filtered.length} de ${universities.length} visibles con los filtros actuales`}
        flushBody
      >
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 px-6 lg:px-7 py-4 border-b border-gray-100 bg-gray-50/60">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, siglas o país…"
              className="w-full rounded-xl bg-white border border-gray-300 text-gray-900 placeholder-gray-400 pl-9 pr-4 py-2.5 text-sm transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl bg-white border border-gray-300 px-3 py-2.5 text-sm text-gray-700 transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
          >
            <option value="">Todos los estados</option>
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
          </select>
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); }}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors cx-press"
            >
              <X className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
        </div>

        {loading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : filtered.length === 0 ? (
          hasFilters ? (
            <EmptyState
              illustration={<SceneSearchEmpty size={190} className="lp-drift" />}
              title="Sin resultados"
              description="Ninguna universidad coincide con los filtros aplicados. Prueba con otro término o limpia la búsqueda."
              action={
                <Button variant="secondary" onClick={() => { setSearch(''); setStatusFilter(''); }} className="cx-press">
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              illustration={<SceneEmptyBox size={200} className="lp-drift" />}
              title="Aún no hay universidades"
              description="Registra la primera institución para que sus profesores y estudiantes empiecen a trabajar."
              action={
                <Button onClick={() => setShowCreate(true)} className="cx-press">
                  <Plus className="w-4 h-4" /> Registrar universidad
                </Button>
              }
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                  <th className="text-left p-4">Universidad</th>
                  <th className="text-left p-4">País</th>
                  <th className="text-right p-4">Usuarios</th>
                  <th className="text-right p-4">Cursos</th>
                  <th className="text-left p-4">Estado</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((u, i) => (
                  <tr
                    key={u.id}
                    className={`group cx-hop-parent hover:bg-blue-50/40 transition-colors cx-pop ${i < 6 ? `cx-d${i + 1}` : ''}`}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <IconTile icon={Building2} tint="#1B2E6E" size={38} className="cx-hop" />
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 truncate">{u.name}</p>
                          {u.shortName && (
                            <p className="text-xs text-gray-400 font-mono">{u.shortName}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1.5 text-gray-500 text-xs">
                        <Globe className="w-3.5 h-3.5" /> {u.country}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="inline-flex items-center justify-end gap-1 text-gray-600 text-xs font-mono tabular-nums">
                        <Users className="w-3.5 h-3.5 text-gray-400" /> {u._count.users}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="inline-flex items-center justify-end gap-1 text-gray-600 text-xs font-mono tabular-nums">
                        <BookOpen className="w-3.5 h-3.5 text-gray-400" /> {u._count.courses}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${u.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {u.isActive ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/superadmin/universidades/${u.id}`}>
                          <button
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-700 hover:bg-blue-50 transition-colors cx-press"
                            title="Ver detalles"
                            aria-label={`Ver detalles de ${u.name}`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </Link>
                        <button
                          onClick={() => handleToggle(u)}
                          disabled={toggling === u.id}
                          className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 cx-press ${
                            u.isActive
                              ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                              : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={u.isActive ? 'Desactivar' : 'Activar'}
                        >
                          {u.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
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
    </div>
  );
}
