/**
 * Reinicio de contrasena desde el panel de la institucion.
 *
 * Toca identidades, asi que lo que se vigila es quien PUEDE hacerlo. Un
 * administrador que pudiera reiniciarle la contrasena al administrador de
 * otra institucion podria entrar con ella: seria una puerta trasera entre
 * clientes.
 *
 * El cambio real ocurre en Supabase. Esta prueba NO lo toca: verifica las
 * reglas de acceso y los efectos en la base, que es donde pueden estar los
 * errores de logica. El camino feliz contra Supabase se prueba usandolo.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UniversitiesService } from '../src/modules/universities/universities.service';
import { SupabaseAdminService } from '../src/common/supabase/supabase-admin.service';

const MARCA = '__QA_RESET_';

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

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const unis = app.get(UniversitiesService);
  const supa = app.get(SupabaseAdminService);

  // Se intercepta el cambio real: no vamos a tocar identidades de verdad
  // solo por correr una prueba.
  const llamadas: Array<{ authId: string; largo: number }> = [];
  (supa as any).updatePassword = async (authId: string, password: string) => {
    llamadas.push({ authId, largo: password.length });
  };

  try {
    console.log('--- 0. Dos instituciones ---');
    const uniA = await prisma.university.create({ data: { name: MARCA + 'UniA', shortName: 'QRA' } });
    const uniB = await prisma.university.create({ data: { name: MARCA + 'UniB', shortName: 'QRB' } });

    const crear = async (etq: string, rol: any, uni: string | null, authId: string | null = 'auth-' + etq) =>
      prisma.user.create({
        data: {
          name: MARCA + etq,
          email: `${MARCA}${etq}.${Date.now()}${Math.floor(Math.random() * 1e6)}@qa.local`.toLowerCase(),
          role: rol, universityId: uni, isActive: true, emailVerified: true,
          authId: authId ? `${authId}-${Date.now()}${Math.floor(Math.random() * 1e6)}` : null,
          mustChangePassword: false,
        },
      });

    const adminA   = await crear('AdminA', 'ADMIN', uniA.id);
    const alumnoA  = await crear('AlumnoA', 'STUDENT', uniA.id);
    const profeA   = await crear('ProfeA', 'TEACHER', uniA.id);
    const adminB   = await crear('AdminB', 'ADMIN', uniB.id);
    const sinAuth  = await crear('SinAuth', 'STUDENT', uniA.id, null);
    const superadm = await crear('Super', 'SUPERADMIN', uniA.id);

    const comoAdminA: any = { id: adminA.id, role: 'ADMIN', universityId: uniA.id };
    const comoAdminB: any = { id: adminB.id, role: 'ADMIN', universityId: uniB.id };

    console.log('\n--- 1. El administrador reinicia a alguien de su institucion ---');
    const r: any = await unis.resetUserPassword(uniA.id, alumnoA.id, comoAdminA);
    chequear('devuelve la contrasena temporal', !!r?.temporaryPassword);
    chequear('la temporal es suficientemente larga', (r.temporaryPassword?.length ?? 0) >= 8,
      String(r.temporaryPassword?.length));
    chequear('avisa que se ve una sola vez', /una sola vez/i.test(r?.aviso ?? ''));
    chequear('se pidio el cambio a Supabase', llamadas.length === 1, String(llamadas.length));
    chequear('se uso el authId correcto', llamadas[0]?.authId === alumnoA.authId);

    const tras = await prisma.user.findUnique({ where: { id: alumnoA.id } });
    chequear('queda obligado a cambiarla al entrar', tras?.mustChangePassword === true);

    console.log('\n--- 2. Aislamiento entre instituciones (lo critico) ---');
    const antes = llamadas.length;
    await debeFallar(
      'el admin de A NO puede reiniciar a alguien de B',
      () => unis.resetUserPassword(uniB.id, adminB.id, comoAdminA),
      'institución',
    );
    await debeFallar(
      'tampoco apuntando a SU universidad con un id de B',
      () => unis.resetUserPassword(uniA.id, adminB.id, comoAdminA),
      'no pertenece',
    );
    chequear('ningun intento ajeno llego a Supabase', llamadas.length === antes,
      `${llamadas.length - antes} llamadas de mas`);

    console.log('\n--- 3. Casos que deben rechazarse ---');
    await debeFallar(
      'no se reinicia la cuenta de superadministracion',
      () => unis.resetUserPassword(uniA.id, superadm.id, comoAdminA),
      'superadministracion',
    );
    await debeFallar(
      'una cuenta sin identidad se rechaza con mensaje util',
      () => unis.resetUserPassword(uniA.id, sinAuth.id, comoAdminA),
      'proveedor de acceso',
    );
    await debeFallar(
      'un id inexistente se rechaza',
      () => unis.resetUserPassword(uniA.id, '00000000-0000-0000-0000-000000000000', comoAdminA),
      'no pertenece',
    );

    console.log('\n--- 4. El admin de B si puede con los suyos ---');
    const r2: any = await unis.resetUserPassword(uniB.id, adminB.id, comoAdminB);
    chequear('el admin de B reinicia al suyo', !!r2?.temporaryPassword);

    console.log('\n--- 5. Dos reinicios dan contrasenas distintas ---');
    const a: any = await unis.resetUserPassword(uniA.id, profeA.id, comoAdminA);
    const b: any = await unis.resetUserPassword(uniA.id, profeA.id, comoAdminA);
    chequear('no se repite la contrasena', a.temporaryPassword !== b.temporaryPassword,
      'dos reinicios seguidos dieron la misma');
  } finally {
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
