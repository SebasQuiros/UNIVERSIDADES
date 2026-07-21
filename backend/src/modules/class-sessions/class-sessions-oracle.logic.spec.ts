import { Decimal } from '@prisma/client/runtime/library';
import {
  roundingTolerance,
  computeMateriality,
  classifySeverity,
  evaluateDiscrepancy,
  categoriesForSection,
  matchFinding,
  computeAccountingScore,
  computeAuditScore,
  computeTotalScore,
  Discrepancy,
  MaterialityThresholds,
} from './class-sessions-oracle.logic';

// Materialidad de referencia con ingresos = ₡10.000.000:
//   MG = max(1%·10M, 25.000) = 100.000
//   PM = 75%·100.000 = 75.000
//   CT = max(5%·75.000, 100) = 3.750
const M10: MaterialityThresholds = computeMateriality(new Decimal('10000000'));

const mkMsg = () => 'diferencia detectada'; // mensaje determinista de prueba

describe('oráculo — tolerancia de redondeo', () => {
  it('RT(1) = ₡0.01 (piso)', () => {
    expect(roundingTolerance(1).toString()).toBe('0.01');
  });
  it('RT(4) = ₡0.02 (0.005·4)', () => {
    expect(roundingTolerance(4).toString()).toBe('0.02');
  });
  it('itemCount inválido cae al piso', () => {
    expect(roundingTolerance(0).toString()).toBe('0.01');
    expect(roundingTolerance(-5).toString()).toBe('0.01');
  });
});

describe('oráculo — materialidad (NIA 320/450)', () => {
  it('ingresos ₡10.000.000 → MG 100.000 · PM 75.000 · CT 3.750', () => {
    expect(M10.MG.toString()).toBe('100000');
    expect(M10.PM.toString()).toBe('75000');
    expect(M10.CT.toString()).toBe('3750');
  });
  it('ingresos chicos → MG toca el piso de ₡25.000', () => {
    const m = computeMateriality(new Decimal('1000000')); // 1%·1M = 10.000 < 25.000
    expect(m.MG.toString()).toBe('25000');
    expect(m.PM.toString()).toBe('18750');
    expect(m.CT.toString()).toBe('937.5');
  });
  it('ingresos negativos se tratan como 0 (MG al piso)', () => {
    const m = computeMateriality(new Decimal('-500'));
    expect(m.MG.toString()).toBe('25000');
  });
});

describe('oráculo — clasificación de severidad', () => {
  it('diff ≤ PM → MEDIO', () => {
    expect(classifySeverity(new Decimal('50000'), M10)).toBe('MEDIO');
    expect(classifySeverity(new Decimal('75000'), M10)).toBe('MEDIO'); // borde ≤ PM
  });
  it('PM < diff ≤ MG → ALTO', () => {
    expect(classifySeverity(new Decimal('90000'), M10)).toBe('ALTO');
    expect(classifySeverity(new Decimal('100000'), M10)).toBe('ALTO'); // borde ≤ MG
  });
  it('diff > MG → CRÍTICO', () => {
    expect(classifySeverity(new Decimal('150000'), M10)).toBe('CRITICO');
  });
});

describe('oráculo — evaluación de discrepancia (corte de ruido + bandas)', () => {
  const base = { itemCount: 4, materiality: M10, buildMessage: mkMsg };

  it('diferencia por redondeo (₡0.03) → null', () => {
    const d = evaluateDiscrepancy({
      ...base, category: 'ingresos_omitidos',
      expected: new Decimal('1000000.03'), reported: new Decimal('1000000.00'),
    });
    expect(d).toBeNull();
  });

  it('diferencia por debajo de CT (₡1.000 < 3.750) → null', () => {
    const d = evaluateDiscrepancy({
      ...base, category: 'ingresos_omitidos',
      expected: new Decimal('1000000'), reported: new Decimal('999000'),
    });
    expect(d).toBeNull();
  });

  it('sobredeclaración (esperado < reportado) → null (solo la subdeclaración es hallazgo)', () => {
    const d = evaluateDiscrepancy({
      ...base, category: 'ingresos_omitidos',
      expected: new Decimal('100000'), reported: new Decimal('200000'),
    });
    expect(d).toBeNull();
  });

  it('subdeclaración ₡50.000 (≤ PM) → MEDIO', () => {
    const d = evaluateDiscrepancy({
      ...base, category: 'ingresos_omitidos',
      expected: new Decimal('100000'), reported: new Decimal('50000'),
    });
    expect(d).not.toBeNull();
    expect(d!.severity).toBe('MEDIO');
    expect(d!.delta).toBe('50000.00');
    expect(d!.expectedAmount).toBe('100000.00');
    expect(d!.reportedAmount).toBe('50000.00');
    expect(d!.category).toBe('ingresos_omitidos');
  });

  it('subdeclaración ₡150.000 (> MG) → CRÍTICO', () => {
    const d = evaluateDiscrepancy({
      ...base, category: 'iva_subdeclarado',
      expected: new Decimal('150000'), reported: new Decimal('0'),
    });
    expect(d!.severity).toBe('CRITICO');
  });
});

describe('oráculo — mapeo sección → categoría', () => {
  it('mapea las secciones conocidas', () => {
    expect(categoriesForSection('INCOME_STATEMENT')).toEqual(['ingresos_omitidos']);
    expect(categoriesForSection('TAX_D104')).toEqual(['iva_subdeclarado']);
    expect(categoriesForSection('BALANCE_SHEET')).toEqual(['cxp_no_registrada']);
  });
  it('secciones sin discrepancia candidata → []', () => {
    expect(categoriesForSection('OTHER')).toEqual([]);
    expect(categoriesForSection('TAX_D103')).toEqual([]);
    expect(categoriesForSection('TAX_D115')).toEqual([]);
  });
});

describe('oráculo — emparejamiento hallazgo ↔ discrepancia', () => {
  const disc: Discrepancy = {
    category: 'ingresos_omitidos',
    expectedAmount: '100000.00', reportedAmount: '50000.00',
    delta: '50000.00', severity: 'MEDIO', message: 'x',
  };

  it('sección correcta + monto ~ delta → MATCH', () => {
    const r = matchFinding({ section: 'INCOME_STATEMENT', claimedAmount: new Decimal('50000'), discrepancies: [disc] });
    expect(r.status).toBe('MATCH');
    expect(r.category).toBe('ingresos_omitidos');
  });

  it('sección correcta + monto ~ esperado → MATCH', () => {
    const r = matchFinding({ section: 'INCOME_STATEMENT', claimedAmount: new Decimal('100000'), discrepancies: [disc] });
    expect(r.status).toBe('MATCH');
  });

  it('sin monto declarado → MATCH débil por sección', () => {
    const r = matchFinding({ section: 'INCOME_STATEMENT', claimedAmount: null, discrepancies: [disc] });
    expect(r.status).toBe('MATCH');
  });

  it('sección correcta pero monto muy distinto → WRONG_AMOUNT', () => {
    const r = matchFinding({ section: 'INCOME_STATEMENT', claimedAmount: new Decimal('10'), discrepancies: [disc] });
    expect(r.status).toBe('WRONG_AMOUNT');
  });

  it('sección sin discrepancia real → NO_DISCREPANCY (falso positivo)', () => {
    const r = matchFinding({ section: 'TAX_D104', claimedAmount: new Decimal('999'), discrepancies: [disc] });
    expect(r.status).toBe('NO_DISCREPANCY');
  });

  it('sección OTHER (sin candidatos) → NO_DISCREPANCY', () => {
    const r = matchFinding({ section: 'OTHER', claimedAmount: null, discrepancies: [disc] });
    expect(r.status).toBe('NO_DISCREPANCY');
  });
});

describe('oráculo — accountingScore', () => {
  it('sin discrepancias propias → 100', () => {
    expect(computeAccountingScore([]).toString()).toBe('100');
  });
  it('un MEDIO → 100 − 15 = 85', () => {
    expect(computeAccountingScore([{ severity: 'MEDIO' }]).toString()).toBe('85');
  });
  it('un CRÍTICO → 100 − 60 = 40', () => {
    expect(computeAccountingScore([{ severity: 'CRITICO' }]).toString()).toBe('40');
  });
  it('dos CRÍTICOS → acotado a 0 (no negativo)', () => {
    expect(computeAccountingScore([{ severity: 'CRITICO' }, { severity: 'CRITICO' }]).toString()).toBe('0');
  });
});

describe('oráculo — auditScore (los 4 extremos del diseño)', () => {
  it('auditado limpio + auditor no reporta nada → 100', () => {
    const s = computeAuditScore({ auditeeDiscrepancies: [], findingResults: [] });
    expect(s.toString()).toBe('100');
  });

  it('auditado limpio + 2 falsos positivos → 70', () => {
    const s = computeAuditScore({
      auditeeDiscrepancies: [],
      findingResults: [{ status: 'NO_DISCREPANCY' }, { status: 'NO_DISCREPANCY' }],
    });
    expect(s.toString()).toBe('70');
  });

  it('auditado sucio + auditor no reporta nada → 0', () => {
    const s = computeAuditScore({
      auditeeDiscrepancies: [{ category: 'ingresos_omitidos', severity: 'ALTO' }],
      findingResults: [],
    });
    expect(s.toString()).toBe('0');
  });

  it('auditado sucio + auditor lo encuentra → 100', () => {
    const s = computeAuditScore({
      auditeeDiscrepancies: [{ category: 'ingresos_omitidos', severity: 'ALTO' }],
      findingResults: [{ status: 'MATCH', category: 'ingresos_omitidos' }],
    });
    expect(s.toString()).toBe('100');
  });

  it('WRONG_AMOUNT no cuenta como falso positivo', () => {
    // auditado limpio; un WRONG_AMOUNT no debe bajar la precisión a 0.
    const s = computeAuditScore({
      auditeeDiscrepancies: [],
      findingResults: [{ status: 'WRONG_AMOUNT', category: 'ingresos_omitidos' }],
    });
    expect(s.toString()).toBe('100');
  });
});

describe('oráculo — totalScore (pesos 0.6/0.4)', () => {
  const W = { accountingWeight: 0.6, auditWeight: 0.4 };

  it('sin auditoría (audit null) → devuelve accountingScore', () => {
    expect(computeTotalScore(new Decimal('85'), null, W).toString()).toBe('85');
  });
  it('acc 80 + audit 100 → 88', () => {
    expect(computeTotalScore(new Decimal('80'), new Decimal('100'), W).toString()).toBe('88');
  });
  it('acc 100 + audit 0 → 60', () => {
    expect(computeTotalScore(new Decimal('100'), new Decimal('0'), W).toString()).toBe('60');
  });
});
