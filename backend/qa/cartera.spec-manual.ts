/**
 * Análisis de cartera y estimación de cuentas incobrables.
 *
 * Se reportó que "la estimación de análisis de cartera no funciona". Esta
 * prueba la ejercita de verdad, por los dos métodos, y además comprueba lo
 * que el reporte no puede comprobar solo: que el asiento sugerido apunte a
 * cuentas que EXISTAN en el catálogo. Un asiento sugerido contra una cuenta
 * inexistente se ve bien en pantalla y revienta al registrarlo.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountsService } from '../src/modules/accounts/accounts.service';
import { ClientsService } from '../src/modules/clients/clients.service';
import { InvoicesService } from '../src/modules/invoices/invoices.service';
import { AccountsReceivableService } from '../src/modules/accounts-receivable/accounts-receivable.service';

const MARCA = '__QA_CART_';
const HOY = new Date().toISOString().slice(0, 10);

let ok = 0, fallos = 0;
const detalle: string[] = [];
function chequear(nombre: string, cond: boolean, extra = '') {
  if (cond) { ok++; console.log(`  ok   ${nombre}`); }
  else { fallos++; detalle.push(`${nombre}${extra ? ' -> ' + extra : ''}`); console.log(`  FALLA ${nombre}${extra ? ' -> ' + extra : ''}`); }
}
const n = (v: any) => Number(v ?? 0);
const igual = (a: any, b: any, tol = 1) => Math.abs(n(a) - n(b)) <= tol;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const ar = app.get(AccountsReceivableService);

  let companyId = '', userId = '', uniId = '';

  try {
    const uni = await prisma.university.create({ data: { name: MARCA + 'Uni', shortName: 'QAC2' } });
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
      name: MARCA + 'Cliente', identification: '304998877', idType: '01', creditDays: 30,
    } as any);
    const inv: any = await app.get(InvoicesService).create(companyId, userId, {
      clientId: cli.id, issueDate: HOY, saleCondition: 'CREDIT', creditDays: 30,
      lines: [{ description: 'Venta a crédito', quantity: 1, unitPrice: 1_000_000, taxRate: 13, cabysCode: '2310100000000' }],
    } as any);
    await app.get(InvoicesService).issue(companyId, inv.id, userId);

    console.log('--- 1. Antigüedad de saldos ---');
    const aging: any = await ar.getAgingReport(companyId);
    chequear('el reporte responde', !!aging?.totals);
    chequear('trae los cuatro tramos estándar',
      ['b0_30', 'b31_60', 'b61_90', 'b91_plus'].every((k) => aging.totals[k] !== undefined),
      Object.keys(aging.totals ?? {}).join(', '));
    chequear('la factura a crédito aparece en la cartera', n(aging.totals.total) > 0,
      String(aging.totals.total));

    console.log('\n--- 2. Estimación por porcentaje de ventas ---');
    const porVentas: any = await ar.estimateAllowance(companyId, {
      method: 'PERCENTAGE_OF_SALES', salesPct: 2,
    });
    chequear('responde', !!porVentas);
    chequear('el monto es un número, no NaN', Number.isFinite(n(porVentas.estimated)),
      String(porVentas.estimated));
    chequear('2% de 1.130.000 = 22.600', igual(porVentas.estimated, 22_600),
      `ventas=${porVentas.sales} estimado=${porVentas.estimated}`);

    console.log('\n--- 3. Estimación por antigüedad ---');
    const porAnt: any = await ar.estimateAllowance(companyId, {
      method: 'PERCENTAGE_OF_AGING',
      agingPcts: { b0_30: 1, b31_60: 5, b61_90: 15, b91_plus: 40 },
    });
    chequear('responde', !!porAnt);
    chequear('el monto es un número, no NaN', Number.isFinite(n(porAnt.estimated)),
      String(porAnt.estimated));
    chequear('el desglose no tiene NaN',
      Object.values(porAnt.breakdown ?? {}).every((v) => Number.isFinite(Number(v))),
      JSON.stringify(porAnt.breakdown));
    chequear('1% del tramo 0-30 sobre 1.130.000 = 11.300', igual(porAnt.estimated, 11_300),
      JSON.stringify(porAnt.buckets));

    console.log('\n--- 4. El asiento sugerido tiene que ser REGISTRABLE ---');
    for (const [etiqueta, res] of [['por ventas', porVentas], ['por antigüedad', porAnt]] as const) {
      const lineas = res.suggestedJournal?.lines ?? [];
      chequear(`${etiqueta}: el asiento trae dos líneas`, lineas.length === 2, String(lineas.length));
      for (const l of lineas) {
        const cuenta = await prisma.account.findFirst({
          where: { companyId, code: l.accountCode }, select: { code: true, level: true, name: true },
        });
        chequear(`${etiqueta}: la cuenta ${l.accountCode} existe en el catálogo`, !!cuenta,
          'el estudiante no podría registrar el asiento');
        if (cuenta) {
          chequear(`${etiqueta}: ${l.accountCode} es de movimiento (nivel 4)`, cuenta.level === 4,
            `nivel ${cuenta.level}`);
        }
      }
      const d = lineas.filter((l: any) => l.side === 'DEBIT').reduce((s: number, l: any) => s + n(l.amount), 0);
      const h = lineas.filter((l: any) => l.side === 'CREDIT').reduce((s: number, l: any) => s + n(l.amount), 0);
      chequear(`${etiqueta}: el asiento sugerido cuadra`, igual(d, h), `${d} vs ${h}`);
    }

    console.log('\n--- 5. Casos borde ---');
    const cero: any = await ar.estimateAllowance(companyId, { method: 'PERCENTAGE_OF_SALES', salesPct: 0 });
    chequear('0% estima cero', igual(cero.estimated, 0), String(cero.estimated));
    chequear('con cero no sugiere asiento', (cero.suggestedJournal?.lines ?? []).length === 0);

    const tope: any = await ar.estimateAllowance(companyId, { method: 'PERCENTAGE_OF_SALES', salesPct: 250 });
    chequear('un porcentaje absurdo se acota a 100', igual(tope.salesPct, 100), String(tope.salesPct));
  } finally {
    const p = app.get(PrismaService);
    const borra = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* */ } };
    if (companyId) {
      for (const f of [
        () => p.journalLine.deleteMany({ where: { entry: { companyId } } }),
        () => p.journalEntry.deleteMany({ where: { companyId } }),
        () => p.accountReceivable.deleteMany({ where: { companyId } }),
        () => (p as any).invoiceItem.deleteMany({ where: { invoice: { companyId } } }),
        () => p.invoice.deleteMany({ where: { companyId } }),
        () => p.client.deleteMany({ where: { companyId } }),
        () => p.account.deleteMany({ where: { companyId } }),
        () => p.company.deleteMany({ where: { id: companyId } }),
      ]) await borra(f);
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
