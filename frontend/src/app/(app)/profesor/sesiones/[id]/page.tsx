'use client';

/**
 * Sesión de aula — pantalla de control del profesor.
 *
 * Cambia de contenido según `session.status` (viene del backend, vía
 * `GET class-sessions/:id/dashboard`, sondeado con `setInterval`). No hay
 * selector manual de fase: la fase la determina el servidor.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { STATUS_LABELS, pollIntervalMs } from '@/lib/classSession';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconTile } from '@/components/ui/IconTile';
import { SceneEmptyBox } from '@/components/illustrations';
import type { DashboardResponse } from './types';
import { PhaseDraft } from './PhaseDraft';
import { PhaseLobby } from './PhaseLobby';
import { PhaseInProgress } from './PhaseInProgress';
import { PhaseTributacion } from './PhaseTributacion';
import { PhaseAudit } from './PhaseAudit';
import { PhaseResults } from './PhaseResults';
import { ArrowLeft, Presentation, X, AlertTriangle } from 'lucide-react';

function CancelModal({ onClose, onConfirm, loading }: { onClose: () => void; onConfirm: (reason: string) => void; loading: boolean }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-csq-dark/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-card border border-gray-200/70 bg-white p-6 shadow-card-hover cx-pop">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600" aria-label="Cerrar">
          <X className="w-5 h-5" />
        </button>
        <div className="mb-4 flex items-center gap-3">
          <IconTile icon={AlertTriangle} tint="#DC2626" size={44} />
          <h3 className="font-bold tracking-tight text-gray-900">Cancelar sesión</h3>
        </div>
        <p className="mb-3 text-sm text-gray-600">
          La sesión quedará cancelada de forma permanente. No se puede deshacer.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Motivo (opcional)"
          className="mb-4 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={loading}>Volver</Button>
          <Button variant="danger" onClick={() => onConfirm(reason)} loading={loading} className="flex-1 cx-press">Cancelar sesión</Button>
        </div>
      </div>
    </div>
  );
}

export default function SesionControlPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const statusRef = useRef(session?.status);
  statusRef.current = session?.status;

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<DashboardResponse>(`/api/v1/class-sessions/${id}/dashboard`);
      setSession(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  // Polling: 3-5s mientras la sesión está "viva" (DRAFT/LOBBY/EN_CURSO), 8-10s
  // en fases de cierre. Se reinicia solo cuando el balde de velocidad cambia.
  const bucket = pollIntervalMs(session?.status) <= 4000 ? 'fast' : 'slow';
  useEffect(() => {
    const ms = bucket === 'fast' ? 4000 : 9000;
    const t = setInterval(refresh, ms);
    return () => clearInterval(t);
  }, [bucket, refresh]);

  async function handleCancel(reason: string) {
    setCancelling(true);
    try {
      await api.post(`/api/v1/class-sessions/${id}/cancel`, { reason: reason || undefined });
      toast.success('Sesión cancelada');
      setShowCancel(false);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  }

  const canCancel = session && session.status !== 'FINALIZADA' && session.status !== 'CANCELADA';

  return (
    <div className="flex-1 overflow-y-auto bg-[#FBF8F1] p-6 lg:p-8">
      {showCancel && (
        <CancelModal onClose={() => setShowCancel(false)} onConfirm={handleCancel} loading={cancelling} />
      )}

      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/profesor/sesiones" className="flex items-center gap-1 transition-colors hover:text-gray-700">
          <ArrowLeft className="w-3.5 h-3.5" /> Sesiones de aula
        </Link>
        {session && (
          <>
            <span className="text-gray-300">/</span>
            <span className="font-medium text-gray-700">{session.code}</span>
          </>
        )}
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-7 w-72" />
            </div>
          </div>
          <Skeleton className="h-40 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
        </div>
      ) : loadError || !session ? (
        <div className="rounded-card border border-gray-200/70 bg-white shadow-card">
          <EmptyState
            illustration={<SceneEmptyBox size={180} />}
            title="No se pudo cargar la sesión"
            description={loadError ?? 'Sesión no encontrada.'}
            action={
              <Link href="/profesor/sesiones">
                <Button variant="secondary"><ArrowLeft className="w-4 h-4" /> Volver a sesiones</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <PageHeader
            eyebrow="Sesión de aula"
            title={`Código ${session.code}`}
            subtitle={`${session.participantsCount} participante${session.participantsCount !== 1 ? 's' : ''} · ${session.groups.length} empresa${session.groups.length !== 1 ? 's' : ''}`}
            icon={Presentation}
            className="mb-6"
            actions={
              <div className="flex items-center gap-2">
                <Badge variant="blue">{STATUS_LABELS[session.status]}</Badge>
                {canCancel && (
                  <Button variant="ghost" size="sm" onClick={() => setShowCancel(true)} className="cx-press">
                    Cancelar sesión
                  </Button>
                )}
              </div>
            }
          />

          {session.status === 'DRAFT' && <PhaseDraft sessionId={session.id} onChanged={refresh} />}
          {session.status === 'LOBBY' && <PhaseLobby session={session} onChanged={refresh} />}
          {session.status === 'EN_CURSO' && <PhaseInProgress session={session} onChanged={refresh} />}
          {session.status === 'TRIBUTACION' && <PhaseTributacion session={session} onChanged={refresh} />}
          {session.status === 'AUDITORIA' && <PhaseAudit session={session} onChanged={refresh} />}
          {(session.status === 'CALIFICACION' || session.status === 'FINALIZADA') && (
            <PhaseResults session={session} onChanged={refresh} />
          )}
          {session.status === 'CANCELADA' && (
            <div className="flex items-center gap-3 rounded-card border border-red-200 bg-red-50/70 p-5 shadow-card">
              <IconTile icon={AlertTriangle} tint="#DC2626" size={40} />
              <p className="text-sm text-red-800">Esta sesión fue cancelada. No se puede reabrir.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
