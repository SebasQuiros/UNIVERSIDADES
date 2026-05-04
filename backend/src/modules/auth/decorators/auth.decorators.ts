import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

// ── @Public() — mark routes that don't require JWT ───────────
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// ── @Roles(...) — restrict route to specific roles ───────────
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// ── @SkipMustChangePassword() — allow route even if mustChangePassword=true
export const SKIP_MUST_CHANGE_KEY = 'skipMustChangePassword';
export const SkipMustChangePassword = () => SetMetadata(SKIP_MUST_CHANGE_KEY, true);

// ── @CurrentUser() — inject authenticated user into param ────
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
