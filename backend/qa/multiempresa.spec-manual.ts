/**
 * Espacio Multiempresa: el aula donde los grupos comercian entre si.
 *
 * El modelo es: el profesor abre un aula con UN codigo, los estudiantes
 * entran, se arman en grupos, y cada grupo opera UNA empresa compartida que
 * le factura a los otros grupos de la misma aula.
 *
 * Esta prueba recorre ese camino y vigila lo que no puede fallar:
 *   · el codigo deja entrar a quien es de la institucion y a nadie mas
 *   · un grupo = una empresa, compartida por sus integrantes
 *   · cada estudiante puede preguntar en que aulas esta
 *   · un aula no ve los grupos de otra
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClassSessionsService } from '../src/modules/class-sessions/class-sessions.service';

const MARCA = '__QA_MULTI_';

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

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const sesiones = app.get(ClassSessionsService);

  try {
    console.log('--- 0. Montaje: dos instituciones, un curso y su aula ---');
    const uniA = await prisma.university.create({ data: { name: MARCA + 'UniA', shortName: 'QMA' } });
    const uniB = await prisma.university.create({ data: { name: MARCA + 'UniB', shortName: 'QMB' } });

    const crear = async (etq: string, rol: any, uni: string) => prisma.user.create({
      data: {
        name: MARCA + etq,
        email: `${MARCA}${etq}.${Date.now()}${Math.floor(Math.random() * 1e6)}@qa.local`.toLowerCase(),
        role: rol, universityId: uni, isActive: true, emailVerified: true,
      },
    });

    const profe = await crear('Profe', 'TEACHER', uniA.id);
    const alumnos: any[] = [];
    for (let i = 1; i <= 5; i++) alumnos.push(await crear('Alumno' + i, 'STUDENT', uniA.id));
    const ajeno = await crear('Ajeno', 'STUDENT', uniB.id);

    const curso = await prisma.course.create({
      data: { universityId: uniA.id, teacherId: profe.id, name: MARCA + 'Curso', isActive: true },
    });
    const ejercicio = await prisma.exercise.create({
      data: {
        courseId: curso.id, teacherId: profe.id, title: MARCA + 'Aula multiempresa',
        difficulty: 'INTERMEDIATE', type: 'FULL_CYCLE', maxScore: 100, isPublished: true,
      },
    });

    const comoProfe: any = { id: profe.id, role: 'TEACHER', universityId: uniA.id };

    console.log('\n--- 1. El profesor abre el aula ---');
    const aula: any = await sesiones.createForExercise(ejercicio.id, comoProfe, {
      minGroupSize: 3, maxGroupSize: 6,
    } as any);
    chequear('el aula se crea', !!aula?.id);
    chequear('trae un codigo para proyectar', !!aula?.code && aula.code.length >= 4, String(aula?.code));
    chequear('nace sin abrir', aula.status === 'DRAFT', String(aula.status));

    await sesiones.openLobby(aula.id);
    const trasAbrir = await prisma.classSession.findUnique({ where: { id: aula.id } });
    chequear('al abrir pasa a armar grupos', trasAbrir?.status === 'LOBBY', String(trasAbrir?.status));

    console.log('\n--- 2. Los estudiantes entran con el codigo ---');
    for (const [i, al] of alumnos.entries()) {
      const r: any = await sesiones.join(
        { id: al.id, role: 'STUDENT', universityId: uniA.id } as any,
        { code: aula.code } as any,
      );
      if (i === 0) chequear('el primero entra', r.classSessionId === aula.id);
    }
    const participantes = await prisma.classSessionParticipant.count({ where: { classSessionId: aula.id } });
    chequear('entraron los cinco', participantes === 5, String(participantes));

    // Volver a entrar no debe duplicar: un doble clic no puede crear dos cupos.
    await sesiones.join({ id: alumnos[0].id, role: 'STUDENT', universityId: uniA.id } as any, { code: aula.code } as any);
    const trasRepetir = await prisma.classSessionParticipant.count({ where: { classSessionId: aula.id } });
    chequear('entrar dos veces no duplica el cupo', trasRepetir === 5, String(trasRepetir));

    console.log('\n--- 3. Aislamiento: el codigo no abre puertas de otra institucion ---');
    await debeFallar(
      'un alumno de otra institucion NO entra',
      () => sesiones.join({ id: ajeno.id, role: 'STUDENT', universityId: uniB.id } as any, { code: aula.code } as any),
      'otra institución',
    );
    await debeFallar(
      'un usuario SIN institucion NO entra',
      () => sesiones.join({ id: ajeno.id, role: 'STUDENT', universityId: null } as any, { code: aula.code } as any),
      'otra institución',
    );
    await debeFallar(
      'un codigo inventado no sirve',
      () => sesiones.join({ id: alumnos[0].id, role: 'STUDENT', universityId: uniA.id } as any, { code: 'ZZZZZZ' } as any),
      'inválido',
    );

    console.log('\n--- 4. Un grupo = una empresa compartida ---');
    // Cada grupo es un tipo de negocio distinto -ferreteria, agencia, bufete,
    // distribuidor-: de ahi sale que tengan algo que venderse entre si.
    const grupo: any = await sesiones.createGroup(aula.id, comoProfe, {
      name: MARCA + 'Grupo Sebastian',
      archetype: 'FERRETERIA',
    } as any).catch((e: any) => ({ __error: e.message }));

    const grupo2: any = await sesiones.createGroup(aula.id, comoProfe, {
      name: MARCA + 'Grupo Rival',
      archetype: 'DISTRIBUIDOR',
    } as any).catch((e: any) => ({ __error: e.message }));
    chequear('se crea un segundo grupo con otro arquetipo', !grupo2?.__error,
      grupo2?.__error?.slice(0, 100) ?? '');

    // Los participantes se reparten entre los grupos existentes.
    await sesiones.autoAssign(aula.id).catch(() => null);

    if (grupo?.__error) {
      chequear('crear el grupo', false, grupo.__error.slice(0, 120));
    } else {
      chequear('el grupo se crea', !!grupo);
      const empresas = await prisma.company.findMany({
        where: { exerciseId: ejercicio.id },
        select: { id: true, name: true, mode: true, isPractice: true, _count: { select: { memberships: true } } },
      });
      chequear('cada grupo tiene UNA empresa', empresas.length === 2, String(empresas.length));
      chequear('las empresas son de modo GROUP (compartidas)',
        empresas.every((e) => e.mode === 'GROUP'), empresas.map((e) => e.mode).join(','));
      chequear('NINGUNA es empresa de practica del Espacio Contador',
        empresas.every((e) => !e.isPractice));
      const repartidos = empresas.reduce((n, e) => n + e._count.memberships, 0);
      chequear('los cinco estudiantes quedaron repartidos en los grupos',
        repartidos === 5, `${repartidos} de 5`);
      const sinGrupo = await prisma.classSessionParticipant.count({
        where: { classSessionId: aula.id, companyId: null },
      });
      chequear('nadie quedo sin grupo', sinGrupo === 0, `${sinGrupo} sin asignar`);
    }

    console.log('\n--- 5. Cada estudiante ve sus aulas ---');
    const mias: any[] = await sesiones.misSesiones(alumnos[0].id);
    chequear('devuelve el aula', mias.some((m) => m.classSessionId === aula.id));
    const mia = mias.find((m) => m.classSessionId === aula.id);
    chequear('trae el codigo', !!mia?.code);
    chequear('trae el ejercicio y su curso', !!mia?.exercise?.title && !!mia?.exercise?.course?.name);
    chequear('trae el profesor', !!mia?.exercise?.teacher?.name);
    chequear('trae la empresa del grupo', !!mia?.empresa?.name, JSON.stringify(mia?.empresa ?? null));

    const ajenas: any[] = await sesiones.misSesiones(ajeno.id);
    chequear('un alumno de otra institucion no ve esta aula',
      !ajenas.some((m) => m.classSessionId === aula.id));

    console.log('\n--- 6. Dos aulas no se mezclan ---');
    const ejercicio2 = await prisma.exercise.create({
      data: {
        courseId: curso.id, teacherId: profe.id, title: MARCA + 'Otra aula',
        difficulty: 'BASIC', type: 'FULL_CYCLE', maxScore: 100, isPublished: true,
      },
    });
    const aula2: any = await sesiones.createForExercise(ejercicio2.id, comoProfe, {
      minGroupSize: 2, maxGroupSize: 4,
    } as any);
    chequear('la segunda aula tiene OTRO codigo', aula2.code !== aula.code, `${aula.code} vs ${aula2.code}`);
    const partAula2 = await prisma.classSessionParticipant.count({ where: { classSessionId: aula2.id } });
    chequear('la segunda aula nace vacia', partAula2 === 0, String(partAula2));
  } finally {
    const p = app.get(PrismaService);
    const borra = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* */ } };
    const ejercicios = await p.exercise.findMany({ where: { title: { startsWith: MARCA } }, select: { id: true } }).catch(() => []);
    const ids = ejercicios.map((e) => e.id);
    if (ids.length) {
      const empresas = await p.company.findMany({ where: { exerciseId: { in: ids } }, select: { id: true } }).catch(() => []);
      for (const c of empresas) {
        await borra(() => p.journalLine.deleteMany({ where: { entry: { companyId: c.id } } }));
        await borra(() => p.journalEntry.deleteMany({ where: { companyId: c.id } }));
        await borra(() => (p as any).companyMembership.deleteMany({ where: { companyId: c.id } }));
        await borra(() => p.account.deleteMany({ where: { companyId: c.id } }));
      }
      await borra(() => p.classSessionParticipant.deleteMany({ where: { classSession: { exerciseId: { in: ids } } } }));
      await borra(() => p.classSession.deleteMany({ where: { exerciseId: { in: ids } } }));
      await borra(() => p.company.deleteMany({ where: { exerciseId: { in: ids } } }));
      await borra(() => p.exerciseAttempt.deleteMany({ where: { exerciseId: { in: ids } } }));
      await borra(() => p.exercise.deleteMany({ where: { id: { in: ids } } }));
    }
    await borra(() => p.course.deleteMany({ where: { name: { startsWith: MARCA } } }));
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
