'use client';

import { useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Search, ArrowLeft, Loader2, Copy, CheckCircle, Barcode, Receipt } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArtInvoice, SceneSearchEmpty } from '@/components/illustrations';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CabysItem {
  codigo: string;
  descripcion: string;
  impuesto: number;
}

// ── IVA badge ─────────────────────────────────────────────────────────────────

function IvaBadge({ rate }: { rate: number }) {
  const colors: Record<number, string> = {
    0:  'bg-gray-100 text-gray-600 border-gray-200',
    1:  'bg-blue-100 text-blue-700 border-blue-200',
    2:  'bg-slate-100 text-slate-700 border-slate-200',
    4:  'bg-yellow-100 text-yellow-700 border-yellow-200',
    8:  'bg-orange-100 text-orange-700 border-orange-200',
    13: 'bg-green-100 text-green-700 border-green-200',
  };
  const cls = colors[rate] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {rate}%
    </span>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Código copiado');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No se pudo copiar');
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-700 hover:bg-blue-50 transition-colors cx-press"
      title="Copiar código"
      aria-label="Copiar código CABYS"
    >
      {copied
        ? <CheckCircle className="w-4 h-4 text-emerald-500 cx-tada" />
        : <Copy className="w-4 h-4" />}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CabysPage() {
  const params = useParams<{ attemptId: string }>();

  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<CabysItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [apiError, setApiError] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setApiError(false);
    try {
      const { data } = await api.get<{ cabys: CabysItem[] }>(
        `/api/v1/hacienda/cabys/search?q=${encodeURIComponent(q.trim())}&top=50`,
      );
      setResults(data.cabys ?? []);
      setSearched(true);
    } catch {
      setApiError(true);
      setResults([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 350);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doSearch(query);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/60">
      <div className="max-w-4xl mx-auto px-6 lg:px-10 py-8 space-y-7">

        {/* Volver */}
        <Link
          href={`/estudiante/ejercicio/${params.attemptId}`}
          className="inline-flex items-center gap-2 -ml-1 text-sm font-medium text-gray-500 hover:text-blue-700 transition-colors cx-press"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al ejercicio
        </Link>

        {/* Encabezado */}
        <PageHeader
          eyebrow="Facturación electrónica"
          title="Catálogo CABYS"
          subtitle="Ministerio de Hacienda de Costa Rica — códigos de bienes y servicios."
          icon={Barcode}
          iconTint="#1B2E6E"
          className="lp-in"
        />

        {/* Banda del módulo */}
        <Card variant="onDark" className="cx-pop">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 px-6 lg:px-7 py-6">
            <div className="flex-1 min-w-0">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-500 mb-1.5">
                ¿Qué es el código CABYS?
              </p>
              <h2 className="text-lg font-bold leading-snug">Sin código CABYS no hay factura electrónica.</h2>
              <p className="mt-1.5 text-sm text-blue-200/80 max-w-xl">
                El <strong className="text-white">Catálogo de Bienes y Servicios</strong> es obligatorio en toda factura
                electrónica de Costa Rica. Cada línea lleva un código de 13 dígitos que identifica el producto o
                servicio y determina la tasa de IVA aplicable.
              </p>
            </div>
            <ArtInvoice size={140} className="lp-drift flex-shrink-0" />
          </div>
        </Card>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="relative cx-pop cx-d1">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={handleChange}
              placeholder="Buscar por nombre de producto o servicio... (ej: computadora, servicio consultoría)"
              className="w-full pl-12 pr-14 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-900 text-sm placeholder-gray-400 shadow-card focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors"
              autoFocus
            />
            {loading && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600 animate-spin" />
            )}
          </div>
          <p className="mt-1.5 text-xs text-gray-400 px-1">
            Ingrese al menos 2 caracteres para buscar · Se muestran hasta 50 resultados
          </p>
        </form>

        {/* Error state */}
        {apiError && (
          <div className="rounded-2xl border border-gold-100 bg-gold-50 px-5 py-4 text-sm text-gold-900 cx-shake">
            <p className="font-bold">Servicio CABYS no disponible</p>
            <p className="text-xs mt-1 text-gold-900/80">
              La API de Hacienda no está disponible en este momento. Puede consultar el catálogo
              directamente en{' '}
              <a
                href="https://tribunet.hacienda.go.cr/ATV/CABYSCatalogos"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold"
              >
                tribunet.hacienda.go.cr
              </a>
            </p>
          </div>
        )}

        {/* Results table */}
        {searched && !apiError && (
          <SectionCard
            eyebrow="Resultados"
            title={
              results.length > 0
                ? `${results.length} resultado${results.length !== 1 ? 's' : ''} para "${query}"`
                : `Sin resultados para "${query}"`
            }
            description={results.length > 0 ? 'Haz clic en el ícono para copiar el código.' : undefined}
            icon={Search}
            iconTint="#2563EB"
            flushBody
            className="cx-pop"
          >
            {results.length === 0 ? (
              <EmptyState
                illustration={<SceneSearchEmpty size={200} className="lp-drift" />}
                title="No se encontraron productos o servicios"
                description="Prueba con palabras más generales, por ejemplo “servicio” o “equipo”."
                className="py-10"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 font-semibold">Código</th>
                      <th className="text-left px-4 py-3 font-semibold">Descripción</th>
                      <th className="text-center px-4 py-3 font-semibold">Tasa IVA</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {results.map((item) => (
                      <tr key={item.codigo} className="hover:bg-blue-50/40 transition-colors group">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-bold text-gray-800 tracking-wider">
                            {item.codigo}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-700 leading-snug">{item.descripcion}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <IvaBadge rate={item.impuesto} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <CopyButton text={item.codigo} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )}

        {/* Initial empty state */}
        {!searched && !loading && (
          <EmptyState
            illustration={<SceneSearchEmpty size={220} className="lp-drift" />}
            title="Busca un bien o servicio"
            description="Escribe el nombre del producto o servicio que vas a facturar y obtené su código CABYS con la tasa de IVA correspondiente."
            className="py-8"
          />
        )}

        {/* IVA rates reference card */}
        <SectionCard
          eyebrow="Referencia"
          title="Tasas de IVA en Costa Rica"
          icon={Receipt}
          iconTint="#B8860B"
          className="cx-pop cx-d2"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            {[
              { rate: 0,  label: 'Exento',                    desc: 'Canasta básica, medicamentos' },
              { rate: 1,  label: 'Tarifa reducida 1%',        desc: 'Servicios médicos privados' },
              { rate: 2,  label: 'Tarifa reducida 2%',        desc: 'Seguros personales' },
              { rate: 4,  label: 'Tarifa reducida 4%',        desc: 'Boletos de avión, transporte' },
              { rate: 8,  label: 'Tarifa reducida 8%',        desc: 'Comidas en restaurantes' },
              { rate: 13, label: 'Tarifa general 13%',        desc: 'Mayoría de bienes y servicios' },
            ].map((item) => (
              <div key={item.rate} className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100 cx-lift">
                <IvaBadge rate={item.rate} />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-700">{item.label}</p>
                  <p className="text-gray-400 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

      </div>
    </div>
  );
}
