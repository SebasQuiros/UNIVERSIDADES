import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { CompaniesService } from './companies.service';
import { ClientsService } from '../clients/clients.service';
import { InvoicesService } from '../invoices/invoices.service';

/**
 * DEMO — siembra una empresa de PRÁCTICA poblada para la cuenta del PROFESOR,
 * para que en el Espacio Contador vea el sistema con datos reales (Diario, CxC,
 * IVA débito, Reportes). Gated por RUN_DEMO=1. Reusa los servicios reales
 * (createPractice siembra catálogo + período anual abierto).
 *
 *   RUN_DEMO=1 npx jest src/modules/companies/profesor-demo.spec.ts --runInBand
 *
 * Idempotente: si la empresa/cliente ya existen, no los duplica.
 */
const RUN = process.env.RUN_DEMO === '1';
const d = RUN ? describe : describe.skip;

d('DEMO — empresa de práctica poblada para el PROFESOR', () => {
  jest.setTimeout(180000);
  let ref: TestingModule;
  let prisma: PrismaService;
  let companies: CompaniesService;
  let clients: ClientsService;
  let invoices: InvoicesService;

  const TEACHER = 'c0000001-0000-4000-8000-000000000002'; // Prof. Ana Bermúdez Solano
  const CABYS = '8471000000000';

  beforeAll(async () => {
    ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma    = ref.get(PrismaService, { strict: false });
    companies = ref.get(CompaniesService, { strict: false });
    clients   = ref.get(ClientsService, { strict: false });
    invoices  = ref.get(InvoicesService, { strict: false });
  });
  afterAll(async () => { await ref?.close(); });

  it('empresa de práctica + cliente + producto + facturas emitidas', async () => {
    const year = new Date().getFullYear();

    // 1) Empresa de práctica (createPractice siembra catálogo + período anual abierto).
    let co = await prisma.company.findFirst({
      where: { name: 'DEMO Contadores Bermúdez', studentId: TEACHER, isPractice: true },
    });
    if (!co) {
      co = await companies.createPractice(TEACHER, {
        name: 'DEMO Contadores Bermúdez', legalId: '3-101-920001',
        legalIdType: 'JURIDICA', economicActivity: 'Servicios contables',
      } as any);
    }

    // 2) Producto (para la vista de Ítems/Productos).
    let prod = await prisma.product.findFirst({ where: { companyId: co.id, cabysCode: CABYS } });
    if (!prod) {
      prod = await prisma.product.create({ data: {
        companyId: co.id, name: 'Servicio de consultoría contable', cabysCode: CABYS,
        price: new Decimal('120000'), cost: new Decimal('0'), taxRate: new Decimal('0.13'),
        stock: new Decimal('0'), unit: 'Servicio', trackInventory: false, isService: true,
      }});
    }

    // 3) Cliente.
    let cli = await prisma.client.findFirst({ where: { companyId: co.id } });
    if (!cli) {
      cli = await clients.create(co.id, {
        name: 'Comercial La Sabana S.A.', identification: '3101456789',
        idType: '02', email: 'pagos@lasabana.cr',
      } as any);
    }

    // 4) Factura a CRÉDITO → CxC + IVA débito + ingreso.
    const inv1: any = await invoices.create(co.id, TEACHER, {
      clientId: cli.id, issueDate: `${year}-07-01`, saleCondition: 'CREDIT',
      lines: [{ productId: prod.id, description: 'Consultoría contable mensual',
        quantity: 2, unitPrice: 120000, taxRate: 13, cabysCode: CABYS, unit: 'Servicio' }],
    } as any);
    await invoices.issue(co.id, inv1.id, TEACHER);

    // 5) Factura de CONTADO → Caja + IVA débito + ingreso.
    const inv2: any = await invoices.create(co.id, TEACHER, {
      clientId: cli.id, issueDate: `${year}-07-05`, saleCondition: 'CASH',
      lines: [{ productId: prod.id, description: 'Asesoría puntual',
        quantity: 1, unitPrice: 85000, taxRate: 13, cabysCode: CABYS, unit: 'Servicio' }],
    } as any);
    await invoices.issue(co.id, inv2.id, TEACHER);

    // Verificación mínima: hay asientos confirmados y están balanceados.
    const entries = await prisma.journalEntry.findMany({
      where: { companyId: co.id, status: 'CONFIRMED' }, include: { lines: true },
    });
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const e of entries) {
      const sD = e.lines.reduce((s, l) => s + Number(l.debit), 0);
      const sC = e.lines.reduce((s, l) => s + Number(l.credit), 0);
      expect(Math.abs(sD - sC)).toBeLessThan(0.01);
    }

    let arBalance: any = 0;
    try {
      const ar = await (prisma as any).accountReceivable?.findFirst({ where: { companyId: co.id } });
      arBalance = ar?.balance ?? 0;
    } catch { /* nombre de modelo distinto — no crítico para el demo */ }

    console.log('\n===== DEMO PROFESOR (empresa de práctica poblada) LISTA =====');
    console.log(`Empresa: ${co.name} (${co.id})  dueño=Prof. Ana Bermúdez (${TEACHER})`);
    console.log(`Cliente: ${cli.name}  Producto: ${prod.name}`);
    console.log(`Facturas emitidas: ${inv1.id} (crédito), ${inv2.id} (contado)`);
    console.log(`Asientos CONFIRMED: ${entries.length}  CxC saldo=${arBalance}`);
    console.log('=============================================================\n');
  });
});
