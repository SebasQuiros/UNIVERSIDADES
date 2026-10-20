'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { SceneSearchEmpty } from '@/components/illustrations';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CabysItem {
  codigo: string;
  descripcion: string;
  impuesto: number;
  /**
   * false cuando el código se escribió a mano y no se pudo confirmar la tarifa
   * contra Hacienda. Quien recibe el item NO debe pisar el IVA del formulario
   * en ese caso: estaría inventando una tarifa.
   */
  tarifaConocida?: boolean;
}

interface CabysSearchProps {
  /** Called when the user selects a CABYS item */
  onSelect: (item: CabysItem) => void;
  /**
   * Código CABYS actualmente asignado. Es la ÚNICA fuente de verdad de lo que
   * se ve seleccionado: el componente no guarda una selección propia en
   * paralelo. Antes sí lo hacía, y se desincronizaba —al borrar una línea de
   * factura, la insignia verde quedaba mostrando el código de la línea
   * borrada mientras el formulario no tenía ninguno.
   */
  value?: string;
  /** Label shown above the input */
  label?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether to show the manual fallback input when API fails */
  showManualFallback?: boolean;
  /** Se llama al quitar el código. Sin esto, el botón X limpiaría la pantalla
   *  pero dejaría el código viejo guardado en el formulario. */
  onClear?: () => void;
}

// ── IVA badge color by rate ───────────────────────────────────────────────────

function ivaBadgeClass(rate: number): string {
  if (rate === 0)  return 'bg-gray-100 text-gray-600';
  if (rate === 4)  return 'bg-yellow-100 text-yellow-700';
  if (rate === 8)  return 'bg-orange-100 text-orange-700';
  if (rate === 13) return 'bg-green-100 text-green-700';
  return 'bg-blue-100 text-blue-700';
}

const ES_CABYS = (c?: string) => !!c && /^\d{13}$/.test(c);

// ── Component ─────────────────────────────────────────────────────────────────

export function CabysSearch({
  onSelect,
  value,
  label = 'Código CABYS',
  disabled = false,
  showManualFallback = true,
  onClear,
}: CabysSearchProps) {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState<CabysItem[]>([]);
  const [loading, setLoading]       = useState(false);
  const [open, setOpen]             = useState(false);
  const [apiError, setApiError]     = useState(false);
  const [manualCode, setManualCode] = useState('');

  /**
   * Detalle (descripción + IVA) de los códigos que ya conocemos, por código.
   * Es solo presentación: la selección vive en `value`. Sirve para que al
   * abrir un producto ya guardado se vea de qué es el código y no un campo
   * de búsqueda vacío.
   */
  const [detalles, setDetalles] = useState<Record<string, CabysItem>>({});

  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // La selección se DERIVA del value que manda el formulario.
  const selected: CabysItem | null = ES_CABYS(value)
    ? detalles[value!] ?? { codigo: value!, descripcion: '', impuesto: 13, tarifaConocida: false }
    : null;

  const recordar = useCallback((item: CabysItem) => {
    if (ES_CABYS(item.codigo)) setDetalles((prev) => ({ ...prev, [item.codigo]: item }));
  }, []);

  // ── Resolver el detalle de un código que llega ya asignado ────────────────
  useEffect(() => {
    if (!ES_CABYS(value) || detalles[value!]) return;
    let vigente = true;
    api
      .get<{ item: CabysItem | null; found: boolean }>(`/api/v1/hacienda/cabys/${value}`)
      .then(({ data }) => {
        if (vigente && data?.item) {
          recordar({ ...data.item, tarifaConocida: true });
        }
      })
      .catch(() => { /* sin detalle se muestra solo el código; no es un fallo */ });
    return () => { vigente = false; };
  }, [value, detalles, recordar]);

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
      // El backend responde 503 cuando Hacienda no contesta, y 200 con lista
      // vacía cuando simplemente no hay coincidencias. Solo lo primero abre
      // el ingreso manual.
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
    recordar(item);
    setQuery('');
    setOpen(false);
    onSelect(item);
  }

  // ── Clear selection ────────────────────────────────────────────────────────
  function handleClear() {
    setQuery('');
    setResults([]);
    setOpen(false);
    onClear?.();
  }

  // ── Manual code submit ────────────────────────────────────────────────────
  //
  // Se intenta igual resolver la tarifa: puede estar caída la búsqueda por
  // texto y funcionar la consulta por código. Si tampoco se puede, se entrega
  // el código marcado como tarifa no confirmada, para que el formulario deje
  // el IVA que el estudiante haya puesto en vez de asumir 13%.
  async function handleManualSubmit() {
    if (!ES_CABYS(manualCode)) return;
    let item: CabysItem = {
      codigo: manualCode,
      descripcion: 'Código ingresado manualmente',
      impuesto: 13,
      tarifaConocida: false,
    };
    try {
      const { data } = await api.get<{ item: CabysItem | null }>(
        `/api/v1/hacienda/cabys/${manualCode}`,
      );
      if (data?.item) item = { ...data.item, tarifaConocida: true };
    } catch {
      /* se usa el item sin confirmar */
    }
    handleSelect(item);
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
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 cx-pop">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 cx-tada" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono font-bold text-emerald-800 tracking-wider">{selected.codigo}</p>
            <p className="text-xs text-emerald-700 truncate">
              {selected.descripcion || 'Consultando descripción…'}
            </p>
          </div>
          {selected.tarifaConocida !== false && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${ivaBadgeClass(selected.impuesto)}`}>
              IVA {selected.impuesto}%
            </span>
          )}
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-red-500 shrink-0 cx-press"
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
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors disabled:opacity-50"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600 animate-spin" />
            )}
          </div>

          {/* Dropdown */}
          {open && results.length > 0 && (
            <div className="absolute z-50 mt-1.5 w-full bg-white rounded-2xl border border-gray-200/70 shadow-card-hover overflow-hidden cx-pop">
              <ul className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                {results.map((item) => (
                  <li key={item.codigo}>
                    <button
                      type="button"
                      onClick={() => handleSelect({ ...item, tarifaConocida: true })}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50/60 transition-colors flex items-start gap-3 cx-press"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono font-bold text-gray-800 tracking-wider">{item.codigo}</p>
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
            <div className="absolute z-50 mt-1.5 w-full bg-white rounded-2xl border border-gray-200/70 shadow-card-hover px-4 py-4 text-center cx-pop">
              <SceneSearchEmpty size={120} className="mx-auto mb-2 lp-drift" />
              <p className="text-sm text-gray-600">Sin resultados para <span className="font-semibold">&laquo;{query}&raquo;</span></p>
              <p className="text-xs text-gray-400 mt-1">Intente con otra palabra clave</p>
            </div>
          )}

          {/* API error — manual fallback */}
          {apiError && showManualFallback && (
            <div className="mt-2 p-3.5 rounded-xl border border-gold-100 bg-gold-50 flex flex-col gap-2 cx-shake">
              <div className="flex items-center gap-2 text-gold-900">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p className="text-xs font-semibold">Servicio CABYS no disponible. Ingrese el código manualmente:</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.replace(/\D/g, '').slice(0, 13))}
                  placeholder="Código CABYS (13 dígitos)"
                  maxLength={13}
                  className="flex-1 px-3 py-2 text-xs font-mono rounded-lg border border-gold-100 bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500"
                />
                <button
                  type="button"
                  onClick={handleManualSubmit}
                  disabled={manualCode.length !== 13}
                  className="px-3.5 py-2 text-xs font-semibold text-white rounded-lg bg-gradient-to-br from-[#D4A017] to-[#B8860B] shadow-[0_6px_20px_rgba(184,134,11,0.3)] hover:shadow-[0_10px_28px_rgba(184,134,11,0.42)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all cx-press"
                >
                  Usar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
