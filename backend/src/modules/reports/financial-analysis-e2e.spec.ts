import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { ClientsService } from '../clients/clients.service';
import { InvoicesService } from '../invoices/invoices.service';
import { ReportsService } from './reports.service';

/**
 * E2E — Estados y Análisis (ratios financieros). Gated RUN_E2E=1.
 *   RUN_E2E=1 npx jest src/modules/reports/financial-analysis-e2e.spec.ts --runInBand
 */
const RUN = process.env.RUN_E2E === '1';
const d = RUN ? describe : describe.skip;

d('E2E — Estados y Análisis (ratios)', () => {
  jest.setTimeout(120000);
  let ref: TestingModule;
  let prisma: PrismaService;
  let companies: CompaniesService;
  let clients: ClientsService;
  let invoices: InvoicesService;
  let reports: ReportsService;

  const TEACHER = 'c0000001-0000-4000-8000-000000000002';
  const CABYS = '8471000000000';

  beforeAll(async () => {
    ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma    = ref.get(PrismaService, { strict: false });
    companies = ref.get(CompaniesService, { strict: false });
    clients   = ref.get(ClientsService, { strict: false });
    invoices  = ref.get(InvoicesService, { strict: false });
    reports   = ref.get(ReportsService, { strict: false });
  });
  afterAll(async () => { await ref?.close(); });

  it('devuelve ratios coherentes tras una venta de contado', async () => {
    let co = await prisma.company.findFirst({ where: { name: 'E2E Ratios Company', studentId: TEACHER, isPractice: true } });
    if (!co) {
      co = await companies.createPractice(TEACHER, {
        name: 'E2E Ratios Company', legalId: '3-101-930005', legalIdType: 'JURIDICA', economicActivity: 'Servicios',
      } as any);
    }
    let prod = await prisma.product.findFirst({ where: { companyId: co.id, cabysCode: CABYS } });
    if (!prod) {
      prod = await prisma.product.create({ data: {
        companyId: co.id, name: 'Servicio Ratios', cabysCode: CABYS, price: new Decimal('200000'),
        cost: new Decimal('0'), taxRate: new Decimal('0.13'), stock: new Decimal('0'),
        unit: 'Servicio', trackInventory: false, isService: true,
      } });
    }
    let cli = await prisma.client.findFirst({ where: { companyId: co.id } });
    if (!cli) cli = await clients.create(co.id, { name: 'Cliente Ratios', identification: '3101999996', idType: '02' } as any);

    const year = new Date().getFullYear();
    const inv: any = await invoices.create(co.id, TEACHER, {
      clientId: cli.id, issueDate: `${year}-07-05`, saleCondition: 'CASH',
      lines: [{ productId: prod.id, description: 'Servicio', quantity: 1, unitPrice: 200000, taxRate: 13, cabysCode: CABYS, unit: 'Servicio' }],
    } as any);
    await invoices.issue(co.id, inv.id, TEACHER);

    const analysis: any = await reports.getFinancialAnalysis(co.id, {});

    // Balance cuadra: Activo = Pasivo + Patrimonio (implícito en balanceSheet ya
    // probado en otros specs) — acá validamos que el análisis derive bien de eso.
    const totalAssets = Number(analysis.balanceSheet.totalAssets);
    expect(totalAssets).toBeGreaterThan(0);
    expect(Number(analysis.incomeStatement.totalIncome)).toBeGreaterThanOrEqual(200000);
    expect(Number(analysis.incomeStatement.netIncome)).toBeGreaterThanOrEqual(200000);

    // Venta de contado → todo el activo es corriente (Caja), sin pasivo circulante
    // de esta operación → currentRatio debe ser un número válido o null (sin pasivo).
    expect(analysis.ratios).toBeDefined();
    expect(analysis.ratios.netMargin).not.toBeNull();
    expect(Number(analysis.ratios.netMargin)).toBeGreaterThan(0);
    expect(analysis.balanceSheet.distribution.currentAssetsPct).not.toBeNull();

    console.log('\n===== FINANCIAL ANALYSIS E2E OK =====');
    console.log(`Activo total: ${analysis.balanceSheet.totalAssets}, Ingresos: ${analysis.incomeStatement.totalIncome}, Utilidad neta: ${analysis.incomeStatement.netIncome}`);
    console.log(`Ratios: liquidez=${analysis.ratios.currentRatio} (${analysis.ratios.currentRatioTag}), endeudamiento=${analysis.ratios.debtRatio}% (${analysis.ratios.debtRatioTag}), margen neto=${analysis.ratios.netMargin}% (${analysis.ratios.netMarginTag}), ROE=${analysis.ratios.roe}%`);
    console.log(`Distribución activo: corriente=${analysis.balanceSheet.distribution.currentAssetsPct}% no-corriente=${analysis.balanceSheet.distribution.nonCurrentAssetsPct}%`);
    console.log('========================================\n');
  });
});
