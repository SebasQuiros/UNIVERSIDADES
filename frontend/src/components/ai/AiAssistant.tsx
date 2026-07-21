'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ElementType } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  X, Send, Sparkles, Loader2, Bot, Lightbulb, Scale, ListChecks, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AiAssistantProps {
  companyId?: string;
  attemptId?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Renderizador de markdown mínimo:
 * - **negrita** → <strong>
 * - saltos de línea → <br>
 */
function renderMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  const nodes: React.ReactNode[] = [];

  parts.forEach((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      nodes.push(<strong key={i}>{part.slice(2, -2)}</strong>);
    } else {
      // Split on newlines
      const lines = part.split('\n');
      lines.forEach((line, j) => {
        nodes.push(line);
        if (j < lines.length - 1) nodes.push(<br key={`${i}-br-${j}`} />);
      });
    }
  });

  return <>{nodes}</>;
}

// ── Quick action buttons config ───────────────────────────────────────────────
// Iconos lucide (sin emojis). `mode` y `message` alimentan la llamada a la API.

const QUICK_ACTIONS = [
  { label: 'Dame una pista',    icon: Lightbulb,  mode: 'exercise_hint',   message: 'Necesito una pista para avanzar en el ejercicio' },
  { label: 'Explica mi balance', icon: Scale,     mode: 'chat',            message: '¿Puedes explicarme cómo verificar si mi balance general está cuadrado?' },
  { label: 'Sugiere cuentas',   icon: ListChecks, mode: 'account_suggest', transactionDescription: 'necesito ayuda para elegir las cuentas correctas' },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function AiAssistant({ companyId, attemptId }: AiAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '¡Hola! Soy ContaBot, tu asistente de contabilidad de ContaSJ. ¿En qué puedo ayudarte hoy? Puedes preguntarme sobre asientos contables, el balance general, cuentas o cualquier duda del ejercicio.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const sendMessage = useCallback(
    async (
      content: string,
      mode: string = 'chat',
      extraContext?: Record<string, unknown>,
    ) => {
      const trimmed = content.trim();
      if (!trimmed || isLoading) return;

      const userMsg: Message = {
        id: uid(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev.slice(-19), userMsg]); // keep last 20
      setInput('');
      setIsLoading(true);

      // Build history for context (exclude the welcome message)
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const body: Record<string, unknown> = {
          mode,
          context: {
            message: trimmed,
            history,
            ...extraContext,
          },
        };
        if (companyId) body.companyId = companyId;
        if (attemptId) body.attemptId = attemptId;

        const { data } = await api.post<string>('/api/v1/ai/suggest', body);

        const assistantMsg: Message = {
          id: uid(),
          role: 'assistant',
          content: typeof data === 'string' ? data : JSON.stringify(data),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: unknown) {
        const errorMsg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'No se pudo conectar con el asistente. Intenta de nuevo.';

        // Check for "not configured" scenario
        if (errorMsg.includes('no configurado') || errorMsg.includes('ANTHROPIC_API_KEY')) {
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: 'assistant',
              content: 'Asistente IA no configurado. El administrador debe configurar la clave de API.',
              timestamp: new Date(),
            },
          ]);
        } else {
          toast.error('Error al consultar al asistente');
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: 'assistant',
              content: `Lo siento, ocurrió un error: ${errorMsg}`,
              timestamp: new Date(),
            },
          ]);
        }
      } finally {
        setIsLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [messages, isLoading, companyId, attemptId],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleQuickAction = (action: (typeof QUICK_ACTIONS)[number]) => {
    if (action.mode === 'account_suggest') {
      sendMessage(
        '¿Qué cuentas debo usar? Necesito ayuda para elegir las cuentas correctas.',
        'account_suggest',
        { transactionDescription: (action as { transactionDescription?: string }).transactionDescription },
      );
    } else {
      sendMessage(action.message, action.mode);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Botón flotante */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            'fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full text-white',
            'bg-gradient-to-br from-blue-600 to-[#1B2E6E] shadow-[0_10px_28px_rgba(27,46,110,0.35)]',
            'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(27,46,110,0.45)]',
            'cx-press cx-wiggle-parent',
          )}
          aria-label="Abrir asistente IA"
        >
          <Sparkles className="w-5 h-5 text-gold-500 cx-wiggle" />
          <span className="text-sm font-semibold hidden sm:inline">ContaBot</span>
        </button>
      )}

      {/* Panel de conversación */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col bg-white border border-gray-200/70 rounded-card shadow-2xl overflow-hidden transition-all duration-200 cx-pop"
          style={{ width: 380, height: isMinimized ? 60 : 520 }}
        >
          {/* Cabecera */}
          <div className="relative flex items-center justify-between px-4 py-3 text-white flex-shrink-0 bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent"
            />
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/10 border border-white/15">
                <Bot className="w-4 h-4 text-blue-200" />
              </span>
              <div>
                <p className="text-sm font-bold leading-tight tracking-tight">ContaBot</p>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-gold-500 leading-tight mt-0.5">
                  Asistente ContaSJ
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized((v) => !v)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cx-press"
                aria-label={isMinimized ? 'Expandir' : 'Minimizar'}
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${isMinimized ? 'rotate-180' : ''}`}
                />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cx-press"
                aria-label="Cerrar asistente"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Conversación */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#FBF8F1]">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn('flex cx-pop', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    {msg.role === 'assistant' && (
                      <span className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                        <Bot className="w-3.5 h-3.5 text-blue-700" />
                      </span>
                    )}
                    <div
                      className={cn(
                        'max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-gradient-to-br from-blue-600 to-[#1B2E6E] text-white rounded-br-md shadow-[0_6px_16px_rgba(27,46,110,0.22)]'
                          : 'bg-white text-gray-800 border border-gray-200/70 rounded-bl-md shadow-card',
                      )}
                    >
                      {renderMarkdown(msg.content)}
                    </div>
                  </div>
                ))}

                {/* Indicador de "pensando" */}
                {isLoading && (
                  <div className="flex justify-start cx-pop">
                    <span className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
                      <Bot className="w-3.5 h-3.5 text-blue-700" />
                    </span>
                    <div className="bg-white border border-gray-200/70 rounded-2xl rounded-bl-md shadow-card px-4 py-3">
                      <div className="flex gap-1.5 items-center">
                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full cx-bounce" />
                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full cx-bounce" style={{ animationDelay: '160ms' }} />
                        <span className="w-1.5 h-1.5 bg-gold-500 rounded-full cx-bounce" style={{ animationDelay: '320ms' }} />
                        <span className="sr-only">ContaBot está pensando…</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Acciones rápidas */}
              <div className="px-3 py-2.5 border-t border-gray-100 bg-white flex gap-1.5 overflow-x-auto flex-shrink-0">
                {QUICK_ACTIONS.map((action) => {
                  const ActionIcon: ElementType = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action)}
                      disabled={isLoading}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cx-press"
                    >
                      <ActionIcon className="w-3.5 h-3.5" />
                      {action.label}
                    </button>
                  );
                })}
              </div>

              {/* Entrada */}
              <div className="px-3 pb-3 pt-2 bg-white flex gap-2 items-end flex-shrink-0 border-t border-gray-100">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu pregunta…"
                  disabled={isLoading}
                  rows={1}
                  className="flex-1 resize-none text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500 disabled:opacity-50 min-h-[38px] max-h-[96px]"
                  style={{ overflow: 'hidden' }}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = 'auto';
                    el.style.height = Math.min(el.scrollHeight, 96) + 'px';
                    el.style.overflow = el.scrollHeight > 96 ? 'auto' : 'hidden';
                  }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={isLoading || !input.trim()}
                  className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-blue-600 to-[#1B2E6E] shadow-[0_6px_16px_rgba(27,46,110,0.25)] transition-all hover:shadow-[0_10px_24px_rgba(27,46,110,0.35)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none cx-press"
                  aria-label="Enviar mensaje"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
