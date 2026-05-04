/**
 * CONTAFÁCIL SQ — Seed de datos iniciales
 * Sebastián Quirós Arroyo © 2026
 *
 * Ejecutar: npx prisma db seed
 * O:        npm run prisma:seed
 */

import { PrismaClient, Role, ExerciseDifficulty, ExerciseType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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
  const saltRounds = 10;

  const adminHash    = await bcrypt.hash('Admin2026!', saltRounds);
  const teacherHash  = await bcrypt.hash('Profesor2026!', saltRounds);
  const student1Hash = await bcrypt.hash('Estudiante1-2026!', saltRounds);
  const student2Hash = await bcrypt.hash('Estudiante2-2026!', saltRounds);

  // Super Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@contafacil.cr' },
    update: {},
    create: {
      id:           'c0000001-0000-4000-8000-000000000001',
      name:         'Super Admin',
      email:        'admin@contafacil.cr',
      passwordHash: adminHash,
      role:         Role.SUPERADMIN,
      isActive:     true,
      emailVerified: true,
    },
  });
  console.log(`✓ Admin creado: ${admin.email}`);

  // Profesor
  const teacher = await prisma.user.upsert({
    where: { email: 'profesor@contafacil.cr' },
    update: {},
    create: {
      id:           'c0000001-0000-4000-8000-000000000002',
      name:         'Prof. Ana Bermúdez Solano',
      email:        'profesor@contafacil.cr',
      passwordHash: teacherHash,
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
    update: {},
    create: {
      id:           'c0000001-0000-4000-8000-000000000003',
      name:         'María Alvarado Jiménez',
      email:        'estudiante1@contafacil.cr',
      passwordHash: student1Hash,
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
    update: {},
    create: {
      id:           'c0000001-0000-4000-8000-000000000004',
      name:         'Carlos Mora Rodríguez',
      email:        'estudiante2@contafacil.cr',
      passwordHash: student2Hash,
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
