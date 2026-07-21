import { ringAssignments, AuditPair } from './class-sessions.logic';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `c${i}`);

function assertValidDerangement(pairs: AuditPair[], all: string[]) {
  // Nadie se audita a sí mismo.
  for (const p of pairs) expect(p.auditor).not.toBe(p.auditee);
  // Cada empresa es auditora exactamente una vez y auditada exactamente una vez.
  expect(pairs.map((p) => p.auditor).sort()).toEqual([...all].sort());
  expect(pairs.map((p) => p.auditee).sort()).toEqual([...all].sort());
}

describe('ringAssignments — derangement de auditoría', () => {
  it('n < 2 → sin asignaciones', () => {
    expect(ringAssignments([])).toEqual([]);
    expect(ringAssignments(['c0'])).toEqual([]);
  });

  it('n = 2 → recíproco (inevitable)', () => {
    const r = ringAssignments(['A', 'B']);
    expect(r).toEqual([{ auditor: 'A', auditee: 'B' }, { auditor: 'B', auditee: 'A' }]);
  });

  it('n = 3 → anillo, sin auto-auditoría ni recíprocas', () => {
    const r = ringAssignments(['A', 'B', 'C']);
    expect(r).toEqual([
      { auditor: 'A', auditee: 'B' },
      { auditor: 'B', auditee: 'C' },
      { auditor: 'C', auditee: 'A' },
    ]);
    assertValidDerangement(r, ['A', 'B', 'C']);
  });

  it('propiedades para n = 5,6,10 (derangement válido, sin recíprocas)', () => {
    for (const n of [5, 6, 10]) {
      const all = ids(n);
      const r = ringAssignments(all);
      assertValidDerangement(r, all);
      // Sin parejas recíprocas: si A audita a B, B NO audita a A.
      const map = new Map(r.map((p) => [p.auditor, p.auditee]));
      for (const p of r) {
        expect(map.get(p.auditee)).not.toBe(p.auditor);
      }
    }
  });
});
