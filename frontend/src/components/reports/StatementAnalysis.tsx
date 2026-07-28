'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SectionCard } from '@/components/ui/SectionCard';
import { Spinner } from '@/components/ui/Spinner';
import { BarChart2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Row {
  code: string; name: string; type: string;
  actual: string; anterior: string;
  porcentajeVertical: number;
  variacionAbsoluta: string;
  variacionPorcentual: number | null;
}
interface Analysis {
  period: { startDate: string; endDate: string };
  previousPeriod: { startDate: string; endDate: string };
  incomeStatement: {
    base: { label: string; value: string };
    rows: Row[];
    totals: {
      ingresos: { actual: string; anterior: string; variacionPorcentual: number | null };
      gastos:   { actual: string; anterior: string; variacionPorcentual: number | null };
      utilidad: { actual: string; anterior: string; variacionPorcentual: number | null; margenVertical: number };
    };
  };
  balanceSheet: { base: { label: string; value: string }; rows: Row[] };
}

const fmt = (n: string | number) => '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Chip de variación: verde si sube, rojo si baja, gris si no hay comparativo. */
function VarChip({ pct }: { pct: number | null }) {
  if (pct === null || !Number.isFinite(pct)) {
    return <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Minus className="h-3 w-3" /> —</span>;
  }
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${up ? 'text-emerald-600' : 'text-red-600'}`}>
      <Icon className="h-3 w-3" />{up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

/** Barra proporcional del análisis vertical. */
function VBar({ pct }: { pct: number }) {
  const w = Math.min(100, Math.abs(pct));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-gray-100">
        <div className="h-1.5 rounded-full bg-gradient-to-r from-blue-600 to-[#1B2E6E]" style={{ width: `${w}%` }} />
      </div>
      <span className="w-12 text-right font-mono text-xs tabular-nums text-gray-600">{pct.toFixed(1)}%</span>
    </div>
  );
}

function AnalysisTable({ title, base, rows }: { title: string; base: { label: string; value: string }; rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <SectionCard title={title} icon={BarChart2} iconTint="#2563EB"
        description={`Base del análisis vertical: ${base.label}`}>
        <p className="py-4 text-center text-sm text-gray-400">Sin movimientos en el período.</p>
      </SectionCard>
    );
  }
  return (
    <SectionCard flushBody title={title} icon={BarChart2} iconTint="#2563EB"
      description={`Vertical sobre ${base.label} (${fmt(base.value)}) · Horizontal vs período anterior`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <th className="px-3 py-2 text-left font-semibold">Cuenta</th>
              <th className="px-3 py-2 text-right font-semibold">Período actual</th>
              <th className="px-3 py-2 text-right font-semibold">Período anterior</th>
              <th className="px-3 py-2 text-left font-semibold">Vertical</th>
              <th className="px-3 py-2 text-right font-semibold">Variación</th>
              <th className="px-3 py-2 text-right font-semibold">Horizontal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.code} className="hover:bg-gray-50/60">
                <td className="px-3 py-2">
                  <span className="font-mono text-xs text-gray-400">{r.code}</span>{' '}
                  <span className="text-gray-700">{r.name}</span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-gray-900">{fmt(r.actual)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-gray-400">{fmt(r.anterior)}</td>
                <td className="px-3 py-2"><VBar pct={r.porcentajeVertical} /></td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-gray-600">{fmt(r.variacionAbsoluta)}</td>
                <td className="px-3 py-2 text-right"><VarChip pct={r.variacionPorcentual} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/** Análisis vertical (% sobre una base) y horizontal (variación vs período anterior). */
export function StatementAnalysis({ companyId }: { companyId: string }) {
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get<Analysis>(`/api/v1/companies/${companyId}/reports/statement-analysis`)
      .then(({ data: d }) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [companyId]);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (!data) return <p className="py-8 text-center text-sm text-gray-400">No se pudo cargar el análisis.</p>;

  const t = data.incomeStatement.totals;

  return (
    <div className="space-y-6">
      {/* Resumen comparativo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Ingresos',  v: t.ingresos },
          { label: 'Gastos',    v: t.gastos   },
          { label: 'Utilidad',  v: t.utilidad },
        ].map(({ label, v }) => (
          <div key={label} className="rounded-card border border-gray-200/70 bg-white p-4 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-gray-900">{fmt(v.actual)}</p>
            <div className="mt-1 flex items-center gap-2">
              <VarChip pct={v.variacionPorcentual} />
              <span className="text-xs text-gray-400">vs {fmt(v.anterior)}</span>
            </div>
            {'margenVertical' in v && (
              <p className="mt-1 text-xs text-gray-500">Margen sobre ventas: <b>{(v as any).margenVertical.toFixed(1)}%</b></p>
            )}
          </div>
        ))}
      </div>

      <AnalysisTable title="Estado de Resultados — análisis vertical y horizontal"
        base={data.incomeStatement.base} rows={data.incomeStatement.rows} />
      <AnalysisTable title="Balance de Situación — análisis vertical y horizontal"
        base={data.balanceSheet.base} rows={data.balanceSheet.rows} />

      <p className="text-xs leading-relaxed text-gray-500">
        <b>Vertical:</b> cada partida como porcentaje de la base (ventas netas en resultados, total de activos en balance).{' '}
        <b>Horizontal:</b> cuánto cambió cada partida respecto del período anterior, en monto y en porcentaje.
      </p>
    </div>
  );
}
