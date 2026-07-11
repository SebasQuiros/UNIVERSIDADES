'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';
import {
  Calculator, Building2, FileText, Receipt, Users, Clock,
  ChevronRight, ExternalLink, Sparkles, BookOpenCheck, Plus,
} from 'lucide-react';

interface PracticeCompany {
  id: string;
  name: string;
  legalId: string | null;
  economicActivity: string | null;
  createdAt: string;
  _count: { invoices: number; journalEntries: number; clients: number };
  lastActivityAt: string | null;
}

const GOLD = '#D4A017';

export default function ContadorResumenPage() {
  const [companies, setCompanies] = useState<PracticeCompany[]>([]);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<PracticeCompany[]>('/api/v1/practice/companies');
      setCompanies(data);
    } catch {
      toast.error('Error al cargar tu resumen de práctica');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => {
    const lastDates = companies
      .map((c) => c.lastActivityAt)
      .filter((d): d is string => Boolean(d))
      .sort();
    let lastActivity: string | null = null;
    if (lastDates.length > 0) lastActivity = lastDates[lastDates.length - 1];
    return {
      companies: companies.length,
      entries:   companies.reduce((s, c) => s + c._count.journalEntries, 0),
      invoices:  companies.reduce((s, c) => s + c._count.invoices, 0),
      clients:   companies.reduce((s, c) => s + c._count.clients, 0),
      lastActivity,
    };
  }, [companies]);

  // Más recientemente activas primero; las sin actividad al final por fecha de creación.
  const sorted = useMemo(() => [...companies].sort((a, b) => {
    const da = a.lastActivityAt ?? '';
    const db = b.lastActivityAt ?? '';
    if (da !== db) return db.localeCompare(da);
    return b.createdAt.localeCompare(a.createdAt);
  }), [companies]);

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,160,23,0.14)' }}>
          <Calculator className="w-5 h-5" style={{ color: '#B8860B' }} />
        </span>
        <h2 className="text-2xl font-bold text-gray-900">Resumen de práctica</h2>
      </div>
      <p className="text-gray-500 text-sm mb-6">
        Un vistazo a tus empresas-cliente del Espacio Contador. Es práctica libre: no afecta tu nota y no depende de ningún ejercicio publicado.
      </p>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : companies.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center mt-6">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'rgba(212,160,23,0.12)' }}>
            <BookOpenCheck className="w-10 h-10" style={{ color: GOLD }} />
          </div>
          <h3 className="text-gray-800 font-semibold text-lg">Aún no tenés empresas de práctica</h3>
          <p className="text-gray-500 text-sm mt-1.5 mb-5 max-w-md">
            Creá tu primera empresa-cliente para practicar el ciclo contable a tu ritmo. Acá vas a ver un resumen con tus asientos, facturas y clientes registrados.
          </p>
          <Link href="/estudiante/contador">
            <Button style={{ background: GOLD, borderColor: GOLD, color: '#1a1205' }}>
              <Plus className="w-4 h-4" /> Crear mi primera empresa
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Empresas de práctica', value: summary.companies,                                icon: Building2,  tint: 'rgba(212,160,23,0.12)', color: '#B8860B' },
              { label: 'Asientos registrados', value: summary.entries,                                  icon: FileText,   tint: '#ECFDF5',              color: '#059669' },
              { label: 'Facturas',             value: summary.invoices,                                 icon: Receipt,    tint: '#EFF6FF',              color: '#2563EB' },
              { label: 'Clientes',             value: summary.clients,                                  icon: Users,      tint: '#F5F3FF',              color: '#7C3AED' },
              { label: 'Última actividad',     value: summary.lastActivity ? formatDate(summary.lastActivity) : '—', icon: Clock, tint: 'rgba(212,160,23,0.12)', color: '#B8860B' },
            ].map((k, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: k.tint }}>
                    <k.icon className="w-4 h-4" style={{ color: k.color }} />
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900 font-mono tabular-nums leading-none">{k.value}</p>
                <p className="text-xs text-gray-500 mt-1.5">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Desglose por empresa */}
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-2.5">Por empresa</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map((c) => (
              <div key={c.id}
                className="group bg-white border border-gray-200 hover:border-amber-300 shadow-sm rounded-xl p-5 flex flex-col gap-4 transition-all duration-200 hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold flex-shrink-0 text-white" style={{ background: GOLD }}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                    {c.economicActivity && <p className="text-xs text-gray-400 mt-0.5 truncate">{c.economicActivity}</p>}
                  </div>
                  <Link href={`/estudiante/contador/${c.id}`} title="Abrir empresa"
                    className="text-gray-300 hover:text-amber-600 flex-shrink-0">
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: Receipt,  n: c._count.invoices,       l: 'Facturas' },
                    { icon: FileText, n: c._count.journalEntries, l: 'Asientos' },
                    { icon: Users,    n: c._count.clients,        l: 'Clientes' },
                  ].map((k, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                      <k.icon className="w-4 h-4 text-amber-600" />
                      <p className="text-sm font-bold text-gray-900 leading-none font-mono tabular-nums">{k.n}</p>
                      <p className="text-[11px] text-gray-400">{k.l}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-auto">
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" /> {c.lastActivityAt ? formatDate(c.lastActivityAt) : 'sin asientos'}
                  </span>
                  <Link href={`/estudiante/contador/${c.id}`}>
                    <Button size="sm" variant="secondary">Abrir <ChevronRight className="w-3.5 h-3.5" /></Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-6 p-3 rounded-xl text-xs" style={{ background: 'rgba(212,160,23,0.08)', color: '#8a6d0f' }}>
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            La práctica libre no afecta tu nota ni depende de ejercicios. Es tu espacio para dominar el ciclo contable a tu ritmo.
          </div>
        </>
      )}
    </div>
  );
}
