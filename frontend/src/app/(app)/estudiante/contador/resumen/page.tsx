'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArtBalance, SceneEmptyBox } from '@/components/illustrations';
import toast from 'react-hot-toast';
import {
  Calculator, Building2, FileText, Receipt, Users, Clock,
  ChevronRight, ExternalLink, Sparkles, Plus,
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
      toast.error('Error al cargar el resumen de tus empresas');
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
      {/* Encabezado */}
      <PageHeader
        eyebrow="Espacio Contador"
        title="Resumen de mis empresas"
        subtitle="Un vistazo a las empresas a las que les llevás la contabilidad. Trabajás libre: no afecta tu nota ni depende de ningún ejercicio publicado."
        icon={Calculator}
        iconTint="#B8860B"
        className="lp-in"
      />

      {loading ? (
        <div className="flex justify-center py-20 mt-6"><Spinner size="lg" /></div>
      ) : companies.length === 0 ? (
        <Card className="lp-in mt-6">
          <EmptyState
            illustration={<SceneEmptyBox size={220} className="lp-drift" />}
            title="Aún no tenés empresas-cliente"
            description="Creá tu primera empresa-cliente para practicar el ciclo contable a tu ritmo. Acá vas a ver un resumen con tus asientos, facturas y clientes registrados."
            action={(
              <Link href="/estudiante/contador">
                <Button variant="gold">
                  <Plus className="w-4 h-4" /> Crear mi primera empresa
                </Button>
              </Link>
            )}
          />
        </Card>
      ) : (
        <>
          {/* Banda de contexto */}
          <Card variant="onDark" className="lp-in lp-in-d1 mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-6 lg:px-7 py-5">
              <div className="flex-1 min-w-0">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-1.5">
                  Progreso libre
                </p>
                <h2 className="text-lg font-bold leading-snug">Tu constancia, en un solo lugar.</h2>
                <p className="mt-1.5 text-sm text-blue-200/80 max-w-xl">
                  Reunimos tus asientos, facturas y clientes de todas tus empresas-cliente.
                </p>
              </div>
              <ArtBalance size={150} className="lp-drift flex-shrink-0" />
            </div>
          </Card>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6 mt-6">
            <StatCard label="Empresas-cliente" value={String(summary.companies)} icon={Building2} tint="#B8860B" />
            <StatCard label="Asientos registrados" value={String(summary.entries)}  icon={FileText}  tint="#059669" />
            <StatCard label="Facturas"             value={String(summary.invoices)} icon={Receipt}   tint="#2563EB" />
            <StatCard label="Clientes"             value={String(summary.clients)}  icon={Users}     tint="#7C3AED" />
            <StatCard label="Última actividad"     value={summary.lastActivity ? formatDate(summary.lastActivity) : '—'} icon={Clock} tint="#B8860B" />
          </div>

          {/* Desglose por empresa */}
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gold-900 mb-2.5">Por empresa</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map((c, i) => (
              <div key={c.id}
                className={`group bg-white border border-gray-200/70 shadow-card rounded-card p-5 flex flex-col gap-4 lp-card-pro lp-in lp-in-d${Math.min(i + 1, 5)}`}>
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

          <div className="flex items-center gap-2 mt-6 p-3.5 rounded-card text-xs bg-gold-50 text-gold-900 border border-gold-100">
            <Sparkles className="w-4 h-4 flex-shrink-0 text-gold-700" />
            La práctica libre no afecta tu nota ni depende de ejercicios. Es tu espacio para dominar el ciclo contable a tu ritmo.
          </div>
        </>
      )}
    </div>
  );
}
