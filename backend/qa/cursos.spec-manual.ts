/**
 * Verificacion del alta de cursos contra base de datos real.
 *
 * Cubre el arreglo de "el profesor no puede crear cursos" y, sobre todo, el
 * aislamiento entre instituciones al designar a la persona responsable: es la
 * ruta nueva y la que mas dano haria si estuviera mal.
 *
 * Crea entidades desechables con prefijo __QA_ y las borra al final, pase o
 * falle. NO toca Supabase Auth: los usuarios se insertan directo en Postgres
 * con un authId ficticio, porque lo que se prueba aqui es la logica de cursos.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/prisma/prisma.service';
import { CoursesService } from './src/modules/courses/courses.service';

const MARCA = '__QA_CURSOS_';

let ok = 0;
let fallos = 0;
const detalle: string[] = [];

function chequear(nombre: string, condicion: boolean, extra = '') {
  if (condicion) {
    ok++;
    console.log(`  ok   ${nombre}`);
  } else {
    fallos++;
    detalle.push(`${nombre}${extra ? ' -> ' + extra : ''}`);
    console.log(`  FALLA ${nombre}${extra ? ' -> ' + extra : ''}`);
  }
}

/** Espera que la promesa reviente, y que el mensaje hable de lo correcto. */
async function debeFallar(nombre: string, fn: () => Promise<unknown>, fragmento: string) {
  try {
    await fn();
    chequear(nombre, false, 'NO fallo, y deberia haber fallado');
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    chequear(nombre, msg.toLowerCase().includes(fragmento.toLowerCase()), `mensaje inesperado: "${msg}"`);
  }
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const cursos = app.get(CoursesService);

  const creados = { universidades: [] as string[], usuarios: [] as string[], cursos: [] as string[] };

  try {
    // ── Dos instituciones distintas: sin esto no se puede probar el aislamiento
    const uniA = await prisma.university.create({
      data: { name: MARCA + 'Colegio A', shortName: 'QA-A', maxStudents: 50 },
    });
    const uniB = await prisma.university.create({
      data: { name: MARCA + 'Colegio B', shortName: 'QA-B', maxStudents: 50 },
    });
    creados.universidades.push(uniA.id, uniB.id);

    const nuevoUsuario = async (nombre: string, rol: any, uni: string, activo = true) => {
      const u = await prisma.user.create({
        data: {
          name: MARCA + nombre,
          email: `${MARCA}${nombre}.${Date.now()}${Math.floor(Math.random() * 1e6)}@qa.local`.toLowerCase(),
          role: rol,
          universityId: uni,
          isActive: activo,
          emailVerified: true,
        },
      });
      creados.usuarios.push(u.id);
      return u;
    };

    const profeA = await nuevoUsuario('ProfeA', 'TEACHER', uniA.id);
    const profeA2 = await nuevoUsuario('ProfeA2', 'TEACHER', uniA.id);
    const profeInactivo = await nuevoUsuario('ProfeInactivo', 'TEACHER', uniA.id, false);
    const alumnoA = await nuevoUsuario('AlumnoA', 'STUDENT', uniA.id);
    const adminA = await nuevoUsuario('AdminA', 'ADMIN', uniA.id);
    const profeB = await nuevoUsuario('ProfeB', 'TEACHER', uniB.id);

    const comoProfeA = { id: profeA.id, role: 'TEACHER', universityId: uniA.id };
    const comoAdminA = { id: adminA.id, role: 'ADMIN', universityId: uniA.id };

    console.log('\n--- 1. El profesor puede crear su primer curso ---');
    const c1: any = await cursos.create(uniA.id, comoProfeA, { name: MARCA + 'Contabilidad I' } as any);
    creados.cursos.push(c1.id);
    chequear('crea el curso', !!c1.id);
    chequear('queda a nombre del propio profesor', c1.teacherId === profeA.id);
    chequear('queda en su institucion', c1.universityId === uniA.id);

    console.log('\n--- 2. Un profesor NO puede colgarle un curso a un colega ---');
    await debeFallar(
      'profesor asignando a otro -> rechazado',
      () => cursos.create(uniA.id, comoProfeA, { name: MARCA + 'Intruso', teacherId: profeA2.id } as any),
      'solo la administracion',
    );

    console.log('\n--- 3. La administracion designa responsable ---');
    const c2: any = await cursos.create(uniA.id, comoAdminA, {
      name: MARCA + 'Contabilidad II',
      teacherId: profeA2.id,
    } as any);
    creados.cursos.push(c2.id);
    chequear('el curso queda a nombre del profesor designado', c2.teacherId === profeA2.id);
    chequear('NO queda a nombre del admin', c2.teacherId !== adminA.id);

    console.log('\n--- 4. Aislamiento entre instituciones (lo critico) ---');
    await debeFallar(
      'admin de A asignando profesor de B -> rechazado',
      () => cursos.create(uniA.id, comoAdminA, { name: MARCA + 'Fuga', teacherId: profeB.id } as any),
      'no pertenece a esta institucion',
    );
    await debeFallar(
      'admin de A creando curso EN la institucion B -> rechazado',
      () =>
        cursos.create(uniB.id, comoAdminA, { name: MARCA + 'Fuga2', teacherId: profeB.id } as any),
      'no encontrado',
    );

    console.log('\n--- 5. Personas que no pueden quedar a cargo ---');
    await debeFallar(
      'designar a un estudiante -> rechazado',
      () => cursos.create(uniA.id, comoAdminA, { name: MARCA + 'Alumno', teacherId: alumnoA.id } as any),
      'no tiene rol docente',
    );
    await debeFallar(
      'designar cuenta desactivada -> rechazado',
      () =>
        cursos.create(uniA.id, comoAdminA, { name: MARCA + 'Inactivo', teacherId: profeInactivo.id } as any),
      'desactivada',
    );
    await debeFallar(
      'designar un id inexistente -> rechazado',
      () =>
        cursos.create(uniA.id, comoAdminA, {
          name: MARCA + 'Fantasma',
          teacherId: '00000000-0000-0000-0000-000000000000',
        } as any),
      'no pertenece a esta institucion',
    );

    console.log('\n--- 6. El profesor ve sus cursos (portal profesor) ---');
    const mios: any[] = await cursos.findMine(profeA.id);
    chequear('findMine devuelve el curso recien creado', mios.some((c) => c.id === c1.id));
    chequear(
      'findMine trae la institucion (necesaria para la pantalla)',
      !!mios.find((c) => c.id === c1.id)?.university?.id,
    );
    const deA2: any[] = await cursos.findMine(profeA2.id);
    chequear('el profesor designado por el admin ve su curso', deA2.some((c) => c.id === c2.id));
    chequear('NO ve cursos ajenos', !deA2.some((c) => c.id === c1.id));

    console.log('\n--- 7. Reasignar responsable ---');
    const upd: any = await cursos.update(uniA.id, c2.id, comoAdminA, { teacherId: profeA.id } as any);
    chequear('el admin reasigna el curso', upd.teacherId === profeA.id);
    await debeFallar(
      'un profesor ajeno no puede tocar el curso',
      () => cursos.update(uniA.id, c1.id, { id: profeA2.id, role: 'TEACHER', universityId: uniA.id }, {
        name: MARCA + 'Secuestrado',
      } as any),
      'solo el profesor del curso',
    );

    console.log('\n--- 8. Matricula de estudiantes ---');
    const inscripcion: any = await cursos.enroll(uniA.id, c1.id, { studentId: alumnoA.id } as any, comoProfeA);
    chequear('matricula al estudiante', !!inscripcion);
    const detalleCurso: any = await cursos.findOne(uniA.id, c1.id, comoProfeA);
    chequear('el curso muestra la matricula', !!detalleCurso);
  } finally {
    // Limpieza: pase lo que pase, no dejamos basura en la base.
    const p = app.get(PrismaService);
    await p.enrollment.deleteMany({ where: { course: { name: { startsWith: MARCA } } } }).catch(() => {});
    await p.course.deleteMany({ where: { name: { startsWith: MARCA } } }).catch(() => {});
    await p.user.deleteMany({ where: { name: { startsWith: MARCA } } }).catch(() => {});
    await p.university.deleteMany({ where: { name: { startsWith: MARCA } } }).catch(() => {});
    await app.close();
  }

  console.log(`\n================ RESULTADO: ${ok} ok / ${fallos} fallos ================`);
  if (fallos) {
    console.log('FALLOS:');
    detalle.forEach((d) => console.log('  - ' + d));
  }
  process.exit(fallos ? 1 : 0);
}

main().catch((e) => {
  console.error('ERROR FATAL:', e);
  process.exit(1);
});
