'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { CompanyStockCard } from '@/components/dashboard/CompanyStockCard';
import { MacroIndicatorsStrip } from '@/components/dashboard/MacroIndicatorsStrip';
import { FinancialAdvisorCard } from '@/components/dashboard/FinancialAdvisorCard';
import { EconomicEventsCard } from '@/components/dashboard/EconomicEventsCard';
import { LineChart, Building2, ChevronDown, Sparkles, Zap, TrendingUp, Globe } from 'lucide-react';

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
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="rounded-2xl overflow-hidden text-white"
        style={{ background: 'linear-gradient(135deg,#03080F 0%,#0F2657 60%,#1E3A8A 100%)' }}>
        <div className="px-6 py-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#3B82F6,#1E3A8A)', boxShadow: '0 0 20px rgba(59,130,246,0.5)' }}>
            <LineChart className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-black leading-tight">Simulador Financiero</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Valoración bursátil, indicadores macro, gerente financiero IA y eventos económicos de tu empresa.
            </p>
          </div>
        </div>
        {/* mini-leyenda de capas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px" style={{ background: 'rgba(59,130,246,0.15)' }}>
          <Layer icon={<TrendingUp className="w-4 h-4" />} label="Precio de acción" />
          <Layer icon={<Globe className="w-4 h-4" />} label="Indicadores macro" />
          <Layer icon={<Sparkles className="w-4 h-4" />} label="Gerente IA" />
          <Layer icon={<Zap className="w-4 h-4" />} label="Eventos económicos" />
        </div>
      </div>

      {/* ── Empty / error ── */}
      {(error || companies.length === 0) && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <Building2 className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 font-semibold">Aún no tienes empresas</p>
          <p className="text-gray-400 text-sm mt-1 mb-4">
            Crea tu empresa dentro de un ejercicio para ver su simulación financiera.
          </p>
          <Link href="/estudiante" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#1E3A8A' }}>
            Ir a mis ejercicios
          </Link>
        </div>
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
                      className="px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors flex items-center gap-2"
                      style={active
                        ? { background: '#1E3A8A', color: '#fff', borderColor: '#1E3A8A' }
                        : { background: '#fff', color: '#334155', borderColor: '#E2E8F0' }}>
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
    <div className="px-3 py-2.5 flex items-center gap-2" style={{ background: '#03080F' }}>
      <span style={{ color: '#60A5FA' }}>{icon}</span>
      <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</span>
    </div>
  );
}
