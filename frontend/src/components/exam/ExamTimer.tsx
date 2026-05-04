'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Clock } from 'lucide-react';
import toast from 'react-hot-toast';

interface ExamTimerProps {
  attemptId: string;
  timeLimitMinutes: number;
  onTimeUp: () => void;
}

function formatHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ExamTimer({ attemptId, timeLimitMinutes, onTimeUp }: ExamTimerProps) {
  const storageKey = `exam-timer-${attemptId}`;
  const totalSeconds = timeLimitMinutes * 60;

  // Initialize from localStorage or from timeLimitMinutes
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (typeof window === 'undefined') return totalSeconds;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { expiresAt: number };
        const remaining = Math.round((parsed.expiresAt - Date.now()) / 1000);
        if (remaining > 0 && remaining <= totalSeconds) return remaining;
      }
    } catch {
      // ignore parse errors
    }
    // Persist new expiry
    const expiresAt = Date.now() + totalSeconds * 1000;
    localStorage.setItem(storageKey, JSON.stringify({ expiresAt }));
    return totalSeconds;
  });

  const alertedRef = useRef({ at10: false, at5: false, at1: false });
  const timeUpFiredRef = useRef(false);

  const tick = useCallback(() => {
    setSecondsLeft((prev) => {
      const next = prev - 1;

      // Fire milestone toasts
      if (next === 600 && !alertedRef.current.at10) {
        alertedRef.current.at10 = true;
        toast('Quedan 10 minutos para terminar el examen', {
          icon: '⏰',
          duration: 5000,
          style: { background: '#fef3c7', color: '#92400e', fontWeight: 600 },
        });
      }
      if (next === 300 && !alertedRef.current.at5) {
        alertedRef.current.at5 = true;
        toast('¡Quedan solo 5 minutos!', {
          icon: '⚠️',
          duration: 5000,
          style: { background: '#fee2e2', color: '#991b1b', fontWeight: 600 },
        });
      }
      if (next === 60 && !alertedRef.current.at1) {
        alertedRef.current.at1 = true;
        toast('¡ÚLTIMO MINUTO! El examen se enviará automáticamente.', {
          icon: '🚨',
          duration: 8000,
          style: { background: '#dc2626', color: '#fff', fontWeight: 700 },
        });
      }

      if (next <= 0) return 0;
      return next;
    });
  }, []);

  // Sync remaining time to localStorage every 5 seconds
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const expiresAt = Date.now() + secondsLeft * 1000;
    // debounce: write only on interval
    if (secondsLeft % 5 === 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ expiresAt }));
      } catch { /* quota errors */ }
    }
  }, [secondsLeft, storageKey]);

  // Countdown tick
  useEffect(() => {
    if (secondsLeft <= 0) {
      if (!timeUpFiredRef.current) {
        timeUpFiredRef.current = true;
        try { localStorage.removeItem(storageKey); } catch { /* ok */ }
        onTimeUp();
      }
      return;
    }
    const timer = setTimeout(tick, 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, tick, onTimeUp, storageKey]);

  // Color state
  const isRed    = secondsLeft <= 300;  // <= 5 min
  const isYellow = !isRed && secondsLeft <= 600; // <= 10 min

  const bgClass = isRed
    ? 'bg-red-600 animate-pulse'
    : isYellow
    ? 'bg-yellow-500'
    : 'bg-gray-900';

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-xl ${bgClass} text-white select-none`}
      style={{ minWidth: 120, justifyContent: 'center' }}
      aria-live="polite"
      aria-label={`Tiempo restante: ${formatHMS(secondsLeft)}`}
    >
      <Clock className="w-4 h-4 flex-shrink-0" />
      <span className="text-base font-mono font-bold tracking-wider">
        {formatHMS(Math.max(0, secondsLeft))}
      </span>
    </div>
  );
}
