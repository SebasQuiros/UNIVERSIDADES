'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PickerAccount {
  id: string;
  code: string;
  name: string;
  type?: string;
}

interface Props {
  accounts: PickerAccount[];
  value: string;                 // accountId seleccionado ('' = ninguno)
  onChange: (accountId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const TYPE_LABEL: Record<string, string> = {
  ASSET: 'Activo', LIABILITY: 'Pasivo', EQUITY: 'Patrimonio',
  INCOME: 'Ingreso', EXPENSE: 'Gasto',
};

/**
 * Selector de cuenta contable con lupa buscadora: filtra por código o nombre.
 * Reemplaza al <select> nativo cuando el catálogo es grande.
 */
export function AccountPicker({
  accounts, value, onChange, placeholder = 'Buscar cuenta…', disabled, className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => accounts.find(a => a.id === value) ?? null, [accounts, value]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts.slice(0, 100);
    return accounts.filter(a =>
      a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q),
    ).slice(0, 100);
  }, [accounts, query]);

  // Cerrar al hacer click afuera
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      {/* Botón / valor seleccionado */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-xs transition-colors',
          'hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60',
        )}
      >
        <Search className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
        {selected ? (
          <span className="min-w-0 flex-1 truncate text-gray-800">
            <span className="font-mono text-gray-500">{selected.code}</span> {selected.name}
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-gray-400">{placeholder}</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card-hover">
          <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
            <Search className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Código o nombre…"
              className="w-full text-xs text-gray-800 placeholder-gray-400 focus:outline-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-gray-300 hover:text-gray-500">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <ul className="max-h-64 overflow-y-auto py-1">
            {results.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-gray-400">Sin coincidencias</li>
            ) : (
              results.map(a => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => { onChange(a.id); setOpen(false); setQuery(''); }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-blue-50',
                      a.id === value && 'bg-blue-50',
                    )}
                  >
                    <span className="w-16 flex-shrink-0 font-mono text-gray-400">{a.code}</span>
                    <span className="min-w-0 flex-1 truncate text-gray-800">{a.name}</span>
                    {a.type && (
                      <span className="flex-shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[0.6rem] text-gray-500">
                        {TYPE_LABEL[a.type] ?? a.type}
                      </span>
                    )}
                    {a.id === value && <Check className="h-3.5 w-3.5 flex-shrink-0 text-blue-600" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
