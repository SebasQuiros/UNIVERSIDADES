'use client';

/**
 * Fase LOBBY — pantalla de proyección.
 *
 * El momento "wow" de la sesión: código enorme legible desde el fondo del
 * aula, y los estudiantes apareciendo en vivo conforme se conectan. Simula la
 * llegada de estudiantes con un intervalo local (Fase 1, sin socket real).
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/IconTile';
import { ROSTER, LOBBY_BASELINE_CONNECTED, LOBBY_TARGET_CONNECTED } from './_mock';
import { Radio, Users, ArrowRight, Wifi } from 'lucide-react';

const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
  backgroundSize: '22px 22px',
};

const TOTAL_EXPECTED = 30;

export function PhaseLobby({ code, onAdvance }: { code: string; onAdvance: () => void }) {
  const [connected, setConnected] = useState(LOBBY_BASELINE_CONNECTED);

  // Simula la llegada de un estudiante nuevo cada ~700ms hasta la meta de
  // esta maqueta. En producción esto vendría de un evento en tiempo real.
  useEffect(() => {
    if (connected >= LOBBY_TARGET_CONNECTED) return;
    const t = setTimeout(() => setConnected((c) => Math.min(c + 1, LOBBY_TARGET_CONNECTED)), 700);
    return () => clearTimeout(t);
  }, [connected]);

  const pct = Math.round((connected / TOTAL_EXPECTED) * 100);

  return (
    <div className="space-y-6">
      {/* Pantalla de proyección */}
      <div className="relative overflow-hidden rounded-card shadow-soft cx-pop bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
        <div className="relative flex flex-col items-center px-6 py-14 text-center sm:px-10">
          <div className="mb-5 flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 cx-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Sala de espera abierta</span>
          </div>

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-500">Código de unión</p>
          <p
            className="mt-3 select-all font-mono text-7xl font-black leading-none tracking-[0.14em] text-white sm:text-8xl lg:text-9xl"
            style={{ textShadow: '0 8px 40px rgba(37,99,235,0.55)' }}
          >
            {code}
          </p>
          <p className="mt-6 max-w-md text-sm text-blue-100/90 sm:text-base">
            Los estudiantes entran a la sesión desde su computadora y escriben este código para unirse.
          </p>

          {/* Contador */}
          <div className="mt-10 w-full max-w-md">
            <div className="mb-2 flex items-center justify-between text-sm text-blue-100/80">
              <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> Conectados</span>
              <span className="font-mono tabular-nums">
                <span key={connected} className="cx-count inline-block font-bold text-white">{connected}</span>
                <span className="text-blue-200/70"> de {TOTAL_EXPECTED}</span>
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#2563EB,#60A5FA,#93C5FD)' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Muro de estudiantes conectándose */}
      <div className="rounded-card border border-gray-200/70 bg-white p-5 shadow-card sm:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <IconTile icon={Wifi} tint="#059669" size={36} />
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900">En vivo</p>
            <h3 className="text-sm font-bold text-gray-900">Estudiantes en la sala</h3>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
          {ROSTER.map((s, i) => {
            const joined = i < connected;
            return (
              <div
                key={s.id}
                className={
                  joined
                    ? 'cx-pop flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-2.5 py-2'
                    : 'flex items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-2.5 py-2 opacity-60'
                }
                style={joined ? { animationDelay: `${Math.min(i, 6) * 0.05}s` } : undefined}
              >
                <div
                  className={
                    joined
                      ? 'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white'
                      : 'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-gray-300 text-xs font-bold text-gray-300'
                  }
                  style={joined ? { background: 'linear-gradient(135deg,#3B82F6,#1E3A8A)' } : undefined}
                >
                  {joined ? s.name.charAt(0).toUpperCase() : '·'}
                </div>
                <p className={joined ? 'truncate text-xs font-semibold text-gray-800' : 'truncate text-xs text-gray-400'}>
                  {joined ? s.name.split(' ').slice(0, 2).join(' ') : 'Esperando…'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA de avance */}
      <div className="flex flex-col items-center gap-2 rounded-card border border-gray-200/70 bg-white p-5 shadow-card sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3">
          <IconTile icon={Radio} tint="#2563EB" size={40} />
          <p className="text-sm text-gray-600">
            Podés cerrar el lobby cuando quieras. Quien no se haya unido para entonces no podrá entrar a esta sesión.
          </p>
        </div>
        <Button onClick={onAdvance} className="w-full cx-press sm:w-auto">
          Cerrar lobby y armar grupos <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
