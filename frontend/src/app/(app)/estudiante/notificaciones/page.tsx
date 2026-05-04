'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatDateTime, getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { Notification } from '@/types';
import toast from 'react-hot-toast';
import { Bell, CheckCheck, BookOpen, Award, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const NOTIF_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  EXERCISE_ASSIGNED: { icon: BookOpen, color: 'text-blue-600 bg-blue-50' },
  GRADED:            { icon: Award,    color: 'text-emerald-600 bg-emerald-50' },
  EXERCISE_DUE:      { icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
  INFO:              { icon: Info,     color: 'text-gray-500 bg-gray-100' },
  WARNING:           { icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
  SYSTEM:            { icon: Info,     color: 'text-gray-500 bg-gray-100' },
};

export default function NotificacionesPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Notification[]>('/api/v1/notifications');
      setNotifications(data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  async function markRead(id: string) {
    try {
      await api.patch(`/api/v1/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
    } catch { /* ignore */ }
  }

  async function markAllRead() {
    try {
      await api.patch('/api/v1/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('Todas marcadas como leídas');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="w-6 h-6 text-blue-600" />
              Notificaciones
            </h2>
            {unread > 0 && (
              <p className="text-sm text-gray-500 mt-1">{unread} sin leer</p>
            )}
          </div>
          {unread > 0 && (
            <Button variant="secondary" size="sm" onClick={markAllRead}>
              <CheckCheck className="w-4 h-4" />
              Marcar todas
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-700 font-semibold">Sin notificaciones</p>
            <p className="text-gray-500 text-sm mt-1">Estás al día</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => {
              const cfg = NOTIF_ICONS[notif.type] ?? NOTIF_ICONS.INFO;
              const Icon = cfg.icon;
              return (
                <button
                  key={notif.id}
                  onClick={() => !notif.isRead && markRead(notif.id)}
                  className={cn(
                    'w-full flex items-start gap-4 p-4 rounded-2xl border text-left transition-all duration-150',
                    notif.isRead
                      ? 'bg-white border-gray-200 opacity-60'
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm',
                  )}
                >
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5', cfg.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        'text-sm font-medium leading-snug',
                        notif.isRead ? 'text-gray-500' : 'text-gray-900',
                      )}>
                        {notif.title}
                      </p>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    {notif.body && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{notif.body}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1.5">{formatDateTime(notif.createdAt)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
