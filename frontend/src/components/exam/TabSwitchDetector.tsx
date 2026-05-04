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

        // Show warning toast
        toast(
          `Salida detectada (${newCount} vez${newCount !== 1 ? 'es' : ''}). El profesor puede ver esto.`,
          {
            icon: '⚠️',
            duration: 5000,
            style: {
              background: '#fef3c7',
              color: '#92400e',
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
    <div className="sticky top-0 z-40 w-full bg-amber-50 border-b border-amber-300 px-4 py-2 flex items-center gap-2 text-sm text-amber-800 font-medium">
      <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
      <span>
        Has salido de esta pestaña <strong>{count} veces</strong>. El profesor puede revisar este registro.
      </span>
    </div>
  );
}
