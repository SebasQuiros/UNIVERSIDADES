/**
 * Alta publica de instituciones: cerrada con codigo de invitacion.
 *
 * La ruta POST /onboarding/university es publica -tiene que serlo, es por
 * donde entra un cliente nuevo- y crea una institucion MAS un usuario
 * administrador en el proveedor de identidad. Sin codigo, cualquiera que
 * diera con la direccion podia abrir instituciones.
 *
 * Lo que se vigila: que sin codigo valido NO se cree NADA. Ni institucion,
 * ni usuario, ni identidad en Supabase. Un rechazo que igual deja basura
 * creada no es un rechazo.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OnboardingService } from '../src/modules/onboarding/onboarding.service';
import { SupabaseAdminService } from '../src/common/supabase/supabase-admin.service';

const MARCA = '__QA_ONB_';
const CODIGO = 'CODIGO-DE-PRUEBA-123';

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
    chequear(nombre, m.toLowerCase().includes(frag.toLowerCase()), `mensaje: "${m.slice(0, 100)}"`);
  }
}

function datos(n: number, codigo: string) {
  return {
    invitationCode: codigo,
    universityName: `${MARCA}Instituto ${n}`,
    universityShortName: `QO${n}`,
    country: 'Costa Rica',
    adminName: `${MARCA}Admin ${n}`,
    adminEmail: `${MARCA}admin${n}.${Date.now()}@qa.local`.toLowerCase(),
    acceptedTerms: true,
  } as any;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const onboarding = app.get(OnboardingService);
  const supa = app.get(SupabaseAdminService);

  // No se crean identidades de verdad por correr una prueba. Se cuenta
  // cuantas VECES se habria pedido crearlas: ese es el dato que importa.
  let identidadesPedidas = 0;
  (supa as any).createUser = async () => {
    identidadesPedidas += 1;
    return 'auth-qa-' + Date.now() + Math.floor(Math.random() * 1e6);
  };
  (supa as any).deleteUser = async () => { /* no-op */ };

  const original = process.env.ONBOARDING_INVITE_CODE;

  const contarInstituciones = () =>
    prisma.university.count({ where: { name: { startsWith: MARCA } } });

  try {
    console.log('--- 1. Sin codigo configurado: el alta queda CERRADA ---');
    delete process.env.ONBOARDING_INVITE_CODE;
    let antes = await contarInstituciones();
    let identAntes = identidadesPedidas;
    await debeFallar(
      'con la variable sin configurar, no se puede registrar',
      () => onboarding.registerUniversity(datos(1, 'lo-que-sea')),
      'no esta habilitado',
    );
    chequear('no se creo ninguna institucion', (await contarInstituciones()) === antes);
    chequear('no se pidio crear ninguna identidad', identidadesPedidas === identAntes);

    console.log('\n--- 2. Con codigo configurado, pero mal escrito ---');
    process.env.ONBOARDING_INVITE_CODE = CODIGO;
    antes = await contarInstituciones();
    identAntes = identidadesPedidas;

    for (const [etiqueta, intento] of [
      ['vacio',            ''],
      ['equivocado',       'otro-codigo-cualquiera'],
      ['con may/min al reves', CODIGO.toLowerCase()],
      ['prefijo correcto', CODIGO.slice(0, 8)],
      ['con basura al final', CODIGO + 'x'],
    ] as const) {
      await debeFallar(`codigo ${etiqueta} -> rechazado`,
        () => onboarding.registerUniversity(datos(2, intento)), 'codigo de invitacion');
    }
    chequear('ningun intento fallido creo institucion', (await contarInstituciones()) === antes,
      `${(await contarInstituciones()) - antes} de mas`);
    chequear('ningun intento fallido pidio una identidad', identidadesPedidas === identAntes,
      `${identidadesPedidas - identAntes} de mas`);

    console.log('\n--- 3. Con el codigo correcto si entra ---');
    const r: any = await onboarding.registerUniversity(datos(9, CODIGO))
      .catch((e: any) => ({ __error: e.message }));
    if (r?.__error) {
      chequear('el alta con codigo correcto funciona', false, r.__error.slice(0, 140));
    } else {
      chequear('el alta con codigo correcto funciona', true);
      chequear('se creo la institucion', (await contarInstituciones()) === antes + 1);
      chequear('se pidio crear la identidad del administrador', identidadesPedidas === identAntes + 1);
    }

    console.log('\n--- 4. Espacios de mas no rompen el codigo ---');
    const r2: any = await onboarding.registerUniversity(datos(10, `  ${CODIGO}  `))
      .catch((e: any) => ({ __error: e.message }));
    chequear('se tolera el codigo con espacios alrededor', !r2?.__error,
      r2?.__error?.slice(0, 100) ?? '');
  } finally {
    if (original === undefined) delete process.env.ONBOARDING_INVITE_CODE;
    else process.env.ONBOARDING_INVITE_CODE = original;

    const p = app.get(PrismaService);
    const borra = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* */ } };
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
