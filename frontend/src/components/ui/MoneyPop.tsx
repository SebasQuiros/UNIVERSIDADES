'use client';

import { useEffect, useState } from 'react';
import { cn, fmtNum } from '@/lib/utils';

/** Retraso del pulso: los totales derivados se recalculan con cada tecla y
 *  animar en cada pulsación distrae justo cuando el estudiante se concentra. */
const PULSE_DELAY_MS = 300;

interface MoneyPopProps {
  /** Monto. Acepta string: los `Decimal` de Prisma se serializan a string en JSON. */
  value: string | number;
  className?: string;
}

/**
 * Cifra en colones: mono + tabular-nums, con pop (cx-count) al cambiar el valor.
 *
 * Zona fiscal: si el valor no es un número finito se muestra "—", NUNCA ₡ 0,00.
 * Un cero silencioso en una casilla de una declaración es peor que un dato ausente,
 * porque el estudiante no puede distinguir "no hay monto" de "el monto es cero".
 */
export function MoneyPop({ value, className }: MoneyPopProps) {
  const n = Number(value);
  const [pulse, setPulse] = useState(0);

  // Pulso con debounce: solo anima cuando el valor deja de cambiar ~300 ms.
  useEffect(() => {
    const t = setTimeout(() => setPulse(p => p + 1), PULSE_DELAY_MS);
    return () => clearTimeout(t);
  }, [n]);

  if (!Number.isFinite(n)) {
    return (
      <span
        className={cn('inline-block font-mono tabular-nums text-gray-400', className)}
        title="Monto no disponible"
      >
        —
      </span>
    );
  }

  return (
    <span key={pulse} className={cn('cx-count inline-block font-mono tabular-nums', className)}>
      ₡ {fmtNum(n)}
    </span>
  );
}
