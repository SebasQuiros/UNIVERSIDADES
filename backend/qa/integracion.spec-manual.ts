/**
 * Auditoría de integración: ¿está TODO conectado y cuadrado?
 *
 * No prueba un módulo: prueba que los módulos se hablen entre sí. Recorre el
 * ciclo completo de una empresa y, DESPUÉS DE CADA OPERACIÓN, vuelve a
 * comprobar los mismos cuatro invariantes:
 *
 *   1. La balanza cuadra (Σ debe = Σ haber).
 *   2. La ecuación contable cuadra (Activo = Pasivo + Patrimonio).
 *   3. Los auxiliares atan con el mayor (CxC ↔ 1.1.02.01, CxP ↔ 2.1.01.01).
 *   4. Todo asiento automático es trazable (sourceType + sourceId).
 *
 * Comprobarlos al final no sirve: dos errores se compensan y el balance
 * cuadra igual. Hay que preguntarlo después de cada paso, porque así se sabe
 * CUÁL operación lo rompió.
 *
 * Además detecta la otra mitad del problema: operaciones que no producen
 * ningún asiento cuando deberían — acciones desconectadas del resto.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountsService } from '../src/modules/accounts/accounts.service';
import { ClientsService } from '../src/modules/clients/clients.service';
import { SuppliersService } from '../src/modules/suppliers/suppliers.service';
import { ProductsService } from '../src/modules/products/products.service';
import { InvoicesService } from '../src/modules/invoices/invoices.service';
import { PurchaseInvoicesService } from '../src/modules/purchase-invoices/purchase-invoices.service';
import { AccountsReceivableService } from '../src/modules/accounts-receivable/accounts-receivable.service';
import { AccountsPayableService } from '../src/modules/accounts-payable/accounts-payable.service';
import { PayrollService } from '../src/modules/payroll/payroll.service';
import { FixedAssetsService } from '../src/modules/fixed-assets/fixed-assets.service';
import { ReportsService } from '../src/modules/reports/reports.service';
import { BankService } from '../src/modules/bank/bank.service';

const MARCA = '__QA_INT_';
const HOY = new Date().toISOString().slice(0, 10);

let ok = 0, fallos = 0;
const detalle: string[] = [];
const desconectadas: string[] = [];

function chequear(nombre: string, cond: boolean, extra = '') {
  if (cond) { ok++; console.log(`     ok   ${nombre}`); }
  else { fallos++; detalle.push(`${nombre}${extra ? ' -> ' + extra : ''}`); console.log(`     FALLA ${nombre}${extra ? ' -> ' + extra : ''}`); }
}
const n = (v: any) => Number(v ?? 0);
const igual = (a: any, b: any, tol = 1) => Math.abs(n(a) - n(b)) <= tol;
const money = (v: any) => n(v).toLocaleString('es-CR', { maximumFractionDigits: 2 });

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const reports = app.get(ReportsService);

  let companyId = '', userId = '', uniId = '';

  /** Saldo del mayor de una cuenta (debe − haber), solo asientos vigentes. */
  async function saldoMayor(code: string): Promise<number> {
    const cuenta = await prisma.account.findFirst({ where: { companyId, code } });
    if (!cuenta) return NaN;
    const agg = await prisma.journalLine.aggregate({
      where: { accountId: cuenta.id, entry: { companyId, isReversed: false } },
      _sum: { debit: true, credit: true },
    });
    return n(agg._sum.debit) - n(agg._sum.credit);
  }

  /** Los cuatro invariantes, después de cada paso. */
  async function invariantes(paso: string) {
    console.log(`\n  ── invariantes tras: ${paso} ──`);

    const balanza: any = await reports.getTrialBalance(companyId, {} as any);
    chequear(`[${paso}] la balanza cuadra`,
      balanza.totals?.isBalanced === true,
      `${money(balanza.totals?.totalDebit)} vs ${money(balanza.totals?.totalCredit)}`);

    const bs: any = await reports.getBalanceSheet(companyId, {} as any);
    const eq = bs.classified?.ecuacion;
    chequear(`[${paso}] Activo = Pasivo + Patrimonio`,
      eq?.cuadra === true,
      `activo ${money(eq?.activo)} vs p+p ${money(eq?.pasivoMasPatrimonio)}`);

    // Auxiliar de clientes contra el mayor.
    const ar = await prisma.accountReceivable.aggregate({
      where: { companyId }, _sum: { balance: true },
    });
    const mayorCxC = await saldoMayor('1.1.02.01');
    chequear(`[${paso}] auxiliar CxC = mayor 1.1.02.01`,
      igual(n(ar._sum.balance), mayorCxC),
      `auxiliar ${money(ar._sum.balance)} vs mayor ${money(mayorCxC)}`);

    // Auxiliar de proveedores contra el mayor.
    const ap = await prisma.accountPayable.aggregate({
      where: { companyId }, _sum: { balance: true },
    });
    const mayorCxP = await saldoMayor('2.1.01.01');
    chequear(`[${paso}] auxiliar CxP = mayor 2.1.01.01`,
      igual(n(ap._sum.balance), -mayorCxP),
      `auxiliar ${money(ap._sum.balance)} vs mayor ${money(-mayorCxP)}`);

    // Trazabilidad: ningún asiento automático sin origen.
    const huerfanos = await prisma.journalEntry.count({
      where: { companyId, source: { not: 'MANUAL' as any }, sourceType: null },
    });
    chequear(`[${paso}] todo asiento automático es trazable`, huerfanos === 0,
      `${huerfanos} sin sourceType`);
  }

  /** Cuenta los asientos, para saber si una operación produjo alguno. */
  const contarAsientos = () => prisma.journalEntry.count({ where: { companyId } });

  async function debeGenerarAsiento(nombre: string, antes: number) {
    const despues = await contarAsientos();
    const genero = despues > antes;
    chequear(`${nombre} genera asiento`, genero, 'NO produjo ningún asiento');
    if (!genero) desconectadas.push(nombre);
    return despues;
  }

  try {
    // ════════════════════════════════════════════════════════════════════
    console.log('\n█ 0. Montaje');
    const uni = await prisma.university.create({ data: { name: MARCA + 'Uni', shortName: 'QAI' } });
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
        name: MARCA + 'Integral SA', legalId: '3101' + String(Date.now()).slice(-6),
        studentId: alumno.id, isPractice: true, mode: 'INDIVIDUAL',
      },
    });
    companyId = empresa.id;
    await app.get(AccountsService).seedChartOfAccounts(companyId);
    await invariantes('catálogo recién sembrado');

    // ════════════════════════════════════════════════════════════════════
    console.log('\n█ 1. Maestros (no deben mover los libros)');
    let asientos = await contarAsientos();
    const cliente: any = await app.get(ClientsService).create(companyId, {
      name: MARCA + 'Cliente', identification: '304110111', idType: '01', creditDays: 30,
    } as any);
    const prov: any = await app.get(SuppliersService).create(companyId, {
      name: MARCA + 'Proveedor', identification: '3101222333', idType: '02',
    } as any);
    const prod: any = await app.get(ProductsService).create(companyId, {
      name: MARCA + 'Producto', price: 10_000, cost: 6_000, taxRate: 13,
      cabysCode: '2310100000000', trackInventory: true,
    } as any);
    chequear('crear maestros NO genera asientos', (await contarAsientos()) === asientos,
      'un cliente o un producto no son hechos económicos');
    await invariantes('maestros creados');

    // ════════════════════════════════════════════════════════════════════
    console.log('\n█ 2. Venta de contado');
    asientos = await contarAsientos();
    const inv1: any = await app.get(InvoicesService).create(companyId, userId, {
      clientId: cliente.id, issueDate: HOY, saleCondition: 'CASH',
      lines: [{ description: 'Venta contado', quantity: 1, unitPrice: 200_000, taxRate: 13, cabysCode: '2310100000000' }],
    } as any);
    chequear('la factura en BORRADOR no mueve libros', (await contarAsientos()) === asientos);
    await app.get(InvoicesService).issue(companyId, inv1.id, userId);
    asientos = await debeGenerarAsiento('emitir factura de contado', asientos);
    await invariantes('venta de contado');

    // ════════════════════════════════════════════════════════════════════
    console.log('\n█ 3. Venta a crédito → alimenta CxC');
    asientos = await contarAsientos();
    const inv2: any = await app.get(InvoicesService).create(companyId, userId, {
      clientId: cliente.id, issueDate: HOY, saleCondition: 'CREDIT', creditDays: 30,
      lines: [{ description: 'Venta crédito', quantity: 1, unitPrice: 500_000, taxRate: 13, cabysCode: '2310100000000' }],
    } as any);
    await app.get(InvoicesService).issue(companyId, inv2.id, userId);
    asientos = await debeGenerarAsiento('emitir factura a crédito', asientos);
    const arTotal = await prisma.accountReceivable.aggregate({ where: { companyId }, _sum: { balance: true } });
    chequear('la venta a crédito crea el registro en CxC', n(arTotal._sum.balance) > 0,
      money(arTotal._sum.balance));
    await invariantes('venta a crédito');

    // ════════════════════════════════════════════════════════════════════
    console.log('\n█ 4. Cobro de la CxC');
    asientos = await contarAsientos();
    await app.get(AccountsReceivableService).registerPayment(companyId, {
      invoiceId: inv2.id, amount: 300_000, paymentDate: HOY, method: 'TRANSFER',
    } as any, userId);
    asientos = await debeGenerarAsiento('registrar cobro', asientos);
    const arTras = await prisma.accountReceivable.aggregate({ where: { companyId }, _sum: { balance: true } });
    chequear('el cobro baja el saldo del auxiliar',
      igual(n(arTras._sum.balance), n(arTotal._sum.balance) - 300_000),
      `${money(arTotal._sum.balance)} → ${money(arTras._sum.balance)}`);
    await invariantes('cobro parcial');

    // ════════════════════════════════════════════════════════════════════
    console.log('\n█ 5. Compra a crédito → alimenta CxP');
    asientos = await contarAsientos();
    // Ojo con el orden: create(dto, companyId, attemptId, userId).
    const compra: any = await app.get(PurchaseInvoicesService).create({
      supplierName: prov.name, supplierCedula: prov.identification,
      invoiceNumber: 'FC-001', date: new Date(HOY).toISOString(),
      subtotal: 150_000, taxRate: 13, description: 'Compra de prueba',
    } as any, companyId, null, userId).catch((e: any) => ({ __error: e.message }));
    if (compra?.__error) {
      chequear('registrar compra', false, compra.__error);
    } else {
      asientos = await debeGenerarAsiento('registrar factura de compra', asientos);
      const apTotal = await prisma.accountPayable.aggregate({ where: { companyId }, _sum: { balance: true } });
      chequear('la compra crea el registro en CxP', n(apTotal._sum.balance) > 0, money(apTotal._sum.balance));
      await invariantes('compra a crédito');

      console.log('\n█ 6. Pago al proveedor');
      asientos = await contarAsientos();
      await app.get(AccountsPayableService).registerPayment(companyId, {
        purchaseInvoiceId: compra.id, amount: 100_000, paymentDate: HOY, method: 'TRANSFER',
      } as any, userId);
      asientos = await debeGenerarAsiento('registrar pago a proveedor', asientos);
      const apTras = await prisma.accountPayable.aggregate({ where: { companyId }, _sum: { balance: true } });
      chequear('el pago baja el saldo del auxiliar',
        igual(n(apTras._sum.balance), n(apTotal._sum.balance) - 100_000),
        `${money(apTotal._sum.balance)} → ${money(apTras._sum.balance)}`);
      await invariantes('pago a proveedor');
    }

    // ════════════════════════════════════════════════════════════════════
    console.log('\n█ 7. Activo fijo y su depreciación');
    asientos = await contarAsientos();
    const activo: any = await app.get(FixedAssetsService).create(companyId, {
      name: MARCA + 'Equipo', category: 'EQUIPO_COMPUTO',
      acquisitionDate: HOY, acquisitionCost: 1_200_000, usefulLifeYears: 5,
    } as any, userId).catch((e: any) => ({ __error: e.message }));
    if (activo?.__error) {
      console.log(`     (alta de activo fijo: ${activo.__error.slice(0, 90)})`);
    } else {
      asientos = await contarAsientos();
      const dep: any = await app.get(FixedAssetsService)
        .depreciate(companyId, activo.id, HOY.slice(0, 7), userId)
        .catch((e: any) => ({ __error: e.message }));
      if (dep?.__error) {
        chequear('depreciar activo fijo', false, dep.__error.slice(0, 110));
      } else {
        asientos = await debeGenerarAsiento('depreciar activo fijo', asientos);
      }
      await invariantes('activo fijo depreciado');
    }

    // ════════════════════════════════════════════════════════════════════
    console.log('\n█ 8. Planilla');
    asientos = await contarAsientos();
    const emp: any = await app.get(PayrollService).createEmployee(companyId, {
      name: MARCA + 'Empleado', identification: '112223334',
      salary: 600_000, startDate: '2025-01-01', cantidadHijos: 1,
    } as any, userId);
    chequear('dar de alta un empleado NO genera asiento', (await contarAsientos()) === asientos);
    await app.get(PayrollService).processPayroll(
      companyId, { period: '2026-05' } as any, userId,
    );
    asientos = await debeGenerarAsiento('procesar planilla', asientos);
    void emp;
    await invariantes('planilla procesada');

    // ════════════════════════════════════════════════════════════════════
    console.log('\n█ 9. Tesorería: caja contra banco');
    // Un cobro por transferencia tiene que entrar al BANCO, no a la gaveta.
    const saldoCajaAntes  = await saldoMayor('1.1.01.01');
    const saldoBancoAntes = await saldoMayor('1.1.01.02');
    chequear('los cobros por transferencia movieron la cuenta bancaria',
      saldoBancoAntes > 0,
      `banco ${money(saldoBancoAntes)} — si está en cero, todo fue a parar a Caja`);

    console.log('\n█ 9b. Un cobro EN EFECTIVO va a caja, no al banco');
    const inv3: any = await app.get(InvoicesService).create(companyId, userId, {
      clientId: cliente.id, issueDate: HOY, saleCondition: 'CREDIT', creditDays: 30,
      lines: [{ description: 'Venta para cobro en efectivo', quantity: 1, unitPrice: 100_000, taxRate: 13, cabysCode: '2310100000000' }],
    } as any);
    await app.get(InvoicesService).issue(companyId, inv3.id, userId);
    await app.get(AccountsReceivableService).registerPayment(companyId, {
      invoiceId: inv3.id, amount: 50_000, paymentDate: HOY, method: 'CASH',
    } as any, userId);
    chequear('el cobro en efectivo entra a Caja',
      igual(await saldoMayor('1.1.01.01'), saldoCajaAntes + 50_000),
      `${money(saldoCajaAntes)} → ${money(await saldoMayor('1.1.01.01'))}`);
    chequear('y NO toca la cuenta bancaria',
      igual(await saldoMayor('1.1.01.02'), saldoBancoAntes),
      `${money(saldoBancoAntes)} → ${money(await saldoMayor('1.1.01.02'))}`);
    await invariantes('cobro en efectivo');

    console.log('\n█ 9c. El libro de bancos se alimenta solo');
    const movsDeSistema = await prisma.bankTransaction.count({
      where: { companyId, source: { not: 'MANUAL' } },
    });
    chequear('las ventas y pagos alimentan el libro de bancos', movsDeSistema > 0,
      'el libro de bancos solo tendría lo que se teclea a mano');
    if (movsDeSistema === 0) desconectadas.push('libro de bancos (no recibe de ventas/compras)');

    const enEfectivo = await prisma.bankTransaction.count({
      where: { companyId, description: { contains: 'cobro en efectivo' } },
    });
    chequear('lo cobrado en efectivo NO aparece en el libro de bancos', enEfectivo === 0,
      'meter el efectivo en el extracto bancario sería enseñar mal');

    console.log('\n█ 9d. Un movimiento manual de banco genera su asiento');
    asientos = await contarAsientos();
    await app.get(BankService).create(companyId, userId, {
      date: HOY, description: MARCA + 'Comisión bancaria', amount: 5_000,
      type: 'DEBIT', counterAccountCode: '5.2.01.09',
    } as any).catch(async (e: any) => {
      // Si esa cuenta de gasto no existe en el catálogo, se reintenta con una
      // que sí: lo que se prueba es el enganche contable, no el código.
      const alterna = await prisma.account.findFirst({
        where: { companyId, type: 'EXPENSE', level: 4 }, select: { code: true },
      });
      if (!alterna) throw e;
      return app.get(BankService).create(companyId, userId, {
        date: HOY, description: MARCA + 'Comisión bancaria', amount: 5_000,
        type: 'DEBIT', counterAccountCode: alterna.code,
      } as any);
    });
    asientos = await debeGenerarAsiento('movimiento manual de banco', asientos);
    await invariantes('movimiento manual de banco');

    console.log('\n█ 9e. Sin contrapartida no se registra nada');
    const antesDeFallar = await contarAsientos();
    const movsAntes = await prisma.bankTransaction.count({ where: { companyId } });
    try {
      await app.get(BankService).create(companyId, userId, {
        date: HOY, description: MARCA + 'Sin contrapartida', amount: 9_000, type: 'CREDIT',
      } as any);
      chequear('se rechaza un movimiento sin contrapartida', false, 'lo dejó pasar');
    } catch (e) {
      chequear('se rechaza un movimiento sin contrapartida',
        /contra qué cuenta|contrapartida/i.test((e as Error).message), (e as Error).message.slice(0, 90));
    }
    chequear('el rechazo no dejó basura: ni asiento ni movimiento',
      (await contarAsientos()) === antesDeFallar &&
      (await prisma.bankTransaction.count({ where: { companyId } })) === movsAntes);

    // ════════════════════════════════════════════════════════════════════
    console.log('\n█ 10. Estado final de los libros');
    await invariantes('cierre de la auditoría');

    const total = await contarAsientos();
    console.log(`\n     (asientos generados en todo el ciclo: ${total})`);

    // Toda línea de asiento apunta a una cuenta de nivel 4 y de esta empresa.
    const lineasMalas = await prisma.journalLine.count({
      where: { entry: { companyId }, OR: [{ account: { level: { not: 4 } } }, { account: { companyId: { not: companyId } } }] },
    });
    chequear('ninguna línea apunta a cuenta de encabezado o de otra empresa', lineasMalas === 0,
      `${lineasMalas} líneas mal apuntadas`);

    const vacios = await prisma.journalEntry.count({ where: { companyId, lines: { none: {} } } });
    chequear('ningún asiento quedó sin líneas', vacios === 0, `${vacios} vacíos`);
  } finally {
    const p = app.get(PrismaService);
    const borra = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* */ } };
    if (companyId) {
      for (const f of [
        () => p.payrollLine.deleteMany({ where: { payroll: { companyId } } }),
        () => p.payroll.deleteMany({ where: { companyId } }),
        () => p.employee.deleteMany({ where: { companyId } }),
        () => (p as any).apPayment.deleteMany({ where: { companyId } }),
        () => (p as any).arPayment.deleteMany({ where: { companyId } }),
        () => p.accountPayable.deleteMany({ where: { companyId } }),
        () => p.accountReceivable.deleteMany({ where: { companyId } }),
        () => (p as any).bankTransaction.deleteMany({ where: { companyId } }),
        () => (p as any).fixedAsset.deleteMany({ where: { companyId } }),
        () => p.journalLine.deleteMany({ where: { entry: { companyId } } }),
        () => p.journalEntry.deleteMany({ where: { companyId } }),
        () => (p as any).invoiceItem.deleteMany({ where: { invoice: { companyId } } }),
        () => p.invoice.deleteMany({ where: { companyId } }),
        () => p.purchaseInvoice.deleteMany({ where: { companyId } }),
        () => (p as any).inventoryLot.deleteMany({ where: { companyId } }),
        () => (p as any).inventoryMovement.deleteMany({ where: { companyId } }),
        () => p.product.deleteMany({ where: { companyId } }),
        () => (p as any).supplier.deleteMany({ where: { companyId } }),
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
  if (desconectadas.length) {
    console.log('\nACCIONES DESCONECTADAS DEL RESTO DEL SISTEMA:');
    [...new Set(desconectadas)].forEach((d) => console.log('  · ' + d));
  }
  if (fallos) { console.log('\nFALLOS:'); detalle.forEach((d) => console.log('  - ' + d)); }
  process.exit(fallos ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
