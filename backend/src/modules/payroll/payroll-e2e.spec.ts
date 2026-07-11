import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { PayrollService } from './payroll.service';
import { AccountsService } from '../accounts/accounts.service';

/**
 * E2E de la planilla por el ESCRITOR ÚNICO (Accounting Manifest I-AT-2 / I-PE-1).
 *
 * Bootea el AppModule real contra la BD (DATABASE_URL del .env), siembra una
 * empresa de práctica con catálogo + período abierto + un empleado, corre
 * processPayroll de verdad, y valida:
 *   1. Se crea UN asiento CONFIRMED, balanceado (V-1) y trazable (sourceType
 *      'payroll' + sourceId `${companyId}:${period}`), enlazado en Payroll.
 *   2. Sin período abierto, processPayroll RECHAZA (I-PE-1), sin dejar estado
 *      parcial (todo dentro de la transacción → rollback).
 *
 * Gated por RUN_E2E=1 para NO volver la suite unitaria dependiente de BD.
 * Correr:  RUN_E2E=1 npx jest src/modules/payroll/payroll-e2e.spec.ts
 */
const RUN = process.env.RUN_E2E === '1';
const d = RUN ? describe : describe.skip;

d('Payroll E2E — asiento por el escritor único (I-AT-2)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let payroll: PayrollService;
  let accounts: AccountsService;

  let userId: string;
  let companyId: string;
  const suffix = String(Date.now()).slice(-10);
  const period = '2026-01';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma   = moduleRef.get(PrismaService, { strict: false });
    payroll  = moduleRef.get(PayrollService, { strict: false });
    accounts = moduleRef.get(AccountsService, { strict: false });

    const user = await prisma.user.create({
      data: { name: 'E2E Payroll', email: `e2e-payroll-${suffix}@test.local`, role: 'STUDENT' },
    });
    userId = user.id;

    const company = await prisma.company.create({
      data: {
        name: 'E2E Payroll Co',
        studentId: userId,
        legalId: `3-101-${suffix}`,
        legalIdType: 'JURIDICA',
        economicActivity: 'Servicios',
        currency: 'CRC',
        isPractice: true,
      },
    });
    companyId = company.id;

    await accounts.seedChartOfAccounts(companyId);

    await prisma.accountingPeriod.create({
      data: {
        companyId,
        name: 'Enero 2026',
        type: 'MONTHLY',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        status: 'OPEN',
      },
    });

    await prisma.employee.create({
      data: {
        companyId,
        name: 'Empleado E2E',
        identification: `9-${suffix}`,
        position: 'Analista',
        salary: new Decimal('500000'),
        startDate: new Date('2026-01-01'),
      },
    });
  }, 90000);

  afterAll(async () => {
    // Limpieza en orden de dependencias (varias FKs no cascadean desde Company:
    // journal_lines, payroll_lines→employee). Best-effort; ignora errores.
    if (companyId) {
      const cid = companyId;
      const del = async (fn: () => Promise<any>) => { try { await fn(); } catch {} };
      await del(() => prisma.journalLine.deleteMany({ where: { companyId: cid } }));
      await del(() => prisma.journalEntry.deleteMany({ where: { companyId: cid } }));
      await del(() => prisma.payrollLine.deleteMany({ where: { payroll: { companyId: cid } } }));
      await del(() => prisma.payroll.deleteMany({ where: { companyId: cid } }));
      await del(() => prisma.employee.deleteMany({ where: { companyId: cid } }));
      await del(() => prisma.accountingPeriod.deleteMany({ where: { companyId: cid } }));
      await del(() => prisma.journalSequence.deleteMany({ where: { companyId: cid } }));
      await del(() => prisma.invoiceSequence.deleteMany({ where: { companyId: cid } }));
      await del(() => prisma.account.deleteMany({ where: { companyId: cid } }));
      await del(() => prisma.company.delete({ where: { id: cid } }));
    }
    if (userId) { try { await prisma.user.delete({ where: { id: userId } }); } catch {} }
    await moduleRef?.close();
  }, 90000);

  it('crea un asiento CONFIRMED, balanceado y trazable, enlazado en Payroll', async () => {
    await payroll.processPayroll(companyId, { period } as any, userId);

    const entry = await prisma.journalEntry.findFirst({
      where: { companyId, sourceType: 'payroll', sourceId: `${companyId}:${period}` },
      include: { lines: true },
    });

    expect(entry).toBeTruthy();
    expect(entry!.status).toBe('CONFIRMED');
    expect(entry!.source).toBe('MANUAL');
    expect(entry!.lines.length).toBeGreaterThanOrEqual(6);

    const sumD = entry!.lines.reduce((s, l) => s + Number(l.debit), 0);
    const sumC = entry!.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(Math.abs(sumD - sumC)).toBeLessThan(0.01); // V-1 partida doble

    const p = await prisma.payroll.findFirst({ where: { companyId, period } });
    expect(p?.journalEntryId).toBe(entry!.id);
  }, 90000);

  it('sin período contable abierto, processPayroll RECHAZA (I-PE-1)', async () => {
    // 2027-06 no tiene AccountingPeriod que lo cubra → createAutoEntry lanza y
    // la transacción entera revierte (no queda Payroll ni asiento parcial).
    await expect(
      payroll.processPayroll(companyId, { period: '2027-06' } as any, userId),
    ).rejects.toThrow();

    const orphan = await prisma.payroll.findFirst({ where: { companyId, period: '2027-06' } });
    expect(orphan).toBeNull();
  }, 90000);
});
