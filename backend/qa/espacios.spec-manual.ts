/**
 * Aislamiento entre el Espacio Contador y el Espacio Educación.
 *
 * Son dos mundos separados: las empresas de práctica que un estudiante arma
 * por su cuenta no tienen nada que ver con las empresas de sus ejercicios, y
 * NINGUNA cifra puede cruzar de un lado al otro.
 *
 * Esto se rompió de verdad: el listado de Educación no excluía las empresas
 * de práctica, así que un estudiante veía el IVA por pagar y la utilidad del
 * período de su empresa del Espacio Contador en el panel de Educación, sin
 * haber iniciado ningún ejercicio.
 *
 * La prueba mira en las DOS direcciones, porque una fuga al revés —ver
 * empresas de ejercicio dentro del Espacio Contador— sería igual de mala.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CompaniesService } from '../src/modules/companies/companies.service';

const MARCA = '__QA_ESP_';

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
  const companies = app.get(CompaniesService);

  const creado = { uni: '', alumno: '', otroAlumno: '', practica: '', ejercicio: '', ajena: '' };

  try {
    console.log('--- 0. Montaje ---');
    const uni = await prisma.university.create({ data: { name: MARCA + 'Uni', shortName: 'QAE' } });
    creado.uni = uni.id;

    const nuevoAlumno = async (etiqueta: string) => {
      const u = await prisma.user.create({
        data: {
          name: MARCA + etiqueta,
          email: `${MARCA}${etiqueta}.${Date.now()}${Math.floor(Math.random() * 1e6)}@qa.local`.toLowerCase(),
          role: 'STUDENT', universityId: uni.id, isActive: true, emailVerified: true,
        },
      });
      return u;
    };
    const alumno = await nuevoAlumno('Alumno');
    const otro   = await nuevoAlumno('Otro');
    creado.alumno = alumno.id;
    creado.otroAlumno = otro.id;

    // Empresa del ESPACIO CONTADOR (práctica libre, sin ejercicio).
    const practica = await prisma.company.create({
      data: {
        name: MARCA + 'Practica', legalId: '3101' + String(Date.now()).slice(-6),
        studentId: alumno.id, isPractice: true, mode: 'INDIVIDUAL',
      },
    });
    creado.practica = practica.id;

    // Empresa del ESPACIO EDUCACIÓN (ligada a un ejercicio).
    const ejercicioCo = await prisma.company.create({
      data: {
        name: MARCA + 'Ejercicio', legalId: '3102' + String(Date.now()).slice(-6),
        studentId: alumno.id, isPractice: false, mode: 'INDIVIDUAL',
      },
    });
    creado.ejercicio = ejercicioCo.id;

    // Empresa de práctica de OTRO estudiante.
    const ajena = await prisma.company.create({
      data: {
        name: MARCA + 'Ajena', legalId: '3103' + String(Date.now()).slice(-6),
        studentId: otro.id, isPractice: true, mode: 'INDIVIDUAL',
      },
    });
    creado.ajena = ajena.id;

    console.log('\n--- 1. El listado de EDUCACIÓN no ve el Espacio Contador ---');
    const educacion: any[] = await companies.findByStudent(alumno.id);
    const idsEdu = educacion.map((c) => c.id);
    chequear('incluye la empresa del ejercicio', idsEdu.includes(ejercicioCo.id));
    chequear('NO incluye la empresa de práctica', !idsEdu.includes(practica.id),
      'la empresa del Espacio Contador se está colando en Educación');
    chequear('ninguna empresa marcada como práctica',
      educacion.every((c) => c.isPractice === false),
      educacion.filter((c) => c.isPractice).map((c) => c.name).join(', '));

    console.log('\n--- 2. El Espacio Contador no ve las de ejercicio ---');
    const practicas: any[] = await companies.listPractice(alumno.id);
    const idsPra = practicas.map((c) => c.id);
    chequear('incluye la empresa de práctica', idsPra.includes(practica.id));
    chequear('NO incluye la empresa del ejercicio', !idsPra.includes(ejercicioCo.id),
      'una empresa de ejercicio se está colando en el Espacio Contador');

    console.log('\n--- 3. Sin ejercicio iniciado, Educación va vacía ---');
    // Es el caso exacto que se reportó: un estudiante que solo tiene empresa
    // de práctica no debe ver NADA en el panel de Educación.
    const soloPractica = await nuevoAlumno('SoloPractica');
    await prisma.company.create({
      data: {
        name: MARCA + 'SoloPractica', legalId: '3104' + String(Date.now()).slice(-6),
        studentId: soloPractica.id, isPractice: true, mode: 'INDIVIDUAL',
      },
    });
    const eduVacia: any[] = await companies.findByStudent(soloPractica.id);
    chequear('el panel de Educación no muestra ninguna empresa', eduVacia.length === 0,
      `devolvió ${eduVacia.length}: ${eduVacia.map((c) => c.name).join(', ')}`);
    const praLlena: any[] = await companies.listPractice(soloPractica.id);
    chequear('pero el Espacio Contador sí muestra la suya', praLlena.length === 1);

    console.log('\n--- 4. Aislamiento entre estudiantes (no se rompió) ---');
    chequear('no ve empresas de otro estudiante en Educación', !idsEdu.includes(ajena.id));
    chequear('no ve empresas de otro estudiante en el Contador', !idsPra.includes(ajena.id));
    const ajenoEdu: any[] = await companies.findByStudent(otro.id);
    chequear('el otro estudiante no ve las de este',
      !ajenoEdu.some((c) => c.id === ejercicioCo.id || c.id === practica.id));
  } finally {
    const p = app.get(PrismaService);
    const borra = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* */ } };
    await borra(() => p.company.deleteMany({ where: { name: { startsWith: MARCA } } }));
    const usuarios = await p.user.findMany({ where: { name: { startsWith: MARCA } }, select: { id: true } }).catch(() => []);
    for (const u of usuarios) {
      await borra(() => (p as any).activityLog.deleteMany({ where: { userId: u.id } }));
      await borra(() => p.user.delete({ where: { id: u.id } }));
    }
    await borra(() => p.university.deleteMany({ where: { name: { startsWith: MARCA } } }));
    await app.close();
  }

  console.log(`\n================ RESULTADO: ${ok} ok / ${fallos} fallos ================`);
  if (fallos) { console.log('FALLOS:'); detalle.forEach((d) => console.log('  - ' + d)); }
  process.exit(fallos ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
