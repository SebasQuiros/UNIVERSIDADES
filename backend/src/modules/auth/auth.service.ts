import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseAdminService } from '../../common/supabase/supabase-admin.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { invalidateAuthUser } from '../../common/auth/auth-cache';

// Cuentas de prueba conocidas — SIN contraseña acá ni en ningún lugar del
// código (ver demoLogin: se accede vía magic-link de Supabase, nunca por
// password). El único secreto es DEMO_LOGIN_TOKEN, que vive solo como
// variable de entorno en Railway — nunca en el repo.
const DEMO_ACCOUNTS: Record<string, string> = {
  admin:        'admin@contafacil.cr',
  profesor:     'profesor@contafacil.cr',
  estudiante1:  'estudiante1@contafacil.cr',
  estudiante2:  'estudiante2@contafacil.cr',
};

/**
 * AuthService mínimo tras la migración a Supabase Auth.
 *
 * La emisión/validación de tokens, login, refresh, verificación de correo,
 * reset de contraseña y 2FA los gestiona Supabase. Aquí solo queda el borrado
 * de cuenta (GDPR), que además de eliminar la identidad en Supabase anonimiza
 * la PII local conservando la fila (integridad contable / audit trail).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseAdmin: SupabaseAdminService,
    @Inject(REDIS_CLIENT) private readonly redis: any,
  ) {}

  // ── Acceso rápido a cuentas de prueba (sin exponer contraseñas) ──
  // Requiere DEMO_LOGIN_TOKEN configurado en el entorno; sin esa variable,
  // esta función SIEMPRE rechaza (deshabilitado por defecto). El token no se
  // compara nunca en el frontend — solo acá, server-side.
  async demoLogin(token: string, as: string): Promise<{ email: string; hashedToken: string }> {
    const expected = process.env.DEMO_LOGIN_TOKEN;
    if (!expected || token !== expected) {
      // 404 en vez de 401/403: no confirmamos ni que el endpoint exista.
      throw new NotFoundException();
    }
    const email = DEMO_ACCOUNTS[as];
    if (!email) throw new NotFoundException();

    const hashedToken = await this.supabaseAdmin.generateMagicLink(email);
    this.logger.log(`Acceso rápido de prueba usado: ${email}`);
    return { email, hashedToken };
  }

  // ── GDPR: borrar / anonimizar la propia cuenta ────────────────
  async deleteAccount(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (user.role === 'SUPERADMIN') {
      throw new BadRequestException(
        'Las cuentas SUPERADMIN no pueden auto-eliminarse. Contacta a otro superadmin.',
      );
    }

    // 1. Eliminar la identidad en Supabase Auth (idempotente si ya no existe).
    if (user.authId) {
      await this.supabaseAdmin.deleteUser(user.authId);
    }

    // 2. Anonimizar PII conservando el row (integridad contable / audit).
    const ts = Date.now();
    const anonEmail = `deleted_${ts}_${user.id.slice(0, 8)}@anonymized.local`;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          name:      'Usuario eliminado',
          email:     anonEmail,
          authId:    null,
          avatarUrl: null,
          isActive:  false,
        },
      });

      await tx.activityLog.create({
        data: {
          userId,
          action:   'AUTH_ACCOUNT_DELETED',
          entity:   'User',
          entityId: userId,
          details:  { previousEmail: user.email } as any,
        },
      });
    });

    // El row quedó con authId=null e isActive=false; sin invalidar, la entrada
    // cacheada (bajo el authId viejo) seguiría autenticando hasta el TTL.
    await invalidateAuthUser(this.redis, user.authId);

    this.logger.log(`Cuenta anonimizada: ${user.email} → ${anonEmail}`);
    return {
      message:
        'Tu cuenta fue eliminada. Los registros contables se conservan anonimizados por requisitos legales.',
    };
  }
}
