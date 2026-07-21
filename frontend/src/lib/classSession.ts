// ── Sesión de Aula — constantes compartidas entre el portal profesor y el
// portal estudiante. Los valores calzan 1:1 con los enums de Prisma
// (`ClassSessionArchetype`, `ClassSessionStatus`) y con las secciones de
// hallazgo de auditoría (`FINDING_SECTIONS` en el backend).

import type { ElementType } from 'react';
import { Hammer, Truck, Megaphone, Scale } from 'lucide-react';

// ── Arquetipos de negocio (ClassSessionArchetype) ───────────────────────────

export type ClassSessionArchetype = 'FERRETERIA' | 'AGENCIA_PUBLICIDAD' | 'BUFETE_CONTABLE' | 'DISTRIBUIDOR';

export const ARCHETYPE_KEYS: ClassSessionArchetype[] = [
  'FERRETERIA', 'DISTRIBUIDOR', 'AGENCIA_PUBLICIDAD', 'BUFETE_CONTABLE',
];

export const ARCHETYPE_LABELS: Record<ClassSessionArchetype, string> = {
  FERRETERIA:         'Ferretería',
  DISTRIBUIDOR:       'Distribuidor mayorista',
  AGENCIA_PUBLICIDAD: 'Agencia de publicidad',
  BUFETE_CONTABLE:    'Bufete contable',
};

export const ARCHETYPE_DESCRIPTIONS: Record<ClassSessionArchetype, string> = {
  FERRETERIA:         'Vende materiales de construcción y herramientas al detalle; le compra mercadería a los distribuidores de la sesión.',
  DISTRIBUIDOR:       'Vende mercadería al por mayor a las demás empresas de la sesión.',
  AGENCIA_PUBLICIDAD: 'Vende servicios de mercadeo y diseño al resto de las empresas de la sesión.',
  BUFETE_CONTABLE:    'Vende servicios de contabilidad y asesoría al resto de las empresas de la sesión.',
};

export const ARCHETYPE_ICON: Record<ClassSessionArchetype, ElementType> = {
  FERRETERIA:         Hammer,
  DISTRIBUIDOR:       Truck,
  AGENCIA_PUBLICIDAD: Megaphone,
  BUFETE_CONTABLE:    Scale,
};

export const ARCHETYPE_TINT: Record<ClassSessionArchetype, string> = {
  FERRETERIA:         '#B8860B',
  DISTRIBUIDOR:       '#059669',
  AGENCIA_PUBLICIDAD: '#2563EB',
  BUFETE_CONTABLE:    '#1B2E6E',
};

// ── Estado de la sesión (ClassSessionStatus) ────────────────────────────────

export type ClassSessionStatus =
  | 'DRAFT' | 'LOBBY' | 'EN_CURSO' | 'TRIBUTACION' | 'AUDITORIA'
  | 'CALIFICACION' | 'FINALIZADA' | 'CANCELADA';

export const STATUS_LABELS: Record<ClassSessionStatus, string> = {
  DRAFT:        'Borrador',
  LOBBY:        'Sala de espera',
  EN_CURSO:     'En curso',
  TRIBUTACION:  'Tributación',
  AUDITORIA:    'Auditoría',
  CALIFICACION: 'Calificación',
  FINALIZADA:   'Finalizada',
  CANCELADA:    'Cancelada',
};

export const ACTIVE_STATUSES: ClassSessionStatus[] = [
  'DRAFT', 'LOBBY', 'EN_CURSO', 'TRIBUTACION', 'AUDITORIA', 'CALIFICACION',
];

// ── Estado de conexión del participante (heartbeat) ─────────────────────────

export type OnlineStatus = 'ACTIVE' | 'IDLE' | 'OFFLINE';

export const ONLINE_STATUS_LABELS: Record<OnlineStatus, string> = {
  ACTIVE:  'En línea',
  IDLE:    'Inactivo',
  OFFLINE: 'Desconectado',
};

// ── Secciones de hallazgo de auditoría (FINDING_SECTIONS) ──────────────────

export const FINDING_SECTIONS = [
  'BALANCE_SHEET', 'INCOME_STATEMENT', 'TAX_D101', 'TAX_D104', 'TAX_D103', 'TAX_D115', 'OTHER',
] as const;
export type FindingSection = typeof FINDING_SECTIONS[number];

export const FINDING_SECTION_LABELS: Record<FindingSection, string> = {
  BALANCE_SHEET:    'Balance General',
  INCOME_STATEMENT: 'Estado de Resultados',
  TAX_D101:         'D-101 · Renta',
  TAX_D104:         'D-104 · IVA',
  TAX_D103:         'D-103 · Retenciones',
  TAX_D115:         'D-115 · Dividendos',
  OTHER:            'Otro',
};

// ── Polling: 3-5s mientras la sesión está "viva", 8-10s en fases de cierre ──

export function pollIntervalMs(status: ClassSessionStatus | null | undefined): number {
  if (status === 'DRAFT' || status === 'LOBBY' || status === 'EN_CURSO') return 4000;
  return 9000;
}
