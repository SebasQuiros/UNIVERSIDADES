'use client';

/**
 * Análisis de cartera (Fase 3): Ledger consolidado por cliente +
 * estimación de cuentas incobrables (% ventas / % aging).
 *
 * Página separada de la lista de facturas para no inflar el módulo
 * de CxC principal. Acceso desde "Cuentas por cobrar → Análisis".
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Users, TrendingDown, RefreshCw, Calculator, AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArtCoins, SceneEmptyBox } from '@/components/illustrations';
import { getErrorMessage } from '@/lib/utils';

interface ConsolidatedClient {
  clientId: string;
  clientName: string;
  identification: string | null;
  email: string | null;
  phone: string | null;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  openInvoices: number;
  oldestInvoiceDate: string | null;
}
interface Consolidated {
  clients: ConsolidatedClient[];
  totals: { totalBilled: number; totalPaid: number; outstanding: number };
}

interface AllowanceSalesResult {
  method: 'PERCENTAGE_OF_SALES';
  period: { from: string | null; to: string | null };
  sales: number;
  invoiceCount: number;
  salesPct: number;
  estimated: number;
  suggestedJournal: { description: string; lines: any[] };
}
interface AllowanceAgingResult {
  method: 'PERCENTAGE_OF_AGING';
  asOfDate: string;
  pcts: { b0_30: number; b31_60: number; b61_90: number; b91_plus: number };
  buckets: { b0_30: number; b31_60: number; b61_90: number; b91_plus: number };
  breakdown: { b0_30: number; b31_60: number; b61_90: number; b91_plus: number };
  estimated: number;
  suggestedJournal: { description: string; lines: any[] };
}
type AllowanceResult = AllowanceSalesResult | AllowanceAgingResult;

const fmtMoney = (n: number) =>
  '₡ ' + Number(n).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CxCAnalisisPage() {
  const { attemptId } = useParams<{ attemptId: string }>();

  const [companyId,    setCompanyId]    = useState<string | null>(null);
  const [consolidated, setConsolidated] = useState<Consolidated | null>(null);
  const [loading,      setLoading]      = useState(true);

  // Estimaciones
  const [method,    setMethod]   = useState<'PERCENTAGE_OF_SALES' | 'PERCENTAGE_OF_AGING'>('PERCENTAGE_OF_AGING');
  const [salesPct,  setSalesPct] = useState('2');
  const [pct030,    setPct030]   = useState('1');
  const [pct3160,   setPct3160]  = useState('5');
  const [pct6190,   setPct6190]  = useState('15');
  const [pct91,     setPct91]    = useState('40');
  const [estResult, setEstResult] = useState<AllowanceResult | null>(null);
  const [estLoading, setEstLoading] = useState(false);

  useEffect(() => {
    api.get<any>(`/api/v1/attempts/${attemptId}`)
      .then(({ data }) => setCompanyId(data?.company?.id ?? null))
      .catch(err => toast.error(getErrorMessage(err)));
  }, [attemptId]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data } = await api.get<Consolidated>(
        `/api/v1/companies/${companyId}/ar/clients/consolidated`,
      );
      setConsolidated(data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  async function estimate() {
    if (!companyId) return;
    setEstLoading(true);
    setEstResult(null);
    try {
      // Endpoint pasó a GET para que TEACHER/ADMIN puedan invocarlo
      // (CompanyOwnerGuard bloquea POST/PATCH para staff).
      const qs = new URLSearchParams({ method });
      if (method === 'PERCENTAGE_OF_SALES') {
        qs.set('salesPct', String(Number(salesPct) || 0));
      } else {
        qs.set('pct_b0_30',    String(Number(pct030)  || 0));
        qs.set('pct_b31_60',   String(Number(pct3160) || 0));
        qs.set('pct_b61_90',   String(Number(pct6190) || 0));
        qs.set('pct_b91_plus', String(Number(pct91)   || 0));
      }
      const { data } = await api.get<AllowanceResult>(
        `/api/v1/companies/${companyId}/ar/allowance/estimate?${qs.toString()}`,
      );
      setEstResult(data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setEstLoading(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/60">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-7">

        <Link href={`/estudiante/ejercicio/${attemptId}/cxc`}
          className="inline-flex items-center gap-2 -ml-1 text-sm font-medium text-gray-500 hover:text-blue-700 transition-colors cx-press">
          <ArrowLeft className="w-4 h-4" /> Volver a Cuentas por Cobrar
        </Link>

        <PageHeader
          eyebrow="Cartera"
          title="Análisis de cartera"
          subtitle="Saldo consolidado por cliente y estimación de cuentas incobrables."
          icon={Calculator}
          iconTint="#1B2E6E"
          className="lp-in"
          actions={
            <Button variant="secondary" onClick={load} disabled={loading} className="cx-press">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          }
        />

        {/* Banda del módulo */}
        <Card variant="onDark" className="cx-pop">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-6 lg:px-7 py-6">
            <div className="flex-1 min-w-0">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-1.5">
                Principio de prudencia
              </p>
              <h2 className="text-lg font-bold leading-snug">No todo lo que se factura se cobra.</h2>
              <p className="mt-1.5 text-sm text-blue-200/80 max-w-xl">
                La estimación de incobrables reconoce, desde hoy, la parte de la cartera que probablemente
                no se recupere. El asiento sugerido lo registras tú en el diario.
              </p>
            </div>
            <ArtCoins size={140} className="lp-drift flex-shrink-0" />
          </div>
        </Card>

        {/* ── Customer ledger ──────────────────────────────── */}
        <SectionCard
          eyebrow="Ledger consolidado"
          title="Saldo por cliente"
          icon={Users}
          iconTint="#2563EB"
          flushBody
          className="cx-pop cx-d1"
          action={consolidated ? (
            <span className="text-xs text-gray-500">
              {consolidated.clients.length} cliente(s) ·{' '}
              <strong className="text-gray-800 tabular-nums">{fmtMoney(consolidated.totals.outstanding)}</strong> pendiente
            </span>
          ) : undefined}
        >
          {loading || !consolidated ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : consolidated.clients.length === 0 ? (
            <EmptyState
              illustration={<SceneEmptyBox size={190} className="lp-drift" />}
              title="Sin cuentas por cobrar"
              description="Cuando emitas facturas a crédito, aquí verás el saldo consolidado de cada cliente."
              className="py-12"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Cliente</th>
                    <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Cédula</th>
                    <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Facturado</th>
                    <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Cobrado</th>
                    <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Pendiente</th>
                    <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Facturas</th>
                    <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Más antigua</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {consolidated.clients.map(c => (
                    <tr key={c.clientId} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{c.clientName}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs font-mono">{c.identification ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-gray-700">{fmtMoney(c.totalBilled)}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-700">{fmtMoney(c.totalPaid)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono tabular-nums font-bold ${c.outstanding > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                        {fmtMoney(c.outstanding)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{c.openInvoices}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">
                        {c.oldestInvoiceDate ?? '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold">
                    <td colSpan={2} className="px-4 py-2.5 text-gray-900">Totales</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{fmtMoney(consolidated.totals.totalBilled)}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-700">{fmtMoney(consolidated.totals.totalPaid)}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-red-700">{fmtMoney(consolidated.totals.outstanding)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* ── Estimación de incobrables ──────────────────── */}
        <SectionCard
          eyebrow="NIIF PYMES"
          title="Estimación de cuentas incobrables"
          description="Elige el método, ajusta los porcentajes y calcula la provisión del período."
          icon={Calculator}
          iconTint="#B8860B"
          className="cx-pop cx-d2"
        >
          <div className="space-y-4">

            {/* Selector de método */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(['PERCENTAGE_OF_AGING', 'PERCENTAGE_OF_SALES'] as const).map(m => {
                const active = method === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMethod(m); setEstResult(null); }}
                    className={`text-left p-4 rounded-2xl border-2 transition cx-press ${
                      active
                        ? 'border-blue-500 bg-blue-50 shadow-card'
                        : 'border-gray-200 bg-white hover:border-blue-200'
                    }`}
                  >
                    <div className="font-bold text-sm text-gray-900">
                      {m === 'PERCENTAGE_OF_AGING' ? '% basado en aging' : '% de ventas'}
                    </div>
                    <div className="text-xs text-gray-600 mt-1 leading-relaxed">
                      {m === 'PERCENTAGE_OF_AGING'
                        ? 'Aplica un porcentaje distinto a cada bucket de antigüedad.'
                        : 'Aplica un porcentaje único sobre las ventas del período.'}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Inputs por método */}
            {method === 'PERCENTAGE_OF_SALES' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">% de las ventas</label>
                  <Input value={salesPct} onChange={(e) => setSalesPct(e.target.value)} type="number" step="0.1" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">% bucket 0-30</label>
                  <Input value={pct030} onChange={(e) => setPct030(e.target.value)} type="number" step="0.1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">% bucket 31-60</label>
                  <Input value={pct3160} onChange={(e) => setPct3160(e.target.value)} type="number" step="0.1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">% bucket 61-90</label>
                  <Input value={pct6190} onChange={(e) => setPct6190(e.target.value)} type="number" step="0.1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">% bucket 90+</label>
                  <Input value={pct91} onChange={(e) => setPct91(e.target.value)} type="number" step="0.1" />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={estimate} disabled={estLoading} className="cx-press">
                <Calculator className="w-4 h-4" />
                {estLoading ? 'Calculando…' : 'Calcular estimación'}
              </Button>
            </div>

            {/* Resultado */}
            {estResult && (
              <div className="mt-4 p-5 rounded-2xl bg-gradient-to-br from-csq-mid to-csq-active text-white shadow-soft cx-pop">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[0.68rem] uppercase tracking-[0.14em] text-gold-500 font-bold">
                      Estimación de incobrables
                    </div>
                    <div className="text-3xl font-extrabold tabular-nums mt-1 cx-count">
                      {fmtMoney(estResult.estimated)}
                    </div>
                  </div>
                  <TrendingDown className="w-12 h-12 text-blue-300/60 flex-shrink-0 cx-float" />
                </div>

                {estResult.method === 'PERCENTAGE_OF_AGING' ? (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    {(['b0_30','b31_60','b61_90','b91_plus'] as const).map(k => (
                      <div key={k} className="bg-white/10 rounded-xl p-2.5 border border-white/10">
                        <div className="text-blue-200/80">
                          {k === 'b0_30' ? '0-30' : k === 'b31_60' ? '31-60' : k === 'b61_90' ? '61-90' : '90+'}
                          {' · '}{estResult.pcts[k]}%
                        </div>
                        <div className="font-mono tabular-nums text-white/90">{fmtMoney(estResult.buckets[k])}</div>
                        <div className="font-mono tabular-nums font-bold text-gold-500">→ {fmtMoney(estResult.breakdown[k])}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                    <div className="bg-white/10 rounded-xl p-2.5 border border-white/10">
                      <div className="text-blue-200/80">Ventas del período</div>
                      <div className="font-mono tabular-nums text-white/90">{fmtMoney(estResult.sales)}</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-2.5 border border-white/10">
                      <div className="text-blue-200/80">N° facturas</div>
                      <div className="font-mono tabular-nums text-white/90">{estResult.invoiceCount}</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-2.5 border border-white/10">
                      <div className="text-blue-200/80">% aplicado</div>
                      <div className="font-mono tabular-nums text-white/90">{estResult.salesPct}%</div>
                    </div>
                  </div>
                )}

                {/* Asiento sugerido */}
                {estResult.suggestedJournal.lines.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-white/10">
                    <div className="text-xs font-bold text-gold-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Asiento sugerido (registralo a mano en el diario)
                    </div>
                    <table className="w-full text-xs bg-white rounded-xl overflow-hidden border border-white/10">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide text-[10px]">Cuenta</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide text-[10px]">Descripción</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide text-[10px]">Débito</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide text-[10px]">Crédito</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {estResult.suggestedJournal.lines.map((l, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-mono text-gray-800">{l.accountCode}</td>
                            <td className="px-3 py-2 text-gray-700">{l.description}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-900">
                              {l.side === 'DEBIT' ? fmtMoney(l.amount) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-900">
                              {l.side === 'CREDIT' ? fmtMoney(l.amount) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </div>
        </SectionCard>

      </div>
    </div>
  );
}
