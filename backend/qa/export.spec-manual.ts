/**
 * Exportacion a Excel y PDF de los estados financieros.
 *
 * Se reporto "no me deja exportar a excel". Esta prueba genera los archivos de
 * verdad contra una empresa con movimiento y comprueba que salgan buffers
 * validos, para separar un fallo del servidor de uno de la pantalla.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountsService } from '../src/modules/accounts/accounts.service';
import { ClientsService } from '../src/modules/clients/clients.service';
import { InvoicesService } from '../src/modules/invoices/invoices.service';
import { ReportsService } from '../src/modules/reports/reports.service';
import { ReportsExportService } from '../src/modules/reports/reports-export.service';

const MARCA = '__QA_EXP_';
const HOY = new Date().toISOString().slice(0, 10);

let ok = 0, fallos = 0;
const detalle: string[] = [];
function chequear(nombre: string, cond: boolean, extra = '') {
  if (cond) { ok++; console.log(`  ok   ${nombre}`); }
  else { fallos++; detalle.push(`${nombre}${extra ? ' -> ' + extra : ''}`); console.log(`  FALLA ${nombre}${extra ? ' -> ' + extra : ''}`); }
}

/** Un .xlsx es un ZIP: tiene que empezar por "PK". */
const esXlsx = (b: Buffer) => b.length > 1000 && b[0] === 0x50 && b[1] === 0x4b;
const esPdf  = (b: Buffer) => b.length > 500 && b.subarray(0, 4).toString() === '%PDF';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const reports = app.get(ReportsService);
  const exportSvc = app.get(ReportsExportService);

  let companyId = '', userId = '', uniId = '';

  try {
    const uni = await prisma.university.create({ data: { name: MARCA + 'Uni', shortName: 'QAX' } });
    uniId = uni.id;
    const alumno = await prisma.user.create({
      data: {
        name: MARCA + 'Alumno', email: `${MARCA}${Date.now()}@qa.local`.toLowerCase(),
        role: 'STUDENT', universityId: uni.id, isActive: true, emailVerified: true,
      },
    });
    userId = alumno.id;
    const empresa = await prisma.company.create({
      data: {
        name: MARCA + 'SA', legalId: '3101' + String(Date.now()).slice(-6),
        studentId: alumno.id, isPractice: true, mode: 'INDIVIDUAL',
      },
    });
    companyId = empresa.id;
    await app.get(AccountsService).seedChartOfAccounts(companyId);

    const cli: any = await app.get(ClientsService).create(companyId, {
      name: MARCA + 'Cliente', identification: '304560788', idType: '01',
    } as any);
    const inv: any = await app.get(InvoicesService).create(companyId, userId, {
      clientId: cli.id, issueDate: HOY, saleCondition: 'CASH',
      lines: [{ description: 'Servicio', quantity: 1, unitPrice: 250_000, taxRate: 13, cabysCode: '2310100000000' }],
    } as any);
    await app.get(InvoicesService).issue(companyId, inv.id, userId);

    console.log('--- 1. Datos que alimentan la exportacion ---');
    const balance: any = await reports.getBalanceSheet(companyId, {} as any);
    const resultados: any = await reports.getIncomeStatement(companyId, {} as any);
    chequear('el balance trae company.name', !!balance?.company?.name, JSON.stringify(Object.keys(balance?.company ?? {})));
    chequear('el balance trae la clasificacion', !!balance?.classified);
    chequear('resultados trae los bloques', Array.isArray(resultados?.structured?.bloques));

    console.log('\n--- 2. Excel ---');
    const bsX: Buffer = await exportSvc.generateBalanceSheetExcel(balance, balance.company.name);
    chequear('balance a Excel', esXlsx(bsX), `${bsX?.length ?? 0} bytes`);
    const isX: Buffer = await exportSvc.generateIncomeStatementExcel(resultados, resultados.company.name);
    chequear('resultados a Excel', esXlsx(isX), `${isX?.length ?? 0} bytes`);

    const balanza: any = await reports.getTrialBalance(companyId, {} as any);
    const tbX: Buffer = await exportSvc.generateTrialBalanceExcel(balanza, balanza.company.name);
    chequear('balanza a Excel', esXlsx(tbX), `${tbX?.length ?? 0} bytes`);

    const diario: any = await reports.getJournalBook(companyId, {} as any);
    const jbX: Buffer = await exportSvc.generateJournalBookExcel(diario, diario.company?.name ?? 'QA');
    chequear('libro diario a Excel', esXlsx(jbX), `${jbX?.length ?? 0} bytes`);

    console.log('\n--- 3. PDF ---');
    const metodos = Object.getOwnPropertyNames(Object.getPrototypeOf(exportSvc))
      .filter((m) => /pdf/i.test(m));
    console.log('    metodos PDF disponibles:', metodos.join(', '));
    for (const m of metodos) {
      try {
        const buf: Buffer = await (exportSvc as any)[m](
          m.toLowerCase().includes('income') ? resultados
            : m.toLowerCase().includes('trial') ? balanza
            : m.toLowerCase().includes('journal') ? diario
            : balance,
          balance.company.name,
        );
        chequear(`${m}`, esPdf(buf), `${buf?.length ?? 0} bytes`);
      } catch (e) {
        chequear(`${m}`, false, (e as Error).message.slice(0, 120));
      }
    }

    console.log('\n--- 4. Comparativo (lo que ahora pide la pantalla) ---');
    const bsComp: any = await reports.getBalanceSheetComparativo(companyId, {} as any);
    chequear('balance comparativo responde', !!bsComp?.classified);
    chequear('trae etiquetas de los dos años', !!bsComp?.comparativo?.etiquetaAnterior,
      JSON.stringify(bsComp?.comparativo ?? {}));
    const isComp: any = await reports.getIncomeStatementComparativo(companyId, {} as any);
    chequear('resultados comparativo responde', Array.isArray(isComp?.structured?.bloques));
    // El comparativo NO debe romper la exportacion: la pantalla muestra uno y
    // exporta el otro, y ambos vienen del mismo calculo.
    const bsX2: Buffer = await exportSvc.generateBalanceSheetExcel(bsComp, bsComp.company.name);
    chequear('el comparativo tambien exporta a Excel', esXlsx(bsX2), `${bsX2?.length ?? 0} bytes`);
  } finally {
    const p = app.get(PrismaService);
    const borra = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* */ } };
    if (companyId) {
      await borra(() => p.journalLine.deleteMany({ where: { entry: { companyId } } }));
      await borra(() => p.journalEntry.deleteMany({ where: { companyId } }));
      await borra(() => p.accountReceivable.deleteMany({ where: { companyId } }));
      await borra(() => (p as any).invoiceItem.deleteMany({ where: { invoice: { companyId } } }));
      await borra(() => p.invoice.deleteMany({ where: { companyId } }));
      await borra(() => p.client.deleteMany({ where: { companyId } }));
      await borra(() => p.account.deleteMany({ where: { companyId } }));
      await borra(() => p.company.deleteMany({ where: { id: companyId } }));
    }
    if (userId) {
      await borra(() => (p as any).activityLog.deleteMany({ where: { userId } }));
      await borra(() => p.user.delete({ where: { id: userId } }));
    }
    if (uniId) await borra(() => p.university.delete({ where: { id: uniId } }));
    await app.close();
  }

  console.log(`\n================ RESULTADO: ${ok} ok / ${fallos} fallos ================`);
  if (fallos) { console.log('FALLOS:'); detalle.forEach((d) => console.log('  - ' + d)); }
  process.exit(fallos ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
