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
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        <div className="flex items-center justify-between">
          <Link href={`/estudiante/ejercicio/${attemptId}/cxc`}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4" /> Volver a Cuentas por Cobrar
          </Link>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Análisis de cartera</h1>
          <p className="text-sm text-gray-500 mt-1">
            Saldo consolidado por cliente y estimación de cuentas incobrables.
          </p>
        </div>

        {/* ── Customer ledger ──────────────────────────────── */}
        <Card>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-700" />
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Saldo por cliente
            </h2>
            {consolidated && (
              <span className="ml-auto text-xs text-gray-500">
                {consolidated.clients.length} cliente(s) ·{' '}
                <strong className="text-gray-800">{fmtMoney(consolidated.totals.outstanding)}</strong> pendiente
              </span>
            )}
          </div>
          {loading || !consolidated ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : consolidated.clients.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Sin cuentas por cobrar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2 text-[10px] uppercase tracking-wide text-gray-600 font-semibold">Cliente</th>
                    <th className="text-left px-4 py-2 text-[10px] uppercase tracking-wide text-gray-600 font-semibold">Cédula</th>
                    <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wide text-gray-600 font-semibold">Facturado</th>
                    <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wide text-gray-600 font-semibold">Cobrado</th>
                    <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wide text-gray-600 font-semibold">Pendiente</th>
                    <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wide text-gray-600 font-semibold">Facturas</th>
                    <th className="text-left px-4 py-2 text-[10px] uppercase tracking-wide text-gray-600 font-semibold">Más antigua</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {consolidated.clients.map(c => (
                    <tr key={c.clientId} className="hover:bg-blue-50/40">
                      <td className="px-4 py-2 font-medium text-gray-900">{c.clientName}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{c.identification ?? '—'}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-700">{fmtMoney(c.totalBilled)}</td>
                      <td className="px-4 py-2 text-right font-mono text-emerald-700">{fmtMoney(c.totalPaid)}</td>
                      <td className={`px-4 py-2 text-right font-mono font-bold ${c.outstanding > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                        {fmtMoney(c.outstanding)}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">{c.openInvoices}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {c.oldestInvoiceDate ?? '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold">
                    <td colSpan={2} className="px-4 py-2 text-gray-900">Totales</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtMoney(consolidated.totals.totalBilled)}</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-700">{fmtMoney(consolidated.totals.totalPaid)}</td>
                    <td className="px-4 py-2 text-right font-mono text-red-700">{fmtMoney(consolidated.totals.outstanding)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* ── Estimación de incobrables ──────────────────── */}
        <Card>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-purple-700" />
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Estimación de cuentas incobrables
            </h2>
          </div>
          <div className="p-5 space-y-4">

            {/* Selector de método */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(['PERCENTAGE_OF_AGING', 'PERCENTAGE_OF_SALES'] as const).map(m => {
                const active = method === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMethod(m); setEstResult(null); }}
                    className={`text-left p-3 rounded-xl border-2 transition ${
                      active
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold text-sm text-gray-900">
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
              <Button onClick={estimate} disabled={estLoading}>
                <Calculator className="w-4 h-4" />
                {estLoading ? 'Calculando…' : 'Calcular estimación'}
              </Button>
            </div>

            {/* Resultado */}
            {estResult && (
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-purple-800 font-semibold">
                      Estimación de incobrables
                    </div>
                    <div className="text-3xl font-bold text-gray-900 font-mono mt-1">
                      {fmtMoney(estResult.estimated)}
                    </div>
                  </div>
                  <TrendingDown className="w-12 h-12 text-purple-300" />
                </div>

                {estResult.method === 'PERCENTAGE_OF_AGING' ? (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    {(['b0_30','b31_60','b61_90','b91_plus'] as const).map(k => (
                      <div key={k} className="bg-white/60 rounded-lg p-2 border border-purple-100">
                        <div className="text-gray-500">
                          {k === 'b0_30' ? '0-30' : k === 'b31_60' ? '31-60' : k === 'b61_90' ? '61-90' : '90+'}
                          {' · '}{estResult.pcts[k]}%
                        </div>
                        <div className="font-mono text-gray-800">{fmtMoney(estResult.buckets[k])}</div>
                        <div className="font-mono font-semibold text-purple-700">→ {fmtMoney(estResult.breakdown[k])}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                    <div className="bg-white/60 rounded-lg p-2 border border-purple-100">
                      <div className="text-gray-500">Ventas del período</div>
                      <div className="font-mono text-gray-800">{fmtMoney(estResult.sales)}</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2 border border-purple-100">
                      <div className="text-gray-500">N° facturas</div>
                      <div className="font-mono text-gray-800">{estResult.invoiceCount}</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2 border border-purple-100">
                      <div className="text-gray-500">% aplicado</div>
                      <div className="font-mono text-gray-800">{estResult.salesPct}%</div>
                    </div>
                  </div>
                )}

                {/* Asiento sugerido */}
                {estResult.suggestedJournal.lines.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-purple-200">
                    <div className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Asiento sugerido (registralo a mano en el diario)
                    </div>
                    <table className="w-full text-xs bg-white rounded-lg overflow-hidden border border-purple-100">
                      <thead className="bg-purple-50">
                        <tr>
                          <th className="text-left px-3 py-1.5 text-gray-700">Cuenta</th>
                          <th className="text-left px-3 py-1.5 text-gray-700">Descripción</th>
                          <th className="text-right px-3 py-1.5 text-gray-700">Débito</th>
                          <th className="text-right px-3 py-1.5 text-gray-700">Crédito</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-50">
                        {estResult.suggestedJournal.lines.map((l, i) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5 font-mono text-gray-800">{l.accountCode}</td>
                            <td className="px-3 py-1.5 text-gray-700">{l.description}</td>
                            <td className="px-3 py-1.5 text-right font-mono">
                              {l.side === 'DEBIT' ? fmtMoney(l.amount) : '—'}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono">
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
        </Card>

      </div>
    </div>
  );
}
