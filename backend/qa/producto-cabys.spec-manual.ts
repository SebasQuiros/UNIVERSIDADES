/**
 * El camino que quedo bloqueado en la pasantia, de punta a punta.
 *
 * Reporte textual: "ocupo meterme al catalogo de productos para crear un
 * producto para poder hacer una facturacion. A la hora de poner el codigo
 * CABYS -que yo tenia un Excel con todos los codigos de Hacienda- ni con eso.
 * Me meti desde donde uno puede buscar CABYS dentro del programa, y tampoco.
 * Entonces no me deja hacer facturacion."
 *
 * Son tres eslabones encadenados: si el primero no entrega un codigo, no hay
 * producto; sin producto no hay factura. Se prueban los tres seguidos, porque
 * probar solo el primero no demuestra que el estudiante pueda avanzar.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HaciendaService } from '../src/modules/hacienda/hacienda.service';
import { ProductsService } from '../src/modules/products/products.service';
import { AccountsService } from '../src/modules/accounts/accounts.service';
import { ClientsService } from '../src/modules/clients/clients.service';
import { InvoicesService } from '../src/modules/invoices/invoices.service';

const MARCA = '__QA_PCAB_';
// Codigo real que el pasante escribio en la captura.
const CODIGO_DEL_REPORTE = '8419000000000';

let ok = 0, fallos = 0;
const detalle: string[] = [];
function chequear(nombre: string, cond: boolean, extra = '') {
  if (cond) { ok++; console.log(`  ok   ${nombre}`); }
  else { fallos++; detalle.push(`${nombre}${extra ? ' -> ' + extra : ''}`); console.log(`  FALLA ${nombre}${extra ? ' -> ' + extra : ''}`); }
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  let companyId = '';

  try {
    const uni = await prisma.university.create({ data: { name: MARCA + 'Uni', shortName: 'QPC' } });
    const alumno = await prisma.user.create({
      data: {
        name: MARCA + 'Alumno', email: `${MARCA}${Date.now()}@qa.local`.toLowerCase(),
        role: 'STUDENT', universityId: uni.id, isActive: true, emailVerified: true,
      },
    });
    const empresa = await prisma.company.create({
      data: {
        name: MARCA + 'SA', legalId: '3101' + String(Date.now()).slice(-6),
        studentId: alumno.id, isPractice: true, mode: 'INDIVIDUAL',
      },
    });
    companyId = empresa.id;
    await app.get(AccountsService).seedChartOfAccounts(companyId);

    console.log('--- 1. Pegar el codigo del Excel de Hacienda en el buscador ---');
    const hallados = await app.get(HaciendaService).searchCabys(CODIGO_DEL_REPORTE, 10);
    chequear('el codigo del Excel aparece en el buscador', hallados.length > 0,
      `${hallados.length} resultados para ${CODIGO_DEL_REPORTE}`);
    const elegido = hallados[0];
    if (elegido) {
      console.log(`       ${elegido.codigo} | ${elegido.descripcion} | IVA ${elegido.impuesto}%`);
      chequear('es el codigo pedido', elegido.codigo === CODIGO_DEL_REPORTE);
      chequear('trae el IVA para rellenar el formulario',
        [0, 1, 2, 4, 8, 13].includes(elegido.impuesto), `${elegido.impuesto}`);
    }

    console.log('\n--- 2. Crear el producto con ese codigo ---');
    if (!elegido) {
      chequear('se puede crear el producto', false, 'sin codigo no hay nada que crear');
    } else {
      const prod: any = await app.get(ProductsService).create(companyId, {
        name: MARCA + 'Servicio telecom',
        cabysCode: elegido.codigo,
        price: 50_000,
        taxRate: elegido.impuesto,
        unit: 'UNI',
        isService: true,
      } as any, alumno.id);
      chequear('el producto se crea', !!prod?.id);
      chequear('guarda el codigo CABYS', prod?.cabysCode === CODIGO_DEL_REPORTE, prod?.cabysCode);
      chequear('guarda la tarifa del catalogo', Number(prod?.taxRate) === elegido.impuesto,
        `${prod?.taxRate}`);

      console.log('\n--- 3. Facturar ese producto (el objetivo real) ---');
      const cli: any = await app.get(ClientsService).create(companyId, {
        name: MARCA + 'Cliente', identification: '304998877', idType: '01', creditDays: 30,
      } as any);
      const hoy = new Date().toISOString().slice(0, 10);
      // Sin cabysCode en la linea a proposito: debe heredarlo del producto.
      const fac: any = await app.get(InvoicesService).create(companyId, alumno.id, {
        clientId: cli.id, issueDate: hoy, saleCondition: 'CASH',
        lines: [{ productId: prod.id, description: 'Servicio', quantity: 1, unitPrice: 50_000, taxRate: elegido.impuesto }],
      } as any);
      chequear('la factura se crea', !!fac?.id);
      const linea = fac?.items?.[0];
      chequear('la linea hereda el CABYS del producto', linea?.cabysCode === CODIGO_DEL_REPORTE,
        `${linea?.cabysCode}`);

      const emitida: any = await app.get(InvoicesService).issue(companyId, fac.id, alumno.id)
        .catch((e: any) => ({ __error: e.message }));
      chequear('la factura se EMITE sin rechazo por CABYS', !emitida?.__error,
        emitida?.__error?.slice(0, 120) ?? '');
    }

    console.log('\n--- 4. El otro camino que probo: buscar por nombre ---');
    const porNombre = await app.get(HaciendaService).searchCabys('telecomunicaciones', 10);
    chequear('buscar por nombre tambien devuelve resultados', porNombre.length > 0,
      `${porNombre.length}`);
  } finally {
    const borra = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* */ } };
    if (companyId) {
      // Por el cliente de Prisma, no con SQL crudo: los nombres fisicos de las
      // tablas estan mapeados (JournalLine -> journal_lines) y escribirlos a
      // mano fallaba. Las lineas caen solas por onDelete: Cascade.
      await borra(() => (prisma as any).journalLine.deleteMany({ where: { entry: { companyId } } }));
      await borra(() => (prisma as any).journalEntry.deleteMany({ where: { companyId } }));
      await borra(() => (prisma as any).invoiceItem.deleteMany({ where: { invoice: { companyId } } }));
      await borra(() => (prisma as any).invoice.deleteMany({ where: { companyId } }));
      await borra(() => (prisma as any).client.deleteMany({ where: { companyId } }));
      await borra(() => (prisma as any).product.deleteMany({ where: { companyId } }));
      await borra(() => (prisma as any).account.deleteMany({ where: { companyId } }));
      await borra(() => prisma.company.deleteMany({ where: { id: companyId } }));
    }
    const usuarios = await prisma.user.findMany({ where: { name: { startsWith: MARCA } }, select: { id: true } }).catch(() => []);
    for (const u of usuarios) {
      await borra(() => (prisma as any).activityLog.deleteMany({ where: { userId: u.id } }));
      await borra(() => prisma.user.delete({ where: { id: u.id } }));
    }
    await borra(() => prisma.university.deleteMany({ where: { name: { startsWith: MARCA } } }));
    await app.close();
  }

  console.log(`\n================ RESULTADO: ${ok} ok / ${fallos} fallos ================`);
  if (fallos) { console.log('FALLOS:'); detalle.forEach((d) => console.log('  - ' + d)); }
  process.exit(fallos ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
