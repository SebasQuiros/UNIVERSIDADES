/**
 * CONTAFÁCIL SQ — Seed de datos iniciales
 * Sebastián Quirós Arroyo © 2026
 *
 * Ejecutar: npx prisma db seed
 * O:        npm run prisma:seed
 */

import { PrismaClient, Role, ExerciseDifficulty, ExerciseType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Crea (o recupera) el usuario en Supabase Auth y devuelve su id (= `sub` del JWT),
 * que se guarda en `User.authId`. La contraseña vive en Supabase; ya no se
 * almacena hash localmente. Idempotente por email.
 *
 * Si faltan las envs de Supabase, se omite y se deja `authId = null`: la
 * estrategia JWT enlaza por email en el primer login.
 */
async function ensureAuthUser(
  email: string,
  password: string,
  meta: Record<string, unknown>,
): Promise<string | null> {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    console.warn(
      `⚠ SUPABASE_URL/SERVICE_ROLE_KEY ausentes — ${email} se crea sin authId (se enlazará por email en el primer login).`,
    );
    return null;
  }
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: meta,
    }),
  });
  if (res.ok) {
    const data: any = await res.json();
    return data.id;
  }
  // Email ya registrado → recuperar el id existente (idempotencia), paginando.
  if (res.status === 422 || res.status === 409) {
    const target = email.toLowerCase();
    for (let page = 1; page <= 100; page++) {
      const lookup = await fetch(
        `${url}/auth/v1/admin/users?page=${page}&per_page=200`,
        { headers },
      );
      if (!lookup.ok) break;
      const data: any = await lookup.json();
      const users: any[] = data.users || (Array.isArray(data) ? data : []);
      const match = users.find((u) => (u.email || '').toLowerCase() === target);
      if (match) return match.id;
      if (users.length < 200) break;
    }
  }
  console.warn(`⚠ No se pudo crear ${email} en Supabase Auth (${res.status}).`);
  return null;
}

async function main() {
  console.log('🌱 Iniciando seed de CONTAFÁCIL SQ...\n');

  // ── 1. Plan ──────────────────────────────────────────────────
  const plan = await prisma.plan.upsert({
    where: { id: 'a0000001-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id:          'a0000001-0000-4000-8000-000000000001',
      name:        'Professional',
      maxStudents: 5000,
      maxCourses:  50,
      priceUsd:    149,
      features: {
        support:   'priority',
        analytics: true,
        api:       true,
      },
    },
  });
  console.log(`✓ Plan creado: ${plan.name}`);

  // ── 2. Universidad ───────────────────────────────────────────
  const university = await prisma.university.upsert({
    where: { id: 'b0000001-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id:         'b0000001-0000-4000-8000-000000000001',
      name:       'Universidad Técnica Nacional',
      shortName:  'UTN',
      country:    'Costa Rica',
      website:    'https://www.utn.ac.cr',
      planId:     plan.id,
      maxStudents: 5000,
    },
  });
  console.log(`✓ Universidad creada: ${university.name}`);

  // ── 3. Usuarios ──────────────────────────────────────────────
  // La identidad y la contraseña viven en Supabase Auth; guardamos solo el authId.
  const adminAuthId    = await ensureAuthUser('admin@contafacil.cr',       'Admin2026!',        { name: 'Super Admin',                role: 'SUPERADMIN' });
  const teacherAuthId  = await ensureAuthUser('profesor@contafacil.cr',    'Profesor2026!',     { name: 'Prof. Ana Bermúdez Solano',  role: 'TEACHER' });
  const student1AuthId = await ensureAuthUser('estudiante1@contafacil.cr', 'Estudiante1-2026!', { name: 'María Alvarado Jiménez',     role: 'STUDENT' });
  const student2AuthId = await ensureAuthUser('estudiante2@contafacil.cr', 'Estudiante2-2026!', { name: 'Carlos Mora Rodríguez',      role: 'STUDENT' });

  // Super Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@contafacil.cr' },
    update: adminAuthId ? { authId: adminAuthId } : {},
    create: {
      id:           'c0000001-0000-4000-8000-000000000001',
      name:         'Super Admin',
      email:        'admin@contafacil.cr',
      authId:       adminAuthId,
      role:         Role.SUPERADMIN,
      isActive:     true,
      emailVerified: true,
    },
  });
  console.log(`✓ Admin creado: ${admin.email}`);

  // Profesor
  const teacher = await prisma.user.upsert({
    where: { email: 'profesor@contafacil.cr' },
    update: teacherAuthId ? { authId: teacherAuthId } : {},
    create: {
      id:           'c0000001-0000-4000-8000-000000000002',
      name:         'Prof. Ana Bermúdez Solano',
      email:        'profesor@contafacil.cr',
      authId:       teacherAuthId,
      role:         Role.TEACHER,
      universityId: university.id,
      isActive:     true,
      emailVerified: true,
    },
  });
  console.log(`✓ Profesor creado: ${teacher.email}`);

  // Estudiante 1
  const student1 = await prisma.user.upsert({
    where: { email: 'estudiante1@contafacil.cr' },
    update: student1AuthId ? { authId: student1AuthId } : {},
    create: {
      id:           'c0000001-0000-4000-8000-000000000003',
      name:         'María Alvarado Jiménez',
      email:        'estudiante1@contafacil.cr',
      authId:       student1AuthId,
      role:         Role.STUDENT,
      universityId: university.id,
      isActive:     true,
      emailVerified: true,
    },
  });
  console.log(`✓ Estudiante 1 creado: ${student1.email}`);

  // Estudiante 2
  const student2 = await prisma.user.upsert({
    where: { email: 'estudiante2@contafacil.cr' },
    update: student2AuthId ? { authId: student2AuthId } : {},
    create: {
      id:           'c0000001-0000-4000-8000-000000000004',
      name:         'Carlos Mora Rodríguez',
      email:        'estudiante2@contafacil.cr',
      authId:       student2AuthId,
      role:         Role.STUDENT,
      universityId: university.id,
      isActive:     true,
      emailVerified: true,
    },
  });
  console.log(`✓ Estudiante 2 creado: ${student2.email}`);

  // ── 4. Curso ─────────────────────────────────────────────────
  const course = await prisma.course.upsert({
    where: { id: 'd0000001-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id:           'd0000001-0000-4000-8000-000000000001',
      universityId: university.id,
      teacherId:    teacher.id,
      name:         'Contabilidad I - 2026',
      description:  'Principios de contabilidad y facturación electrónica costarricense',
      code:         'CONT-1001',
      period:       '2026-I',
    },
  });
  console.log(`✓ Curso creado: ${course.name}`);

  // Inscripciones
  for (const student of [student1, student2]) {
    await prisma.enrollment.upsert({
      where: {
        courseId_studentId: {
          courseId:  course.id,
          studentId: student.id,
        },
      },
      update: {},
      create: {
        courseId:  course.id,
        studentId: student.id,
      },
    });
  }
  console.log(`✓ 2 estudiantes inscritos en el curso`);

  // ── 5. Ejercicio ─────────────────────────────────────────────
  const exercise = await prisma.exercise.upsert({
    where: { id: 'e0000001-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id:          'e0000001-0000-4000-8000-000000000001',
      courseId:    course.id,
      teacherId:   teacher.id,
      title:       'Ejercicio 1: Operaciones Básicas de Contabilidad',
      description: 'Registro de operaciones comerciales básicas con facturación electrónica costarricense.',
      instructions: `OBJETIVO
Familiarizarse con el sistema contable y el flujo de facturación electrónica de Costa Rica.

INSTRUCCIONES
1. Configure su empresa simulada con datos ficticios pero coherentes.
2. Registre al menos 5 clientes con cédulas de Costa Rica.
3. Cree al menos 8 productos con códigos CABYS de 13 dígitos.
4. Emita 10 facturas electrónicas a diferentes clientes.
5. Verifique que todos los asientos contables se generaron automáticamente.
6. Genere el Balance de Comprobación y verifique que cuadra.
7. Genere el Estado de Resultados del período.

CRITERIOS DE EVALUACIÓN
- Configuración correcta de la empresa (10 pts)
- Registro correcto de clientes y productos con CABYS (20 pts)
- Facturación electrónica con XML válido (30 pts)
- Asientos contables balanceados (25 pts)
- Reportes financieros correctos (15 pts)`,
      difficulty:  ExerciseDifficulty.BASIC,
      type:        ExerciseType.FULL_CYCLE,
      maxScore:    100,
      isPublished: true,
    },
  });
  console.log(`✓ Ejercicio creado: ${exercise.title}`);

  // Rúbricas del ejercicio
  const rubrics = [
    { criterion: 'company_setup',     description: 'Empresa configurada correctamente con datos completos',          expectedValue: 'true', points: 10 },
    { criterion: 'min_clients',       description: 'Registrar al menos 5 clientes con identificación válida',        expectedValue: '5',    points: 10 },
    { criterion: 'min_products',      description: 'Crear al menos 8 productos con código CABYS de 13 dígitos',      expectedValue: '8',    points: 10 },
    { criterion: 'min_invoices',      description: 'Emitir al menos 10 facturas electrónicas validadas',             expectedValue: '10',   points: 30 },
    { criterion: 'balanced_entries',  description: 'Todos los asientos contables deben estar balanceados (D=C)',      expectedValue: 'true', points: 25 },
    { criterion: 'balanced_sheet',    description: 'El Balance General debe cuadrar (Activos = Pasivos + Patrimonio)', expectedValue: 'true', points: 15 },
  ];

  for (let i = 0; i < rubrics.length; i++) {
    const r = rubrics[i];
    await prisma.exerciseRubric.create({
      data: {
        exerciseId:    exercise.id,
        criterion:     r.criterion,
        description:   r.description,
        expectedValue: r.expectedValue,
        points:        r.points,
        order:         i + 1,
      },
    }).catch(() => {}); // Ignorar si ya existe
  }
  console.log(`✓ ${rubrics.length} rúbricas de evaluación creadas`);

  // ── Resumen ──────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════');
  console.log('✅ Seed completado exitosamente');
  console.log('════════════════════════════════════════════════');
  console.log('\n📋 CREDENCIALES DE ACCESO:');
  console.log('┌─────────────────────────────────────────────┐');
  console.log('│  Rol        │ Email                │ Password        │');
  console.log('│─────────────│──────────────────────│─────────────────│');
  console.log('│  Super Admin│ admin@contafacil.cr  │ Admin2026!      │');
  console.log('│  Profesor   │ profesor@contafacil.cr│ Profesor2026!  │');
  console.log('│  Estudiante1│ estudiante1@contafacil.cr│ Estudiante1-2026!│');
  console.log('│  Estudiante2│ estudiante2@contafacil.cr│ Estudiante2-2026!│');
  console.log('└─────────────────────────────────────────────┘\n');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
