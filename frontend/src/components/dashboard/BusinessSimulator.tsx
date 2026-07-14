'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { SectionCard } from '@/components/ui/SectionCard';
import { Card } from '@/components/ui/Card';
import { IconTile } from '@/components/ui/IconTile';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  TrendingUp, Target, Lightbulb, AlertTriangle, Rocket,
  Wifi, WifiOff, RefreshCw, Sparkles, Cpu, DollarSign, Percent, Building2, Gauge,
} from 'lucide-react';

// ── Tipos que espejan la API /simulator ──────────────────────────────────────
type Sector =
  | 'comercio' | 'servicios' | 'tecnologia' | 'manufactura'
  | 'alimentos' | 'construccion' | 'transporte';

interface SectorOutlook { demandIndex: number; note: string; }
interface Market {
  exchangeRate: number;
  inflation: number;
  interestRate: number;
  source: 'live' | 'cache' | 'fallback';
  sectorOutlook: Record<string, SectorOutlook>;
}

interface AnalyzeInputs {
  sector: Sector;
  unitPrice: number;
  unitCost: number;
  monthlyFixedCosts: number;
  initialInvestment: number;
  innovationLevel: number;
  competitionLevel: number;
  estimatedMarketSizeUnits: number;
}

interface Projection {
  demand: number;
  revenue: number;
  variableCost: number;
  grossMargin: number;
  grossMarginPct: number;
  monthlyProfit: number;
  contributionPerUnit: number;
  breakEvenUnits: number;
  paybackMonths: number | null;
  annualROI: number;
}

interface Scenario { profit: number; marginPct: number; annualROI: number; }

interface Analysis {
  riesgos: string[];
  oportunidades: string[];
  recomendaciones: string[];
  source: 'ai' | 'deterministic';
}

interface AnalyzeResult {
  inputs: AnalyzeInputs;
  market: Market;
  projection: Projection;
  successProbability: number;
  scenarios: { base: Scenario; optimista: Scenario; pesimista: Scenario };
  analysis: Analysis;
}

// ── Sectores (label legible) ──────────────────────────────────────────────────
const SECTORS: { value: Sector; label: string }[] = [
  { value: 'comercio', label: 'Comercio' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'tecnologia', label: 'Tecnología' },
  { value: 'manufactura', label: 'Manufactura' },
  { value: 'alimentos', label: 'Alimentos' },
  { value: 'construccion', label: 'Construcción' },
  { value: 'transporte', label: 'Transporte' },
];
const SECTOR_LABEL: Record<string, string> =
  Object.fromEntries(SECTORS.map(s => [s.value, s.label]));

// ── Formateadores ─────────────────────────────────────────────────────────────
const money = (n: number | null | undefined) =>
  n == null
    ? '—'
    : '₡' + n.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: number | null | undefined, dec = 0) =>
  n == null ? '—' : n.toLocaleString('es-CR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const pct = (n: number | null | undefined, dec = 1) =>
  n == null ? '—' : `${n.toLocaleString('es-CR', { minimumFractionDigits: dec, maximumFractionDigits: dec })}%`;

// Pill de perspectiva del sector según demandIndex
function outlookStyle(idx: number): { bg: string; fg: string; label: string } {
  if (idx >= 1.05) return { bg: '#ECFDF5', fg: '#047857', label: 'favorable' };
  if (idx < 0.95) return { bg: '#FEF2F2', fg: '#B91C1C', label: 'adverso' };
  return { bg: '#F1F5F9', fg: '#475569', label: 'estable' };
}

// Banda de color para la probabilidad de éxito
function probBand(p: number): { color: string; label: string; verdict: string } {
  if (p > 70) return {
    color: '#10B981',
    label: 'Alta',
    verdict: 'El modelo luce viable: los números respaldan la idea.',
  };
  if (p >= 40) return {
    color: '#F59E0B',
    label: 'Media',
    verdict: 'Viabilidad moderada: ajustá precios, costos o volumen para reforzarla.',
  };
  return {
    color: '#EF4444',
    label: 'Baja',
    verdict: 'Alto riesgo: revisá el modelo antes de invertir.',
  };
}

export function BusinessSimulator() {
  // Mercado
  const [market, setMarket] = useState<Market | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);

  // Formulario
  const [form, setForm] = useState({
    sector: 'comercio' as Sector,
    unitPrice: '5000',
    unitCost: '2000',
    monthlyFixedCosts: '500000',
    initialInvestment: '3000000',
    estimatedMarketSizeUnits: '1000',
    innovationLevel: 3,
    competitionLevel: 3,
  });

  // Análisis
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get<Market>('/api/v1/simulator/market')
      .then(({ data }) => { if (alive) setMarket(data); })
      .catch(() => { if (alive) toast.error('No se pudo cargar el mercado'); })
      .finally(() => { if (alive) setMarketLoading(false); });
    return () => { alive = false; };
  }, []);

  const setField = (k: keyof typeof form, v: string | number) =>
    setForm(prev => ({ ...prev, [k]: v }));

  async function handleAnalyze() {
    const body: AnalyzeInputs = {
      sector: form.sector,
      unitPrice: Number(form.unitPrice),
      unitCost: Number(form.unitCost),
      monthlyFixedCosts: Number(form.monthlyFixedCosts),
      initialInvestment: Number(form.initialInvestment),
      innovationLevel: form.innovationLevel,
      competitionLevel: form.competitionLevel,
      estimatedMarketSizeUnits: Number(form.estimatedMarketSizeUnits),
    };

    // Validación mínima en cliente
    if (!(body.unitPrice > 0)) return toast.error('Ingresá un precio unitario válido');
    if (body.unitCost < 0) return toast.error('El costo unitario no puede ser negativo');
    if (body.unitCost > body.unitPrice) toast('Ojo: el costo supera al precio', { icon: '⚠️' });

    setAnalyzing(true);
    try {
      const { data } = await api.post<AnalyzeResult>('/api/v1/simulator/analyze', body);
      setResult(data);
    } catch {
      toast.error('No se pudo completar el análisis');
    } finally {
      setAnalyzing(false);
    }
  }

  const live = market ? market.source !== 'fallback' : false;

  return (
    <div className="space-y-6">
      {/* ── Panel: Condiciones de mercado ── */}
      <SectionCard
        variant="onDark"
        icon={TrendingUp}
        eyebrow="Mercado en tiempo real"
        title="Condiciones de mercado"
        action={market && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
            style={{
              background: live ? 'rgba(16,185,129,0.15)' : 'rgba(251,191,36,0.15)',
              color: live ? '#34D399' : '#FBBF24',
            }}>
            {live ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {market.source === 'live' ? 'En vivo' : market.source === 'cache' ? 'Cache' : 'Referencia'}
          </span>
        )}
        flushBody
        className="lp-in"
      >
        {marketLoading ? (
          <div className="px-5 py-5"><div className="h-20 rounded-lg animate-pulse" style={{ background: 'rgba(96,165,250,0.12)' }} /></div>
        ) : market ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-px" style={{ background: 'rgba(96,165,250,0.14)' }}>
              <MacroCell icon={<DollarSign className="w-4 h-4" />} label="Tipo de cambio" value={money(market.exchangeRate)} sub="₡ / USD" color="#34D399" />
              <MacroCell icon={<TrendingUp className="w-4 h-4" />} label="Inflación" value={pct(market.inflation)} sub="interanual" color="#94A3B8" />
              <MacroCell icon={<Percent className="w-4 h-4" />} label="Tasa de interés" value={pct(market.interestRate)} sub="TBP · anual" color="#FBBF24" />
            </div>

            {/* Perspectiva por sector */}
            <div className="px-5 lg:px-7 py-4">
              <p className="text-[11px] uppercase tracking-wide mb-2.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Perspectiva por sector · índice de demanda
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {SECTORS.map(({ value, label }) => {
                  const o = market.sectorOutlook?.[value];
                  if (!o) return null;
                  const s = outlookStyle(o.demandIndex);
                  return (
                    <div key={value} className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.05)' }} title={o.note}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white truncate">{label}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: s.bg, color: s.fg }}>
                          {s.label}
                        </span>
                      </div>
                      <p className="text-sm font-black font-mono tabular-nums mt-1" style={{ color: s.fg === '#B91C1C' ? '#F87171' : s.fg === '#047857' ? '#34D399' : '#CBD5E1' }}>
                        {o.demandIndex.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-5 lg:px-7 pb-4 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <RefreshCw className="w-3 h-3" />
              <span className="text-[10px]">Datos reales BCCR / Ministerio de Hacienda. Solo fines educativos.</span>
            </div>
          </>
        ) : null}
      </SectionCard>

      {/* ── Formulario: Simulá tu empresa ── */}
      <SectionCard
        icon={Building2}
        iconTint="#2563EB"
        eyebrow="Modelo de negocio"
        title="Simulá tu empresa"
        description="Ingresá tu modelo de negocio y analizá su viabilidad."
        className="lp-in lp-in-d1"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Sector">
            <select value={form.sector} onChange={e => setField('sector', e.target.value as Sector)}
              className="w-full px-3 py-2 rounded-lg border bg-white text-sm text-gray-800"
              style={{ borderColor: '#E2E8F0' }}>
              {SECTORS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>

          <NumberField label="Precio unitario (₡)" value={form.unitPrice} onChange={v => setField('unitPrice', v)} />
          <NumberField label="Costo unitario (₡)" value={form.unitCost} onChange={v => setField('unitCost', v)} />
          <NumberField label="Costos fijos mensuales (₡)" value={form.monthlyFixedCosts} onChange={v => setField('monthlyFixedCosts', v)} />
          <NumberField label="Inversión inicial (₡)" value={form.initialInvestment} onChange={v => setField('initialInvestment', v)} />
          <NumberField label="Tamaño de mercado (uds/mes)" value={form.estimatedMarketSizeUnits} onChange={v => setField('estimatedMarketSizeUnits', v)} />

          <SliderField label="Nivel de innovación" value={form.innovationLevel}
            onChange={v => setField('innovationLevel', v)} lowLabel="Imitador" highLabel="Disruptor" />
          <SliderField label="Nivel de competencia" value={form.competitionLevel}
            onChange={v => setField('competitionLevel', v)} lowLabel="Nicho libre" highLabel="Saturado" />
        </div>

        <div className="mt-5 flex justify-end">
          <Button variant="primary" onClick={handleAnalyze} loading={analyzing} disabled={marketLoading}>
            {!analyzing && <Target className="w-4 h-4" />}
            Analizar viabilidad
          </Button>
        </div>
      </SectionCard>

      {/* ── Resultados ── */}
      {analyzing && !result && (
        <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
      )}

      {result && (
        // key por firma del resultado: replay suave de la animación al recalcular
        <ResultsPanel key={`${result.successProbability}-${result.projection.monthlyProfit}`} result={result} analyzing={analyzing} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Resultados
// ══════════════════════════════════════════════════════════════════════════════
function ResultsPanel({ result, analyzing }: { result: AnalyzeResult; analyzing: boolean }) {
  const { projection: p, scenarios, analysis, successProbability } = result;
  const band = probBand(successProbability);

  const chartData = [
    { name: 'Pesimista', profit: scenarios.pesimista.profit, color: '#EF4444' },
    { name: 'Base', profit: scenarios.base.profit, color: '#2563EB' },
    { name: 'Optimista', profit: scenarios.optimista.profit, color: '#10B981' },
  ];

  return (
    <div className={`space-y-6 lp-in transition-opacity ${analyzing ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Probabilidad de éxito */}
      <Card className="lp-pop">
        <div className="grid grid-cols-1 md:grid-cols-[auto,1fr]">
          <div className="p-6 flex flex-col items-center justify-center text-center md:border-r"
            style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}>
            <div className="relative w-32 h-32">
              <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#E2E8F0" strokeWidth="12" />
                <circle cx="60" cy="60" r="52" fill="none" stroke={band.color} strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 52}
                  strokeDashoffset={2 * Math.PI * 52 * (1 - Math.min(100, Math.max(0, successProbability)) / 100)} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black font-mono tabular-nums" style={{ color: band.color }}>
                  {Math.round(successProbability)}
                </span>
                <span className="text-[10px] font-semibold text-gray-400">/ 100</span>
              </div>
            </div>
            <p className="text-xs font-bold uppercase tracking-wide mt-3 flex items-center gap-1.5" style={{ color: band.color }}>
              <Gauge className="w-3.5 h-3.5" /> Probabilidad {band.label}
            </p>
          </div>
          <div className="p-6 flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Probabilidad de éxito</p>
            <p className="text-lg font-semibold text-gray-900 leading-snug">{band.verdict}</p>
            <p className="text-sm text-gray-500 mt-2">
              Sector {SECTOR_LABEL[result.inputs.sector] ?? result.inputs.sector} · basado en tu modelo y las condiciones actuales del mercado.
            </p>
          </div>
        </div>
      </Card>

      {/* Proyección mensual */}
      <SectionCard
        icon={TrendingUp}
        iconTint="#2563EB"
        eyebrow="Escenario base"
        title="Proyección mensual"
        flushBody
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              <Row label="Demanda estimada" value={`${num(p.demand)} uds`} />
              <Row label="Ingresos" value={money(p.revenue)} strong />
              <Row label="Costo variable" value={money(p.variableCost)} />
              <Row label="Margen bruto" value={`${money(p.grossMargin)}  ·  ${pct(p.grossMarginPct)}`} />
              <Row label="Contribución por unidad" value={money(p.contributionPerUnit)} />
              <Row label="Utilidad mensual" value={money(p.monthlyProfit)} strong
                valueColor={p.monthlyProfit >= 0 ? '#047857' : '#B91C1C'} />
              <Row label="Punto de equilibrio" value={`${num(p.breakEvenUnits)} uds`} />
              <Row label="Payback (recuperación)"
                value={p.paybackMonths == null ? 'No recupera' : `${num(p.paybackMonths, 1)} meses`}
                valueColor={p.paybackMonths == null ? '#B91C1C' : undefined} />
              <Row label="ROI anual" value={pct(p.annualROI)} strong
                valueColor={p.annualROI >= 0 ? '#047857' : '#B91C1C'} />
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Escenarios */}
      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <IconTile icon={Target} tint="#475569" size={38} />
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">Sensibilidad</p>
            <h3 className="font-bold text-gray-900 text-sm leading-tight">Escenarios</h3>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ScenarioCard title="Pesimista" s={scenarios.pesimista} accent="#EF4444" bg="#FEF2F2" />
          <ScenarioCard title="Base" s={scenarios.base} accent="#2563EB" bg="#EFF6FF" highlight />
          <ScenarioCard title="Optimista" s={scenarios.optimista} accent="#10B981" bg="#ECFDF5" />
        </div>

        {/* Gráfico comparativo de utilidad mensual */}
        <Card className="p-5 mt-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">Utilidad mensual por escenario</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `₡${(v / 1000).toLocaleString('es-CR')}k`} />
              <Tooltip
                formatter={(v: any) => [money(Number(v)), 'Utilidad']}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
              />
              <Bar dataKey="profit" radius={[6, 6, 0, 0]} name="Utilidad">
                {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Análisis */}
      <SectionCard
        icon={Sparkles}
        iconTint="#4F46E5"
        eyebrow="Lectura del modelo"
        title="Análisis"
        action={(
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
            style={analysis.source === 'ai'
              ? { background: '#EEF2FF', color: '#4F46E5' }
              : { background: '#F1F5F9', color: '#475569' }}>
            {analysis.source === 'ai' ? <Sparkles className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
            {analysis.source === 'ai' ? 'Análisis IA' : 'Análisis determinista'}
          </span>
        )}
        flushBody
      >
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
          <AnalysisList title="Riesgos" items={analysis.riesgos} icon={<AlertTriangle className="w-4 h-4" />}
            accent="#B91C1C" bullet="#EF4444" />
          <AnalysisList title="Oportunidades" items={analysis.oportunidades} icon={<Rocket className="w-4 h-4" />}
            accent="#047857" bullet="#10B981" />
          <AnalysisList title="Recomendaciones" items={analysis.recomendaciones} icon={<Lightbulb className="w-4 h-4" />}
            accent="#2563EB" bullet="#3B82F6" />
        </div>
      </SectionCard>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function MacroCell({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="px-4 py-3" style={{ background: '#03080F' }}>
      <p className="text-[10px] uppercase tracking-wide mb-1 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
        <span style={{ color }}>{icon}</span> {label}
      </p>
      <p className="text-lg font-black leading-none font-mono tabular-nums" style={{ color }}>{value}</p>
      <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{sub}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function NumberField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number" inputMode="decimal" min={0} value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border bg-white text-sm text-gray-800 font-mono tabular-nums"
        style={{ borderColor: '#E2E8F0' }}
      />
    </Field>
  );
}

function SliderField({ label, value, onChange, lowLabel, highLabel }: {
  label: string; value: number; onChange: (v: number) => void; lowLabel: string; highLabel: string;
}) {
  return (
    <Field label={`${label} · ${value}/5`}>
      <input
        type="range" min={1} max={5} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-blue-600 cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
        <span>{lowLabel}</span><span>{highLabel}</span>
      </div>
    </Field>
  );
}

function Row({ label, value, strong, valueColor }: {
  label: string; value: string; strong?: boolean; valueColor?: string;
}) {
  return (
    <tr>
      <td className="px-5 py-2.5 text-gray-600">{label}</td>
      <td className={`px-5 py-2.5 text-right font-mono tabular-nums ${strong ? 'font-bold' : 'font-medium'}`}
        style={{ color: valueColor ?? (strong ? '#0F172A' : '#334155') }}>
        {value}
      </td>
    </tr>
  );
}

function ScenarioCard({ title, s, accent, bg, highlight }: {
  title: string; s: Scenario; accent: string; bg: string; highlight?: boolean;
}) {
  return (
    <div className="rounded-card border p-4 lp-card-pro" style={{ background: bg, borderColor: highlight ? accent : '#E2E8F0' }}>
      <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: accent }}>{title}</p>
      <dl className="space-y-2">
        <div className="flex items-center justify-between">
          <dt className="text-xs text-gray-500">Utilidad mensual</dt>
          <dd className="text-sm font-bold font-mono tabular-nums" style={{ color: s.profit >= 0 ? '#0F172A' : '#B91C1C' }}>
            {money(s.profit)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-xs text-gray-500">Margen</dt>
          <dd className="text-sm font-semibold font-mono tabular-nums text-gray-700">{pct(s.marginPct)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-xs text-gray-500">ROI anual</dt>
          <dd className="text-sm font-semibold font-mono tabular-nums" style={{ color: s.annualROI >= 0 ? '#0F172A' : '#B91C1C' }}>
            {pct(s.annualROI)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function AnalysisList({ title, items, icon, accent, bullet }: {
  title: string; items: string[]; icon: React.ReactNode; accent: string; bullet: string;
}) {
  return (
    <div className="p-5">
      <p className="text-xs font-bold uppercase tracking-wide mb-3 flex items-center gap-1.5" style={{ color: accent }}>
        {icon} {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">Sin observaciones.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="text-xs text-gray-600 leading-snug flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: bullet }} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default BusinessSimulator;
