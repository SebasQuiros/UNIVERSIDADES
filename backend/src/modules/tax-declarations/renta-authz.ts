/**
 * renta-authz.ts
 * Funciones PURAS (sin Prisma) usadas por `renta.service.ts` para autorización
 * y cálculo de créditos del D-101. Se extraen a este archivo para que
 * qa-testing pueda probarlas de forma aislada, siguiendo el patrón del resto
 * del núcleo fiscal ("replicar la lógica pura" — ver `d104-iva.spec.ts`).
 *
 * Contexto: Fase 2a — Cimiento B (spec fiscal-contable, "tributación en modo
 * GROUP"). No se tocan tasas, tramos ni el umbral PYME — solo autorización,
 * anclaje del `attemptId` y el bug de créditos de `withholdingsReceived`.
 */

// ── Autorización ────────────────────────────────────────────────────────────
// NOTA: esta función es un ESPEJO puro y testeable del criterio que aplica
// `assertCompanyAccess` (`common/auth/company-access.helper.ts`), que es la
// fuente de verdad real (consulta CompanyMembership en DB y lanza si no hay
// acceso). `renta.service.ts` delega la autorización efectiva a
// `assertCompanyAccess` — no invoca esta función en runtime — para no
// duplicar/desincronizar el criterio con el resto de `tax-declarations` ni
// con `CompanyOwnerGuard`. `canTributeForCompany` documenta y deja testeable
// el MISMO criterio sin depender de Prisma.
//
// Regla: INDIVIDUAL → dueño de la empresa (studentId === userId).
//        GROUP      → miembro de la empresa (CompanyMembership existente).
export function canTributeForCompany(input: {
  mode: 'INDIVIDUAL' | 'GROUP';
  companyStudentId: string | null;
  userId: string;
  isMember: boolean;
}): boolean {
  if (input.mode === 'INDIVIDUAL') {
    return input.companyStudentId === input.userId;
  }
  return input.isMember;
}

// ── Anclaje de attemptId ─────────────────────────────────────────────────────
// El anclaje fiscal real de Retencion/PartialPayment es `companyId` (la
// persona jurídica, contribuyente del impuesto), no el `attempt` académico.
// INDIVIDUAL conserva su `attemptId` (retrocompatible, útil para calificación
// por intento); GROUP no tiene un único intento dueño → queda NULL.
export function resolveAttemptId(input: {
  mode: 'INDIVIDUAL' | 'GROUP';
  companyAttemptId: string | null;
}): string | null {
  return input.mode === 'INDIVIDUAL' ? input.companyAttemptId : null;
}

// ── Créditos del D-101 (fix del bug de withholdingsReceived) ────────────────
// Antes: `taxAfterCredits = totalTax - totalPartialPaid - withholdingsReceived`.
// Eso acreditaba contra la renta PROPIA las retenciones que la empresa
// PRACTICÓ a terceros — que son pasivo a enterar en el D-103 (agente
// retenedor), no un crédito del D-101. Subdeclaraba el impuesto.
//
// Fix: el único crédito automático hoy es el pago parcial (`totalPartialPaid`).
// Las retenciones SOPORTADAS (que otros le practicaron a la empresa) serían el
// crédito correcto del D-101, pero esa ruta aún no está modelada en el cálculo
// automático — por eso el crédito por retenciones queda en 0 (mejor no
// acreditar nada que acreditar el lado equivocado). Ver `renta.service.ts`
// (`retencionesRecibidas`) para el detalle de retrocompatibilidad de UI.
export function computeTaxAfterCredits(input: {
  totalTax: number;
  totalPartialPaid: number;
}): { impuestoAPagar: number; saldoAFavor: number } {
  const neto = round(input.totalTax - input.totalPartialPaid);
  return neto >= 0
    ? { impuestoAPagar: neto, saldoAFavor: 0 }
    : { impuestoAPagar: 0, saldoAFavor: round(-neto) };
}

// ── Helper de redondeo ───────────────────────────────────────────────────────
// Redondeo heredado (Math.round sobre number, no Decimal). Se mantiene tal
// cual por ahora — migrar a Decimal es Fase 2b (fuera de alcance de este
// cimiento; ver spec-cimientos.md §3).
export function round(n: number): number {
  return Math.round(n * 100) / 100;
}
