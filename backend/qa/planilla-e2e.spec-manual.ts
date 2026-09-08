/**
 * Planilla de extremo a extremo, contra base de datos real.
 *
 * La prueba hermana (qa/planilla) verifica el motor de cálculo. Esta verifica
 * lo demás: que las cuentas existan, que el asiento que el sistema GUARDA sea
 * el mismo de la planilla resuelta a mano, y que la planilla no descuadre los
 * libros.
 *
 * Reproduce el caso del Excel: Roberto y Alberto, y comprueba el asiento
 * renglón por renglón contra la hoja "Asiento Contable" (suma ₡6.174.850).
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountsService } from '../src/modules/accounts/accounts.service';
import { PayrollService } from '../src/modules/payroll/payroll.service';
import { ReportsService } from '../src/modules/reports/reports.service';

const MARCA = '__QA_PLAN_';
const PERIODO = '2026-03';

let ok = 0;
let fallos = 0;
const detalle: string[] = [];

function chequear(nombre: string, cond: boolean, extra = '') {
  if (cond) { ok++; console.log(`  ok   ${nombre}`); }
  else { fallos++; detalle.push(`${nombre}${extra ? ' -> ' + extra : ''}`); console.log(`  FALLA ${nombre}${extra ? ' -> ' + extra : ''}`); }
}
const n = (v: any) => Number(v ?? 0);
const igual = (a: any, b: any, tol = 1) => Math.abs(n(a) - n(b)) <= tol;
const fmt = (v: any) => n(v).toLocaleString('es-CR');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const payroll = app.get(PayrollService);

  let companyId = '';
  let userId = '';
  let uniId = '';

  try {
    console.log('--- 0. Empresa y catálogo ---');
    const uni = await prisma.university.create({ data: { name: MARCA + 'Uni', shortName: 'QAP' } });
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

    console.log('\n--- 1. Las cuentas de planilla existen en el catálogo ---');
    const necesarias = [
      '6.1.01.01', '6.1.02.01', '6.1.03.01', '6.1.04.01', '6.1.05.01', '6.1.06.01', '6.1.06.02',
      '2.1.04.01', '2.1.04.02', '2.1.04.04', '2.1.04.05', '2.1.04.06',
      '2.1.04.07', '2.1.04.08', '2.1.04.09', '2.1.04.10',
    ];
    const hay = await prisma.account.findMany({
      where: { companyId, code: { in: necesarias } },
      select: { code: true, level: true, name: true },
    });
    const porCodigo = new Map(hay.map((a) => [a.code, a]));
    for (const c of necesarias) {
      const a = porCodigo.get(c);
      chequear(`cuenta ${c}`, !!a && a.level === 4, a ? `nivel ${a.level}` : 'NO EXISTE');
    }

    console.log('\n--- 2. Empleados del caso real ---');
    const roberto = await prisma.employee.create({
      data: {
        companyId, name: MARCA + 'Roberto', identification: '111111111',
        salary: 400_000, startDate: new Date('2025-01-01'), isActive: true,
      },
    });
    const alberto = await prisma.employee.create({
      data: {
        companyId, name: MARCA + 'Alberto', identification: '222222222',
        salary: 3_500_000, startDate: new Date('2025-01-01'), isActive: true,
        cantidadHijos: 4,
        pensionAlimenticia: 200_000,
      },
    });
    chequear('se guardan los hijos en la ficha', alberto.cantidadHijos === 4);
    chequear('se guarda la pensión alimenticia', igual(alberto.pensionAlimenticia, 200_000));

    const movimientos = [
      { employeeId: roberto.id, comisiones: 350_000, viaticos: 30_000, regalos: 80_000 },
      { employeeId: alberto.id, viaticos: 80_000 },
    ];

    console.log('\n--- 2b. El alta por el SERVICIO guarda hijos y deducciones ---');
    // Se crea por el service, NO por prisma directo: es el camino que recorre
    // el formulario, y era justo donde los campos se descartaban en silencio.
    const porServicio: any = await payroll.createEmployee(companyId, {
      name: MARCA + 'ConFamilia',
      identification: '333333333',
      salary: 2_000_000,
      startDate: '2025-01-01',
      tieneConyuge: true,
      cantidadHijos: 2,
      pensionAlimenticia: 50_000,
      tasaAhorroAsociacion: 0.05,
      prestamoAsociacion: 25_000,
    } as any, userId);
    chequear('guarda el conyuge', porServicio.tieneConyuge === true, String(porServicio.tieneConyuge));
    chequear('guarda los hijos', porServicio.cantidadHijos === 2, String(porServicio.cantidadHijos));
    chequear('guarda la pension', igual(porServicio.pensionAlimenticia, 50_000));
    chequear('guarda la tasa de ahorro', igual(porServicio.tasaAhorroAsociacion, 0.05, 0.0001));
    chequear('guarda el prestamo', igual(porServicio.prestamoAsociacion, 25_000));

    const previaFamilia: any = await payroll.previewPayroll(
      companyId, PERIODO, [porServicio.id], userId,
    );
    const cf = previaFamilia.lines[0].calc;
    chequear('el credito por conyuge llega al calculo',
      igual(cf.detalleRenta.creditoConyuge, 2_580), String(cf.detalleRenta.creditoConyuge));
    chequear('el credito por 2 hijos llega al calculo',
      igual(cf.detalleRenta.creditoHijos, 3_420), String(cf.detalleRenta.creditoHijos));
    chequear('la pension alimenticia se descuenta',
      igual(cf.pensionAlimenticia, 50_000), String(cf.pensionAlimenticia));
    chequear('el ahorro es el 5% del bruto',
      igual(cf.ahorroAsociacion, 100_000), String(cf.ahorroAsociacion));
    chequear('el prestamo se descuenta',
      igual(cf.prestamoAsociacion, 25_000), String(cf.prestamoAsociacion));
    chequear('los creditos rebajan el impuesto en 6.000 exactos',
      igual(cf.detalleRenta.impuestoBruto - cf.impuestoRenta, 6_000),
      `${cf.detalleRenta.impuestoBruto} - ${cf.impuestoRenta}`);
    await prisma.employee.delete({ where: { id: porServicio.id } });

    console.log('\n--- 3. Vista previa antes de asentar ---');
    const previa: any = await payroll.previewPayroll(companyId, PERIODO, undefined, userId, movimientos);
    chequear('la previa trae el asiento para revisarlo', Array.isArray(previa.asiento) && previa.asiento.length > 0);
    chequear('salario bruto de la planilla', igual(previa.totales.salarioBruto, 4_250_000), fmt(previa.totales.salarioBruto));
    chequear('impuesto de renta', igual(previa.totales.impuestoRenta, 415_810), fmt(previa.totales.impuestoRenta));
    chequear('efectivo a pagar', igual(previa.totales.totalEfectivoAPagar, 3_363_915), fmt(previa.totales.totalEfectivoAPagar));
    chequear('costo total del patrono', igual(previa.totales.costoTotalPatrono, 5_984_850), fmt(previa.totales.costoTotalPatrono));

    console.log('\n--- 4. Procesar y asentar ---');
    const procesada: any = await payroll.processPayroll(
      companyId, { period: PERIODO, movimientos } as any, userId,
    );
    chequear('la planilla se guarda', !!procesada?.id);
    chequear('queda ligada a su asiento', !!procesada?.journalEntryId);
    chequear('guarda las dos líneas', procesada?.lines?.length === 2);
    chequear('encabezado: vacaciones', igual(procesada.totalVacaciones, 176_800), fmt(procesada.totalVacaciones));
    chequear('encabezado: póliza INS', igual(procesada.totalINS, 63_750), fmt(procesada.totalINS));
    chequear('encabezado: no salariales', igual(procesada.totalNoSalarial, 190_000), fmt(procesada.totalNoSalarial));
    chequear('encabezado: efectivo', igual(procesada.totalEfectivo, 3_363_915), fmt(procesada.totalEfectivo));
    chequear('encabezado: costo patrono', igual(procesada.totalCostoPatrono, 5_984_850), fmt(procesada.totalCostoPatrono));

    console.log('\n--- 5. El asiento guardado, renglón por renglón ---');
    const asiento = await prisma.journalEntry.findFirst({
      where: { id: procesada.journalEntryId },
      include: { lines: { include: { account: { select: { code: true, name: true } } } } },
    });
    chequear('el asiento existe', !!asiento);

    const porCuenta = new Map<string, { debe: number; haber: number }>();
    for (const l of asiento?.lines ?? []) {
      const c = l.account?.code ?? '?';
      const acc = porCuenta.get(c) ?? { debe: 0, haber: 0 };
      acc.debe += n(l.debit); acc.haber += n(l.credit);
      porCuenta.set(c, acc);
    }

    const esperadoDebe: Array<[string, string, number]> = [
      ['6.1.01.01', 'Sueldos y salarios',            4_250_000],
      ['6.1.02.01', 'Cargas patronales 26,83%',      1_140_275],
      ['6.1.03.01', 'Provisión aguinaldo 8,33%',       354_025],
      ['6.1.04.01', 'Provisión vacaciones 4,16%',      176_800],
      ['6.1.05.01', 'Póliza INS 1,50%',                 63_750],
      ['6.1.06.01', 'Viáticos (no salarial)',          110_000],
      ['6.1.06.02', 'Regalos (no salarial)',            80_000],
    ];
    for (const [code, nombre, monto] of esperadoDebe) {
      chequear(`DEBE  ${code} ${nombre}`, igual(porCuenta.get(code)?.debe, monto),
        fmt(porCuenta.get(code)?.debe));
    }

    const esperadoHaber: Array<[string, string, number]> = [
      ['2.1.04.02', 'CCSS patronal por pagar',       1_140_275],
      ['2.1.04.05', 'CCSS cuotas obreras por pagar',   460_275],
      ['2.1.04.04', 'Impuesto de renta por pagar',     415_810],
      ['2.1.04.07', 'Pensión alimenticia por pagar',   200_000],
      ['2.1.04.03', 'Aguinaldo por pagar',             354_025],
      ['2.1.04.06', 'Vacaciones por pagar',            176_800],
      ['2.1.04.10', 'INS por pagar',                    63_750],
      ['2.1.04.01', 'Sueldos por pagar (efectivo)',  3_363_915],
    ];
    for (const [code, nombre, monto] of esperadoHaber) {
      chequear(`HABER ${code} ${nombre}`, igual(porCuenta.get(code)?.haber, monto),
        fmt(porCuenta.get(code)?.haber));
    }

    const sumaDebe  = (asiento?.lines ?? []).reduce((s, l) => s + n(l.debit), 0);
    const sumaHaber = (asiento?.lines ?? []).reduce((s, l) => s + n(l.credit), 0);
    chequear('SUMAS IGUALES ₡6.174.850 (debe)', igual(sumaDebe, 6_174_850), fmt(sumaDebe));
    chequear('SUMAS IGUALES ₡6.174.850 (haber)', igual(sumaHaber, 6_174_850), fmt(sumaHaber));
    chequear('no se generaron renglones en cero',
      (asiento?.lines ?? []).every((l) => n(l.debit) > 0 || n(l.credit) > 0));

    console.log('\n--- 6. Desglose guardado para el estudiante ---');
    const lineaAlberto = procesada.lines.find((l: any) => l.employeeId === alberto.id);
    const desglose: any = lineaAlberto?.breakdown;
    chequear('guarda el detalle de la renta por tramos',
      Array.isArray(desglose?.detalleRenta?.tramos) && desglose.detalleRenta.tramos.length === 5);
    chequear('guarda el crédito por los 4 hijos',
      igual(desglose?.detalleRenta?.creditoHijos, 6_840), String(desglose?.detalleRenta?.creditoHijos));
    chequear('guarda las nueve cargas patronales',
      Object.keys(desglose?.cargasPatronales ?? {}).length === 10, // 9 + total
      String(Object.keys(desglose?.cargasPatronales ?? {}).length));
    chequear('guarda FODESAF al 5%', igual(desglose?.cargasPatronales?.fodesaf, 175_000),
      fmt(desglose?.cargasPatronales?.fodesaf));
    chequear('guarda el ROP (antes no existía)', igual(desglose?.cargasPatronales?.rop, 43_750),
      fmt(desglose?.cargasPatronales?.rop));

    console.log('\n--- 7. La planilla no descuadra los libros ---');
    const reports = app.get(ReportsService);
    const balanza: any = await reports.getTrialBalance(companyId, {} as any);
    chequear('la balanza sigue cuadrada', balanza.totals?.isBalanced === true,
      `${fmt(balanza.totals?.totalDebit)} vs ${fmt(balanza.totals?.totalCredit)}`);
    const balance: any = await reports.getBalanceSheet(companyId, {} as any);
    chequear('la ecuación contable sigue cuadrada',
      (balance.classified?.ecuacion?.cuadra) === true,
      `activo=${fmt(balance.classified?.ecuacion?.activo)} p+p=${fmt(balance.classified?.ecuacion?.pasivoMasPatrimonio)}`);

    console.log('\n--- 8. No se puede procesar dos veces el mismo período ---');
    try {
      await payroll.processPayroll(companyId, { period: PERIODO, movimientos } as any, userId);
      chequear('período repetido rechazado', false, 'lo dejó pasar');
    } catch (e) {
      chequear('período repetido rechazado', /ya existe/i.test((e as Error).message), (e as Error).message);
    }
  } finally {
    const p = app.get(PrismaService);
    const borra = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* */ } };
    if (companyId) {
      await borra(() => p.payrollLine.deleteMany({ where: { payroll: { companyId } } }));
      await borra(() => p.payroll.deleteMany({ where: { companyId } }));
      await borra(() => p.employee.deleteMany({ where: { companyId } }));
      await borra(() => p.journalLine.deleteMany({ where: { entry: { companyId } } }));
      await borra(() => p.journalEntry.deleteMany({ where: { companyId } }));
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
