'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import { Activity, Search, RefreshCw } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface University { id: string; name: string; shortName: string | null; }

interface ActivityEntry {
  id:             string;
  action:         string;
  entity:         string | null;
  entityId:       string | null;
  details:        any;
  createdAt:      string;
  user:           { id: string; name: string; email: string; role: string };
  universityName: string | null;
}

// ── Role colors ───────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  STUDENT:    'bg-blue-50 text-blue-700 border-blue-200',
  TEACHER:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  ADMIN:      'bg-purple-50 text-purple-700 border-purple-200',
  SUPERADMIN: 'bg-red-50 text-red-700 border-red-200',
};

const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Est', TEACHER: 'Prof', ADMIN: 'Admin', SUPERADMIN: 'SA',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFull(dateStr: string) {
  return new Date(dateStr).toLocaleString('es', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatRelative(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)   return 'Ahora mismo';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  return `Hace ${Math.floor(diff / 86400)} días`;
}

// ── Activity Row ──────────────────────────────────────────────────────────────

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  return (
    <div className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0 mt-0.5">
        {entry.user.name.charAt(0).toUpperCase()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-sm font-semibold text-gray-800">{entry.user.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${ROLE_COLORS[entry.user.role] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {ROLE_LABELS[entry.user.role] ?? entry.user.role}
          </span>
          {entry.universityName && (
            <span className="text-xs text-gray-400">· {entry.universityName}</span>
          )}
        </div>
        <p className="text-sm text-gray-600">{entry.action}</p>
        {entry.entity && (
          <p className="text-xs text-gray-400 mt-0.5">
            {entry.entity}{entry.entityId ? ` · ${entry.entityId.slice(0, 8)}…` : ''}
          </p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">{entry.user.email}</p>
      </div>

      {/* Time */}
      <div className="flex-shrink-0 text-right">
        <p className="text-xs text-gray-500">{formatRelative(entry.createdAt)}</p>
        <p className="text-xs text-gray-400 mt-0.5">{formatFull(entry.createdAt)}</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ActividadPage() {
  const [entries,      setEntries]      = useState<ActivityEntry[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [uniFilter,    setUniFilter]    = useState('');
  const [search,       setSearch]       = useState('');
  const [limit,        setLimit]        = useState(50);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (uniFilter) params.set('universityId', uniFilter);

      const [actRes, univRes] = await Promise.all([
        api.get<ActivityEntry[]>(`/api/v1/superadmin/activity?${params}`),
        api.get<University[]>('/api/v1/superadmin/universities'),
      ]);
      setEntries(actRes.data);
      setUniversities(univRes.data);
    } catch {
      toast.error('Error al cargar actividad');
    } finally {
      setLoading(false);
    }
  }, [uniFilter, limit]);

  useEffect(() => { load(); }, [load]);

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    return (
      !q ||
      e.user.name.toLowerCase().includes(q) ||
      e.user.email.toLowerCase().includes(q) ||
      e.action.toLowerCase().includes(q) ||
      (e.entity?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Actividad</h2>
          <p className="text-gray-500 text-sm mt-1">
            Registro de acciones en la plataforma
          </p>
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors disabled:opacity-50"
          title="Recargar"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por usuario, acción..."
            className="w-full rounded-xl bg-white border border-gray-300 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={uniFilter}
          onChange={(e) => { setUniFilter(e.target.value); }}
          className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Todas las universidades</option>
          {universities.map((u) => (
            <option key={u.id} value={u.id}>{u.shortName ?? u.name}</option>
          ))}
        </select>
        <select
          value={String(limit)}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="20">Últimas 20</option>
          <option value="50">Últimas 50</option>
          <option value="100">Últimas 100</option>
          <option value="200">Últimas 200</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Activity className="w-8 h-8 text-gray-300 mb-3" />
          <p className="text-gray-500">
            {search || uniFilter ? 'Sin resultados para los filtros aplicados' : 'No hay actividad registrada'}
          </p>
          {!search && !uniFilter && (
            <p className="text-xs text-gray-400 mt-1">
              Las acciones de los usuarios en la plataforma se registran automáticamente.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
          {/* Header row */}
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {filtered.length} evento{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Timeline */}
          <div className="divide-y divide-gray-100">
            {filtered.map((entry, i) => {
              const prev = filtered[i - 1];
              const currDate = new Date(entry.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' });
              const prevDate = prev ? new Date(prev.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
              const showDivider = currDate !== prevDate;

              return (
                <div key={entry.id}>
                  {showDivider && (
                    <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                      <span className="text-xs font-semibold text-gray-500">{currDate}</span>
                    </div>
                  )}
                  <ActivityRow entry={entry} />
                </div>
              );
            })}
          </div>

          {/* Load more */}
          {filtered.length >= limit && (
            <div className="px-5 py-4 border-t border-gray-100 text-center">
              <button
                onClick={() => setLimit((l) => l + 50)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Cargar más
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
