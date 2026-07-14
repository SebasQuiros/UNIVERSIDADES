'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';

interface TabSwitchDetectorProps {
  attemptId: string;
  /** Called whenever a switch is detected, with the updated total count */
  onSwitch?: (count: number) => void;
}

export function TabSwitchDetector({ attemptId, onSwitch }: TabSwitchDetectorProps) {
  const [count, setCount] = useState(0);
  const countRef = useRef(0); // always-current count for the event handler
  const lastHiddenRef = useRef(false);

  useEffect(() => {
    const handleVisibility = () => {
      // Only count transitions: visible → hidden (tab left)
      if (document.hidden && !lastHiddenRef.current) {
        lastHiddenRef.current = true;
      } else if (!document.hidden && lastHiddenRef.current) {
        // Tab came back into focus — this is the switch event
        lastHiddenRef.current = false;
        countRef.current += 1;
        const newCount = countRef.current;
        setCount(newCount);
        onSwitch?.(newCount);

        // Aviso al estudiante
        toast(
          `Salida detectada (${newCount} vez${newCount !== 1 ? 'es' : ''}). El profesor puede ver esto.`,
          {
            icon: <AlertTriangle className="w-4 h-4" />,
            duration: 5000,
            style: {
              background: '#FDF6E3',
              color: '#8A6608',
              fontWeight: 600,
            },
          },
        );

        // Report to backend (fire-and-forget)
        api
          .post(`/api/v1/attempts/${attemptId}/tab-switch`, {
            count: newCount,
            timestamp: new Date().toISOString(),
          })
          .catch(() => {
            // Silently ignore network errors — we still track locally
          });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [attemptId, onSwitch]);

  // Persistent warning banner when count > 3
  if (count <= 3) return null;

  return (
    <div className="sticky top-0 z-40 flex w-full items-center gap-2.5 border-b border-gold-100 bg-gold-50 px-4 py-2.5 text-sm font-medium text-gold-900 cx-pop">
      {/* Wiggle limitado a 2 repeticiones: el banner es persistente y un icono en
          movimiento perpetuo durante el examen distrae más de lo que avisa. */}
      <AlertTriangle className="w-4 h-4 flex-shrink-0 text-gold-700 cx-wiggle-loop cx-iter-2" />
      <span>
        Has salido de esta pestaña <strong className="tabular-nums">{count} veces</strong>. El profesor puede revisar este registro.
      </span>
    </div>
  );
}
