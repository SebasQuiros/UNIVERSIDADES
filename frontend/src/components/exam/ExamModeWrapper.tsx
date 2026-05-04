'use client';

import { useState, useCallback } from 'react';
import { Lock } from 'lucide-react';
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
      {/* ── Tab-switch detector (invisible) ─────────────────────────────── */}
      <TabSwitchDetector attemptId={attemptId} onSwitch={setTabSwitchCount} />

      {/* ── Fixed countdown timer ────────────────────────────────────────── */}
      {timeLimitMinutes != null && timeLimitMinutes > 0 && (
        <ExamTimer
          attemptId={attemptId}
          timeLimitMinutes={timeLimitMinutes}
          onTimeUp={handleTimeUp}
        />
      )}

      {/* ── Top banner ────────────────────────────────────────────────────── */}
      <div className="w-full bg-gray-900 text-white px-4 py-2 flex items-center justify-between text-sm font-medium z-30">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-red-400" />
          <span className="font-bold tracking-wide text-red-300">MODO EXAMEN</span>
          <span className="text-gray-400">—</span>
          <span className="text-gray-200 truncate max-w-xs">{studentName}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          {tabSwitchCount > 0 && (
            <span className={tabSwitchCount > 3 ? 'text-amber-400 font-semibold' : 'text-gray-400'}>
              Cambios de pestaña: {tabSwitchCount}
            </span>
          )}
          <span className="truncate max-w-xs hidden sm:inline">{exerciseName}</span>
        </div>
      </div>

      {/* ── Page content ─────────────────────────────────────────────────── */}
      {children}

      {/* ── Time's up overlay ────────────────────────────────────────────── */}
      {timeUp && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-10 text-center max-w-sm w-full mx-4 border border-red-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-3xl font-black text-red-600 mb-2 tracking-tight">
              TIEMPO AGOTADO
            </h2>
            <p className="text-gray-600 text-sm mb-6">
              {submitting
                ? 'Enviando tu ejercicio automáticamente...'
                : 'Tu ejercicio ha sido enviado para calificación.'}
            </p>
            {submitting && (
              <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
