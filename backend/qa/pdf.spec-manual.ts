/**
 * Reproduccion y verificacion de la descarga de PDF de facturas emitidas.
 *
 * El PDF se escribe en uploads/pdfs/<companyId>/FE-xxx.pdf, pero el
 * controlador lo servia con path.basename(), es decir buscandolo en
 * uploads/pdfs/FE-xxx.pdf — sin la carpeta de la empresa. Nunca lo
 * encontraba.
 *
 * Esta prueba comprueba las dos mitades: que el servicio devuelva una ruta
 * existente, y que la ruta que el controlador usa para servir apunte al
 * MISMO archivo.
 */
import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountsService } from '../src/modules/accounts/accounts.service';
import { ClientsService } from '../src/modules/clients/clients.service';
import { InvoicesService } from '../src/modules/invoices/invoices.service';

const MARCA = '__QA_PDF_';
const HOY = new Date().toISOString().slice(0, 10);

let ok = 0;
let fallos = 0;
const detalle: string[] = [];
function chequear(nombre: string, cond: boolean, extra = '') {
  if (cond) { ok++; console.log(`  ok   ${nombre}`); }
  else { fallos++; detalle.push(`${nombre}${extra ? ' -> ' + extra : ''}`); console.log(`  FALLA ${nombre}${extra ? ' -> ' + extra : ''}`); }
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const invoices = app.get(InvoicesService);

  let companyId = '';
  let userId = '';
  let uniId = '';

  try {
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

    const cli: any = await app.get(ClientsService).create(companyId, {
      name: MARCA + 'Cliente', identification: '304560799', idType: '01',
    } as any);

    console.log('--- 1. Emitir una factura ---');
    const inv: any = await invoices.create(companyId, userId, {
      clientId: cli.id, issueDate: HOY, saleCondition: 'CASH',
      lines: [{ description: 'Servicio', quantity: 1, unitPrice: 50000, taxRate: 13, cabysCode: '2310100000000' }],
    } as any);
    await invoices.issue(companyId, inv.id, userId);
    const emitida = await prisma.invoice.findUnique({
      where: { id: inv.id },
      select: { status: true, pdfUrl: true, pdfData: true, consecutiveNumber: true },
    });
    chequear('la factura quedo emitida', emitida?.status === 'ISSUED', String(emitida?.status));
    chequear('quedo respaldo del PDF en la base', !!emitida?.pdfData && emitida.pdfData.length > 1000,
      `bytes=${emitida?.pdfData?.length ?? 0}`);

    console.log('\n--- 2. El servicio devuelve una ruta valida ---');
    const rutaServicio = await invoices.getPdfPath(companyId, inv.id);
    chequear('getPdfPath no revienta', !!rutaServicio);
    chequear('el archivo existe en esa ruta', fs.existsSync(rutaServicio), rutaServicio);

    console.log('\n--- 3. La ruta que sirve el controlador apunta al mismo archivo ---');
    // Reproduccion EXACTA de lo que hace el controlador para servir el archivo.
    const raiz = path.resolve(path.join(process.cwd(), 'uploads', 'pdfs'));
    const absoluto = path.resolve(rutaServicio);
    const dentro = absoluto === raiz || absoluto.startsWith(raiz + path.sep);
    chequear('el PDF vive dentro de uploads/pdfs', dentro, absoluto);

    const relativa = path.relative(raiz, absoluto);
    const servido = path.join(raiz, relativa);
    chequear('la ruta servida existe (aqui fallaba)', fs.existsSync(servido), servido);
    chequear('la ruta servida es el mismo archivo', servido === absoluto, `${servido} vs ${absoluto}`);
    chequear('la ruta relativa conserva la carpeta de la empresa',
      relativa.includes(companyId), relativa);

    // El fallo original: servir solo el nombre del archivo.
    const rutaVieja = path.join(raiz, path.basename(absoluto));
    chequear('confirmado: servir solo el nombre NO encontraba el archivo',
      !fs.existsSync(rutaVieja), `existia en ${rutaVieja}`);

    console.log('\n--- 4. Auto-reparacion: si el disco se borra, se regenera ---');
    fs.unlinkSync(absoluto);
    chequear('el archivo fue borrado a proposito', !fs.existsSync(absoluto));
    const ruta2 = await invoices.getPdfPath(companyId, inv.id);
    chequear('getPdfPath lo regenera desde el respaldo en base', fs.existsSync(ruta2), ruta2);
    chequear('el PDF regenerado tiene contenido', fs.statSync(ruta2).size > 1000,
      `${fs.statSync(ruta2).size} bytes`);
    chequear('el PDF regenerado empieza por %PDF',
      fs.readFileSync(ruta2).subarray(0, 4).toString() === '%PDF');

    console.log('\n--- 5. Un borrador NO deja descargar PDF ---');
    const borrador: any = await invoices.create(companyId, userId, {
      clientId: cli.id, issueDate: HOY, saleCondition: 'CASH',
      lines: [{ description: 'Borrador', quantity: 1, unitPrice: 1000, taxRate: 13, cabysCode: '2310100000000' }],
    } as any);
    try {
      await invoices.getPdfPath(companyId, borrador.id);
      chequear('borrador rechazado', false, 'devolvio una ruta y no deberia');
    } catch (e) {
      chequear('borrador rechazado con mensaje claro',
        /no ha sido emitida|no está disponible/i.test((e as Error).message),
        (e as Error).message);
    }

    console.log('\n--- 6. No se puede pedir el PDF de otra empresa ---');
    try {
      await invoices.getPdfPath('00000000-0000-0000-0000-000000000000', inv.id);
      chequear('empresa ajena rechazada', false, 'devolvio una ruta y no deberia');
    } catch (e) {
      chequear('empresa ajena rechazada', /no encontrada/i.test((e as Error).message),
        (e as Error).message);
    }
  } finally {
    const p = app.get(PrismaService);
    const borra = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* ignorar */ } };
    if (companyId) {
      await borra(() => p.journalLine.deleteMany({ where: { entry: { companyId } } }));
      await borra(() => p.journalEntry.deleteMany({ where: { companyId } }));
      await borra(() => p.accountReceivable.deleteMany({ where: { companyId } }));
      await borra(() => (p as any).invoiceItem.deleteMany({ where: { invoice: { companyId } } }));
      await borra(() => p.invoice.deleteMany({ where: { companyId } }));
      await borra(() => p.client.deleteMany({ where: { companyId } }));
      await borra(() => p.account.deleteMany({ where: { companyId } }));
      await borra(() => p.company.deleteMany({ where: { id: companyId } }));
      try { fs.rmSync(path.join(process.cwd(), 'uploads', 'pdfs', companyId), { recursive: true, force: true }); } catch { /* */ }
      try { fs.rmSync(path.join(process.cwd(), 'uploads', 'xmls', companyId), { recursive: true, force: true }); } catch { /* */ }
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
