/**
 * PDF de las declaraciones de impuestos.
 *
 * Se reporto que no aparece el PDF de las declaraciones presentadas. El boton
 * SI existe en la pantalla y la ruta SI existe en el servidor, asi que la
 * sospecha es que la generacion falle y el usuario solo vea el aviso de error.
 *
 * Esta prueba genera el PDF de los cuatro formularios con datos reales y
 * comprueba que salgan archivos validos. Incluye a proposito un caso con el
 * simbolo del colon y con tildes: la fuente estandar de pdf-lib NO soporta
 * esos caracteres y revienta al guardar, que es la causa mas probable.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { TaxDeclarationsPdfService } from '../src/modules/tax-declarations/tax-declarations-pdf.service';

let ok = 0, fallos = 0;
const detalle: string[] = [];
function chequear(nombre: string, cond: boolean, extra = '') {
  if (cond) { ok++; console.log(`  ok   ${nombre}`); }
  else { fallos++; detalle.push(`${nombre}${extra ? ' -> ' + extra : ''}`); console.log(`  FALLA ${nombre}${extra ? ' -> ' + extra : ''}`); }
}
const esPdf = (b: Buffer) => !!b && b.length > 500 && b.subarray(0, 4).toString() === '%PDF';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const pdf = app.get(TaxDeclarationsPdfService);

  const usuario = { name: 'María Fernández Ávalos', email: 'maria@institucion.ac.cr' } as any;

  const casos: Array<{ nombre: string; d: any }> = [
    {
      nombre: 'D-104 (IVA) presentada',
      d: {
        type: 'D104', period: '2026-03', referenceNo: 'SIM-0001',
        submittedAt: new Date(),
        formData: { ventasGravadas13: 1_000_000, debitoFiscal: 130_000, creditoFiscal: 45_000 },
        result:   { impuestoAPagar: 85_000, saldoAFavor: 0 },
        user: usuario,
      },
    },
    {
      nombre: 'D-101 (renta) presentada',
      d: {
        type: 'D101', period: '2025-2026', referenceNo: 'SIM-0002',
        submittedAt: new Date(),
        formData: { ingresosBrutos: 24_000_000, gastosDeducibles: 15_500_000 },
        result:   { rentaNeta: 8_500_000, impuesto: 1_700_000 },
        user: usuario,
      },
    },
    {
      nombre: 'D-103 (retenciones) presentada',
      d: {
        type: 'D103', period: '2026-03', referenceNo: 'SIM-0003',
        submittedAt: new Date(),
        formData: { baseRetencion: 3_000_000 }, result: { totalRetenido: 60_000 },
        user: usuario,
      },
    },
    {
      nombre: 'D-115 presentada',
      d: {
        type: 'D115', period: '2026-03', referenceNo: 'SIM-0004',
        submittedAt: new Date(),
        formData: { base: 500_000 }, result: { total: 10_000 },
        user: usuario,
      },
    },
    {
      // El caso que mas probablemente rompe: simbolo de colon y tildes.
      nombre: 'declaración con ₡, tildes y ñ',
      d: {
        type: 'D104', period: '2026-04', referenceNo: 'SIM-ÑÁÉ',
        submittedAt: new Date(),
        formData: { 'Ventas gravadas (₡)': '₡1.130.000', 'Descripción': 'Año fiscal — niño' },
        result:   { 'Impuesto a pagar (₡)': '₡85.000' },
        user: { name: 'Ñandú Pérez Über', email: 'n@x.cr' },
      },
    },
    {
      nombre: 'borrador sin número de referencia',
      d: {
        type: 'D104', period: '2026-05', referenceNo: null, submittedAt: null,
        formData: {}, result: {}, user: usuario,
      },
    },
  ];

  try {
    for (const { nombre, d } of casos) {
      try {
        const buf = await pdf.generate(d);
        chequear(nombre, esPdf(buf), `${buf?.length ?? 0} bytes`);
      } catch (e) {
        chequear(nombre, false, (e as Error).message.slice(0, 150));
      }
    }
  } finally {
    await app.close();
  }

  console.log(`\n================ RESULTADO: ${ok} ok / ${fallos} fallos ================`);
  if (fallos) { console.log('FALLOS:'); detalle.forEach((d) => console.log('  - ' + d)); }
  process.exit(fallos ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
