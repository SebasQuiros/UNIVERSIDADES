/**
 * Carga el catalogo CABYS del BCCR en la base.
 *
 *   npx ts-node -T scripts/importar-cabys.ts
 *
 * Es idempotente: se puede correr las veces que haga falta. Actualiza lo que
 * cambio, agrega lo nuevo y deja lo demas igual.
 *
 * El archivo (prisma/data/cabys-2025.json.gz) viene del Excel oficial:
 * https://www.bccr.fi.cr/cr/es/noticias/listado-de-noticias/2025/
 *   actualizacion-del-catalogo-de-bienes-y-servicios-cabys-2025.html
 * Se guarda comprimido en el repo -466 KB- para que el despliegue no dependa
 * de que la pagina del BCCR este arriba.
 */
import { gunzipSync } from 'zlib';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

const ARCHIVO = join(__dirname, '..', 'prisma', 'data', 'cabys-2025.json.gz');
const VERSION = '2025';
const LOTE = 1000;

/** Minuscula y sin tildes: asi "cafe" encuentra "Café". */
export function normalizar(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

type Fila = [string, string, number, string]; // codigo, descripcion, impuesto, jerarquia

async function main() {
  const prisma = new PrismaClient();
  const t0 = Date.now();

  try {
    const filas: Fila[] = JSON.parse(gunzipSync(readFileSync(ARCHIVO)).toString('utf8'));
    console.log(`Leidos ${filas.length} codigos del catalogo ${VERSION}.`);

    const TARIFAS = new Set([0, 1, 2, 4, 8, 13]);
    const datos = filas.map(([codigo, descripcion, impuesto, jerarquia]) => {
      if (!/^\d{13}$/.test(codigo)) throw new Error(`Codigo invalido: ${codigo}`);
      if (!TARIFAS.has(impuesto)) throw new Error(`Tarifa invalida en ${codigo}: ${impuesto}`);
      return {
        codigo,
        descripcion,
        impuesto,
        jerarquia,
        busqueda: normalizar(`${descripcion} ${jerarquia}`),
        version: VERSION,
      };
    });

    let escritos = 0;
    for (let i = 0; i < datos.length; i += LOTE) {
      const lote = datos.slice(i, i + LOTE);

      // Un INSERT con muchas filas y ON CONFLICT, no un upsert por fila.
      //
      // La primera version hacia prisma.cabysItem.upsert() dentro de una
      // transaccion por lote: 20 506 viajes de ida y vuelta contra el pooler.
      // Iba a ~300 filas por minuto -mas de una hora- y en produccion seria
      // igual de lento. Asi son unas pocas sentencias.
      //
      // createMany tampoco sirve: con skipDuplicates no actualiza nada, y una
      // version nueva del catalogo cambia descripciones y tarifas.
      const valores: any[] = [];
      const marcas = lote.map((d, j) => {
        const b = j * 5;
        valores.push(d.codigo, d.descripcion, d.impuesto, d.jerarquia, d.busqueda);
        return `($${b + 1}, $${b + 2}, $${b + 3}::int, $${b + 4}, $${b + 5}, '${VERSION}', NOW())`;
      });

      await prisma.$executeRawUnsafe(
        `INSERT INTO cabys_items (codigo, descripcion, impuesto, jerarquia, busqueda, version, updated_at)
         VALUES ${marcas.join(', ')}
         ON CONFLICT (codigo) DO UPDATE SET
           descripcion = EXCLUDED.descripcion,
           impuesto    = EXCLUDED.impuesto,
           jerarquia   = EXCLUDED.jerarquia,
           busqueda    = EXCLUDED.busqueda,
           version     = EXCLUDED.version,
           updated_at  = NOW()`,
        ...valores,
      );

      escritos += lote.length;
      process.stdout.write(`\r  ${escritos}/${datos.length}`);
    }

    const total = await prisma.cabysItem.count();
    console.log(`\n\nListo en ${((Date.now() - t0) / 1000).toFixed(1)} s.`);
    console.log(`Codigos en la base: ${total}`);

    // Comprobacion util: si el catalogo quedo a medias, esto lo delata.
    const muestra = await prisma.cabysItem.findUnique({ where: { codigo: '8419000000000' } });
    console.log(`Muestra 8419000000000 -> ${muestra ? `${muestra.descripcion} (IVA ${muestra.impuesto}%)` : 'NO ESTA'}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
}
