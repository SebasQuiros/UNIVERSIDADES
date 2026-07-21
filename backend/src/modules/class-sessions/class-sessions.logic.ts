/**
 * class-sessions.logic.ts — Lógica PURA de la Sesión de Aula (sin Prisma/Nest),
 * para poder probarla aislada (patrón del repo).
 */

/** Un par de asignación de auditoría: `auditor` audita a `auditee`. */
export interface AuditPair {
  auditor: string;
  auditee: string;
}

/**
 * Construye el anillo de auditoría sobre un orden YA barajado: cada empresa
 * audita a la SIGUIENTE del anillo. Determinista (la aleatoriedad vive en el
 * shuffle previo, fuera de aquí).
 *
 * Propiedades garantizadas:
 *  - n < 2  → [] (con una sola empresa no hay a quién auditar).
 *  - Cada empresa es auditora exactamente una vez y auditada exactamente una vez.
 *  - Nadie se audita a sí mismo (para n ≥ 2).
 *  - Para n ≥ 3 NO hay parejas recíprocas A↔B (anti-colusión). Para n = 2 la
 *    reciprocidad es inevitable (A audita a B y B audita a A).
 */
export function ringAssignments(orderedIds: string[]): AuditPair[] {
  if (orderedIds.length < 2) return [];
  return orderedIds.map((auditor, i) => ({
    auditor,
    auditee: orderedIds[(i + 1) % orderedIds.length],
  }));
}
