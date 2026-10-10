'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Sello institucional: la marca del sistema junto a la de la institución.
 *
 * La institución NO va escrita en el código. El producto se vende a varias
 * —hoy ya conviven una universidad y un colegio técnico— así que clavar un
 * logo concreto significaría mostrarle a los estudiantes de un colegio el
 * escudo de otra institución. Se lee la del usuario que tiene la sesión.
 *
 * Si la institución no cargó su logo, se muestra su nombre corto en una
 * placa tipográfica: sigue siendo su identidad y no deja un hueco.
 */

interface Institucion {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
}

export function SelloInstitucional({ className = '' }: { className?: string }) {
  const [inst, setInst] = useState<Institucion | null>(null);
  const [fallaLogo, setFallaLogo] = useState(false);

  useEffect(() => {
    let vivo = true;
    api.get<Institucion | null>('/api/v1/universities/mine')
      .then(({ data }) => { if (vivo && data?.id) setInst(data); })
      .catch(() => { /* sin institución: se muestra solo la marca del sistema */ });
    return () => { vivo = false; };
  }, []);

  const hayLogo = !!inst?.logoUrl && !fallaLogo;
  const etiqueta = inst?.shortName?.trim() || inst?.name?.trim() || '';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Marca del sistema */}
      <img
        src="/sjqa-logo.png"
        alt="SJQA GROUP"
        title="SJQA GROUP"
        className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
        style={{ background: '#fff' }}
      />

      {inst && (
        <>
          <span aria-hidden className="h-7 w-px flex-shrink-0 bg-white/20" />

          {hayLogo ? (
            <img
              src={inst.logoUrl!}
              alt={inst.name}
              title={inst.name}
              onError={() => setFallaLogo(true)}
              className="h-9 w-auto max-w-[120px] flex-shrink-0 rounded bg-white/95 object-contain p-1"
            />
          ) : (
            <span
              title={inst.name}
              className="flex-shrink-0 rounded bg-white/10 px-2.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-white/85"
            >
              {etiqueta}
            </span>
          )}
        </>
      )}
    </div>
  );
}
