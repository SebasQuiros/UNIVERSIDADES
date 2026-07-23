import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { ClientsService } from '../clients/clients.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { QuotesService } from './quotes.service';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';
import { InventoryAdjustmentsService } from '../inventory-adjustments/inventory-adjustments.service';

/**
 * E2E — Cotizaciones → convertir a factura, Órdenes de compra → recibir
 * (inventario), Ajustes de inventario → asiento contable. Gated RUN_E2E=1.
 *   RUN_E2E=1 npx jest src/modules/quotes/quotes-po-adjustments-e2e.spec.ts --runInBand
 */
const RUN = process.env.RUN_E2E === '1';
const d = RUN ? describe : describe.skip;

d('E2E — Cotizaciones, Órdenes de compra, Ajustes de inventario', () => {
  jest.setTimeout(180000);
  let ref: TestingModule;
  let prisma: PrismaService;
  let companies: CompaniesService;
  let clients: ClientsService;
  let suppliers: SuppliersService;
  let quotes: QuotesService;
  let pos: PurchaseOrdersService;
  let adjustments: InventoryAdjustmentsService;

  const TEACHER = 'c0000001-0000-4000-8000-000000000002';
  const CABYS = '8471000000000';

  beforeAll(async () => {
    ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma      = ref.get(PrismaService, { strict: false });
    companies   = ref.get(CompaniesService, { strict: false });
    clients     = ref.get(ClientsService, { strict: false });
    suppliers   = ref.get(SuppliersService, { strict: false });
    quotes      = ref.get(QuotesService, { strict: false });
    pos         = ref.get(PurchaseOrdersService, { strict: false });
    adjustments = ref.get(InventoryAdjustmentsService, { strict: false });
  });
  afterAll(async () => { await ref?.close(); });

  it('cotización DRAFT→SENT→convert crea una factura real en DRAFT', async () => {
    const year = new Date().getFullYear();

    let co = await prisma.company.findFirst({ where: { name: 'E2E Quotes Company', studentId: TEACHER, isPractice: true } });
    if (!co) {
      co = await companies.createPractice(TEACHER, {
        name: 'E2E Quotes Company', legalId: '3-101-930002', legalIdType: 'JURIDICA', economicActivity: 'Servicios',
      } as any);
    }
    let prod = await prisma.product.findFirst({ where: { companyId: co.id, cabysCode: CABYS } });
    if (!prod) {
      prod = await prisma.product.create({ data: {
        companyId: co.id, name: 'Servicio', cabysCode: CABYS, price: new Decimal('50000'),
        cost: new Decimal('0'), taxRate: new Decimal('0.13'), stock: new Decimal('0'),
        unit: 'Servicio', trackInventory: false, isService: true,
      } });
    }
    let cli = await prisma.client.findFirst({ where: { companyId: co.id } });
    if (!cli) cli = await clients.create(co.id, { name: 'Cliente Cotización', identification: '3101999998', idType: '02' } as any);

    const q: any = await quotes.create(co.id, TEACHER, {
      clientId: cli.id, issueDate: `${year}-07-01`, validUntil: `${year}-07-15`,
      lines: [{ productId: prod.id, description: 'Servicio cotizado', quantity: 1, unitPrice: 50000, taxRate: 13, cabysCode: CABYS, unit: 'Servicio' }],
    } as any);
    expect(q.status).toBe('DRAFT');

    await quotes.send(co.id, q.id);
    const converted: any = await quotes.convert(co.id, q.id, TEACHER);

    const qFinal = await prisma.quote.findUnique({ where: { id: q.id } });
    expect(qFinal?.status).toBe('CONVERTED');
    expect(qFinal?.convertedInvoiceId).toBeTruthy();

    const invoice = await prisma.invoice.findUnique({ where: { id: qFinal!.convertedInvoiceId! } });
    expect(invoice).toBeTruthy();
    expect(invoice?.status).toBe('DRAFT');
    expect(Number(invoice?.total)).toBeCloseTo(56500, 0); // 50000 + 13%

    console.log('\n===== QUOTE E2E OK =====');
    console.log(`Cotización ${q.id} → factura ${qFinal?.convertedInvoiceId} (DRAFT, total ${invoice?.total})`);
    console.log('=========================\n');
  });

  it('orden de compra DRAFT→ISSUED→receive suma stock (sin asiento) ', async () => {
    let co = await prisma.company.findFirst({ where: { name: 'E2E PO Company', studentId: TEACHER, isPractice: true } });
    if (!co) {
      co = await companies.createPractice(TEACHER, {
        name: 'E2E PO Company', legalId: '3-101-930003', legalIdType: 'JURIDICA', economicActivity: 'Comercio',
      } as any);
    }
    let prod = await prisma.product.findFirst({ where: { companyId: co.id, name: 'Producto PO' } });
    if (!prod) {
      prod = await prisma.product.create({ data: {
        companyId: co.id, name: 'Producto PO', cabysCode: CABYS, price: new Decimal('10000'),
        cost: new Decimal('6000'), taxRate: new Decimal('0.13'), stock: new Decimal('0'),
        unit: 'Unidad', trackInventory: true, isService: false,
      } });
    }
    let sup = await prisma.supplier.findFirst({ where: { companyId: co.id } });
    if (!sup) sup = await suppliers.create(co.id, { name: 'Proveedor E2E', identification: '3101999997', idType: '02' } as any);

    const stockBefore = Number((await prisma.product.findUnique({ where: { id: prod.id } }))!.stock);

    const po: any = await pos.create(co.id, TEACHER, {
      supplierId: sup.id, issueDate: new Date().toISOString().slice(0, 10),
      lines: [{ productId: prod.id, description: 'Producto PO', quantity: 10, unitCost: 6000, taxRate: 13 }],
    } as any);
    await pos.issue(co.id, po.id);
    await pos.receive(co.id, po.id, TEACHER);

    const poFinal = await prisma.purchaseOrder.findUnique({ where: { id: po.id } });
    expect(poFinal?.status).toBe('RECEIVED');

    const stockAfter = Number((await prisma.product.findUnique({ where: { id: prod.id } }))!.stock);
    expect(stockAfter - stockBefore).toBeCloseTo(10, 2);

    // Recibir NO debe generar asiento (movimiento físico solamente).
    const entry = await prisma.journalEntry.findFirst({ where: { companyId: co.id, sourceType: 'purchase_order', sourceId: po.id } });
    expect(entry).toBeNull();

    console.log('\n===== PURCHASE ORDER E2E OK =====');
    console.log(`Orden ${po.id}: stock ${stockBefore} → ${stockAfter} (sin asiento, correcto)`);
    console.log('==================================\n');
  });

  it('ajuste de inventario DECREASE consume FIFO y postea asiento balanceado', async () => {
    let co = await prisma.company.findFirst({ where: { name: 'E2E Adjustments Company', studentId: TEACHER, isPractice: true } });
    if (!co) {
      co = await companies.createPractice(TEACHER, {
        name: 'E2E Adjustments Company', legalId: '3-101-930004', legalIdType: 'JURIDICA', economicActivity: 'Comercio',
      } as any);
    }
    let prod = await prisma.product.findFirst({ where: { companyId: co.id, name: 'Producto Ajuste' } });
    if (!prod) {
      prod = await prisma.product.create({ data: {
        companyId: co.id, name: 'Producto Ajuste', cabysCode: CABYS, price: new Decimal('10000'),
        cost: new Decimal('5000'), taxRate: new Decimal('0.13'), stock: new Decimal('0'),
        unit: 'Unidad', trackInventory: true, isService: false,
      } });
    }

    // Entrada previa (INCREASE) para tener lotes FIFO de dónde consumir.
    await adjustments.create(co.id, TEACHER, {
      productId: prod.id, type: 'INCREASE', quantity: 20, unitCost: 5000, reason: 'Carga inicial E2E',
    } as any);

    const adj: any = await adjustments.create(co.id, TEACHER, {
      productId: prod.id, type: 'DECREASE', quantity: 5, reason: 'Merma por daño E2E',
    } as any);

    const entry = await prisma.journalEntry.findFirst({
      where: { companyId: co.id, sourceType: 'inventory_adjustment', sourceId: adj.id },
      include: { lines: true },
    });
    expect(entry).toBeTruthy();
    const sD = entry!.lines.reduce((s, l) => s + Number(l.debit), 0);
    const sC = entry!.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(Math.abs(sD - sC)).toBeLessThan(0.01);
    expect(sD).toBeCloseTo(25000, 0); // 5 unidades * 5000 costo FIFO

    console.log('\n===== INVENTORY ADJUSTMENT E2E OK =====');
    console.log(`Ajuste ${adj.id}: asiento D=${sD} C=${sC} (balanceado)`);
    console.log('=========================================\n');
  });
});
