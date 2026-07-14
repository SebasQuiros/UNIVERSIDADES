'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { PerfilTributarioData } from './PerfilTributario';

type Accent = 'blue' | 'emerald' | 'orange' | 'purple';

interface TribuHeaderProps {
  code: string;                 // 'D-104'
  title: string;                // 'Declaración del Impuesto al Valor Agregado'
  accent?: Accent;
  status: 'DRAFT' | 'SUBMITTED';
  refNo?: string | null;
  periodLabel: string;          // 'Junio 2026' o '2025-2026'
  perfil?: PerfilTributarioData | null;
  /** 'Original' o 'Rectificativa' — TRIBU-CR siempre muestra el tipo */
  declType?: string;
  /** Explicación breve del impuesto (voz pedagógica). */
  description?: string;
  /** Ilustración temática de la declaración (spot-art de marca). */
  illustration?: ReactNode;
}

const ACCENTS: Record<Accent, { sub: string; badge: string; chip: string; strip: string }> = {
  blue:    { sub: '#93C5FD', badge: 'rgba(37,99,235,0.28)',  chip: '#2563EB', strip: '#F4F6F8' },
  emerald: { sub: '#6EE7B7', badge: 'rgba(16,185,129,0.26)', chip: '#047857', strip: '#ECFDF5' },
  orange:  { sub: '#FDBA74', badge: 'rgba(249,115,22,0.26)', chip: '#C2410C', strip: '#FFF7ED' },
  purple:  { sub: '#CBD5E1', badge: 'rgba(148,163,184,0.26)', chip: '#475569', strip: '#F1F5F9' },
};

// Textura de puntos de las bandas hero (mismo lenguaje que los dashboards).
const DOT_TEXTURE: CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
};

/**
 * Encabezado institucional unificado estilo Tributación Digital (TRIBU-CR):
 *  · Banda hero azul noche con la ilustración del impuesto y su explicación
 *  · Aviso de simulación educativa
 *  · Franja de identificación del declarante (cédula, nombre, período, N° declaración)
 */
export function TribuHeader({
  code, title, accent = 'blue', status, refNo,
  periodLabel, perfil, declType = 'Original',
  description, illustration,
}: TribuHeaderProps) {
  const a = ACCENTS[accent];
  const isSubmitted = status === 'SUBMITTED';

  const ident = perfil?.cedula?.trim() || '—';
  const nombre = perfil?.razonSocial?.trim() || '— Sin identificar —';
  const tipoPersona = perfil?.tipoPersona === 'FISICA' ? 'Persona física' : 'Persona jurídica';

  return (
    <div className="text-white">
      {/* ── Banda hero — azul noche de marca ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-csq-dark via-csq-dark-2 to-csq-mid">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_TEXTURE} />
        {illustration && (
          <div aria-hidden className="pointer-events-none absolute right-6 bottom-0 hidden lg:block opacity-95">
            {illustration}
          </div>
        )}

        <div className="relative mx-auto max-w-4xl px-4 pt-5 pb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <Link
                href="/estudiante/impuestos"
                aria-label="Volver a Tributación"
                className="cx-press mt-0.5 flex-shrink-0 rounded-lg p-1.5 text-blue-200 transition-colors hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>

              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-gold-500">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Tributación · TRIBU-CR
                </p>
                <h1 className="mt-1.5 flex flex-wrap items-center gap-2 text-xl font-extrabold leading-tight tracking-tight lg:text-2xl">
                  <span
                    className="rounded-lg px-2 py-0.5 text-sm font-black tabular-nums"
                    style={{ background: a.badge, color: a.sub }}
                  >
                    {code}
                  </span>
                  <span>{title}</span>
                </h1>
                {description && (
                  <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-blue-200/80 lg:max-w-lg">
                    {description}
                  </p>
                )}
              </div>
            </div>

            {isSubmitted && (
              <span className="cx-pop flex flex-shrink-0 items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow-[0_6px_18px_rgba(16,185,129,0.35)]">
                <CheckCircle2 className="h-3.5 w-3.5" /> Presentada
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Aviso de simulación educativa ── */}
      <div className="bg-gold-500 text-amber-900">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-2 text-xs font-bold">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          SIMULACIÓN EDUCATIVA — Esta declaración NO se envía a Hacienda. Solo tiene fines de práctica académica.
        </div>
      </div>

      {/* ── Franja de identificación del declarante (firma de TRIBU-CR) ── */}
      <div style={{ background: a.strip }}>
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-x-6 gap-y-2 px-4 py-3 text-gray-700 md:grid-cols-4">
          <Field label="Declaración N°" value={refNo ?? '(borrador)'} mono accent={a.chip} />
          <Field label="Tipo de declaración" value={declType} accent={a.chip} />
          <Field label="Identificación" value={ident} mono accent={a.chip} />
          <Field label="Período fiscal" value={periodLabel} accent={a.chip} />
          <div className="col-span-2 md:col-span-3">
            <Field label="Nombre / Razón social" value={nombre} accent={a.chip} />
          </div>
          <Field label="Condición" value={tipoPersona} accent={a.chip} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono = false, accent }: { label: string; value: string; mono?: boolean; accent: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: accent, opacity: 0.7 }}>{label}</p>
      <p className={`truncate text-sm font-semibold text-gray-800 ${mono ? 'font-mono tabular-nums' : ''}`}>{value}</p>
    </div>
  );
}

export default TribuHeader;
