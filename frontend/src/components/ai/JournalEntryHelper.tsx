'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Lightbulb, X, Send, Loader2, Sparkles, AlertTriangle } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface JournalEntryHelperProps {
  companyId?: string;
  /** Pre-fill the description field (e.g. from a nearby form input) */
  defaultDescription?: string;
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
   * Renderizador ligero: convierte **negrita** y \n en JSX.
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
      {/* Disparador */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((v) => !v);
          if (!isOpen) {
            setResult(null);
            setError(null);
          }
        }}
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors',
          'text-blue-700 border border-blue-200 hover:bg-blue-50 hover:border-blue-300',
          'cx-press cx-wiggle-parent',
        )}
        title="Sugerencia de cuentas con IA"
      >
        <Sparkles className="w-3.5 h-3.5 text-gold-600 cx-wiggle" />
        ¿Necesitas ayuda?
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 z-50 w-80 overflow-hidden rounded-card border border-gray-200/70 bg-white shadow-2xl cx-pop">
          {/* Cabecera */}
          <div className="relative flex items-center justify-between px-3.5 py-2.5 text-white bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent"
            />
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/10 border border-white/15">
                <Lightbulb className="w-3.5 h-3.5 text-gold-500" />
              </span>
              <div>
                <p className="text-sm font-bold leading-tight tracking-tight">Sugerencia de cuentas</p>
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-gold-500 leading-tight mt-0.5">
                  Asistente ContaSJ
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors cx-press"
              aria-label="Cerrar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Cuerpo */}
          <div className="p-3.5 space-y-3">
            <p className="text-xs text-gray-500 leading-relaxed">
              Describe la transacción y te sugiero qué cuentas debitar y acreditar. La decisión final
              (y el asiento) siguen siendo tuyos.
            </p>

            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ej: Pago de alquiler de oficina…"
                className="flex-1 text-sm border border-gray-300 rounded-xl px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500 disabled:opacity-50"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={handleSuggest}
                disabled={isLoading || !description.trim()}
                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-blue-600 to-[#1B2E6E] shadow-[0_6px_16px_rgba(27,46,110,0.25)] transition-all hover:shadow-[0_10px_24px_rgba(27,46,110,0.35)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none cx-press"
                aria-label="Obtener sugerencia"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Pensando */}
            {isLoading && (
              <div className="flex items-center gap-1.5 px-1">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full cx-bounce" />
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full cx-bounce" style={{ animationDelay: '160ms' }} />
                <span className="w-1.5 h-1.5 bg-gold-500 rounded-full cx-bounce" style={{ animationDelay: '320ms' }} />
                <span className="text-xs text-gray-400 ml-1.5">Pensando…</span>
              </div>
            )}

            {/* Resultado */}
            {result && (
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-sm leading-relaxed text-gray-800 cx-pop">
                {renderSuggestion(result)}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 cx-shake">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
