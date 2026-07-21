import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { ClientsService } from '../clients/clients.service';
import { InvoicesService } from '../invoices/invoices.service';
import { CreditNotesService } from './credit-notes.service';

/**
 * E2E — la Nota de Crédito revierte la venta y cuadra el Diario. Gated RUN_E2E=1.
 *   RUN_E2E=1 npx jest src/modules/credit-notes/credit-notes-e2e.spec.ts --runInBand
 *
 * Emite una factura a crédito (D CxC / C Ventas / C IVA débito) y luego una NC
 * total, y verifica que el asiento de la NC sea el espejo balanceado
 * (D Ventas + D IVA débito = C CxC) y que el saldo de la factura baje a 0.
 */
const RUN = process.env.RUN_E2E === '1';
const d = RUN ? describe : describe.skip;

d('E2E — Nota de crédito revierte la venta', () => {
  jest.setTimeout(180000);
  let ref: TestingModule;
  let prisma: PrismaService;
  let companies: CompaniesService;
  let clients: ClientsService;
  let invoices: InvoicesService;
  let notes: CreditNotesService;

  const TEACHER = 'c0000001-0000-4000-8000-000000000002';
  const CABYS = '8471000000000';

  beforeAll(async () => {
    ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma    = ref.get(PrismaService, { strict: false });
    companies = ref.get(CompaniesService, { strict: false });
    clients   = ref.get(ClientsService, { strict: false });
    invoices  = ref.get(InvoicesService, { strict: false });
    notes     = ref.get(CreditNotesService, { strict: false });
  });
  afterAll(async () => { await ref?.close(); });

  it('factura a crédito + NC total → asiento reversa balanceado y saldo en 0', async () => {
    const year = new Date().getFullYear();

    let co = await prisma.company.findFirst({ where: { name: 'E2E NC Company', studentId: TEACHER, isPractice: true } });
    if (!co) {
      co = await companies.createPractice(TEACHER, {
        name: 'E2E NC Company', legalId: '3-101-930001', legalIdType: 'JURIDICA', economicActivity: 'Servicios',
      } as any);
    }
    let prod = await prisma.product.findFirst({ where: { companyId: co.id, cabysCode: CABYS } });
    if (!prod) {
      prod = await prisma.product.create({ data: {
        companyId: co.id, name: 'Servicio', cabysCode: CABYS, price: new Decimal('100000'),
        cost: new Decimal('0'), taxRate: new Decimal('0.13'), stock: new Decimal('0'),
        unit: 'Servicio', trackInventory: false, isService: true,
      } });
    }
    let cli = await prisma.client.findFirst({ where: { companyId: co.id } });
    if (!cli) cli = await clients.create(co.id, { name: 'Cliente NC', identification: '3101999999', idType: '02' } as any);

    // Factura a CRÉDITO: 100 000 + 13% = 113 000.
    const inv: any = await invoices.create(co.id, TEACHER, {
      clientId: cli.id, issueDate: `${year}-07-10`, saleCondition: 'CREDIT',
      lines: [{ productId: prod.id, description: 'Servicio', quantity: 1, unitPrice: 100000, taxRate: 13, cabysCode: CABYS, unit: 'Servicio' }],
    } as any);
    await invoices.issue(co.id, inv.id, TEACHER);
    const invIssued = await prisma.invoice.findUnique({ where: { id: inv.id }, select: { balanceDue: true, total: true } });

    // Nota de crédito TOTAL.
    const nc: any = await notes.createCreditNote(co.id, TEACHER, {
      invoiceId: inv.id, issueDate: `${year}-07-11`, reason: 'Devolución total', restoreInventory: false,
      lines: [{ productId: prod.id, description: 'Reversa de servicio', quantity: 1, unitPrice: 100000, taxRate: 13, cabysCode: CABYS, unit: 'Servicio' }],
    } as any);
    await notes.issueCreditNote(co.id, nc.id, TEACHER);

    // ── Verificación del asiento de la NC ──
    const entry = await prisma.journalEntry.findFirst({
      where: { companyId: co.id, sourceType: 'credit_note', sourceId: nc.id },
      include: { lines: { include: { account: true } } },
    });
    expect(entry).toBeTruthy();
    const sD = entry!.lines.reduce((s, l) => s + Number(l.debit), 0);
    const sC = entry!.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(Math.abs(sD - sC)).toBeLessThan(0.01);          // balanceado
    expect(Math.abs(sD - 113000)).toBeLessThan(0.01);      // reversa total = 113 000

    // Débitos = Ventas (100 000) + IVA débito (13 000); Crédito = CxC (113 000).
    const debits  = entry!.lines.filter((l) => Number(l.debit) > 0);
    const credits = entry!.lines.filter((l) => Number(l.credit) > 0);
    expect(credits.length).toBe(1);                         // una sola cuenta acreditada (CxC)
    expect(debits.length).toBe(2);                          // Ventas + IVA débito

    // El saldo de la factura origen baja a 0.
    const invFinal = await prisma.invoice.findUnique({ where: { id: inv.id }, select: { balanceDue: true } });
    expect(Number(invFinal!.balanceDue)).toBeCloseTo(0, 0);

    console.log('\n===== NC E2E OK =====');
    console.log(`Factura ${inv.id}: total ${invIssued?.total}, saldo tras emitir ${invIssued?.balanceDue} → tras NC ${invFinal?.balanceDue}`);
    console.log(`Asiento NC (D=${sD} C=${sC}):`);
    for (const l of entry!.lines) console.log(`  ${l.account?.code} ${l.account?.name}  D=${l.debit} C=${l.credit}`);
    console.log('=====================\n');
  });
});
