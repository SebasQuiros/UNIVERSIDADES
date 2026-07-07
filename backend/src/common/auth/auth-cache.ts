/**
 * auth-cache — clave e invalidación del cache corto authId→User usado por
 * `SupabaseJwtStrategy.validate()`.
 *
 * Centralizado para que la strategy (quien escribe el cache) y los services que
 * mutan un `User` (quienes lo invalidan) usen EXACTAMENTE el mismo formato de
 * clave. Análogo a `invalidateCompanyCore` en `common/company/company-core.ts`.
 *
 * El cache solo guarda usuarios ACTIVOS resueltos por `authId` (camino feliz).
 * Al desactivar/degradar/borrar un usuario invalidamos su entrada para que el
 * cambio sea efectivamente inmediato (la próxima request reevalúa contra DB) en
 * vez de esperar el TTL. Todo es fail-open: si Redis está caído, el TTL corto
 * igual acota la staleness y el comportamiento es el actual.
 */

export const authUserCacheKey = (authId: string) => `auth:user:${authId}`;

function redisUsable(redis: any): boolean {
  return !!redis && (redis.isOpen === true || redis.isReady === true);
}

/**
 * Invalida el cache authId→User. Si el usuario no tiene `authId` (null), no hay
 * entrada que borrar y salimos sin hacer nada. Fail-open ante error de Redis.
 */
export async function invalidateAuthUser(
  redis: any,
  authId: string | null | undefined,
): Promise<void> {
  if (!authId) return; // sin authId no hay entrada cacheada
  try {
    if (redisUsable(redis)) {
      await redis.del(authUserCacheKey(authId));
    }
  } catch {
    // best-effort; el TTL corto acota igual la staleness.
  }
}
