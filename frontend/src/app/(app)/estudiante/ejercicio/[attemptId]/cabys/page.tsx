'use client';

import { useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Search, ArrowLeft, Loader2, Info, Copy, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

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
    2:  'bg-indigo-100 text-indigo-700 border-indigo-200',
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
      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
      title="Copiar código"
    >
      {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link
            href={`/estudiante/ejercicio/${params.attemptId}`}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Catálogo CABYS</h1>
            <p className="text-xs text-gray-500">Ministerio de Hacienda de Costa Rica</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Informational banner */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex gap-3">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 space-y-1">
            <p className="font-semibold">¿Qué es el código CABYS?</p>
            <p>
              El <strong>Catálogo de Bienes y Servicios (CABYS)</strong> es obligatorio en todas las
              facturas electrónicas de Costa Rica según el Ministerio de Hacienda. Cada línea de
              factura debe tener un código CABYS de 13 dígitos que identifica el producto o servicio
              y determina la tasa de IVA aplicable.
            </p>
          </div>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={handleChange}
              placeholder="Buscar por nombre de producto o servicio... (ej: computadora, servicio consultoría)"
              className="w-full pl-12 pr-14 py-3.5 rounded-2xl border border-gray-300 bg-white text-gray-900 text-sm placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            {loading && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 animate-spin" />
            )}
          </div>
          <p className="mt-1.5 text-xs text-gray-400 px-1">
            Ingrese al menos 2 caracteres para buscar · Se muestran hasta 50 resultados
          </p>
        </form>

        {/* Error state */}
        {apiError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">Servicio CABYS no disponible</p>
            <p className="text-xs mt-1">
              La API de Hacienda no está disponible en este momento. Puede consultar el catálogo
              directamente en{' '}
              <a
                href="https://tribunet.hacienda.go.cr/ATV/CABYSCatalogos"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                tribunet.hacienda.go.cr
              </a>
            </p>
          </div>
        )}

        {/* Results table */}
        {searched && !apiError && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">
                {results.length > 0
                  ? `${results.length} resultado${results.length !== 1 ? 's' : ''} para "${query}"`
                  : `Sin resultados para "${query}"`}
              </p>
              {results.length > 0 && (
                <p className="text-xs text-gray-400">Haga clic en el ícono para copiar el código</p>
              )}
            </div>

            {results.length === 0 ? (
              <div className="py-10 text-center">
                <Search className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No se encontraron productos o servicios</p>
                <p className="text-gray-400 text-xs mt-1">Pruebe con palabras más generales</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium">Código</th>
                      <th className="text-left px-4 py-3 font-medium">Descripción</th>
                      <th className="text-center px-4 py-3 font-medium">Tasa IVA</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {results.map((item) => (
                      <tr key={item.codigo} className="hover:bg-blue-50 transition-colors group">
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
          </div>
        )}

        {/* Initial empty state */}
        {!searched && !loading && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Ingrese un término para buscar en el catálogo CABYS</p>
          </div>
        )}

        {/* IVA rates reference card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Tasas de IVA en Costa Rica</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {[
              { rate: 0,  label: 'Exento',                    desc: 'Canasta básica, medicamentos' },
              { rate: 1,  label: 'Tarifa reducida 1%',        desc: 'Servicios médicos privados' },
              { rate: 2,  label: 'Tarifa reducida 2%',        desc: 'Seguros personales' },
              { rate: 4,  label: 'Tarifa reducida 4%',        desc: 'Boletos de avión, transporte' },
              { rate: 8,  label: 'Tarifa reducida 8%',        desc: 'Comidas en restaurantes' },
              { rate: 13, label: 'Tarifa general 13%',        desc: 'Mayoría de bienes y servicios' },
            ].map((item) => (
              <div key={item.rate} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50">
                <IvaBadge rate={item.rate} />
                <div>
                  <p className="font-medium text-gray-700">{item.label}</p>
                  <p className="text-gray-400 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
