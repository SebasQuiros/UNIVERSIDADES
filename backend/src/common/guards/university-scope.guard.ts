import {
  CanActivate, ExecutionContext, Injectable, ForbiddenException,
} from '@nestjs/common';

/**
 * UniversityScopeGuard — aísla el tenant en rutas `/universities/:id/*`.
 *
 * Las rutas están gateadas por rol (ADMIN/SUPERADMIN/TEACHER) pero ESO NO IMPIDE
 * que un ADMIN de la universidad A opere sobre la universidad B cambiando el
 * `:id` del path. Este guard exige que, salvo SUPERADMIN, el `:id` del path
 * coincida con la universidad del usuario autenticado.
 *
 * Se aplica a nivel de controller: las rutas SIN `:id` (detect público, /mine,
 * listado, create) lo atraviesan sin efecto (se scopean en el service / por rol).
 */
@Injectable()
export class UniversityScopeGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const targetId: string | undefined = req.params?.id;

    // No es una ruta :id-scoped → este guard no aplica.
    if (!targetId) return true;

    const user = req.user as { role?: string; universityId?: string | null } | undefined;
    if (!user) throw new ForbiddenException('No autenticado.');

    // SUPERADMIN opera sobre cualquier universidad.
    if (user.role === 'SUPERADMIN') return true;

    // El resto (ADMIN/TEACHER) solo sobre la suya.
    if (user.universityId && user.universityId === targetId) return true;

    throw new ForbiddenException('No tenés acceso a esta universidad.');
  }
}
