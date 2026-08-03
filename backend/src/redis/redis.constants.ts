/**
 * Token de inyeccion del cliente de Redis.
 *
 * Vive en su propio archivo, y no dentro de redis.module.ts, porque
 * ReportesCache necesita el token y el modulo necesita a ReportesCache: si
 * ambos estuvieran en el mismo archivo el ciclo de imports deja el token en
 * `undefined` en tiempo de ejecucion y Nest no puede resolver la dependencia
 * — la app entera no arranca, con un error que no menciona el ciclo.
 */
export const REDIS_CLIENT = 'REDIS_CLIENT';
