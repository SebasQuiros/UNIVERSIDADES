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
