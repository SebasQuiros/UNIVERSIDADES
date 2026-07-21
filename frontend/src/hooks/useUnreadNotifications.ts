'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Notification } from '@/types';

// ── Poller ÚNICO de notificaciones no leídas ─────────────────────────────────
// Caché a nivel de módulo compartida por todos los componentes que muestran el
// badge (StudentSidebar + TopBar): un solo GET /api/v1/notifications cada 30s
// en vez de un intervalo por componente. El intervalo arranca con el primer
// subscriber (con refetch inmediato) y se limpia cuando se desmonta el último.

const POLL_MS = 30_000;

let cachedUnread = 0;
const subscribers = new Set<(n: number) => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function fetchUnread() {
  api.get<Notification[]>('/api/v1/notifications')
    .then(({ data }) => {
      cachedUnread = data.filter((n) => !n.isRead).length;
      subscribers.forEach((notify) => notify(cachedUnread));
    })
    .catch(() => {});
}

export function useUnreadNotifications(): number {
  const [unread, setUnread] = useState(cachedUnread);

  useEffect(() => {
    subscribers.add(setUnread);
    setUnread(cachedUnread); // sincroniza si la caché cambió entre render y mount
    if (subscribers.size === 1) {
      fetchUnread(); // primer subscriber → refetch inmediato + arranca el poller
      intervalId = setInterval(fetchUnread, POLL_MS);
    }
    return () => {
      subscribers.delete(setUnread);
      if (subscribers.size === 0 && intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, []);

  return unread;
}
