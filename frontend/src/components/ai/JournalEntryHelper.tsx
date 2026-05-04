'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { Lightbulb, X, Send, Loader2, Sparkles } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface JournalEntryHelperProps {
  companyId?: string;
  /** Pre-fill the description field (e.g. from a nearby form input) */
  defaultDescription?: string;
}

interface SuggestionResult {
  text: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function JournalEntryHelper({ companyId, defaultDescription = '' }: JournalEntryHelperProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState(defaultDescription);
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync if parent updates defaultDescription
  useEffect(() => {
    if (defaultDescription) setDescription(defaultDescription);
  }, [defaultDescription]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleSuggest = async () => {
    const trimmed = description.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        mode: 'account_suggest',
        context: { transactionDescription: trimmed },
      };
      if (companyId) body.companyId = companyId;

      const { data } = await api.post<string>('/api/v1/ai/suggest', body);
      setResult(typeof data === 'string' ? data : JSON.stringify(data));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo conectar con el asistente.';

      if (msg.includes('no configurado') || msg.includes('ANTHROPIC_API_KEY')) {
        setError('Asistente IA no configurado en este servidor.');
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSuggest();
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  /**
   * Light renderer: turns **bold** and \n into JSX.
   */
  const renderSuggestion = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    const nodes: React.ReactNode[] = [];
    parts.forEach((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        nodes.push(<strong key={i}>{part.slice(2, -2)}</strong>);
      } else {
        part.split('\n').forEach((line, j, arr) => {
          nodes.push(line);
          if (j < arr.length - 1) nodes.push(<br key={`${i}-${j}`} />);
        });
      }
    });
    return <>{nodes}</>;
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((v) => !v);
          if (!isOpen) {
            setResult(null);
            setError(null);
          }
        }}
        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors px-2 py-1 rounded-lg hover:bg-blue-50 border border-blue-200 hover:border-blue-300"
        title="Sugerencia de cuentas con IA"
      >
        <Sparkles className="w-3.5 h-3.5" />
        ¿Necesitas ayuda?
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-80 overflow-hidden">
          {/* Popover header */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              <span className="text-sm font-semibold">Sugerencia de cuentas</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-0.5 rounded hover:bg-blue-500 transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-3 space-y-3">
            <p className="text-xs text-gray-500">
              Describe la transacción y te sugeriré las cuentas a debitar y acreditar.
            </p>

            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ej: Pago de alquiler de oficina..."
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={handleSuggest}
                disabled={isLoading || !description.trim()}
                className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Obtener sugerencia"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Result */}
            {result && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-gray-800 leading-relaxed">
                {renderSuggestion(result)}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
