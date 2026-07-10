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
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ArrowLeft, RefreshCw, Building2, Users, FileText, ShoppingCart,
  CircleDollarSign, BookOpen, Power,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
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

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/60">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        <div className="flex items-center justify-between">
          <Link
            href={cursoId
              ? `/profesor/ejercicios/${id}?cursoId=${cursoId}`
              : `/profesor/ejercicios/${id}`}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al ejercicio
          </Link>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
              />
              Auto-actualizar 15s
            </label>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel de empresas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor en vivo del estado contable de cada empresa del ejercicio.
          </p>
        </div>

        {loading && !data ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : !data || data.companies.length === 0 ? (
          <Card className="py-14 text-center text-sm text-gray-500">
            No hay empresas creadas para este ejercicio.
          </Card>
        ) : (
          <>
            {/* Resumen global */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryStat
                label="Empresas"
                value={data.companies.length}
                icon={Building2}
                color="blue"
              />
              <SummaryStat
                label="Facturas emitidas"
                value={data.companies.reduce((s, c) => s + c.stats.invoicesCount, 0)}
                icon={FileText}
                color="emerald"
              />
              <SummaryStat
                label="Ventas totales"
                value={fmtMoney(data.companies.reduce((s, c) => s + c.stats.totalSales, 0))}
                icon={CircleDollarSign}
                color="amber"
                isMoney
              />
              <SummaryStat
                label="AR pendiente"
                value={fmtMoney(data.companies.reduce((s, c) => s + c.stats.arOutstanding, 0))}
                icon={CircleDollarSign}
                color="red"
                isMoney
              />
            </div>

            {/* Cards por empresa */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.companies.map(c => (
                <Card
                  key={c.id}
                  className={`overflow-hidden ${
                    c.isCompanyEnabled ? '' : 'border-amber-300'
                  }`}
                >
                  {/* Header */}
                  <div className={`px-4 py-3 ${
                    c.isCompanyEnabled ? 'bg-gray-50' : 'bg-amber-50'
                  } border-b border-gray-100 flex items-center justify-between gap-2`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        c.mode === 'GROUP' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                      }`}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-gray-900 truncate">{c.name}</div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-500">
                          {c.mode} · {c.legalId}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleEnabled(c)}
                      title={c.isCompanyEnabled ? 'Deshabilitar' : 'Habilitar'}
                      className={`p-1.5 rounded-lg ${
                        c.isCompanyEnabled
                          ? 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                          : 'text-amber-700 bg-amber-100'
                      }`}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="p-4 grid grid-cols-2 gap-3 text-xs">
                    <Stat icon={FileText}        label="Facturas" value={c.stats.invoicesCount} />
                    <Stat icon={ShoppingCart}    label="Compras"  value={c.stats.purchasesCount} />
                    <Stat icon={CircleDollarSign} label="Ventas"  value={fmtMoney(c.stats.totalSales)}     mono />
                    <Stat icon={CircleDollarSign} label="Compras ₡" value={fmtMoney(c.stats.totalPurchases)} mono />
                    <Stat icon={CircleDollarSign} label="AR" value={fmtMoney(c.stats.arOutstanding)} mono color="red" />
                    <Stat icon={CircleDollarSign} label="AP" value={fmtMoney(c.stats.apOutstanding)} mono color="amber" />
                    <Stat icon={BookOpen}        label="Asientos" value={c.stats.journalEntries} />
                  </div>

                  {/* Miembros */}
                  <div className="px-4 pb-3 border-t border-gray-100 pt-2">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1.5">
                      <Users className="w-3 h-3" />
                      {c.mode === 'GROUP'
                        ? `${c.members.length} ${c.members.length === 1 ? 'miembro' : 'miembros'}`
                        : 'Estudiante'}
                    </div>
                    {c.mode === 'INDIVIDUAL' ? (
                      c.owner ? (
                        <div className="text-xs text-gray-700 truncate">
                          {c.owner.name} <span className="text-gray-400">· {c.owner.email}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 italic">Sin estudiante</div>
                      )
                    ) : c.members.length === 0 ? (
                      <div className="text-xs text-gray-400 italic">Sin miembros aún</div>
                    ) : (
                      <ul className="space-y-0.5">
                        {c.members.map(m => (
                          <li key={m.id} className="text-xs text-gray-700 truncate">
                            {m.name}
                            {m.role === 'OWNER' && (
                              <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-100 text-blue-800">
                                owner
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

function SummaryStat({
  label, value, icon: Icon, color, isMoney,
}: {
  label: string; value: string | number; icon: any;
  color: 'blue' | 'emerald' | 'amber' | 'red'; isMoney?: boolean;
}) {
  const cls: Record<string, string> = {
    blue:    'from-blue-500 to-blue-700',
    emerald: 'from-emerald-500 to-emerald-700',
    amber:   'from-amber-500 to-amber-700',
    red:     'from-red-500 to-red-700',
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">{label}</div>
          <div className={`mt-1 ${isMoney ? 'text-base font-bold' : 'text-2xl font-bold'} text-gray-900 ${isMoney ? 'font-mono' : ''}`}>
            {value}
          </div>
        </div>
        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${cls[color]} text-white flex items-center justify-center`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </Card>
  );
}

function Stat({
  icon: Icon, label, value, mono, color,
}: {
  icon: any; label: string; value: string | number;
  mono?: boolean; color?: 'red' | 'amber';
}) {
  const cls = color === 'red'   ? 'text-red-700'
            : color === 'amber' ? 'text-amber-700'
            : 'text-gray-800';
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-gray-500 text-[10px] uppercase tracking-wide">{label}</div>
        <div className={`${cls} ${mono ? 'font-mono' : 'font-semibold'} text-xs truncate`}>
          {value}
        </div>
      </div>
    </div>
  );
}
