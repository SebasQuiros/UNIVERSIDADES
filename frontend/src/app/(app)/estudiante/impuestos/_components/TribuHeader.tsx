'use client';

import Link from 'next/link';
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
}

const ACCENTS: Record<Accent, { bar: string; sub: string; badge: string; chip: string; strip: string }> = {
  blue:    { bar: '#0F2657', sub: '#93C5FD', badge: 'rgba(59,130,246,0.25)', chip: '#1E40AF', strip: '#EFF6FF' },
  emerald: { bar: '#064E3B', sub: '#6EE7B7', badge: 'rgba(16,185,129,0.22)', chip: '#047857', strip: '#ECFDF5' },
  orange:  { bar: '#7C2D12', sub: '#FDBA74', badge: 'rgba(249,115,22,0.22)', chip: '#C2410C', strip: '#FFF7ED' },
  purple:  { bar: '#4C1D95', sub: '#C4B5FD', badge: 'rgba(139,92,246,0.22)', chip: '#6D28D9', strip: '#F5F3FF' },
};

/**
 * Encabezado institucional unificado estilo Tributación Digital (TRIBU-CR):
 *  · Barra del Ministerio de Hacienda / Administración Tributaria Virtual
 *  · Banner de simulación educativa
 *  · Franja de identificación del declarante (cédula, nombre, período, N° declaración)
 */
export function TribuHeader({
  code, title, accent = 'blue', status, refNo,
  periodLabel, perfil, declType = 'Original',
}: TribuHeaderProps) {
  const a = ACCENTS[accent];
  const isSubmitted = status === 'SUBMITTED';

  const ident = perfil?.cedula?.trim() || '—';
  const nombre = perfil?.razonSocial?.trim() || '— Sin identificar —';
  const tipoPersona = perfil?.tipoPersona === 'FISICA' ? 'Persona física' : 'Persona jurídica';

  return (
    <div className="text-white" style={{ background: a.bar }}>
      {/* Barra institucional */}
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/estudiante/impuestos" className="transition-colors flex-shrink-0" style={{ color: a.sub }}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <ShieldCheck className="w-3.5 h-3.5" style={{ color: a.sub }} />
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: a.sub }}>
                Ministerio de Hacienda
              </span>
              <span style={{ color: a.sub, opacity: 0.5 }}>·</span>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: a.sub }}>
                Administración Tributaria Virtual — TRIBU-CR
              </span>
            </div>
            <h1 className="text-lg font-black leading-tight truncate">
              <span className="px-2 py-0.5 rounded-md mr-2 text-sm align-middle"
                style={{ background: a.badge }}>{code}</span>
              {title}
            </h1>
          </div>
        </div>
        {isSubmitted && (
          <span className="flex items-center gap-1.5 text-xs font-bold bg-emerald-500 text-white px-3 py-1.5 rounded-full flex-shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" /> PRESENTADA
          </span>
        )}
      </div>

      {/* Banner simulación educativa */}
      <div className="bg-amber-400 text-amber-900">
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-2 text-xs font-bold">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          SIMULACIÓN EDUCATIVA — Esta declaración NO se envía a Hacienda. Solo tiene fines de práctica académica.
        </div>
      </div>

      {/* Franja de identificación del declarante (firma de TRIBU-CR) */}
      <div style={{ background: a.strip }}>
        <div className="max-w-4xl mx-auto px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-gray-700">
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
      <p className={`text-sm font-semibold text-gray-800 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

export default TribuHeader;
