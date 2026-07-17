/**
 * mirror-status.spec.ts
 * Pruebas unitarias del mapeo puro del outbox del espejo inter-company.
 *
 * Cimiento A (spec-cimientos.md, Fase 2a): `classifyMirrorOutcome`,
 * `isCrossCheckEligible` e `isFabricatedPurchaseCandidate` son funciones
 * puras (sin Prisma) — se importan directamente, no se replican, porque el
 * módulo fuente ya está libre de dependencias de Prisma/Nest.
 *
 * Fuente: src/modules/inter-company/mirror-status.ts
 */

import {
  classifyMirrorOutcome,
  isCrossCheckEligible,
  isFabricatedPurchaseCandidate,
  type MirrorStatus,
} from './mirror-status';

describe('classifyMirrorOutcome — mapeo resultado de espejo → estado durable', () => {
  it('mirrored:true (CONTABLE, efectos aplicados) → DONE', () => {
    expect(classifyMirrorOutcome({ mirrored: true })).toBe('DONE');
  });

  it("reason:'proposal_created' (EMPRESARIAL, propuesta durable) → DONE", () => {
    expect(classifyMirrorOutcome({ mirrored: false, reason: 'proposal_created' })).toBe('DONE');
  });

  it("reason:'no_matching_company' (cliente externo al universo) → NOT_APPLICABLE", () => {
    expect(classifyMirrorOutcome({ mirrored: false, reason: 'no_matching_company' })).toBe(
      'NOT_APPLICABLE',
    );
  });

  it("reason:'auto_inter_company_off' (feature apagado) → NOT_APPLICABLE", () => {
    expect(classifyMirrorOutcome({ mirrored: false, reason: 'auto_inter_company_off' })).toBe(
      'NOT_APPLICABLE',
    );
  });

  it("reason:'no_customer' → NOT_APPLICABLE", () => {
    expect(classifyMirrorOutcome({ mirrored: false, reason: 'no_customer' })).toBe(
      'NOT_APPLICABLE',
    );
  });

  it("reason:'client_without_identification_or_not_owned' → NOT_APPLICABLE", () => {
    expect(
      classifyMirrorOutcome({
        mirrored: false,
        reason: 'client_without_identification_or_not_owned',
      }),
    ).toBe('NOT_APPLICABLE');
  });

  it("reason:'seller_without_exercise' → NOT_APPLICABLE", () => {
    expect(classifyMirrorOutcome({ mirrored: false, reason: 'seller_without_exercise' })).toBe(
      'NOT_APPLICABLE',
    );
  });

  it("reason:'commercial_mode_erp_completo_awaiting_flow' → NOT_APPLICABLE", () => {
    expect(
      classifyMirrorOutcome({
        mirrored: false,
        reason: 'commercial_mode_erp_completo_awaiting_flow',
      }),
    ).toBe('NOT_APPLICABLE');
  });

  it('excepción lanzada al intentar el espejo (threw:true) → FAILED (falla de plataforma, reintentable)', () => {
    expect(classifyMirrorOutcome({ threw: true })).toBe('FAILED');
  });

  it('threw:true tiene prioridad sobre cualquier otro campo del outcome → FAILED', () => {
    expect(classifyMirrorOutcome({ threw: true, mirrored: true, reason: 'proposal_created' })).toBe(
      'FAILED',
    );
  });

  it(
    "reason:'invoice_not_found' (la factura recién emitida no se pudo leer dentro de la propia tx " +
      'del espejo — anomalía de plataforma, no ausencia de obligación) → FAILED explícito',
    () => {
      expect(classifyMirrorOutcome({ mirrored: false, reason: 'invoice_not_found' })).toBe('FAILED');
    },
  );

  it(
    'razón desconocida/no mapeada → FAILED (criterio revisado: NOT_APPLICABLE es un estado ' +
      'TERMINAL que el oráculo deja de mirar para siempre; una falla desconocida debe ser ' +
      'investigable/reintentable, NUNCA una ausencia silenciosa sin evidencia explícita)',
    () => {
      expect(classifyMirrorOutcome({ mirrored: false, reason: 'razon_nueva_sin_mapear' })).toBe(
        'FAILED',
      );
    },
  );

  it('outcome vacío (sin mirrored, sin reason, sin threw) → FAILED (mismo default defensivo)', () => {
    expect(classifyMirrorOutcome({})).toBe('FAILED');
  });
});

describe('isCrossCheckEligible — elegibilidad de cruce para el oráculo de auditoría', () => {
  it("DONE → true (única condición elegible para cruce)", () => {
    expect(isCrossCheckEligible('DONE')).toBe(true);
  });

  it.each<MirrorStatus>(['PENDING', 'FAILED', 'NOT_APPLICABLE'])(
    '%s → false (no genera hallazgos contra el comprador)',
    (status) => {
      expect(isCrossCheckEligible(status)).toBe(false);
    },
  );
});

describe('isFabricatedPurchaseCandidate — gate anti-auto-incriminación (T2a)', () => {
  it('hasFailedOrPendingMirror:true → false aunque sourceInvoiceId sea null y el proveedor esté en el universo (precedencia del gate)', () => {
    expect(
      isFabricatedPurchaseCandidate({
        sourceInvoiceId: null,
        supplierIsInUniverse: true,
        hasFailedOrPendingMirror: true,
      }),
    ).toBe(false);
  });

  it('sin factura fuente, proveedor del universo, sin espejo pendiente/fallido que lo explique → true (candidata a fabricación)', () => {
    expect(
      isFabricatedPurchaseCandidate({
        sourceInvoiceId: null,
        supplierIsInUniverse: true,
        hasFailedOrPendingMirror: false,
      }),
    ).toBe(true);
  });

  it('con sourceInvoiceId no-nulo (compra sí espejada) → false, sin importar el resto', () => {
    expect(
      isFabricatedPurchaseCandidate({
        sourceInvoiceId: 'inv-123',
        supplierIsInUniverse: true,
        hasFailedOrPendingMirror: false,
      }),
    ).toBe(false);
  });

  it('proveedor externo al universo (supplierIsInUniverse:false) → false, aunque falte sourceInvoiceId', () => {
    expect(
      isFabricatedPurchaseCandidate({
        sourceInvoiceId: null,
        supplierIsInUniverse: false,
        hasFailedOrPendingMirror: false,
      }),
    ).toBe(false);
  });
});
