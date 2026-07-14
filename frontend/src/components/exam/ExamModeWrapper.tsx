'use client';

import { useState, useCallback } from 'react';
import { Eye, Lock, Loader2 } from 'lucide-react';
import { ExamTimer } from './ExamTimer';
import { TabSwitchDetector } from './TabSwitchDetector';

interface ExamModeWrapperProps {
  attemptId: string;
  studentName: string;
  exerciseName: string;
  timeLimitMinutes?: number;
  examMode?: boolean;
  onAutoSubmit: () => Promise<void>;
  children: React.ReactNode;
}

export function ExamModeWrapper({
  attemptId,
  studentName,
  exerciseName,
  timeLimitMinutes,
  examMode,
  onAutoSubmit,
  children,
}: ExamModeWrapperProps) {
  const isActive = examMode || (timeLimitMinutes != null && timeLimitMinutes > 0);
  const [timeUp, setTimeUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  const handleTimeUp = useCallback(async () => {
    setTimeUp(true);
    setSubmitting(true);
    try {
      await onAutoSubmit();
    } finally {
      setSubmitting(false);
    }
  }, [onAutoSubmit]);

  if (!isActive) {
    return <>{children}</>;
  }

  return (
    <>
      {/* ── Detector de cambio de pestaña (invisible) ─────────────────────── */}
      <TabSwitchDetector attemptId={attemptId} onSwitch={setTabSwitchCount} />

      {/* ── Temporizador fijo ─────────────────────────────────────────────── */}
      {timeLimitMinutes != null && timeLimitMinutes > 0 && (
        <ExamTimer
          attemptId={attemptId}
          timeLimitMinutes={timeLimitMinutes}
          onTimeUp={handleTimeUp}
        />
      )}

      {/* ── Banda superior de modo examen ─────────────────────────────────── */}
      <div className="z-30 flex w-full items-center justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-csq-dark via-csq-dark-2 to-csq-mid px-4 py-2.5 text-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-red-400/30 bg-red-500/15">
            <Lock className="w-3.5 h-3.5 text-red-300" />
          </span>
          <span className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-red-300">
            Modo examen
          </span>
          <span className="text-blue-200/40">·</span>
          <span className="max-w-xs truncate font-semibold text-blue-100">{studentName}</span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-4 text-xs">
          {tabSwitchCount > 0 && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tabular-nums ${
                tabSwitchCount > 3
                  ? 'border border-gold-100/30 bg-gold-500/15 text-gold-500'
                  : 'border border-white/10 bg-white/5 text-blue-200/80'
              }`}
            >
              <Eye className="w-3 h-3" />
              Cambios de pestaña: {tabSwitchCount}
            </span>
          )}
          <span className="hidden max-w-xs truncate text-blue-200/70 sm:inline">{exerciseName}</span>
        </div>
      </div>

      {/* ── Contenido de la página ────────────────────────────────────────── */}
      {children}

      {/* ── Overlay de tiempo agotado ─────────────────────────────────────── */}
      {timeUp && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-csq-dark/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-card border border-red-200 bg-white p-10 text-center shadow-card-hover cx-pop">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-200 bg-red-50">
              <Lock className="w-8 h-8 text-red-600" />
            </div>
            <p className="mb-1 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-gold-900">
              Modo examen
            </p>
            <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-red-600">
              Tiempo agotado
            </h2>
            <p className="mb-6 text-sm text-gray-600">
              {submitting
                ? 'Enviando tu ejercicio automáticamente…'
                : 'Tu ejercicio fue enviado para calificación.'}
            </p>
            {submitting && (
              <Loader2 className="mx-auto w-8 h-8 animate-spin text-red-600" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
