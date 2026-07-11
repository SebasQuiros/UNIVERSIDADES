import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { ProcurementService } from './procurement.service';

/**
 * SEED de demo (no es un test): arma una escena ERP entre 2 empresas del
 * ejercicio "Ejercicio 1" para poder VERLA en localhost. Gated por RUN_DEMO=1.
 *   RUN_DEMO=1 npx jest src/modules/procurement/demo-seed.spec.ts --runInBand
 * NO limpia: deja los datos para el recorrido guiado.
 */
const RUN = process.env.RUN_DEMO === '1';
const d = RUN ? describe : describe.skip;

d('DEMO — escena ERP entre 2 empresas', () => {
  jest.setTimeout(180000);
  let ref: TestingModule;
  let prisma: PrismaService;
  let accounts: AccountsService;
  let procurement: ProcurementService;

  const EX   = 'e0000001-0000-4000-8000-000000000001'; // Ejercicio 1
  const STU1 = 'c0000001-0000-4000-8000-000000000003'; // estudiante1 = COMPRADOR
  const STU2 = 'c0000001-0000-4000-8000-000000000004'; // estudiante2 = VENDEDOR
  const CABYS = '8471000000000';

  beforeAll(async () => {
    ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma      = ref.get(PrismaService, { strict: false });
    accounts    = ref.get(AccountsService, { strict: false });
    procurement = ref.get(ProcurementService, { strict: false });
  });
  afterAll(async () => { await ref?.close(); });

  const setupCompany = async (studentId: string, name: string, legalId: string) => {
    let att = await prisma.exerciseAttempt.findFirst({ where: { exerciseId: EX, studentId } });
    if (!att) att = await prisma.exerciseAttempt.create({
      data: { exerciseId: EX, studentId, status: 'IN_PROGRESS', maxScore: 100 },
    });
    let co = await prisma.company.findFirst({ where: { attemptId: att.id } });
    if (!co) co = await prisma.company.create({
      data: {
        name, studentId, attemptId: att.id, exerciseId: EX, mode: 'INDIVIDUAL',
        legalId, legalIdType: 'JURIDICA', economicActivity: 'Comercio', currency: 'CRC',
      },
    });
    await accounts.seedChartOfAccounts(co.id); // idempotente
    const per = await prisma.accountingPeriod.findFirst({ where: { companyId: co.id } });
    if (!per) await prisma.accountingPeriod.create({
      data: {
        companyId: co.id, name: 'Año 2026', type: 'ANNUAL',
        startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'OPEN',
      },
    });
    const prod = await prisma.product.findFirst({ where: { companyId: co.id, cabysCode: CABYS } });
    if (!prod) await prisma.product.create({
      data: {
        companyId: co.id, name: 'Laptop', cabysCode: CABYS,
        price: new Decimal('450000'), cost: new Decimal('400000'), taxRate: new Decimal('0.13'),
        stock: new Decimal('0'), unit: 'unidad', trackInventory: true, isService: false,
      },
    });
    return { company: co, attemptId: att.id };
  };

  it('siembra la escena y deja una orden en INVOICED + otra en PO_ISSUED', async () => {
    // 1. Config del ejercicio: modo ERP + automatización contable + inventario.
    await prisma.exerciseConfig.upsert({
      where:  { exerciseId: EX },
      update: {
        commercialMode: 'ERP_COMPLETO', autoInventory: true,
        autoTransactionsBetweenCompanies: true, autoJournal: true, autoAP: true, autoAR: true,
        companyMode: 'INDIVIDUAL',
      },
      create: {
        exerciseId: EX, commercialMode: 'ERP_COMPLETO', autoInventory: true,
        autoTransactionsBetweenCompanies: true, companyMode: 'INDIVIDUAL',
      },
    });

    // 2. Dos empresas del mismo ejercicio (comprador + vendedor).
    const buyer  = await setupCompany(STU1, 'DEMO Distribuidora El Sol', '3-101-900001');
    const seller = await setupCompany(STU2, 'DEMO TecnoImportes CR',     '3-101-900002');

    const itemsOf = (qty: number) => [{ description: 'Laptop', cabysCode: CABYS, quantity: qty, unitPrice: 400000 }];

    // 3. Orden #1: recorrer hasta INVOICED → efectos visibles en el COMPRADOR
    //    (inventario + CxP + asiento de compra).
    const o1 = await procurement.createOrder(
      { exerciseId: EX, buyerCompanyId: buyer.company.id, sellerCompanyId: seller.company.id, items: itemsOf(5), taxRate: 0.13, notes: 'Demo ERP #1' } as any,
      STU1,
    );
    await procurement.dispatch(o1.id, STU2);
    await procurement.receive(o1.id, STU1);
    await procurement.invoice(o1.id, STU2);

    // 4. Orden #2: fresca en PO_ISSUED para recorrer el flujo completo.
    const o2 = await procurement.createOrder(
      { exerciseId: EX, buyerCompanyId: buyer.company.id, sellerCompanyId: seller.company.id, items: itemsOf(2), taxRate: 0.13, notes: 'Demo ERP #2' } as any,
      STU1,
    );

    console.log('\n================ DEMO LISTA ================');
    console.log(`COMPRADOR (estudiante1) attempt: /estudiante/ejercicio/${buyer.attemptId}`);
    console.log(`VENDEDOR  (estudiante2) attempt: /estudiante/ejercicio/${seller.attemptId}`);
    console.log(`Orden #1 (INVOICED, lista para PAGAR por el comprador): ${o1.id}`);
    console.log(`Orden #2 (PO_ISSUED, para el flujo completo): ${o2.id}`);
    console.log('===========================================\n');

    expect(o1.id).toBeTruthy();
    expect(o2.id).toBeTruthy();
  });
});
