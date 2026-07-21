// ── Tipos de la pantalla de control de una sesión de aula (profesor) ───────
// Calzan con las respuestas reales del backend (ver
// `backend/src/modules/class-sessions/class-sessions.service.ts`).

import type { ClassSessionArchetype, ClassSessionStatus, OnlineStatus } from '@/lib/classSession';

export interface DashboardParticipant {
  participantId: string;
  studentId: string;
  name: string;
  email: string;
  companyId: string | null;
  onlineStatus: OnlineStatus;
}

export interface DashboardGroup {
  companyId: string;
  name: string;
  legalId: string;
  archetype: ClassSessionArchetype;
  memberCount: number;
  snapshotPublished: boolean;
  accountingScore: string | number | null;
  auditScore: string | number | null;
}

export interface DashboardResponse {
  id: string;
  status: ClassSessionStatus;
  code: string;
  participants: DashboardParticipant[];
  groups: DashboardGroup[];
  participantsCount: number;
  findingsTotal: number;
}

export interface AuditAssignmentPair {
  auditorCompanyId: string;
  auditorName: string;
  auditeeCompanyId: string;
  auditeeName: string;
  archetype: ClassSessionArchetype;
}

/** Peso por defecto del oráculo (`DEFAULT_SETTINGS` en el backend). */
export const DEFAULT_ACCOUNTING_WEIGHT = 0.6;
export const DEFAULT_AUDIT_WEIGHT = 0.4;

export function combinedScore(accounting: string | number | null, audit: string | number | null): number | null {
  if (accounting == null || audit == null) return null;
  return Number(accounting) * DEFAULT_ACCOUNTING_WEIGHT + Number(audit) * DEFAULT_AUDIT_WEIGHT;
}
