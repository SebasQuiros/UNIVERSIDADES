'use client';

/**
 * Fase DRAFT — la sesión existe pero el lobby todavía no está abierto.
 * Único paso: abrirlo (`POST class-sessions/:id/lobby/open`).
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/IconTile';
import { Radio, ArrowRight } from 'lucide-react';

export function PhaseDraft({ sessionId, onChanged }: { sessionId: string; onChanged: () => void }) {
  const [loading, setLoading] = useState(false);

  async function openLobby() {
    setLoading(true);
    try {
      await api.post(`/api/v1/class-sessions/${sessionId}/lobby/open`);
      toast.success('Sala de espera abierta');
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-gray-200/70 bg-white p-8 text-center shadow-card cx-pop">
      <IconTile icon={Radio} tint="#2563EB" size={56} />
      <div>
        <h3 className="text-base font-bold text-gray-900">La sesión todavía no está abierta</h3>
        <p className="mt-1.5 max-w-md text-sm text-gray-500">
          Abrí la sala de espera cuando estés listo para proyectarla: va a mostrar un código de unión
          gigante para que tus estudiantes se conecten desde su computadora.
        </p>
      </div>
      <Button onClick={openLobby} loading={loading} className="cx-press">
        Abrir sala de espera <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
