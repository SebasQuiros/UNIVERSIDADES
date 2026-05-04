'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CabysItem {
  codigo: string;
  descripcion: string;
  impuesto: number;
}

interface CabysSearchProps {
  /** Called when the user selects a CABYS item */
  onSelect: (item: CabysItem) => void;
  /** Currently selected CABYS code (controlled) */
  value?: string;
  /** Label shown above the input */
  label?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether to show the manual fallback input when API fails */
  showManualFallback?: boolean;
}

// ── IVA badge color by rate ───────────────────────────────────────────────────

function ivaBadgeClass(rate: number): string {
  if (rate === 0)  return 'bg-gray-100 text-gray-600';
  if (rate === 4)  return 'bg-yellow-100 text-yellow-700';
  if (rate === 8)  return 'bg-orange-100 text-orange-700';
  if (rate === 13) return 'bg-green-100 text-green-700';
  return 'bg-blue-100 text-blue-700';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CabysSearch({
  onSelect,
  value,
  label = 'Código CABYS',
  disabled = false,
  showManualFallback = true,
}: CabysSearchProps) {
  const [query, setQuery]               = useState('');
  const [results, setResults]           = useState<CabysItem[]>([]);
  const [loading, setLoading]           = useState(false);
  const [open, setOpen]                 = useState(false);
  const [selected, setSelected]         = useState<CabysItem | null>(null);
  const [apiError, setApiError]         = useState(false);
  const [manualCode, setManualCode]     = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Close dropdown when clicking outside ─────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Debounced search ──────────────────────────────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    setApiError(false);
    try {
      const { data } = await api.get<{ cabys: CabysItem[] }>(
        `/api/v1/hacienda/cabys/search?q=${encodeURIComponent(q.trim())}&top=10`,
      );
      setResults(data.cabys ?? []);
      setOpen(true);
    } catch {
      setApiError(true);
      setResults([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  }

  // ── Select an item ────────────────────────────────────────────────────────
  function handleSelect(item: CabysItem) {
    setSelected(item);
    setQuery('');
    setOpen(false);
    onSelect(item);
  }

  // ── Clear selection ────────────────────────────────────────────────────────
  function handleClear() {
    setSelected(null);
    setQuery('');
    setResults([]);
  }

  // ── Manual code submit ────────────────────────────────────────────────────
  function handleManualSubmit() {
    if (!/^\d{13}$/.test(manualCode)) return;
    const fallback: CabysItem = { codigo: manualCode, descripcion: 'Código ingresado manualmente', impuesto: 13 };
    handleSelect(fallback);
    setManualCode('');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-gray-700">{label}</label>
      )}

      {/* Selected badge */}
      {selected ? (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-green-300 bg-green-50">
          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono font-bold text-green-800">{selected.codigo}</p>
            <p className="text-xs text-green-700 truncate">{selected.descripcion}</p>
          </div>
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${ivaBadgeClass(selected.impuesto)}`}>
            IVA {selected.impuesto}%
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-red-500 shrink-0"
              title="Cambiar código CABYS"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={handleQueryChange}
              disabled={disabled}
              placeholder="Buscar producto o servicio..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
            )}
          </div>

          {/* Dropdown */}
          {open && results.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
              <ul className="max-h-60 overflow-y-auto divide-y divide-gray-50">
                {results.map((item) => (
                  <li key={item.codigo}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors flex items-start gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono font-bold text-gray-800">{item.codigo}</p>
                        <p className="text-xs text-gray-600 truncate">{item.descripcion}</p>
                      </div>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0 mt-0.5 ${ivaBadgeClass(item.impuesto)}`}>
                        IVA {item.impuesto}%
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* No results state */}
          {open && !loading && results.length === 0 && query.trim().length >= 2 && (
            <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg px-4 py-3 text-center">
              <p className="text-sm text-gray-500">Sin resultados para <span className="font-medium">"{query}"</span></p>
              <p className="text-xs text-gray-400 mt-1">Intente con otra palabra clave</p>
            </div>
          )}

          {/* API error — manual fallback */}
          {apiError && showManualFallback && (
            <div className="mt-2 p-3 rounded-xl border border-amber-200 bg-amber-50 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p className="text-xs font-medium">Servicio CABYS no disponible. Ingrese el código manualmente:</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.replace(/\D/g, '').slice(0, 13))}
                  placeholder="Código CABYS (13 dígitos)"
                  maxLength={13}
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handleManualSubmit}
                  disabled={manualCode.length !== 13}
                  className="px-3 py-2 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Usar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Current value indicator when value prop differs from selected */}
      {!selected && value && /^\d{13}$/.test(value) && (
        <p className="text-xs text-gray-500">
          Código actual: <span className="font-mono font-semibold text-gray-700">{value}</span>
        </p>
      )}
    </div>
  );
}
