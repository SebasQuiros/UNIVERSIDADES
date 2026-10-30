/**
 * Aula de Multiempresa: tipo de negocio libre y escenario igual para todos.
 *
 * Lo que se vigila:
 *   · que la profe pueda poner CUALQUIER tipo de negocio, no uno de cuatro;
 *   · que todas las empresas arranquen EXACTAMENTE iguales — si una sale con
 *     mas capital o mas inventario, la nota mide la suerte del reparto;
 *   · que la apertura cuadre (si no, la empresa nace con la ecuacion contable
 *     rota, que es lo primero que el estudiante revisa);
 *   · que sembrar dos veces no duplique el capital.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClassSessionsService } from '../src/modules/class-sessions/class-sessions.service';
import { EscenarioInicialService } from '../src/modules/class-sessions/escenario-inicial.service';

const MARCA = '__QA_AULA_';

/** Capital acreditado en 3.1.01.01, venga de la siembra que venga. */
async function capitalDe(prisma: any, companyId: string): Promise<number> {
  const lineas = await prisma.journalLine.findMany({
    where:   { entry: { companyId } },
    include: { account: { select: { code: true } } },
  });
  return lineas
    .filter((l: any) => l.account.code === '3.1.01.01')
    .reduce((s: number, l: any) => s + Number(l.credit ?? 0), 0);
}

let ok = 0, fallos = 0;
const detalle: string[] = [];
function chequear(nombre: string, cond: boolean, extra = '') {
  if (cond) { ok++; console.log(`  ok   ${nombre}`); }
  else { fallos++; detalle.push(`${nombre}${extra ? ' -> ' + extra : ''}`); console.log(`  FALLA ${nombre}${extra ? ' -> ' + extra : ''}`); }
}
async function debeFallar(nombre: string, fn: () => Promise<unknown>, frag: string) {
  try { await fn(); chequear(nombre, false, 'NO fallo y deberia'); }
  catch (e) {
    const m = (e as Error).message ?? '';
    chequear(nombre, m.toLowerCase().includes(frag.toLowerCase()), `mensaje: "${m.slice(0, 90)}"`);
  }
}

const ESCENARIO = {
  tipoNegocio: 'Panadería artesanal',
  capital: 2_000_000,
  enCaja: 300_000,
  productos: [
    { nombre: MARCA + 'Pan baguette', precio: 1200, costo: 500, stock: 100, iva: 1 },
    { nombre: MARCA + 'Queque seco',  precio: 4500, costo: 2000, stock: 40,  iva: 13 },
  ],
};

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const sesiones = app.get(ClassSessionsService);
  const escenarios = app.get(EscenarioInicialService);
  const creados: string[] = [];
  let uniId = '', cursoId = '', ejercicioId = '', sesionId = '', profeId = '';

  try {
    console.log('--- 0. Armar un aula ---');
    const uni = await prisma.university.create({ data: { name: MARCA + 'Uni', shortName: 'QAU' } });
    uniId = uni.id;
    const profe = await prisma.user.create({
      data: {
        name: MARCA + 'Profe', email: `${MARCA}p${Date.now()}@qa.local`.toLowerCase(),
        role: 'TEACHER', universityId: uni.id, isActive: true, emailVerified: true,
      },
    });
    profeId = profe.id;
    const curso = await prisma.course.create({
      data: { name: MARCA + 'Curso', code: 'QA' + String(Date.now()).slice(-5), universityId: uni.id, teacherId: profe.id, period: '2026' },
    });
    cursoId = curso.id;
    const ejercicio = await prisma.exercise.create({
      data: { title: MARCA + 'Ejercicio', courseId: curso.id, teacherId: profe.id, isPublished: true, maxScore: 100 },
    });
    ejercicioId = ejercicio.id;
    await prisma.exerciseConfig.create({ data: { exerciseId: ejercicio.id, companyMode: 'GROUP' } as any });

    const user: any = { id: profe.id, role: 'TEACHER', universityId: uni.id };
    const ses: any = await sesiones.createForExercise(ejercicio.id, user, {} as any);
    sesionId = ses.id ?? ses.classSession?.id;
    chequear('la sesión se crea', !!sesionId);

    console.log('\n--- 1. La profe define el tipo de negocio, el que quiera ---');
    const cfg: any = await sesiones.configurarAula(sesionId, user, ESCENARIO as any);
    chequear('acepta un tipo de negocio libre', cfg.tipoNegocio === 'Panadería artesanal', cfg.tipoNegocio);
    chequear('guarda el escenario', Number(cfg.escenarioInicial?.capital) === 2_000_000,
      JSON.stringify(cfg.escenarioInicial).slice(0, 80));

    console.log('\n--- 2. Tres grupos, el MISMO punto de partida ---');
    await sesiones.openLobby(sesionId).catch(() => { /* ya abierto */ });
    for (const n of ['Grupo A', 'Grupo B', 'Grupo C']) {
      const r: any = await sesiones.createGroup(sesionId, user, { name: MARCA + n } as any);
      creados.push(r.company.id);
    }
    chequear('se crearon las tres empresas', creados.length === 3, String(creados.length));
    chequear('ninguna necesitó arquetipo', true);

    const resumen: Array<{ caja: number; banco: number; inv: number; capital: number; prods: number }> = [];
    for (const cid of creados) {
      const lineas = await prisma.journalLine.findMany({
        where:   { entry: { companyId: cid, source: 'OPENING_BALANCE' } },
        include: { account: { select: { code: true } } },
      });
      const monto = (code: string, lado: 'debit' | 'credit') =>
        lineas.filter(l => l.account.code === code)
              .reduce((s, l) => s + Number(l[lado] ?? 0), 0);
      resumen.push({
        caja:    monto('1.1.01.01', 'debit'),
        banco:   monto('1.1.01.02', 'debit'),
        inv:     monto('1.1.03.01', 'debit'),
        capital: monto('3.1.01.01', 'credit'),
        prods:   await prisma.product.count({ where: { companyId: cid } }),
      });
    }
    resumen.forEach((r, i) => console.log(
      `       empresa ${i + 1}: caja ₡${r.caja} | banco ₡${r.banco} | inv ₡${r.inv} | capital ₡${r.capital} | ${r.prods} productos`));

    const todasIguales = resumen.every(r => JSON.stringify(r) === JSON.stringify(resumen[0]));
    chequear('las tres arrancan EXACTAMENTE iguales', todasIguales,
      'una salió con ventaja: la nota mediría el reparto, no el trabajo');

    console.log('\n--- 3. La apertura cuadra ---');
    const r0 = resumen[0];
    // inventario = 500*100 + 2000*40 = 130 000
    chequear('el efectivo en caja es el pedido', r0.caja === 300_000, String(r0.caja));
    chequear('el resto del capital fue al banco', r0.banco === 1_700_000, String(r0.banco));
    chequear('el inventario vale su costo', r0.inv === 130_000, String(r0.inv));
    chequear('debe = haber en la apertura', r0.caja + r0.banco + r0.inv === r0.capital,
      `${r0.caja + r0.banco + r0.inv} vs ${r0.capital}`);
    chequear('los productos quedaron cargados', r0.prods === 2, String(r0.prods));

    const stock = await prisma.product.findFirst({
      where: { companyId: creados[0], name: MARCA + 'Pan baguette' }, select: { stock: true, taxRate: true },
    });
    chequear('con su existencia inicial', Number(stock?.stock) === 100, String(stock?.stock));
    chequear('y su tarifa de IVA', Number(stock?.taxRate) === 1, String(stock?.taxRate));

    console.log('\n--- 4. Sembrar dos veces NO duplica el capital ---');
    await escenarios.sembrar(creados[0], ESCENARIO as any, profe.id);
    const capitalDespues = (await prisma.journalLine.findMany({
      where:   { entry: { companyId: creados[0], source: 'OPENING_BALANCE' } },
      include: { account: { select: { code: true } } },
    })).filter(l => l.account.code === '3.1.01.01').reduce((s, l) => s + Number(l.credit ?? 0), 0);
    chequear('el capital no se duplicó', capitalDespues === r0.capital,
      `${capitalDespues} vs ${r0.capital}`);

    console.log('\n--- 4b. Cada empresa conoce a las otras (comercio del aula) ---');
    const contras: any = await sesiones.contrapartes(sesionId, creados[0]);
    chequear('ve a las otras dos empresas', contras.length === 2, `${contras.length}`);
    const cli = await prisma.client.findMany({
      where:  { companyId: creados[0] },
      select: { name: true, identification: true },
    });
    console.log(`       empresa 1 tiene ${cli.length} clientes: ${cli.map(c => c.name).join(', ')}`);
    chequear('las otras quedaron cargadas como clientes', cli.length >= 2, `${cli.length}`);

    // El motor de comercio entre empresas resuelve al comprador por
    // identification == legalId. Si no coincide, la factura sale como venta a
    // un desconocido y el espejo nunca ocurre, EN SILENCIO.
    const legales = await prisma.company.findMany({
      where: { id: { in: creados.slice(1) } }, select: { legalId: true },
    });
    const idsCliente = new Set(cli.map(c => c.identification));
    chequear('la cédula del cliente coincide con la de la empresa real',
      legales.every(l => !!l.legalId && idsCliente.has(l.legalId)),
      `clientes: ${[...idsCliente].join(',')} vs empresas: ${legales.map(l => l.legalId).join(',')}`);

    console.log('\n--- 4c. Arrancar el aula NO duplica el capital ---');
    // Son dos siembras con marcas distintas: la del escenario y la vieja de
    // initialCapital. Si no se vieran entre si, la empresa saldria al mundo
    // con el patrimonio inflado sin que nadie lo notara.
    const antesDeArrancar = await capitalDe(prisma, creados[0]);
    await (sesiones as any).seedInitialCapital(sesionId, 2_000_000, profeId);
    const despuesDeArrancar = await capitalDe(prisma, creados[0]);
    chequear('el capital no cambia tras la siembra de arranque',
      despuesDeArrancar === antesDeArrancar,
      `${antesDeArrancar} -> ${despuesDeArrancar}`);

    console.log('\n--- 5. Lo que no debe pasar ---');
    await debeFallar('más efectivo en caja que capital se rechaza',
      () => sesiones.configurarAula(sesionId, user, { capital: 100, enCaja: 500 } as any),
      'no puede superar');
    await debeFallar('un IVA inventado se rechaza',
      () => sesiones.configurarAula(sesionId, user, {
        capital: 100, productos: [{ nombre: 'Producto de prueba', precio: 1, costo: 1, stock: 1, iva: 7 }],
      } as any),
      'no es una tarifa válida');
    await debeFallar('un CABYS de 5 dígitos se rechaza',
      () => sesiones.configurarAula(sesionId, user, {
        capital: 100, productos: [{ nombre: 'Producto de prueba', cabysCode: '12345', precio: 1, costo: 1, stock: 1 }],
      } as any),
      '13 dígitos');
  } finally {
    const borra = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* */ } };
    for (const cid of creados) {
      await borra(() => (prisma as any).journalLine.deleteMany({ where: { entry: { companyId: cid } } }));
      await borra(() => (prisma as any).journalEntry.deleteMany({ where: { companyId: cid } }));
      await borra(() => (prisma as any).product.deleteMany({ where: { companyId: cid } }));
      await borra(() => (prisma as any).companyMembership.deleteMany({ where: { companyId: cid } }));
      await borra(() => (prisma as any).account.deleteMany({ where: { companyId: cid } }));
      await borra(() => (prisma as any).accountingPeriod.deleteMany({ where: { companyId: cid } }));
      await borra(() => (prisma as any).classSessionCompany.deleteMany({ where: { companyId: cid } }));
      await borra(() => prisma.company.deleteMany({ where: { id: cid } }));
    }
    if (sesionId) await borra(() => prisma.classSession.deleteMany({ where: { id: sesionId } }));
    if (ejercicioId) {
      await borra(() => (prisma as any).exerciseConfig.deleteMany({ where: { exerciseId: ejercicioId } }));
      await borra(() => (prisma as any).exerciseAttempt.deleteMany({ where: { exerciseId: ejercicioId } }));
      await borra(() => prisma.exercise.deleteMany({ where: { id: ejercicioId } }));
    }
    if (cursoId) await borra(() => prisma.course.deleteMany({ where: { id: cursoId } }));
    if (profeId) {
      await borra(() => (prisma as any).activityLog.deleteMany({ where: { userId: profeId } }));
      await borra(() => prisma.user.deleteMany({ where: { id: profeId } }));
    }
    if (uniId) await borra(() => prisma.university.deleteMany({ where: { id: uniId } }));
    await app.close();
  }

  console.log(`\n================ RESULTADO: ${ok} ok / ${fallos} fallos ================`);
  if (fallos) { console.log('FALLOS:'); detalle.forEach(d => console.log('  - ' + d)); }
  process.exit(fallos ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e?.stack ?? e); process.exit(1); });
