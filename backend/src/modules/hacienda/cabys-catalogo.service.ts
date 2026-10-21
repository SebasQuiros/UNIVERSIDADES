import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { gunzipSync } from 'zlib';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';

/** Codigos que debe tener el catalogo 2025. Si hay menos, quedo a medias. */
const ESPERADOS = 20_000;
const VERSION = '2025';
const LOTE = 1000;

/** Minuscula y sin tildes: asi "cafe" encuentra "Café". */
export function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

type Fila = [string, string, number, string]; // codigo, descripcion, impuesto, jerarquia

/**
 * Carga el catalogo CABYS al arrancar, si hace falta.
 *
 * Existe porque el catalogo tiene que estar en CADA entorno donde corra el
 * sistema, y no siempre hay quien entre a correr un script a mano. Al
 * levantar, mira cuantos codigos hay: si estan todos no hace nada, y si no,
 * los carga desde el archivo que viene en el repo.
 *
 * Nunca impide el arranque. Si algo falla, se registra y el sistema sigue:
 * HaciendaService vuelve a consultar api.hacienda.go.cr, que es peor pero
 * funciona. Un catalogo a medias no puede dejar la plataforma caida.
 */
@Injectable()
export class CabysCatalogoService implements OnModuleInit {
  private readonly logger = new Logger(CabysCatalogoService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Sin await a proposito: el arranque no espera por esto. Mientras carga,
    // las busquedas caen a Hacienda como antes.
    void this.cargarSiHaceFalta();
  }

  private rutaDelArchivo(): string | null {
    // Segun como se haya construido, el proceso arranca desde la raiz del
    // backend o desde dist/. Se prueban las dos.
    const candidatos = [
      join(process.cwd(), 'prisma', 'data', 'cabys-2025.json.gz'),
      join(__dirname, '..', '..', '..', 'prisma', 'data', 'cabys-2025.json.gz'),
      join(__dirname, '..', '..', '..', '..', 'prisma', 'data', 'cabys-2025.json.gz'),
    ];
    return candidatos.find((c) => existsSync(c)) ?? null;
  }

  async cargarSiHaceFalta(): Promise<void> {
    try {
      const hay = await this.prisma.cabysItem.count();
      if (hay >= ESPERADOS) {
        this.logger.log(`Catálogo CABYS ${VERSION} listo: ${hay} códigos.`);
        return;
      }

      const ruta = this.rutaDelArchivo();
      if (!ruta) {
        this.logger.warn(
          'No se encontró prisma/data/cabys-2025.json.gz: las búsquedas CABYS ' +
          'seguirán consultando a api.hacienda.go.cr.',
        );
        return;
      }

      this.logger.log(`Cargando el catálogo CABYS (hay ${hay}, faltan ~${ESPERADOS - hay})…`);
      const t0 = Date.now();
      const filas: Fila[] = JSON.parse(gunzipSync(readFileSync(ruta)).toString('utf8'));

      const TARIFAS = new Set([0, 1, 2, 4, 8, 13]);
      let escritos = 0;

      for (let i = 0; i < filas.length; i += LOTE) {
        const lote = filas.slice(i, i + LOTE).filter(
          ([cod, , imp]) => /^\d{13}$/.test(cod) && TARIFAS.has(imp),
        );
        if (!lote.length) continue;

        // Un INSERT con muchas filas, no un upsert por fila: fila por fila
        // contra el pooler son 20 500 viajes y tarda mas de una hora.
        const valores: any[] = [];
        const marcas = lote.map(([cod, desc, imp, jer], j) => {
          const b = j * 5;
          valores.push(cod, desc, imp, jer, normalizar(`${desc} ${jer}`));
          return `($${b + 1}, $${b + 2}, $${b + 3}::int, $${b + 4}, $${b + 5}, '${VERSION}', NOW())`;
        });

        await this.prisma.$executeRawUnsafe(
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
      }

      const total = await this.prisma.cabysItem.count();
      this.logger.log(
        `Catálogo CABYS ${VERSION} cargado: ${escritos} códigos escritos, ` +
        `${total} en total, en ${((Date.now() - t0) / 1000).toFixed(1)} s.`,
      );
    } catch (err: any) {
      // Deliberadamente no se relanza: sin catálogo el sistema funciona peor,
      // pero funciona. Caído no le sirve a nadie.
      this.logger.error(`No se pudo cargar el catálogo CABYS: ${err.message}`);
    }
  }
}
