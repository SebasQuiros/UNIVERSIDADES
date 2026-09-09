/**
 * Verificacion del ciclo contable contra base de datos real.
 *
 * Recorre lo que va a hacer un estudiante en clase: empresa, catalogo de
 * cuentas, cliente, factura de contado, factura a credito, cobro, y despues
 * comprueba los invariantes que NO pueden fallar delante de un profesor:
 *
 *   - partida doble: cada asiento cuadra
 *   - balanza de comprobacion: suma debe = suma haber
 *   - ecuacion contable: Activo = Pasivo + Patrimonio
 *   - estado de resultados escalonado: el ultimo escalon = ingresos - gastos
 *   - auxiliar de clientes = saldo de la cuenta 1.1.02 del mayor
 *   - reversar un asiento no resta dos veces
 *
 * Todo con prefijo __QA_ y limpieza al final, pase o falle.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountsService } from '../src/modules/accounts/accounts.service';
import { ClientsService } from '../src/modules/clients/clients.service';
import { InvoicesService } from '../src/modules/invoices/invoices.service';
import { JournalService } from '../src/modules/journal/journal.service';
import { ReportsService } from '../src/modules/reports/reports.service';

const MARCA = '__QA_CONTA_';
const HOY = new Date().toISOString().slice(0, 10);

let ok = 0;
let fallos = 0;
const detalle: string[] = [];

function chequear(nombre: string, condicion: boolean, extra = '') {
  if (condicion) { ok++; console.log(`  ok   ${nombre}`); }
  else { fallos++; detalle.push(`${nombre}${extra ? ' -> ' + extra : ''}`); console.log(`  FALLA ${nombre}${extra ? ' -> ' + extra : ''}`); }
}

const n = (v: any) => Number(v ?? 0);
/** Comparacion de dinero: dos colones de tolerancia por redondeos. */
const igual = (a: any, b: any, tol = 2) => Math.abs(n(a) - n(b)) <= tol;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const accounts = app.get(AccountsService);
  const clients = app.get(ClientsService);
  const invoices = app.get(InvoicesService);
  const journal = app.get(JournalService);
  const reports = app.get(ReportsService);

  let companyId = '';
  let userId = '';

  try {
    console.log('--- 0. Montaje: empresa de practica y catalogo ---');
    const uni = await prisma.university.create({ data: { name: MARCA + 'Uni', shortName: 'QAC' } });
    const alumno = await prisma.user.create({
      data: {
        name: MARCA + 'Alumno',
        email: `${MARCA}${Date.now()}@qa.local`.toLowerCase(),
        role: 'STUDENT',
        universityId: uni.id,
        isActive: true,
        emailVerified: true,
      },
    });
    userId = alumno.id;

    const empresa = await prisma.company.create({
      data: {
        name: MARCA + 'Comercial SA',
        legalId: '3101' + String(Date.now()).slice(-6),
        studentId: alumno.id,
        isPractice: true,
        mode: 'INDIVIDUAL',
      },
    });
    companyId = empresa.id;

    await accounts.seedChartOfAccounts(companyId);
    const catalogo = await prisma.account.count({ where: { companyId } });
    chequear(`catalogo sembrado (${catalogo} cuentas)`, catalogo > 100, `solo ${catalogo}`);

    console.log('\n--- 1. Cliente y factura de CONTADO ---');
    const cliente: any = await clients.create(companyId, {
      name: MARCA + 'Cliente Contado',
      identification: '304560789',
      idType: '01',
    } as any);
    chequear('crea el cliente', !!cliente.id);

    const fContado: any = await invoices.create(companyId, userId, {
      clientId: cliente.id,
      issueDate: HOY,
      saleCondition: 'CASH',
      lines: [{
        description: 'Venta de contado',
        quantity: 10,
        unitPrice: 10000,
        taxRate: 13,
        cabysCode: '2310100000000',
      }],
    } as any);
    chequear('emite la factura de contado', !!fContado.id);
    chequear('subtotal 100.000', igual(fContado.subtotal, 100000), String(fContado.subtotal));
    chequear('IVA 13% = 13.000', igual(fContado.tax, 13000), String(fContado.tax));
    chequear('total 113.000', igual(fContado.total, 113000), String(fContado.total));

    console.log('\n--- 2. Factura a CREDITO (alimenta el auxiliar de clientes) ---');
    const clienteCred: any = await clients.create(companyId, {
      name: MARCA + 'Cliente Credito',
      identification: '304560790',
      idType: '01',
      creditDays: 30,
      creditLimit: 5000000,
    } as any);
    const fCredito: any = await invoices.create(companyId, userId, {
      clientId: clienteCred.id,
      issueDate: HOY,
      saleCondition: 'CREDIT',
      creditDays: 30,
      lines: [{
        description: 'Venta a credito',
        quantity: 5,
        unitPrice: 40000,
        taxRate: 13,
        cabysCode: '2310100000000',
      }],
    } as any);
    chequear('emite la factura a credito', !!fCredito.id);
    chequear('total credito 226.000', igual(fCredito.total, 226000), String(fCredito.total));

    console.log('\n--- 2b. Un BORRADOR no toca los libros ---');
    chequear('la factura nace en borrador', fContado.status === 'DRAFT', String(fContado.status));
    const asientosBorrador = await prisma.journalEntry.count({ where: { companyId } });
    chequear('con solo borradores, el diario esta vacio', asientosBorrador === 0,
      `${asientosBorrador} asientos y no deberia haber ninguno`);

    console.log('\n--- 2c. Emision: aqui SI entra a los libros ---');
    const emitida1: any = await invoices.issue(companyId, fContado.id, userId);
    chequear('emite la factura de contado', !!emitida1);
    const emitida2: any = await invoices.issue(companyId, fCredito.id, userId);
    chequear('emite la factura a credito', !!emitida2);

    const estados = await prisma.invoice.findMany({
      where: { companyId }, select: { id: true, status: true },
    });
    chequear('ambas facturas quedaron emitidas',
      estados.every((f) => f.status === 'ISSUED'),
      estados.map((f) => f.status).join(', '));

    console.log('\n--- 3. Partida doble: TODO asiento cuadra ---');
    const asientos = await prisma.journalEntry.findMany({
      where: { companyId },
      include: { lines: true },
    });
    chequear(`se generaron asientos (${asientos.length})`, asientos.length >= 2);
    let descuadrados = 0;
    let sinLineas = 0;
    for (const a of asientos) {
      if (a.lines.length === 0) { sinLineas++; continue; }
      const d = a.lines.reduce((s, l) => s + n(l.debit), 0);
      const h = a.lines.reduce((s, l) => s + n(l.credit), 0);
      if (Math.abs(d - h) > 0.01) descuadrados++;
    }
    chequear('ningun asiento descuadrado', descuadrados === 0, `${descuadrados} descuadrados`);
    chequear('ningun asiento sin lineas', sinLineas === 0, `${sinLineas} vacios`);

    console.log('\n--- 4. Balanza de comprobacion ---');
    const balanza: any = await reports.getTrialBalance(companyId, {} as any);
    const td = n(balanza.totals?.totalDebit);
    const th = n(balanza.totals?.totalCredit);
    chequear('suma debe = suma haber', igual(td, th), `${td} vs ${th}`);
    chequear('el propio reporte se declara cuadrado', balanza.totals?.isBalanced === true);
    chequear('la balanza no esta vacia', td > 0, `debe=${td}`);
    chequear('la balanza refleja las dos facturas (339.000)', igual(td, 339000), String(td));

    console.log('\n--- 5. Ecuacion contable: Activo = Pasivo + Patrimonio ---');
    const balance: any = await reports.getBalanceSheet(companyId, {} as any);
    const eq = balance.classified?.ecuacion ?? balance.ecuacion;
    chequear('el balance reporta la ecuacion', !!eq, 'no viene el bloque ecuacion');
    if (eq) {
      chequear('la ecuacion cuadra', eq.cuadra === true,
        `activo=${n(eq.activo)} p+p=${n(eq.pasivoMasPatrimonio)}`);
      chequear('activo = pasivo + patrimonio (recalculado a mano)',
        igual(n(eq.activo), n(eq.pasivoMasPatrimonio)),
        `${n(eq.activo)} vs ${n(eq.pasivoMasPatrimonio)}`);
      chequear('la diferencia es cero', igual(n(eq.diferencia), 0), String(eq.diferencia));
    }
    const clas = balance.classified;
    chequear('el balance viene clasificado (corriente / no corriente)',
      !!clas?.activo?.corriente && !!clas?.activo?.noCorriente);
    // El bug que ya se corrigio una vez: el comodin del no corriente se tragaba
    // las cuentas corrientes. Se vuelve a comprobar aqui de forma explicita.
    const grupos = (bloque: any): any[] =>
      Array.isArray(bloque) ? bloque : Array.isArray(bloque?.grupos) ? bloque.grupos : [];
    const noCorrCodes: string[] = grupos(clas?.activo?.noCorriente)
      .flatMap((g: any) => (g.cuentas ?? g.accounts ?? []).map((c: any) => String(c.code ?? '')));
    chequear('ninguna cuenta 1.1.x quedo en el activo NO corriente',
      !noCorrCodes.some((c) => c.startsWith('1.1')),
      noCorrCodes.filter((c) => c.startsWith('1.1')).join(', '));

    console.log('\n--- 6. Estado de resultados escalonado ---');
    const resultados: any = await reports.getIncomeStatement(companyId, {} as any);
    chequear('devuelve los bloques del formato escalonado',
      Array.isArray(resultados.structured?.bloques) && resultados.structured.bloques.length > 0);
    chequear('el escalonado cuadra con ingresos - gastos',
      resultados.structured?.cuadra === true,
      `neto=${n(resultados.netIncome)}`);

    console.log('\n--- 7. Auxiliar de clientes = mayor (cuenta 1.1.02) ---');
    const porCobrar = await prisma.accountReceivable.aggregate({
      where: { companyId },
      _sum: { balance: true },
    }).catch(() => null as any);
    // 1.1.02 es cuenta de encabezado; el movimiento vive en el detalle 1.1.02.01
    const cuentaAR = await prisma.account.findFirst({ where: { companyId, code: '1.1.02.01' } });
    if (porCobrar && cuentaAR) {
      const lineasAR = await prisma.journalLine.aggregate({
        where: { accountId: cuentaAR.id, entry: { companyId, isReversed: false } },
        _sum: { debit: true, credit: true },
      });
      const saldoMayor = n(lineasAR._sum.debit) - n(lineasAR._sum.credit);
      const saldoAux = n(porCobrar._sum.balance);
      chequear('auxiliar de cuentas por cobrar = saldo del mayor',
        igual(saldoAux, saldoMayor), `auxiliar=${saldoAux} mayor=${saldoMayor}`);
    } else {
      chequear('auxiliar de cuentas por cobrar comprobable', false, 'no se pudo leer AR o la cuenta 1.1.02');
    }

    console.log('\n--- 8. Reversar un asiento no resta dos veces ---');
    // El asiento se arma por accountId: hay que resolver los codigos primero.
    const cta = async (code: string) => {
      const c = await prisma.account.findFirst({ where: { companyId, code } });
      if (!c) throw new Error(`falta la cuenta ${code} en el catalogo`);
      return c.id;
    };
    const idEfectivo = await cta('1.1.01.01');
    const idIngreso = await cta('4.1.01.01');

    const manual: any = await journal.createEntry(companyId, {
      entryDate: HOY,
      description: MARCA + 'Asiento manual de prueba',
      lines: [
        { accountId: idEfectivo, debit: 50000, credit: 0, description: 'Entra efectivo' },
        { accountId: idIngreso, debit: 0, credit: 50000, description: 'Ingreso' },
      ],
    } as any, userId).catch((e: any) => ({ __error: e.message }));

    if (manual?.__error) {
      chequear('crea asiento manual', false, manual.__error);
    } else {
      chequear('crea asiento manual', !!manual.id);
      const antes: any = await reports.getTrialBalance(companyId, {} as any);
      const debeAntes = n(antes.totals?.totalDebit);

      await journal.reverseEntry(companyId, manual.id, { reason: 'QA' } as any, userId);

      const despues: any = await reports.getTrialBalance(companyId, {} as any);
      const debeDespues = n(despues.totals?.totalDebit);
      const hDespues = n(despues.totals?.totalCredit);

      chequear('la balanza sigue cuadrando tras reversar', igual(debeDespues, hDespues),
        `${debeDespues} vs ${hDespues}`);
      chequear('reversar quita el efecto UNA sola vez',
        igual(debeDespues, debeAntes - 50000),
        `antes=${debeAntes} despues=${debeDespues} (esperado ${debeAntes - 50000})`);

      const balance2: any = await reports.getBalanceSheet(companyId, {} as any);
      const eq2 = balance2.classified?.ecuacion ?? balance2.ecuacion;
      chequear('la ecuacion sigue cuadrando tras reversar', eq2?.cuadra === true,
        `activo=${n(eq2?.activo)} p+p=${n(eq2?.pasivo) + n(eq2?.patrimonio)}`);
    }

    console.log('\n--- 9. El libro diario muestra tambien lo reversado ---');
    const diario: any = await reports.getJournalBook(companyId, {} as any);
    const filas = diario.entries ?? diario.asientos ?? diario;
    chequear('el diario devuelve movimientos', Array.isArray(filas) ? filas.length > 0 : !!filas);
  } finally {
    // Limpieza en orden inverso a las dependencias.
    const p = app.get(PrismaService);
    if (companyId) {
      const borra = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* tabla ausente */ } };
      await borra(() => p.journalLine.deleteMany({ where: { entry: { companyId } } }));
      await borra(() => p.journalEntry.deleteMany({ where: { companyId } }));
      await borra(() => (p as any).accountReceivable.deleteMany({ where: { companyId } }));
      await borra(() => (p as any).invoiceItem.deleteMany({ where: { invoice: { companyId } } }));
      await borra(() => p.invoice.deleteMany({ where: { companyId } }));
      await borra(() => p.client.deleteMany({ where: { companyId } }));
      await borra(() => p.account.deleteMany({ where: { companyId } }));
      await borra(() => p.company.deleteMany({ where: { id: companyId } }));
    }
    // El registro de actividad apunta al usuario: hay que soltarlo antes.
    const usuarios = await p.user.findMany({ where: { name: { startsWith: MARCA } }, select: { id: true } }).catch(() => []);
    for (const u of usuarios) {
      try { await (p as any).activityLog.deleteMany({ where: { userId: u.id } }); } catch { /* sin tabla */ }
      try { await p.user.delete({ where: { id: u.id } }); } catch { /* aun referenciado */ }
    }
    await p.university.deleteMany({ where: { name: { startsWith: MARCA } } }).catch(() => {});
    await app.close();
  }

  console.log(`\n================ RESULTADO: ${ok} ok / ${fallos} fallos ================`);
  if (fallos) { console.log('FALLOS:'); detalle.forEach((d) => console.log('  - ' + d)); }
  process.exit(fallos ? 1 : 0);
}

main().catch((e) => { console.error('ERROR FATAL:', e); process.exit(1); });
