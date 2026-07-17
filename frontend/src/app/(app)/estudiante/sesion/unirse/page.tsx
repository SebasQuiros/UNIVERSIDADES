'use client';

// ── FASE 1 — Andamiaje de maqueta ────────────────────────────────────────────
// Pantalla para unirse a una "Sesión de Aula" con el código de 6 caracteres que
// el profesor proyecta (estilo Kahoot). No llama a `api`: valida contra
// `VALID_JOIN_CODE` en `_mock.ts`. En fase 2 esto se reemplaza por
// `api.post('/api/v1/class-sessions/join', { code })` (contrato a definir con
// backend-engineer).

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/IconTile';
import { SceneWelcome } from '@/components/illustrations';
import { KeyRound, ArrowLeft, Loader2, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { MOCK_SESSION, VALID_JOIN_CODE } from '../_mock';

const CODE_LEN = 6;
type Status = 'idle' | 'invalid' | 'joining' | 'joined';

export default function UnirseSesionPage() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LEN).fill(''));
  const [status, setStatus] = useState<Status>('idle');
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join('');

  const focusBox = (i: number) => inputsRef.current[i]?.focus();

  const setDigit = (i: number, value: string) => {
    const clean = value.replace(/[^a-zA-Z0-9]/g, '').slice(-1).toUpperCase();
    setDigits((prev) => {
      const next = [...prev];
      next[i] = clean;
      return next;
    });
    setStatus('idle');
    if (clean && i < CODE_LEN - 1) focusBox(i + 1);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      focusBox(i - 1);
    }
    if (e.key === 'ArrowLeft' && i > 0) focusBox(i - 1);
    if (e.key === 'ArrowRight' && i < CODE_LEN - 1) focusBox(i + 1);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!text) return;
    e.preventDefault();
    const next = Array(CODE_LEN).fill('');
    for (let i = 0; i < Math.min(CODE_LEN, text.length); i++) next[i] = text[i];
    setDigits(next);
    setStatus('idle');
    focusBox(Math.min(text.length, CODE_LEN) - 1);
  };

  const submit = useCallback(() => {
    if (code.length !== CODE_LEN || status === 'joining' || status === 'joined') return;
    setStatus('joining');
    // Andamiaje: simula latencia de red antes de "confirmar" el código.
    setTimeout(() => {
      if (code === VALID_JOIN_CODE) {
        setStatus('joined');
        setTimeout(() => router.push(`/estudiante/sesion/${MOCK_SESSION.id}`), 700);
      } else {
        setStatus('invalid');
      }
    }, 800);
  }, [code, status, router]);

  // Auto-envío cuando las 6 casillas están completas.
  useEffect(() => {
    if (code.length === CODE_LEN && status === 'idle') submit();
  }, [code, status, submit]);

  const fillDemoCode = () => {
    setDigits(VALID_JOIN_CODE.split(''));
    setStatus('idle');
    focusBox(CODE_LEN - 1);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 lg:p-8 bg-[#F4F6F8]">
      <div className="w-full max-w-3xl">
        <Link
          href="/estudiante"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al inicio
        </Link>

        <div className="bg-white border border-gray-200/70 shadow-card rounded-card overflow-hidden lp-in">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-6 p-6 sm:p-10">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <IconTile icon={KeyRound} tint="#1B2E6E" size={48} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold-900 mb-0.5">
                    Sesión de aula
                  </p>
                  <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Unite con el código</h1>
                </div>
              </div>
              <p className="text-sm text-gray-500 max-w-sm mb-8">
                Pedile el código de 6 caracteres a tu profesor — lo vas a ver proyectado en la pizarra o pantalla del aula.
              </p>

              {/* Casillas de código */}
              <div
                className={cn('flex gap-2 sm:gap-3', status === 'invalid' && 'cx-shake')}
                role="group"
                aria-label="Código de la sesión"
              >
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputsRef.current[i] = el; }}
                    value={d}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    disabled={status === 'joining' || status === 'joined'}
                    inputMode="text"
                    maxLength={1}
                    aria-label={`Carácter ${i + 1} de ${CODE_LEN}`}
                    className={cn(
                      'w-11 h-14 sm:w-14 sm:h-16 text-center text-2xl sm:text-3xl font-mono font-bold rounded-xl border-2 outline-none transition-all uppercase',
                      'focus:ring-4 focus:ring-blue-100',
                      status === 'invalid'
                        ? 'border-red-400 text-red-600 bg-red-50'
                        : status === 'joined'
                          ? 'border-emerald-400 text-emerald-700 bg-emerald-50'
                          : 'border-gray-300 text-gray-900 bg-white focus:border-blue-500',
                      (status === 'joining' || status === 'joined') && 'opacity-70',
                    )}
                  />
                ))}
              </div>

              {/* Estado */}
              <div className="mt-5 min-h-[2rem]">
                {status === 'joining' && (
                  <p className="flex items-center gap-2 text-sm font-medium text-blue-700">
                    <Loader2 className="w-4 h-4 animate-spin" /> Uniéndote a la sesión…
                  </p>
                )}
                {status === 'joined' && (
                  <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 cx-pop">
                    <CheckCircle2 className="w-4 h-4" /> ¡Listo! Entrando a la sesión…
                  </p>
                )}
                {status === 'invalid' && (
                  <p className="flex items-center gap-2 text-sm font-medium text-red-600">
                    <XCircle className="w-4 h-4" /> Ese código no es válido. Pedile el código actualizado a tu profesor.
                  </p>
                )}
              </div>

              <Button
                onClick={submit}
                disabled={code.length !== CODE_LEN}
                loading={status === 'joining'}
                className="mt-4"
              >
                Unirme a la sesión
              </Button>

              {/* Andamiaje de fase 1: código de prueba visible para recorrer la maqueta. */}
              <button
                onClick={fillDemoCode}
                className="mt-5 flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Modo maqueta (fase 1): usar el código de prueba <code className="font-mono font-semibold">{VALID_JOIN_CODE}</code>
              </button>
            </div>

            <SceneWelcome size={200} className="hidden md:block lp-drift justify-self-center" />
          </div>
        </div>
      </div>
    </div>
  );
}
