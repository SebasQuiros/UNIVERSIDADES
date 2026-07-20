'use client';

/**
 * Panel del profesor — stats live de TODAS las companies del ejercicio.
 *
 * Muestra una card por cada company (INDIVIDUAL y GROUP) con:
 *   · número de facturas, ventas totales, AR pendiente
 *   · número de compras, AP pendiente
 *   · número de asientos en el diario
 *   · miembros / dueño
 *
 * Refresca cada 15s automáticamente. Usado para hacer seguimiento
 * en vivo durante la clase.
 */

import { useEffect, useState, useCallback } from 'react';
import type { ElementType } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ArrowLeft, RefreshCw, Building2, Users, FileText, ShoppingCart,
  CircleDollarSign, BookOpen, Power,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconTile } from '@/components/ui/IconTile';
import { SceneEmptyBox } from '@/components/illustrations';
import { getErrorMessage } from '@/lib/utils';

interface Member { id: string; name: string; email: string; role: 'OWNER' | 'MEMBER' }
interface CompanyStats {
  id: string;
  name: string;
  mode: 'INDIVIDUAL' | 'GROUP';
  legalId: string;
  isCompanyEnabled: boolean;
  owner: { id: string; name: string; email: string } | null;
  members: Member[];
  stats: {
    invoicesCount:  number;
    totalSales:     number;
    arOutstanding:  number;
    purchasesCount: number;
    totalPurchases: number;
    apOutstanding:  number;
    journalEntries: number;
  };
}
interface Dashboard {
  exercise: { id: string; isPublished?: boolean };
  companies: CompanyStats[];
}

/** Moneda en colones, formato es-CR. */
const fmtMoney = (n: number) =>
  '₡ ' + Number(n).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ProfesorCompaniesDashboard() {
  const { id }    = useParams<{ id: string }>();
  const search    = useSearchParams();
  const cursoId   = search.get('cursoId') ?? '';
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Dashboard>(
        `/api/v1/exercises/${id}/companies/dashboard`,
      );
      setData(data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh cada 15s — solo cuando la pestaña está visible.
  // Evita tráfico innecesario si el profe deja la página abierta en otra pestaña.
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        load();
      }
    }, 15000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  async function toggleEnabled(c: CompanyStats) {
    try {
      await api.patch(`/api/v1/companies/${c.id}/enabled`, {
        enabled: !c.isCompanyEnabled,
      });
      toast.success(c.isCompanyEnabled ? 'Empresa deshabilitada' : 'Empresa habilitada');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const backHref = cursoId
    ? `/profesor/ejercicios/${id}?cursoId=${cursoId}`
    : `/profesor/ejercicios/${id}`;

  return (
    <div className="flex-1 overflow-y-auto bg-[#FBF8F1]">
      <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href={backHref} className="flex items-center gap-1 transition-colors hover:text-gray-700">
            <ArrowLeft className="w-3.5 h-3.5" /> Volver al ejercicio
          </Link>
          <span className="text-gray-300">/</span>
          <span className="font-medium text-gray-700">Panel de empresas</span>
        </div>

        <PageHeader
          eyebrow="Multiempresa"
          title="Panel de empresas"
          subtitle="Monitor en vivo del estado contable de cada empresa del ejercicio."
          icon={Building2}
          actions={
            <>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={e => setAutoRefresh(e.target.checked)}
                  className="h-4 w-4 rounded accent-blue-600"
                />
                Auto-actualizar 15s
              </label>
              <Button variant="secondary" size="sm" onClick={load} disabled={loading} className="cx-press">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </>
          }
        />

        {loading && !data ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : !data || data.companies.length === 0 ? (
          <div className="rounded-card border border-gray-200/70 bg-white shadow-card">
            <EmptyState
              illustration={<SceneEmptyBox size={200} className="cx-float" />}
              title="No hay empresas creadas"
              description="Cuando los estudiantes creen su empresa para este ejercicio, aparecerán aquí."
            />
          </div>
        ) : (
          <>
            {/* Resumen global */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                label="Empresas"
                value={String(data.companies.length)}
                icon={Building2}
                tint="#2563EB"
                className="cx-pop cx-d1"
              />
              <StatCard
                label="Facturas emitidas"
                value={String(data.companies.reduce((s, c) => s + c.stats.invoicesCount, 0))}
                icon={FileText}
                tint="#059669"
                className="cx-pop cx-d2"
              />
              <StatCard
                label="Ventas totales"
                value={fmtMoney(data.companies.reduce((s, c) => s + c.stats.totalSales, 0))}
                icon={CircleDollarSign}
                tint="#B8860B"
                className="cx-pop cx-d3"
              />
              <StatCard
                label="CxC pendiente"
                value={fmtMoney(data.companies.reduce((s, c) => s + c.stats.arOutstanding, 0))}
                icon={CircleDollarSign}
                tint="#DC2626"
                className="cx-pop cx-d4"
              />
            </div>

            {/* Cards por empresa */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.companies.map((c, i) => (
                <div
                  key={c.id}
                  className={`overflow-hidden rounded-card border bg-white shadow-card transition-all cx-lift cx-pop cx-d${Math.min(i + 1, 6)} ${
                    c.isCompanyEnabled ? 'border-gray-200/70' : 'border-gold-100'
                  }`}
                >
                  {/* Cabecera */}
                  <div className={`flex items-center justify-between gap-2 border-b px-4 py-3 ${
                    c.isCompanyEnabled ? 'border-gray-100 bg-gray-50/70' : 'border-gold-100 bg-gold-50'
                  }`}>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <IconTile
                        icon={Building2}
                        tint={c.mode === 'GROUP' ? '#2563EB' : '#64748B'}
                        size={36}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-gray-900">{c.name}</div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-500">
                          {c.mode === 'GROUP' ? 'Grupal' : 'Individual'} · {c.legalId}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleEnabled(c)}
                      title={c.isCompanyEnabled ? 'Deshabilitar' : 'Habilitar'}
                      className={`rounded-lg p-1.5 transition-colors cx-press ${
                        c.isCompanyEnabled
                          ? 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                          : 'bg-gold-100 text-gold-900'
                      }`}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 p-4 text-xs">
                    <Stat icon={FileText}         label="Facturas"  value={c.stats.invoicesCount} />
                    <Stat icon={ShoppingCart}     label="Compras"   value={c.stats.purchasesCount} />
                    <Stat icon={CircleDollarSign} label="Ventas"    value={fmtMoney(c.stats.totalSales)} />
                    <Stat icon={CircleDollarSign} label="Compras ₡" value={fmtMoney(c.stats.totalPurchases)} />
                    <Stat icon={CircleDollarSign} label="CxC"       value={fmtMoney(c.stats.arOutstanding)} color="red" />
                    <Stat icon={CircleDollarSign} label="CxP"       value={fmtMoney(c.stats.apOutstanding)} color="gold" />
                    <Stat icon={BookOpen}         label="Asientos"  value={c.stats.journalEntries} />
                  </div>

                  {/* Miembros */}
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                      <Users className="w-3 h-3" />
                      {c.mode === 'GROUP'
                        ? `${c.members.length} ${c.members.length === 1 ? 'miembro' : 'miembros'}`
                        : 'Estudiante'}
                    </div>
                    {c.mode === 'INDIVIDUAL' ? (
                      c.owner ? (
                        <div className="truncate text-xs text-gray-700">
                          {c.owner.name} <span className="text-gray-400">· {c.owner.email}</span>
                        </div>
                      ) : (
                        <div className="text-xs italic text-gray-400">Sin estudiante</div>
                      )
                    ) : c.members.length === 0 ? (
                      <div className="text-xs italic text-gray-400">Sin miembros aún</div>
                    ) : (
                      <ul className="space-y-0.5">
                        {c.members.map(m => (
                          <li key={m.id} className="truncate text-xs text-gray-700">
                            {m.name}
                            {m.role === 'OWNER' && (
                              <span className="ml-1.5 rounded bg-blue-100 px-1 py-0.5 text-[9px] font-bold uppercase text-blue-800">
                                dueño
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

function Stat({
  icon: Icon, label, value, color,
}: {
  icon: ElementType; label: string; value: string | number;
  color?: 'red' | 'gold';
}) {
  const cls = color === 'red'  ? 'text-red-700'
            : color === 'gold' ? 'text-gold-900'
            : 'text-gray-800';
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
        <div className={`truncate text-xs font-semibold tabular-nums ${cls}`}>
          {value}
        </div>
      </div>
    </div>
  );
}
