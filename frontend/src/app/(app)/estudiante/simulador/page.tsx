'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { IconTile } from '@/components/ui/IconTile';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { ArtGrowth, SceneEmptyBox } from '@/components/illustrations';
import { CompanyStockCard } from '@/components/dashboard/CompanyStockCard';
import { MacroIndicatorsStrip } from '@/components/dashboard/MacroIndicatorsStrip';
import { FinancialAdvisorCard } from '@/components/dashboard/FinancialAdvisorCard';
import { EconomicEventsCard } from '@/components/dashboard/EconomicEventsCard';
import { BusinessSimulator } from '@/components/dashboard/BusinessSimulator';
import { LineChart, Building2, ChevronDown, Sparkles, Zap, TrendingUp, Globe, Target } from 'lucide-react';

interface CompanyCard {
  id: string;
  name: string;
  mode: 'INDIVIDUAL' | 'GROUP';
  linkedExercise: { id: string; title: string } | null;
}

export default function SimuladorPage() {
  const [companies, setCompanies] = useState<CompanyCard[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get<CompanyCard[]>('/api/v1/companies')
      .then(({ data }) => {
        if (!alive) return;
        setCompanies(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const selected = useMemo(
    () => companies.find(c => c.id === selectedId) ?? null,
    [companies, selectedId],
  );

  if (loading) {
    return <div className="flex items-center justify-center py-32"><Spinner /></div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
      {/* ── Encabezado ── */}
      <PageHeader
        eyebrow="Simulador financiero"
        title="Simulá antes de invertir"
        subtitle="Explorá la viabilidad de un negocio con datos reales de mercado y la simulación bursátil de las empresas que creaste en tus ejercicios."
        icon={LineChart}
        iconTint="#2563EB"
        className="lp-in"
      />

      {/* ── Hero: las cuatro capas del simulador ── */}
      <Card variant="onDark" className="lp-in lp-in-d1">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-6 lg:px-7 py-6">
          <div className="flex-1 min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-1.5">
              Cuatro capas de análisis
            </p>
            <h2 className="text-lg font-bold leading-snug">De la idea a los números, con contexto real.</h2>
            <p className="mt-1.5 text-sm text-blue-200/80 max-w-xl">
              Modelá la viabilidad de un negocio y observá cómo reaccionan tus empresas ante indicadores
              macro, un gerente financiero IA y eventos económicos.
            </p>
          </div>
          <ArtGrowth size={150} className="lp-drift flex-shrink-0" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-white/10">
          <Layer icon={<Target className="w-4 h-4" />} label="Viabilidad de negocio" />
          <Layer icon={<Globe className="w-4 h-4" />} label="Indicadores macro" />
          <Layer icon={<Sparkles className="w-4 h-4" />} label="Gerente IA" />
          <Layer icon={<Zap className="w-4 h-4" />} label="Eventos económicos" />
        </div>
      </Card>

      {/* ── Simulador de viabilidad (contenido principal) ── */}
      <BusinessSimulator />

      {/* ── Simulación bursátil de tus empresas (sección secundaria) ── */}
      <div className="flex items-start gap-3.5 pt-4 border-t border-gray-100">
        <IconTile icon={TrendingUp} tint="#2563EB" size={46} className="mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold-900 mb-0.5">Mercado bursátil</p>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">Simulación bursátil de tus empresas</h2>
          <p className="text-gray-500 text-sm mt-1 max-w-prose">
            Valoración de acción, gerente financiero IA y eventos económicos de las empresas que creaste en tus ejercicios.
          </p>
        </div>
      </div>

      {/* ── Empty / error ── */}
      {(error || companies.length === 0) && (
        <Card className="lp-in">
          <EmptyState
            illustration={<SceneEmptyBox size={200} className="lp-drift" />}
            title="Aún no tenés empresas"
            description="Creá tu empresa dentro de un ejercicio para ver su simulación financiera."
            action={
              <Link href="/estudiante">
                <Button variant="primary"><Building2 className="w-4 h-4" /> Ir a mis ejercicios</Button>
              </Link>
            }
          />
        </Card>
      )}

      {/* ── Selector de empresa ── */}
      {companies.length > 0 && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-gray-500">Empresa:</span>
            {companies.length <= 4 ? (
              <div className="flex gap-2 flex-wrap">
                {companies.map(c => {
                  const active = c.id === selectedId;
                  return (
                    <button key={c.id} onClick={() => setSelectedId(c.id)}
                      className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-all duration-200 flex items-center gap-2 ${
                        active
                          ? 'text-white bg-gradient-to-br from-blue-600 to-csq-mid border-transparent shadow-[0_6px_20px_rgba(27,46,110,0.28)]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-700'
                      }`}>
                      <Building2 className="w-3.5 h-3.5" />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="relative">
                <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                  className="appearance-none pl-3 pr-9 py-2 rounded-xl border bg-white text-sm font-medium text-gray-700"
                  style={{ borderColor: '#E2E8F0' }}>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            )}
          </div>

          {/* ── Las 4 capas ── */}
          {selected && (
            <div key={selected.id} className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <CompanyStockCard companyId={selected.id} companyName={selected.name} />
                <MacroIndicatorsStrip />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <FinancialAdvisorCard companyId={selected.id} />
                <EconomicEventsCard companyId={selected.id} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Layer({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="px-4 py-3 flex items-center gap-2.5 border-r border-white/10 last:border-r-0 [&:nth-child(2)]:border-r-0 sm:[&:nth-child(2)]:border-r">
      <span className="text-csq-accent-bright">{icon}</span>
      <span className="text-xs font-medium text-blue-100/80">{label}</span>
    </div>
  );
}
