'use client';

/**
 * Fase EN CURSO — panel en vivo de las empresas operando.
 *
 * KPIs por empresa (facturas, asientos, si cuadra) + un mapa de comercio en
 * forma de matriz (vende ↓ / compra →), que se lee mejor proyectado que un
 * grafo de nodos sueltos.
 */

import { useState, type ElementType } from 'react';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/IconTile';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { fmtNum } from '@/lib/utils';
import {
  MOCK_COMPANIES, MOCK_LIVE_STATS, MOCK_TRADES, ARCHETYPE_LABELS, companyName,
} from './_mock';
import { ARCHETYPE_ICON, ARCHETYPE_TINT } from './archetypeStyle';
import {
  FileText, BookOpen, CheckCircle2, AlertTriangle,
  CircleDollarSign, ArrowRight, ShieldCheck, Grid3x3, List, Wifi,
} from 'lucide-react';

const fmtMoney = (n: number) => `₡ ${fmtNum(n)}`;

function shortName(name: string): string {
  return name.replace(/\s+S\.A\.$/i, '').split(' ').slice(0, 2).join(' ');
}

function Stat({ icon: Icon, label, value, tone }: { icon: ElementType; label: string; value: string | number; tone?: 'red' | 'gold' }) {
  const cls = tone === 'red' ? 'text-red-700' : tone === 'gold' ? 'text-gold-900' : 'text-gray-800';
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
        <p className={`truncate text-xs font-semibold tabular-nums ${cls}`}>{value}</p>
      </div>
    </div>
  );
}

export function PhaseInProgress({ onAdvance }: { onAdvance: () => void }) {
  const [view, setView] = useState<'matrix' | 'list'>('matrix');
  const maxAmount = Math.max(...MOCK_TRADES.map((t) => t.amount));
  const topFlows = [...MOCK_TRADES].sort((a, b) => b.amount - a.amount);

  const totalInvoices = MOCK_LIVE_STATS.reduce((s, x) => s + x.invoicesIssued, 0);
  const totalEntries  = MOCK_LIVE_STATS.reduce((s, x) => s + x.journalEntries, 0);
  const balancedCount = MOCK_LIVE_STATS.filter((x) => x.isBalanced).length;
  const totalB2B      = MOCK_TRADES.reduce((s, x) => s + x.amount, 0);

  return (
    <div className="space-y-6">
      {/* Resumen global */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Facturas emitidas" value={String(totalInvoices)} icon={FileText} tint="#2563EB" className="cx-pop cx-d1" />
        <StatCard label="Asientos registrados" value={String(totalEntries)} icon={BookOpen} tint="#1B2E6E" className="cx-pop cx-d2" />
        <StatCard
          label="Empresas cuadradas"
          value={`${balancedCount}/${MOCK_LIVE_STATS.length}`}
          icon={balancedCount === MOCK_LIVE_STATS.length ? CheckCircle2 : AlertTriangle}
          tint={balancedCount === MOCK_LIVE_STATS.length ? '#059669' : '#B8860B'}
          className="cx-pop cx-d3"
        />
        <StatCard label="Comercio B2B total" value={fmtMoney(totalB2B)} icon={CircleDollarSign} tint="#B8860B" className="cx-pop cx-d4" />
      </div>

      {/* KPIs por empresa */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MOCK_COMPANIES.map((c, i) => {
          const stats = MOCK_LIVE_STATS.find((s) => s.companyId === c.id)!;
          const Icon = ARCHETYPE_ICON[c.archetype];
          return (
            <div key={c.id} className={`overflow-hidden rounded-card border bg-white shadow-card transition-all cx-lift cx-pop cx-d${Math.min(i + 1, 6)} ${stats.isBalanced ? 'border-gray-200/70' : 'border-gold-100'}`}>
              <div className={`flex items-center justify-between gap-2 border-b px-4 py-3 ${stats.isBalanced ? 'border-gray-100 bg-gray-50/70' : 'border-gold-100 bg-gold-50'}`}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <IconTile icon={Icon} tint={ARCHETYPE_TINT[c.archetype]} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">{c.name}</p>
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">{ARCHETYPE_LABELS[c.archetype]}</p>
                  </div>
                </div>
                {stats.isBalanced ? (
                  <span className="flex flex-shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> Cuadrada
                  </span>
                ) : (
                  <span className="flex flex-shrink-0 items-center gap-1 rounded-full border border-gold-100 bg-gold-50 px-2 py-0.5 text-[10px] font-bold uppercase text-gold-900">
                    <AlertTriangle className="h-3 w-3" /> Revisar
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 p-4 text-xs">
                <Stat icon={FileText} label="Facturas" value={stats.invoicesIssued} />
                <Stat icon={BookOpen} label="Asientos" value={stats.journalEntries} />
                <Stat icon={CircleDollarSign} label="Ventas" value={fmtMoney(stats.salesTotal)} />
                <Stat icon={CircleDollarSign} label="Compras" value={fmtMoney(stats.purchasesTotal)} tone="gold" />
              </div>
              <div className="border-t border-gray-100 px-4 py-2.5 text-[11px] text-gray-400">
                Última actividad: {stats.lastActivity}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mapa de comercio */}
      <SectionCard
        icon={Wifi}
        iconTint="#059669"
        eyebrow="Actualizado en vivo"
        title="Mapa de comercio"
        description="Quién le está vendiendo a quién en este momento. Entre más oscura la celda, mayor el monto."
        action={
          <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white">
            <button onClick={() => setView('matrix')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors cx-press ${view === 'matrix' ? 'bg-csq-dark text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <Grid3x3 className="h-3.5 w-3.5" /> Matriz
            </button>
            <button onClick={() => setView('list')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors cx-press ${view === 'list' ? 'bg-csq-dark text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <List className="h-3.5 w-3.5" /> Lista
            </button>
          </div>
        }
      >
        {view === 'matrix' ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white p-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Vende ↓ · Compra →
                  </th>
                  {MOCK_COMPANIES.map((c) => (
                    <th key={c.id} className="whitespace-nowrap p-2 text-center text-[11px] font-bold text-gray-600">
                      {shortName(c.name)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_COMPANIES.map((seller) => (
                  <tr key={seller.id} className="border-t border-gray-50">
                    <td className="sticky left-0 z-10 bg-white p-2 pr-4 text-xs font-bold text-gray-700 whitespace-nowrap">
                      {shortName(seller.name)}
                    </td>
                    {MOCK_COMPANIES.map((buyer) => {
                      if (seller.id === buyer.id) {
                        return <td key={buyer.id} className="p-1.5 text-center text-gray-200">—</td>;
                      }
                      const trade = MOCK_TRADES.find((t) => t.fromCompanyId === seller.id && t.toCompanyId === buyer.id);
                      if (!trade) return <td key={buyer.id} className="p-1.5 text-center text-gray-200">·</td>;
                      const alpha = Math.max(0.16, trade.amount / maxAmount);
                      return (
                        <td key={buyer.id} className="p-1">
                          <div
                            className="rounded-lg px-2 py-2 text-center"
                            style={{ background: `rgba(37,99,235,${alpha})` }}
                            title={`${trade.invoicesCount} factura${trade.invoicesCount !== 1 ? 's' : ''} · ${trade.product}`}
                          >
                            <span className={`text-[11px] font-bold tabular-nums ${alpha > 0.55 ? 'text-white' : 'text-blue-900'}`}>
                              {fmtMoney(trade.amount)}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-2">
            {topFlows.map((t, i) => (
              <div key={`${t.fromCompanyId}-${t.toCompanyId}`} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3 cx-pop cx-d${Math.min(i + 1, 6)}`}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-gray-800">{companyName(t.fromCompanyId)}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                  <span className="font-semibold text-gray-800">{companyName(t.toCompanyId)}</span>
                  <span className="text-xs text-gray-400">· {t.product}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{t.invoicesCount} factura{t.invoicesCount !== 1 ? 's' : ''}</span>
                  <span className="font-mono text-sm font-bold text-blue-700 tabular-nums">{fmtMoney(t.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="flex flex-col items-center gap-3 rounded-card border border-gray-200/70 bg-white p-5 shadow-card sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3">
          <IconTile icon={ShieldCheck} tint="#1B2E6E" size={40} />
          <p className="text-sm text-gray-600">Al cerrar el periodo, los estados financieros de cada empresa quedan congelados y empieza la auditoría cruzada.</p>
        </div>
        <Button onClick={onAdvance} className="w-full cx-press sm:w-auto">
          Cerrar periodo y auditar <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
