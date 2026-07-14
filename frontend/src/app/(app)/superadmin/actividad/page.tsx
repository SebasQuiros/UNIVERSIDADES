'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ArtGrowth, SceneEmptyBox, SceneSearchEmpty } from '@/components/illustrations';
import toast from 'react-hot-toast';
import { Activity, Search, RefreshCw, X, Users, Building2, ListChecks } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface University { id: string; name: string; shortName: string | null; }

interface ActivityEntry {
  id:             string;
  action:         string;
  entity:         string | null;
  entityId:       string | null;
  details:        unknown;
  createdAt:      string;
  user:           { id: string; name: string; email: string; role: string };
  universityName: string | null;
}

// ── Role colors ───────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  STUDENT:    'bg-blue-50 text-blue-700 border-blue-200',
  TEACHER:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  ADMIN:      'bg-slate-100 text-slate-700 border-slate-200',
  SUPERADMIN: 'bg-red-50 text-red-700 border-red-200',
};

const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Est', TEACHER: 'Prof', ADMIN: 'Admin', SUPERADMIN: 'SA',
};

// Textura de puntos sutil para la banda hero (fondo azul noche).
const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFull(dateStr: string) {
  return new Date(dateStr).toLocaleString('es-CR', {
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
    <div className="flex items-start gap-4 px-6 lg:px-7 py-4 hover:bg-blue-50/40 transition-colors cx-hop-parent">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0 mt-0.5 cx-hop">
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
          <p className="text-xs text-gray-400 mt-0.5 font-mono">
            {entry.entity}{entry.entityId ? ` · ${entry.entityId.slice(0, 8)}…` : ''}
          </p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">{entry.user.email}</p>
      </div>

      {/* Time */}
      <div className="flex-shrink-0 text-right">
        <p className="text-xs font-medium text-gray-500">{formatRelative(entry.createdAt)}</p>
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

  const distinctUsers = new Set(filtered.map((e) => e.user.id)).size;
  const distinctUnis  = new Set(
    filtered.map((e) => e.universityName).filter((n): n is string => Boolean(n)),
  ).size;
  const hasFilters = Boolean(search || uniFilter);

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#F4F6F8]">
      <PageHeader
        eyebrow="Superadmin"
        title="Actividad"
        subtitle="Bitácora de acciones registradas en toda la plataforma."
        icon={Activity}
        className="mb-8"
        actions={
          <Button
            variant="secondary"
            onClick={() => load()}
            disabled={loading}
            className="cx-press"
            title="Recargar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Recargar
          </Button>
        }
      />

      {/* Banda hero — pulso de la plataforma */}
      <div className="relative overflow-hidden rounded-card shadow-soft mb-8 lp-in bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
        <div aria-hidden className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 hidden xl:block opacity-95">
          <ArtGrowth size={175} className="lp-drift" />
        </div>
        <div className="relative p-6 lg:p-8">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-gold-500 mb-2">
            Pulso de la plataforma
          </p>
          <h2 className="text-xl lg:text-2xl font-extrabold text-white tracking-tight">
            Qué está pasando ahora
          </h2>
          <p className="text-sm text-blue-200/80 mt-1.5 max-w-md">
            Eventos visibles según los filtros seleccionados.
          </p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 xl:max-w-3xl">
            <StatCard
              key={`ev-${filtered.length}`}
              variant="dark"
              label="Eventos"
              value={String(filtered.length)}
              icon={ListChecks}
              className="cx-count"
            />
            <StatCard
              key={`us-${distinctUsers}`}
              variant="dark"
              label="Usuarios distintos"
              value={String(distinctUsers)}
              icon={Users}
              className="cx-count"
            />
            <StatCard
              key={`un-${distinctUnis}`}
              variant="dark"
              label="Universidades"
              value={String(distinctUnis)}
              icon={Building2}
              className="cx-count"
            />
          </div>
        </div>
      </div>

      {/* Bitácora */}
      <SectionCard
        icon={Activity}
        iconTint="#B8860B"
        eyebrow="Bitácora"
        title="Registro de eventos"
        description={`${filtered.length} evento${filtered.length !== 1 ? 's' : ''} en pantalla`}
        flushBody
      >
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 px-6 lg:px-7 py-4 border-b border-gray-100 bg-gray-50/60">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por usuario, acción o entidad…"
              className="w-full rounded-xl bg-white border border-gray-300 pl-9 pr-4 py-2.5 text-sm transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
            />
          </div>
          <select
            value={uniFilter}
            onChange={(e) => { setUniFilter(e.target.value); }}
            className="rounded-xl bg-white border border-gray-300 px-3 py-2.5 text-sm text-gray-700 transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
          >
            <option value="">Todas las universidades</option>
            {universities.map((u) => (
              <option key={u.id} value={u.id}>{u.shortName ?? u.name}</option>
            ))}
          </select>
          <select
            value={String(limit)}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-xl bg-white border border-gray-300 px-3 py-2.5 text-sm text-gray-700 transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
          >
            <option value="20">Últimas 20</option>
            <option value="50">Últimas 50</option>
            <option value="100">Últimas 100</option>
            <option value="200">Últimas 200</option>
          </select>
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setUniFilter(''); }}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors cx-press"
            >
              <X className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
        </div>

        {loading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 px-6 lg:px-7 py-4">
                <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-64" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          hasFilters ? (
            <EmptyState
              illustration={<SceneSearchEmpty size={190} className="lp-drift" />}
              title="Sin resultados"
              description="Ningún evento coincide con los filtros aplicados. Prueba a ampliar el rango o limpiar la búsqueda."
              action={
                <Button variant="secondary" onClick={() => { setSearch(''); setUniFilter(''); }} className="cx-press">
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              illustration={<SceneEmptyBox size={200} className="lp-drift" />}
              title="Sin actividad registrada"
              description="Las acciones de los usuarios en la plataforma se registran automáticamente y aparecerán aquí."
            />
          )
        ) : (
          <>
            {/* Timeline */}
            <div className="divide-y divide-gray-100">
              {filtered.map((entry, i) => {
                const prev = filtered[i - 1];
                const currDate = new Date(entry.createdAt).toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric' });
                const prevDate = prev ? new Date(prev.createdAt).toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
                const showDivider = currDate !== prevDate;

                return (
                  <div key={entry.id}>
                    {showDivider && (
                      <div className="px-6 lg:px-7 py-2 bg-gray-50 border-b border-gray-100">
                        <span className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gray-500">
                          {currDate}
                        </span>
                      </div>
                    )}
                    <ActivityRow entry={entry} />
                  </div>
                );
              })}
            </div>

            {/* Cargar más */}
            {filtered.length >= limit && (
              <div className="px-6 lg:px-7 py-4 border-t border-gray-100 text-center">
                <Button variant="secondary" onClick={() => setLimit((l) => l + 50)} className="cx-press">
                  Cargar más eventos
                </Button>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
}
