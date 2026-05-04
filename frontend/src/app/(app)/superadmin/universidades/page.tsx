'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import {
  Building2, Plus, Search, X, Users, BookOpen, Globe,
  ToggleLeft, ToggleRight, Eye,
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
      const { data } = await api.post<{ university: any; tempPassword?: string }>('/api/v1/superadmin/universities', {
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
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div className="relative bg-white border border-gray-200 rounded-2xl w-full max-w-sm shadow-xl p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="font-bold text-gray-900 mb-1">Universidad creada</h3>
          <p className="text-sm text-gray-500 mb-4">
            Se creó el administrador <strong>{created.adminEmail}</strong> con contraseña temporal:
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-mono text-lg font-bold text-gray-900 mb-4 tracking-widest">
            {created.tempPassword}
          </div>
          <p className="text-xs text-amber-600 mb-5">
            Comparte esta contraseña de forma segura. El admin deberá cambiarla al ingresar.
          </p>
          <Button onClick={() => { onCreated(); }} className="w-full">Entendido</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 rounded-2xl w-full max-w-lg shadow-xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-gray-900">Nueva Universidad</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Datos de la universidad */}
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos de la institución</div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Universidad Técnica Nacional"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre corto</label>
              <input
                value={form.shortName}
                onChange={(e) => setForm({ ...form, shortName: e.target.value })}
                placeholder="UTN"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">País *</label>
              <input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="Costa Rica"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.country && <p className="text-xs text-red-500 mt-1">{errors.country}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sitio web</label>
            <input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://utn.ac.cr"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Máx. estudiantes</label>
            <input
              type="number"
              value={form.maxStudents}
              onChange={(e) => setForm({ ...form, maxStudents: e.target.value })}
              min={10}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Admin inicial */}
          <div className="border-t border-gray-100 pt-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Administrador inicial (opcional)
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del admin</label>
                <input
                  value={form.adminName}
                  onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                  placeholder="Juan Pérez"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email del admin</label>
                <input
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                  placeholder="admin@universidad.cr"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.adminEmail && <p className="text-xs text-red-500 mt-1">{errors.adminEmail}</p>}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={saving} className="flex-1">Crear universidad</Button>
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

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      {showCreate && (
        <CreateUniversityModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Universidades</h2>
          <p className="text-gray-500 text-sm mt-1">
            {universities.length} registradas &mdash; {universities.filter((u) => u.isActive).length} activas
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> Nueva universidad
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar universidades..."
            className="w-full rounded-xl bg-white border border-gray-300 text-gray-900 placeholder-gray-400 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activas</option>
          <option value="inactive">Inactivas</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Building2 className="w-8 h-8 text-gray-300 mb-3" />
          <p className="text-gray-500">
            {search || statusFilter ? 'Sin resultados para los filtros aplicados' : 'No hay universidades registradas'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-200">
                  <th className="text-left p-4">Universidad</th>
                  <th className="text-left p-4">País</th>
                  <th className="text-right p-4">Usuarios</th>
                  <th className="text-right p-4">Cursos</th>
                  <th className="text-left p-4">Estado</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{u.name}</p>
                          {u.shortName && <p className="text-xs text-gray-400">{u.shortName}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1.5 text-gray-500 text-xs">
                        <Globe className="w-3.5 h-3.5" /> {u.country}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="flex items-center justify-end gap-1 text-gray-500 text-xs">
                        <Users className="w-3.5 h-3.5" /> {u._count.users}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="flex items-center justify-end gap-1 text-gray-500 text-xs">
                        <BookOpen className="w-3.5 h-3.5" /> {u._count.courses}
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
                          <button className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Ver detalles">
                            <Eye className="w-4 h-4" />
                          </button>
                        </Link>
                        <button
                          onClick={() => handleToggle(u)}
                          disabled={toggling === u.id}
                          className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
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
        </div>
      )}
    </div>
  );
}
