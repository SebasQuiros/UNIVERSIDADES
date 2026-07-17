/**
 * renta-authz.spec.ts
 * Pruebas unitarias de las funciones puras de autorización, anclaje de
 * `attemptId` y créditos del D-101 usadas para habilitar la tributación en
 * modo GROUP (Cimiento B, spec-cimientos.md, Fase 2a).
 *
 * Se importan directamente — el módulo fuente ya está libre de Prisma/Nest.
 *
 * Fuente: src/modules/tax-declarations/renta-authz.ts
 */

import {
  canTributeForCompany,
  resolveAttemptId,
  computeTaxAfterCredits,
} from './renta-authz';

describe('canTributeForCompany — autorización para tributar por la empresa', () => {
  it('INDIVIDUAL: el dueño de la empresa (studentId === userId) puede tributar', () => {
    expect(
      canTributeForCompany({
        mode: 'INDIVIDUAL',
        companyStudentId: 'U1',
        userId: 'U1',
        isMember: false,
      }),
    ).toBe(true);
  });

  it('INDIVIDUAL: un usuario ajeno a la empresa (studentId !== userId) NO puede tributar', () => {
    expect(
      canTributeForCompany({
        mode: 'INDIVIDUAL',
        companyStudentId: 'U1',
        userId: 'U2',
        isMember: false,
      }),
    ).toBe(false);
  });

  it('GROUP: un miembro de la empresa puede tributar (borde que antes lanzaba ForbiddenException)', () => {
    expect(
      canTributeForCompany({
        mode: 'GROUP',
        companyStudentId: null,
        userId: 'U1',
        isMember: true,
      }),
    ).toBe(true);
  });

  it('GROUP: un usuario que NO es miembro (de otra empresa) NO puede tributar — aislamiento intacto', () => {
    expect(
      canTributeForCompany({
        mode: 'GROUP',
        companyStudentId: null,
        userId: 'U2',
        isMember: false,
      }),
    ).toBe(false);
  });

  it('GROUP con un solo miembro: ese miembro puede tributar', () => {
    expect(
      canTributeForCompany({
        mode: 'GROUP',
        companyStudentId: null,
        userId: 'U1',
        isMember: true,
      }),
    ).toBe(true);
  });

  it('GROUP con varios miembros: cualquiera de ellos puede tributar', () => {
    // isMember ya resuelve la membership fresca de DB para el userId en curso;
    // el caso "varios miembros" se reduce, para la función pura, a isMember:true
    // sin importar cuántos otros miembros tenga la empresa.
    expect(
      canTributeForCompany({
        mode: 'GROUP',
        companyStudentId: null,
        userId: 'U3',
        isMember: true,
      }),
    ).toBe(true);
  });
});

describe('resolveAttemptId — anclaje del attemptId en escrituras de Retencion/PartialPayment', () => {
  it("INDIVIDUAL: conserva el attemptId de la empresa ('A1')", () => {
    expect(resolveAttemptId({ mode: 'INDIVIDUAL', companyAttemptId: 'A1' })).toBe('A1');
  });

  it('GROUP: siempre resuelve null (companyAttemptId=null) — el anclaje real es companyId', () => {
    expect(resolveAttemptId({ mode: 'GROUP', companyAttemptId: null })).toBeNull();
  });

  it('GROUP: aunque companyAttemptId viniera no-nulo, igual devuelve null — GROUP nunca ancla por attempt', () => {
    expect(resolveAttemptId({ mode: 'GROUP', companyAttemptId: 'A1' })).toBeNull();
  });
});

describe('computeTaxAfterCredits — fix del bug de withholdingsReceived (créditos del D-101)', () => {
  it(
    'practicó retenciones a terceros (40.000, pasivo D-103) pero sin pagos parciales: ' +
      'NO se acreditan contra la renta propia → impuestoAPagar=150.000 ' +
      '(el bug anterior daba 110.000 al restar indebidamente las retenciones practicadas)',
    () => {
      expect(computeTaxAfterCredits({ totalTax: 150_000, totalPartialPaid: 0 })).toEqual({
        impuestoAPagar: 150_000,
        saldoAFavor: 0,
      });
    },
  );

  it('con pagos parciales (100.000): estos sí son crédito legítimo → impuestoAPagar=50.000', () => {
    expect(computeTaxAfterCredits({ totalTax: 150_000, totalPartialPaid: 100_000 })).toEqual({
      impuestoAPagar: 50_000,
      saldoAFavor: 0,
    });
  });

  it('pagos parciales superan el impuesto determinado: saldo a favor de 50.000', () => {
    expect(computeTaxAfterCredits({ totalTax: 150_000, totalPartialPaid: 200_000 })).toEqual({
      impuestoAPagar: 0,
      saldoAFavor: 50_000,
    });
  });

  it('sin retención alguna (ni practicada ni pago parcial): el crédito automático es solo pagos parciales, aquí 0 → impuestoAPagar=150.000', () => {
    expect(computeTaxAfterCredits({ totalTax: 150_000, totalPartialPaid: 0 })).toEqual({
      impuestoAPagar: 150_000,
      saldoAFavor: 0,
    });
  });

  it('monto cero (empresa sin impuesto determinado ni pagos): impuestoAPagar=0, saldoAFavor=0', () => {
    expect(computeTaxAfterCredits({ totalTax: 0, totalPartialPaid: 0 })).toEqual({
      impuestoAPagar: 0,
      saldoAFavor: 0,
    });
  });
});
