import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  CanActivate,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY, ROLES_KEY, SKIP_MUST_CHANGE_KEY } from '../decorators/auth.decorators';
import { PrismaService } from '../../../prisma/prisma.service';

// ── JwtAuthGuard ─────────────────────────────────────────────
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      const message = info?.message === 'jwt expired'
        ? 'Token expirado. Por favor inicia sesión nuevamente.'
        : 'No autorizado. Token inválido o ausente.';
      throw new UnauthorizedException(message);
    }
    return user;
  }
}

// ── RolesGuard ────────────────────────────────────────────────
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new UnauthorizedException('No autenticado');

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Acceso denegado. Se requiere uno de los siguientes roles: ${requiredRoles.join(', ')}`,
      );
    }
    return true;
  }
}

// ── MustChangePasswordGuard ──────────────────────────────────
/**
 * Blocks ALL routes when the user has mustChangePassword=true.
 * Exempt routes must be decorated with @SkipMustChangePassword() or @Public().
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip @Public() routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Skip routes decorated with @SkipMustChangePassword()
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_MUST_CHANGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.id) return true; // JwtAuthGuard handles missing users

    // Query fresh value from DB (avoids stale JWT cache)
    const dbUser = await this.prisma.user.findUnique({
      where:  { id: user.id },
      select: { mustChangePassword: true },
    });

    if (dbUser?.mustChangePassword) {
      throw new ForbiddenException({
        statusCode: 403,
        code:       'MUST_CHANGE_PASSWORD',
        message:    'Debes cambiar tu contraseña antes de continuar.',
      });
    }

    return true;
  }
}
