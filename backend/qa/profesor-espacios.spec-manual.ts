/**
 * El profesor entrando a los espacios del estudiante.
 *
 * Un profesor puede -y debe- recorrer Educacion y Contador para ver el sistema
 * como lo ve un alumno. Eso reventaba con "Algo salio mal".
 *
 * La causa: `/attempts` sin `?mine=true` le devuelve al profesor los intentos
 * de TODOS sus estudiantes, y esa respuesta tiene otra forma -no trae
 * difficulty, dueDate, maxScore ni company- porque esta pensada para el portal
 * docente. La pantalla del estudiante leia `difficulty` de ahi y tumbaba el
 * render del arbol completo.
 *
 * Esta prueba fija las dos formas y la diferencia entre ellas.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AttemptsService } from '../src/modules/attempts/attempts.service';
import { CompaniesService } from '../src/modules/companies/companies.service';

const MARCA = '__QA_PROF_';

let ok = 0, fallos = 0;
const detalle: string[] = [];
function chequear(nombre: string, cond: boolean, extra = '') {
  if (cond) { ok++; console.log(`  ok   ${nombre}`); }
  else { fallos++; detalle.push(`${nombre}${extra ? ' -> ' + extra : ''}`); console.log(`  FALLA ${nombre}${extra ? ' -> ' + extra : ''}`); }
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const attempts = app.get(AttemptsService);
  const companies = app.get(CompaniesService);

  try {
    console.log('--- 0. Montaje: un curso, su profesor y un alumno ---');
    const uni = await prisma.university.create({ data: { name: MARCA + 'Uni', shortName: 'QAPR' } });

    const crear = async (etiqueta: string, rol: any) => prisma.user.create({
      data: {
        name: MARCA + etiqueta,
        email: `${MARCA}${etiqueta}.${Date.now()}${Math.floor(Math.random() * 1e6)}@qa.local`.toLowerCase(),
        role: rol, universityId: uni.id, isActive: true, emailVerified: true,
      },
    });
    const profe  = await crear('Profe', 'TEACHER');
    const alumno = await crear('Alumno', 'STUDENT');

    const curso = await prisma.course.create({
      data: { universityId: uni.id, teacherId: profe.id, name: MARCA + 'Curso', isActive: true },
    });
    const ejercicio = await prisma.exercise.create({
      data: {
        courseId: curso.id, teacherId: profe.id, title: MARCA + 'Ejercicio',
        difficulty: 'INTERMEDIATE', type: 'FULL_CYCLE', maxScore: 100, isPublished: true,
      },
    });

    // Un intento del ALUMNO y uno propio del PROFESOR (su vista previa).
    await prisma.exerciseAttempt.create({
      data: { exerciseId: ejercicio.id, studentId: alumno.id, status: 'IN_PROGRESS', maxScore: 100 },
    });
    const suyo = await prisma.exerciseAttempt.create({
      data: { exerciseId: ejercicio.id, studentId: profe.id, status: 'NOT_STARTED', maxScore: 100 },
    });

    console.log('\n--- 1. Portal docente: ve los intentos de sus estudiantes ---');
    const comoDocente: any[] = await attempts.findAll(profe.id, 'TEACHER', false);
    chequear('el profesor ve el intento del alumno',
      comoDocente.some((a) => a.studentId === alumno.id));

    console.log('\n--- 2. Espacio Educacion: ?mine=true devuelve SOLO lo suyo ---');
    const comoAlumno: any[] = await attempts.findAll(profe.id, 'TEACHER', true);
    chequear('devuelve su propio intento', comoAlumno.some((a) => a.id === suyo.id));
    chequear('NO devuelve el del alumno',
      !comoAlumno.some((a) => a.studentId === alumno.id),
      'el profesor veria mezclados los intentos de sus estudiantes');

    console.log('\n--- 3. La forma que espera la pantalla del estudiante ---');
    const mio = comoAlumno.find((a) => a.id === suyo.id);
    chequear('trae exercise.difficulty (aqui reventaba)',
      !!mio?.exercise?.difficulty, String(mio?.exercise?.difficulty));
    chequear('trae exercise.type', !!mio?.exercise?.type, String(mio?.exercise?.type));
    chequear('trae exercise.maxScore', mio?.exercise?.maxScore !== undefined);
    chequear('trae el curso', !!mio?.exercise?.course?.name);
    chequear('la clave company existe (aunque venga vacia)', 'company' in (mio ?? {}));

    // Y la confirmacion de que la otra forma NO la trae: es la que rompia.
    const delAlumno = comoDocente.find((a) => a.studentId === alumno.id);
    chequear('la respuesta del portal docente NO trae difficulty',
      delAlumno?.exercise?.difficulty === undefined,
      'si la trajera, el diagnostico estaria mal');

    console.log('\n--- 4. Espacio Contador del profesor ---');
    const practicaProfe = await prisma.company.create({
      data: {
        name: MARCA + 'PracticaProfe', legalId: '3109' + String(Date.now()).slice(-6),
        studentId: profe.id, isPractice: true, mode: 'INDIVIDUAL',
      },
    });
    const suPractica: any[] = await companies.listPractice(profe.id);
    chequear('el profesor ve su empresa de practica',
      suPractica.some((c) => c.id === practicaProfe.id));
    const suEducacion: any[] = await companies.findByStudent(profe.id);
    chequear('y esa empresa NO se cuela en su espacio Educacion',
      !suEducacion.some((c) => c.id === practicaProfe.id));
  } finally {
    const p = app.get(PrismaService);
    const borra = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* */ } };
    await borra(() => p.exerciseAttempt.deleteMany({ where: { exercise: { title: { startsWith: MARCA } } } }));
    await borra(() => p.exercise.deleteMany({ where: { title: { startsWith: MARCA } } }));
    await borra(() => p.course.deleteMany({ where: { name: { startsWith: MARCA } } }));
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
