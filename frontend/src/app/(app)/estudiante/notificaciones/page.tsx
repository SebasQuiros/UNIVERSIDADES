'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatDateTime, getErrorMessage, cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { SceneEmptyBox } from '@/components/illustrations';
import type { Notification } from '@/types';
import toast from 'react-hot-toast';
import { Bell, CheckCheck, BookOpen, Award, Info, AlertTriangle } from 'lucide-react';

const NOTIF_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  EXERCISE_ASSIGNED: { icon: BookOpen,      color: 'text-blue-700 bg-blue-50 border-blue-100' },
  GRADED:            { icon: Award,         color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  EXERCISE_DUE:      { icon: AlertTriangle, color: 'text-gold-700 bg-gold-50 border-gold-100' },
  INFO:              { icon: Info,          color: 'text-gray-500 bg-gray-100 border-gray-200' },
  WARNING:           { icon: AlertTriangle, color: 'text-gold-700 bg-gold-50 border-gold-100' },
  SYSTEM:            { icon: Info,          color: 'text-gray-500 bg-gray-100 border-gray-200' },
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
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#FBF8F1]">
      <div className="max-w-2xl mx-auto">

        {/* Cabecera */}
        <PageHeader
          eyebrow="Tu bandeja"
          title="Notificaciones"
          subtitle={
            unread > 0
              ? `Tienes ${unread} notificación${unread !== 1 ? 'es' : ''} sin leer.`
              : 'Aquí llegan los avisos de tus cursos, entregas y calificaciones.'
          }
          icon={Bell}
          className="mb-6"
          actions={
            unread > 0 ? (
              <Button variant="secondary" size="sm" onClick={markAllRead} className="cx-press">
                <CheckCheck className="w-4 h-4" />
                Marcar todas
              </Button>
            ) : undefined
          }
        />

        {loading && notifications.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-card bg-white border border-gray-200/70 shadow-card">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-2 py-0.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <Card>
            <EmptyState
              illustration={<SceneEmptyBox size={200} className="cx-float" />}
              title="Estás al día"
              description="No tienes notificaciones pendientes. Cuando tu profesor publique un ejercicio o califique una entrega, te avisamos aquí."
            />
          </Card>
        ) : (
          <div className="space-y-2.5">
            {notifications.map((notif, i) => {
              const cfg = NOTIF_ICONS[notif.type] ?? NOTIF_ICONS.INFO;
              const Icon = cfg.icon;
              return (
                <button
                  key={notif.id}
                  onClick={() => !notif.isRead && markRead(notif.id)}
                  className={cn(
                    'w-full flex items-start gap-4 p-4 rounded-card border text-left transition-all cx-pop cx-hop-parent cx-press',
                    i < 6 ? `cx-d${i + 1}` : undefined,
                    notif.isRead
                      ? 'bg-white/70 border-gray-200/70 opacity-70 hover:opacity-100'
                      : 'bg-white border-gray-200/70 shadow-card hover:shadow-card-hover hover:border-gray-300/70',
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 border cx-hop',
                    cfg.color,
                  )}>
                    <Icon className="w-4 h-4" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        'text-sm font-semibold leading-snug',
                        notif.isRead ? 'text-gray-500' : 'text-gray-900',
                      )}>
                        {notif.title}
                      </p>
                      {!notif.isRead && (
                        <span className="relative flex h-2.5 w-2.5 flex-shrink-0 mt-1.5">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-blue-500 cx-ping" aria-hidden />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-600" />
                          <span className="sr-only">Sin leer</span>
                        </span>
                      )}
                    </div>
                    {notif.body && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{notif.body}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1.5 font-mono tabular-nums">
                      {formatDateTime(notif.createdAt)}
                    </p>
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
