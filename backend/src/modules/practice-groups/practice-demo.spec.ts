import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { PracticeGroupsService } from './practice-groups.service';
import { ProcurementService } from '../procurement/procurement.service';

/**
 * DEMO + verificación E2E del comercio entre empresas de PRÁCTICA por grupo
 * (multiempresa en modo Contador). Gated por RUN_DEMO=1.
 *   RUN_DEMO=1 npx jest src/modules/practice-groups/practice-demo.spec.ts --runInBand
 * NO limpia: deja un grupo + 2 empresas de práctica con una compra facturada,
 * para verlo en el Espacio Contador.
 */
const RUN = process.env.RUN_DEMO === '1';
const d = RUN ? describe : describe.skip;

d('DEMO — multiempresa entre empresas de práctica', () => {
  jest.setTimeout(180000);
  let ref: TestingModule;
  let prisma: PrismaService;
  let companies: CompaniesService;
  let groups: PracticeGroupsService;
  let procurement: ProcurementService;

  const STU1 = 'c0000001-0000-4000-8000-000000000003'; // estudiante1 = comprador
  const STU2 = 'c0000001-0000-4000-8000-000000000004'; // estudiante2 = vendedor
  const CABYS = '8471000000000';

  beforeAll(async () => {
    ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma      = ref.get(PrismaService, { strict: false });
    companies   = ref.get(CompaniesService, { strict: false });
    groups      = ref.get(PracticeGroupsService, { strict: false });
    procurement = ref.get(ProcurementService, { strict: false });
  });
  afterAll(async () => { await ref?.close(); });

  const ensurePracticeCompany = async (studentId: string, name: string, legalId: string) => {
    let co = await prisma.company.findFirst({ where: { name, studentId, isPractice: true } });
    if (!co) {
      co = await companies.createPractice(studentId, {
        name, legalId, legalIdType: 'JURIDICA', economicActivity: 'Comercio',
      } as any); // createPractice siembra catálogo + período anual abierto
    }
    const prod = await prisma.product.findFirst({ where: { companyId: co.id, cabysCode: CABYS } });
    if (!prod) await prisma.product.create({
      data: {
        companyId: co.id, name: 'Laptop', cabysCode: CABYS,
        price: new Decimal('450000'), cost: new Decimal('400000'), taxRate: new Decimal('0.13'),
        stock: new Decimal('0'), unit: 'unidad', trackInventory: true, isService: false,
      },
    });
    return co;
  };

  it('grupo + orden de compra entre prácticas → efectos en el comprador', async () => {
    const buyer  = await ensurePracticeCompany(STU1, 'DEMO Contador El Sol',   '3-101-910001');
    const seller = await ensurePracticeCompany(STU2, 'DEMO Contador TecnoCR',  '3-101-910002');

    // Grupo (reusa si ya existe una membresía del comprador).
    let group = (await groups.listMine(STU1)).find((g: any) => (g.name || '').startsWith('DEMO Grupo'));
    if (!group) {
      group = await groups.createGroup(STU1, { name: 'DEMO Grupo Multiempresa', companyId: buyer.id });
    }
    // El vendedor se une (idempotente).
    await groups.joinGroup(STU2, { code: (group as any).code, companyId: seller.id });

    // Orden de compra por el grupo → recorrer hasta INVOICED.
    const o = await procurement.createOrder(
      { practiceGroupId: (group as any).id, buyerCompanyId: buyer.id, sellerCompanyId: seller.id,
        items: [{ description: 'Laptop', cabysCode: CABYS, quantity: 3, unitPrice: 400000 }], taxRate: 0.13, notes: 'Demo práctica' } as any,
      STU1,
    );
    await procurement.dispatch(o.id, STU2);
    await procurement.receive(o.id, STU1);
    await procurement.invoice(o.id, STU2);

    // Verificación de efectos en el COMPRADOR.
    const entry = await prisma.journalEntry.findFirst({
      where: { companyId: buyer.id, sourceType: 'purchase' }, include: { lines: true },
    });
    const ap = await prisma.accountPayable.findFirst({ where: { companyId: buyer.id } });
    const prod = await prisma.product.findFirst({ where: { companyId: buyer.id, cabysCode: CABYS } });

    expect(entry).toBeTruthy();
    const sD = entry!.lines.reduce((s, l) => s + Number(l.debit), 0);
    const sC = entry!.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(Math.abs(sD - sC)).toBeLessThan(0.01);
    expect(Number(ap?.balance)).toBeCloseTo(1356000, 0); // 3×400k×1.13
    expect(Number(prod?.stock)).toBeGreaterThanOrEqual(3);

    console.log('\n===== DEMO MULTIEMPRESA (PRÁCTICA) LISTA =====');
    console.log(`Grupo: ${(group as any).name}  código: ${(group as any).code}`);
    console.log(`Comprador (estudiante1): empresa ${buyer.name} (${buyer.id})`);
    console.log(`Vendedor  (estudiante2): empresa ${seller.name} (${seller.id})`);
    console.log(`Orden INVOICED: ${o.id}  | CxP=${ap?.balance} stock=${prod?.stock}`);
    console.log('==============================================\n');
  });
});
