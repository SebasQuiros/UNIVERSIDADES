/**
 * CABYS: busqueda y consulta por codigo.
 *
 * El catalogo CABYS viene de api.hacienda.go.cr. Lo que se vigila aqui NO es
 * que Hacienda responda -eso no lo controlamos- sino que nosotros leamos bien
 * lo que responde. Un error de forma en la respuesta se ve igual que "no hay
 * resultados", y esa confusion es justamente la que hay que descartar.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HaciendaService, CabysNoDisponibleError } from '../src/modules/hacienda/hacienda.service';

let ok = 0, fallos = 0;
const detalle: string[] = [];
function chequear(nombre: string, cond: boolean, extra = '') {
  if (cond) { ok++; console.log(`  ok   ${nombre}`); }
  else { fallos++; detalle.push(`${nombre}${extra ? ' -> ' + extra : ''}`); console.log(`  FALLA ${nombre}${extra ? ' -> ' + extra : ''}`); }
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const hacienda = app.get(HaciendaService);

  try {
    console.log('--- 1. Busqueda por descripcion ---');
    const arroz = await hacienda.searchCabys('arroz', 10);
    chequear('devuelve resultados para "arroz"', arroz.length > 0, `${arroz.length} resultados`);
    if (arroz.length) {
      const a = arroz[0];
      console.log(`       primero: ${a.codigo} | ${a.descripcion} | IVA ${a.impuesto}%`);
      chequear('el codigo tiene 13 digitos', /^\d{13}$/.test(a.codigo), a.codigo);
      chequear('trae descripcion', a.descripcion.length > 0);
      chequear('el IVA es una tarifa valida de CR',
        [0, 1, 2, 4, 8, 13].includes(a.impuesto), `impuesto=${a.impuesto}`);
    }

    const compu = await hacienda.searchCabys('computadora', 10);
    chequear('devuelve resultados para "computadora"', compu.length > 0, `${compu.length}`);

    console.log('\n--- 2. Busqueda con tilde ---');
    const cafe = await hacienda.searchCabys('café', 5);
    chequear('"café" con tilde encuentra algo', cafe.length > 0, `${cafe.length}`);

    console.log('\n--- 2b. Escribir el CODIGO en el campo de busqueda ---');
    // El campo se llama "Código CABYS (13 dígitos)": pegar el codigo es lo
    // primero que hace cualquiera. Antes se buscaba siempre por descripcion y
    // un codigo valido devolvia "Sin resultados".
    const porCodigo = await hacienda.searchCabys('8419000000000', 10);
    chequear('un codigo de 13 digitos en el buscador encuentra el item',
      porCodigo.length > 0, `${porCodigo.length} resultados`);
    if (porCodigo.length) {
      console.log(`       ${porCodigo[0].codigo} | ${porCodigo[0].descripcion} | IVA ${porCodigo[0].impuesto}%`);
      chequear('es exactamente el codigo pedido', porCodigo[0].codigo === '8419000000000');
    }
    const prefijo = await hacienda.searchCabys('841900000', 10);
    chequear('un prefijo de 9 digitos tambien busca por codigo', prefijo.length > 0,
      `${prefijo.length}`);
    const corto = await hacienda.searchCabys('8419', 10);
    chequear('un codigo a medio escribir devuelve vacio sin reventar', corto.length === 0,
      `${corto.length}; Hacienda responde 400 con menos de 9 digitos`);

    console.log('\n--- 3. Consulta por codigo exacto (lo que usa la factura) ---');
    const codigo = arroz[0]?.codigo;
    if (!codigo) {
      chequear('hay un codigo para probar', false, 'la busqueda no devolvio nada');
    } else {
      const item = await hacienda.getCabysByCode(codigo);
      chequear(`el codigo ${codigo} se encuentra por consulta directa`, item !== null,
        'devolvio null: el codigo salio de la busqueda, existe con seguridad');
      if (item) {
        chequear('el codigo devuelto coincide con el pedido', item.codigo === codigo,
          `pedido ${codigo}, devuelto ${item.codigo}`);
        chequear('trae descripcion', item.descripcion.length > 0);
        chequear('trae el IVA', [0, 1, 2, 4, 8, 13].includes(item.impuesto), `${item.impuesto}`);
      }
    }

    console.log('\n--- 4. Casos que deben devolver vacio sin reventar ---');
    chequear('un codigo inexistente devuelve null',
      (await hacienda.getCabysByCode('9999999999999')) === null);
    chequear('una busqueda de 1 letra devuelve vacio',
      (await hacienda.searchCabys('a', 10)).length === 0);

    console.log('\n--- 5. Varios codigos reales, no solo uno ---');
    const paraProbar = (await hacienda.searchCabys('servicio', 8)).slice(0, 5);
    let encontrados = 0;
    for (const c of paraProbar) {
      const r = await hacienda.getCabysByCode(c.codigo);
      if (r && r.codigo === c.codigo) encontrados++;
      else console.log(`       no se encontro ${c.codigo} (${c.descripcion})`);
    }
    chequear('todos los codigos de la busqueda se encuentran por codigo',
      paraProbar.length > 0 && encontrados === paraProbar.length,
      `${encontrados}/${paraProbar.length}`);

    console.log('\n--- 6. Si Hacienda no contesta se AVISA, no se finge vacio ---');
    const fetchReal = global.fetch;
    (global as any).fetch = async () => { throw new Error('simulacion: red caida'); };
    try {
      let aviso = false;
      try {
        // Termino nuevo, para que no lo resuelva la cache de una prueba previa.
        await hacienda.searchCabys(`zzz${Date.now()}`, 5);
      } catch (e) {
        aviso = e instanceof CabysNoDisponibleError;
      }
      chequear('la busqueda avisa que el catalogo no esta disponible', aviso,
        'devolvio vacio en silencio: con el servicio caido la pantalla diria "sin resultados"');

      let aviso2 = false;
      try {
        await hacienda.getCabysByCode('1234567890123');
      } catch (e) {
        aviso2 = e instanceof CabysNoDisponibleError;
      }
      chequear('la consulta por codigo tambien avisa', aviso2);
    } finally {
      (global as any).fetch = fetchReal;
    }

    console.log('\n--- 7. Tipo de cambio ---');
    const tc = await hacienda.getExchangeRate();
    console.log(`       venta ₡${tc.venta} | compra ₡${tc.compra} | ${tc.fecha}`);
    chequear('el tipo de cambio es un numero razonable', tc.venta > 300 && tc.venta < 900, `${tc.venta}`);
    chequear('no es el valor de respaldo quemado', tc.venta !== 530,
      'devolvio 530: significa que la llamada a Hacienda fallo');
  } finally {
    await app.close();
  }

  console.log(`\n================ RESULTADO: ${ok} ok / ${fallos} fallos ================`);
  if (fallos) { console.log('FALLOS:'); detalle.forEach((d) => console.log('  - ' + d)); }
  process.exit(fallos ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
