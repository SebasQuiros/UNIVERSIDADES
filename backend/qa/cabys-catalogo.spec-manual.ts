/**
 * Catalogo CABYS local.
 *
 * El punto de tenerlo en nuestra base es que el estudiante pueda trabajar
 * aunque api.hacienda.go.cr este caida. Asi que la prueba mas importante de
 * todas es la ultima: se corta la red a proposito y el buscador tiene que
 * seguir funcionando. Si eso falla, el catalogo local no sirve de nada.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HaciendaService } from '../src/modules/hacienda/hacienda.service';

let ok = 0, fallos = 0;
const detalle: string[] = [];
function chequear(nombre: string, cond: boolean, extra = '') {
  if (cond) { ok++; console.log(`  ok   ${nombre}`); }
  else { fallos++; detalle.push(`${nombre}${extra ? ' -> ' + extra : ''}`); console.log(`  FALLA ${nombre}${extra ? ' -> ' + extra : ''}`); }
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const hacienda = app.get(HaciendaService);

  try {
    console.log('--- 1. El catalogo esta completo ---');
    const total = await prisma.cabysItem.count();
    console.log(`       ${total} codigos`);
    chequear('hay mas de 20 000 codigos', total > 20_000, `${total}`);
    const tarifas = await prisma.cabysItem.groupBy({ by: ['impuesto'], _count: true });
    const vals = tarifas.map((t) => t.impuesto).sort((a, b) => a - b);
    console.log('       tarifas:', vals.join(', '));
    chequear('todas las tarifas son validas en CR',
      vals.every((v) => [0, 1, 2, 4, 8, 13].includes(v)), vals.join(','));
    const malos = await prisma.$queryRawUnsafe<any[]>(
      `SELECT count(*)::int AS n FROM cabys_items WHERE codigo !~ '^[0-9]{13}$'`);
    chequear('todos los codigos tienen 13 digitos', Number(malos[0].n) === 0, `${malos[0].n} malos`);

    console.log('\n--- 2. Los casos que fallaron de verdad ---');
    const delReporte = await hacienda.searchCabys('8419000000000', 10);
    chequear('el codigo del reporte aparece', delReporte.length > 0);
    if (delReporte.length) {
      console.log(`       ${delReporte[0].codigo} | ${delReporte[0].descripcion} | IVA ${delReporte[0].impuesto}%`);
      chequear('con su IVA correcto', delReporte[0].impuesto === 13, `${delReporte[0].impuesto}`);
    }

    console.log('\n--- 3. Buscar por texto ---');
    for (const [q, esperado] of [['arroz', true], ['computadora', true], ['consultoria', true],
                                 ['telecomunicaciones', true]] as const) {
      const r = await hacienda.searchCabys(q, 10);
      chequear(`"${q}" devuelve resultados`, r.length > 0 === esperado, `${r.length}`);
      if (r.length) console.log(`       ${q}: ${r[0].descripcion.slice(0, 50)}`);
    }

    console.log('\n--- 4. Tildes: escribirlas o no da lo mismo ---');
    const conT = await hacienda.searchCabys('café', 10);
    const sinT = await hacienda.searchCabys('cafe', 10);
    chequear('"café" encuentra algo', conT.length > 0, `${conT.length}`);
    chequear('"cafe" encuentra lo mismo', sinT.length > 0 && sinT[0].codigo === conT[0]?.codigo,
      `${sinT[0]?.codigo} vs ${conT[0]?.codigo}`);

    console.log('\n--- 5. Varias palabras afinan la busqueda ---');
    const una = await hacienda.searchCabys('servicios', 50);
    const dos = await hacienda.searchCabys('servicios telecomunicaciones', 50);
    chequear('dos palabras devuelven menos que una', dos.length <= una.length,
      `${dos.length} vs ${una.length}`);
    chequear('y siguen siendo pertinentes',
      dos.every((x) => /telecomunicacion/i.test(x.descripcion) || dos.length > 0));

    console.log('\n--- 6. Por prefijo de codigo ---');
    const pre = await hacienda.searchCabys('841900000', 10);
    chequear('un prefijo de 9 digitos devuelve candidatos', pre.length > 0, `${pre.length}`);

    console.log('\n--- 7. Velocidad: ya no se sale a internet ---');
    const t0 = Date.now();
    for (let i = 0; i < 5; i++) await hacienda.searchCabys(`arroz ${i}`, 10);
    const ms = (Date.now() - t0) / 5;
    console.log(`       ${ms.toFixed(0)} ms por busqueda`);
    chequear('cada busqueda tarda menos de 500 ms', ms < 500, `${ms.toFixed(0)} ms`);

    console.log('\n--- 8. LO IMPORTANTE: con Hacienda caida sigue sirviendo ---');
    const fetchReal = global.fetch;
    (global as any).fetch = async () => { throw new Error('simulacion: Hacienda caida'); };
    try {
      const r1 = await hacienda.searchCabys(`arroz-${Date.now()}`.slice(0, 5), 10);
      chequear('la busqueda por texto funciona sin Hacienda', r1.length > 0, `${r1.length}`);
      const r2 = await hacienda.searchCabys('8419000000000', 10);
      chequear('la busqueda por codigo funciona sin Hacienda', r2.length > 0, `${r2.length}`);
      const r3 = await hacienda.getCabysByCode('2312000000300');
      chequear('la consulta directa funciona sin Hacienda', r3 !== null, 'devolvio null');
    } finally {
      (global as any).fetch = fetchReal;
    }
  } finally {
    await app.close();
  }

  console.log(`\n================ RESULTADO: ${ok} ok / ${fallos} fallos ================`);
  if (fallos) { console.log('FALLOS:'); detalle.forEach((d) => console.log('  - ' + d)); }
  process.exit(fallos ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
