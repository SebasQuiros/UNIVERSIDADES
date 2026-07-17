/**
 * mirror-status.ts — Lógica PURA del outbox del espejo inter-company.
 *
 * Sin dependencias de Prisma/Nest a propósito: son las funciones que
 * `qa-testing` prueba de forma aislada (ver spec FASE 2a, Cimiento A, §A.4).
 *
 * Ubicación del criterio fiscal: una factura electrónica emitida y aceptada
 * por Hacienda es válida con independencia de que la contraparte registre su
 * compra (ver `InterCompanyService` — comentario de diseño del outbox). Estas
 * funciones son el mapeo canónico entre "qué pasó al intentar el espejo" y el
 * estado durable que se persiste en `InterCompanyMirror.status`, más el
 * predicado de elegibilidad de cruce y el gate anti-auto-incriminación (T2a)
 * que usará el oráculo de auditoría en una fase posterior.
 */

/**
 * Estado durable del outbox (`InterCompanyMirror.status`). Union local (no se
 * importa el enum de Prisma) para que este módulo compile y se pruebe sin la
 * dependencia de `@prisma/client`. Los valores están alineados 1:1 con el
 * enum Prisma `MirrorStatus` (`schema.prisma`).
 */
export type MirrorStatus = 'NOT_APPLICABLE' | 'PENDING' | 'DONE' | 'FAILED';

/**
 * Resultado crudo de un intento de espejo: lo que devuelve
 * `InterCompanyService.mirrorSaleToBuyer` (`{ mirrored, reason }`), o la
 * marca de que el intento lanzó una excepción (`threw: true`).
 */
export interface MirrorOutcome {
  mirrored?: boolean;
  reason?: string;
  threw?: boolean;
}

/** Razones de `mirrorSaleToBuyer` que significan "no hay obligación de espejo". */
const NOT_APPLICABLE_REASONS = new Set<string>([
  'no_matching_company',
  'auto_inter_company_off',
  'no_customer',
  'client_without_identification_or_not_owned',
  'seller_without_exercise',
  'commercial_mode_erp_completo_awaiting_flow',
]);

/**
 * Mapeo canónico resultado de espejo → estado durable del outbox.
 * Ver spec FASE 2a, Cimiento A §A.2, tabla "Enum MirrorStatus y mapeo de
 * resultados". Una excepción (`threw: true`) siempre es `FAILED`
 * (falla de plataforma, reintentable), sin importar qué más traiga el outcome.
 *
 * Criterio de revisión fiscal-contable: `NOT_APPLICABLE` es un estado
 * TERMINAL — "ausencia esperada, no reintentar, no investigar". Es el PEOR
 * destino posible para una falla desconocida o una anomalía, porque el
 * oráculo (y el estudiante) dejan de mirarla para siempre. Por eso el default
 * de este mapeo es `FAILED` (investigable/reintentable), NUNCA
 * `NOT_APPLICABLE`. Solo las razones explícitamente listadas en
 * `NOT_APPLICABLE_REASONS` — casos de ausencia de obligación verificados —
 * mapean a `NOT_APPLICABLE`.
 */
export function classifyMirrorOutcome(outcome: MirrorOutcome): MirrorStatus {
  if (outcome.threw) return 'FAILED';
  if (outcome.mirrored === true) return 'DONE';
  if (outcome.reason === 'proposal_created') return 'DONE';
  // 'invoice_not_found': la factura recién emitida no se pudo leer dentro de
  // la propia tx del espejo — es una anomalía de plataforma, no una ausencia
  // de obligación esperada. FAILED explícito (aunque ya caería acá por el
  // default de abajo, se deja explícito para que no se pierda de vista).
  if (outcome.reason === 'invoice_not_found') return 'FAILED';
  if (outcome.reason && NOT_APPLICABLE_REASONS.has(outcome.reason)) return 'NOT_APPLICABLE';
  // Cualquier razón NO reconocida (rama nueva de mirrorSaleToBuyer sin
  // mapear aquí todavía) se trata como FAILED — reintentable e investigable
  // — nunca como NOT_APPLICABLE sin evidencia explícita de que no hay
  // obligación.
  return 'FAILED';
}

/**
 * Elegibilidad de cruce del oráculo de auditoría (fase siguiente): SOLO las
 * facturas cuyo espejo quedó `DONE` son comparables contra la compra del
 * comprador. `PENDING`/`FAILED` son fallas de plataforma que no generan
 * hallazgos; `NOT_APPLICABLE` es ausencia esperada (cliente externo al
 * universo o feature apagado).
 */
export function isCrossCheckEligible(status: MirrorStatus): boolean {
  return status === 'DONE';
}

/**
 * Gate anti-auto-incriminación (T2a) para el oráculo. Una `PurchaseInvoice`
 * sin `sourceInvoiceId` (registrada a mano) de un proveedor que SÍ está en el
 * universo (otra Company del mismo exercise/curso) es candidata a "compra
 * fabricada" SOLO si no existe una fila de outbox `PENDING`/`FAILED` para esa
 * relación que explique por qué el estudiante tuvo que registrarla a mano —
 * evita acusar de fabricación lo que en realidad es una falla de plataforma
 * (espejo caído o aún no procesado).
 */
export function isFabricatedPurchaseCandidate(input: {
  sourceInvoiceId: string | null;
  supplierIsInUniverse: boolean;
  hasFailedOrPendingMirror: boolean;
}): boolean {
  if (input.hasFailedOrPendingMirror) return false;
  return input.sourceInvoiceId === null && input.supplierIsInUniverse;
}
