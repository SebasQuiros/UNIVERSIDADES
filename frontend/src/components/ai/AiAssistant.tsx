'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { X, Send, Sparkles, Loader2, Bot, Lightbulb, BarChart2, BookOpen, ChevronDown } from 'lucide-react';
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
 * Very light markdown renderer:
 * - **bold** → <strong>
 * - line breaks → <br>
 * - ✅ ❌ 📥 📤 💡 emojis stay as-is
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

const QUICK_ACTIONS = [
  { label: '💡 Dame una pista', mode: 'exercise_hint', message: 'Necesito una pista para avanzar en el ejercicio' },
  { label: '📊 Explica mi balance', mode: 'chat', message: '¿Puedes explicarme cómo verificar si mi balance general está cuadrado?' },
  { label: '📝 Sugiere cuentas', mode: 'account_suggest', transactionDescription: 'necesito ayuda para elegir las cuentas correctas' },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function AiAssistant({ companyId, attemptId }: AiAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '¡Hola! Soy ContaBot, tu asistente de contabilidad de SJQA GROUP. ¿En qué puedo ayudarte hoy? Puedes preguntarme sobre asientos contables, el balance general, cuentas o cualquier duda del ejercicio. 📚',
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
              content: '⚠️ Asistente IA no configurado. El administrador debe configurar la clave de API.',
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
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group"
          aria-label="Abrir asistente IA"
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">ContaBot</span>
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden transition-all duration-200"
          style={{ width: 380, height: isMinimized ? 56 : 520 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <div>
                <p className="text-sm font-semibold leading-tight">ContaBot</p>
                <p className="text-xs text-blue-200 leading-tight">Asistente SJQA GROUP</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized((v) => !v)}
                className="p-1 rounded hover:bg-blue-500 transition-colors"
                aria-label={isMinimized ? 'Expandir' : 'Minimizar'}
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${isMinimized ? 'rotate-180' : ''}`}
                />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-blue-500 transition-colors"
                aria-label="Cerrar asistente"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                        <Bot className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm'
                      }`}
                    >
                      {renderMarkdown(msg.content)}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
                      <Bot className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm shadow-sm px-4 py-3">
                      <div className="flex gap-1 items-center">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick actions */}
              <div className="px-3 py-2 border-t border-gray-100 bg-white flex gap-1.5 overflow-x-auto flex-shrink-0">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action)}
                    disabled={isLoading}
                    className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {action.label}
                  </button>
                ))}
              </div>

              {/* Input area */}
              <div className="px-3 pb-3 pt-2 bg-white flex gap-2 items-end flex-shrink-0 border-t border-gray-100">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu pregunta..."
                  disabled={isLoading}
                  rows={1}
                  className="flex-1 resize-none text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 min-h-[38px] max-h-[96px]"
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
                  className="flex-shrink-0 w-9 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
