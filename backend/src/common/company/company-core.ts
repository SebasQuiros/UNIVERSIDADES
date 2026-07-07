import { PrismaService } from '../../prisma/prisma.service';

/**
 * company-core — fuente única de la fila "core" de una Company usada por los
 * guards de acceso (`CompanyEnabledGuard`, `CompanyOwnerGuard`) y por el helper
 * `assertCompanyAccess`.
 *
 * Objetivo (solo rendimiento): dejar de pagar el MISMO `SELECT company` varias
 * veces por request. Se cachea en Redis con TTL corto y se reusa dentro del
 * request. **La semántica de aislamiento NO cambia** — solo cambia DE DÓNDE
 * sale la fila, nunca SI se verifica.
 *
 * Qué es "core" y por qué es seguro cachearlo por id:
 *   - `studentId`, `mode`, `exerciseId` son efectivamente inmutables tras crear
 *     la empresa → un core viejo jamás puede otorgar acceso al usuario equivocado
 *     (la comparación `studentId === userId` sigue siendo correcta).
 *   - `student.universityId` / `exercise.teacher.universityId` (aislamiento por
 *     universidad de staff, solo lectura) cambian rarísimo; la staleness queda
 *     acotada por el TTL corto.
 *   - `isCompanyEnabled` (bloqueo temporal del profesor, NO es frontera de
 *     tenant) se invalida explícitamente en el toggle (`setEnabled`) y además
 *     queda acotado por el TTL.
 *
 * Lo que NO va en el core: `CompanyMembership` (acceso a empresas GROUP) es
 * PER-USUARIO, así que NUNCA se cachea por id de empresa — siempre se resuelve
 * fresco contra la DB. Así, agregar/quitar a un integrante de un grupo propaga
 * de inmediato.
 *
 * Todo acceso a Redis es fail-open: ante miss, error o Redis caído → lectura
 * directa a la DB (comportamiento actual).
 */

// Select Prisma compartido: exactamente los campos que consumen los guards y el
// helper para DECIDIR acceso (sin memberships). Centralizarlo evita que las dos
// rutas se desincronicen.
//
// A propósito NO incluye `name`: es mutable (companies.service lo edita sin
// invalidar) y NINGÚN guard/helper lo usa para decidir acceso, así que dejarlo
// fuera mantiene el core acotado a campos de decisión (inmutables o invalidados).
export const COMPANY_CORE_SELECT = {
  id: true,
  mode: true,
  studentId: true,
  exerciseId: true,
  isCompanyEnabled: true,
  // Universidad para INDIVIDUAL viene del estudiante dueño; para GROUP viene
  // del teacher del exercise asociado.
  student: { select: { universityId: true } },
  exercise: { select: { teacher: { select: { universityId: true } } } },
} as const;

export interface CompanyCore {
  id: string;
  mode: 'INDIVIDUAL' | 'GROUP';
  studentId: string | null;
  exerciseId: string | null;
  isCompanyEnabled: boolean;
  student: { universityId: string | null } | null;
  exercise: { teacher: { universityId: string | null } | null } | null;
}

// TTL corto (segundos). Acota la staleness de isCompanyEnabled / universityId.
const CORE_TTL_SECONDS = 45;

const coreKey = (companyId: string) => `company:core:${companyId}`;

function redisUsable(redis: any): boolean {
  return !!redis && (redis.isOpen === true || redis.isReady === true);
}

/**
 * Devuelve la fila core de la empresa, priorizando el cache de Redis y cayendo a
 * la DB ante cualquier problema. `redis` es opcional: si no se pasa (o está
 * caído) el comportamiento es idéntico al `findUnique` directo de hoy.
 *
 * Solo se cachea el camino positivo (empresa encontrada). Nunca se cachean
 * negativos: un `null` siempre implica una lectura fresca a la DB.
 */
export async function getCompanyCore(
  prisma: PrismaService,
  redis: any,
  companyId: string,
): Promise<CompanyCore | null> {
  // 1 — Cache Redis (fail-open).
  try {
    if (redisUsable(redis)) {
      const raw = await redis.get(coreKey(companyId));
      if (raw) return JSON.parse(raw) as CompanyCore;
    }
  } catch {
    // Redis caído / error → caemos a la DB (comportamiento actual).
  }

  // 2 — DB (fuente de verdad).
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: COMPANY_CORE_SELECT,
  });
  if (!company) return null; // no cacheamos negativos

  // 3 — Poblar cache (fail-open; nunca bloquea la respuesta).
  try {
    if (redisUsable(redis)) {
      await redis.setEx(coreKey(companyId), CORE_TTL_SECONDS, JSON.stringify(company));
    }
  } catch {
    // best-effort; si Redis falla seguimos sin cache.
  }

  return company as CompanyCore;
}

/**
 * Invalida el core cacheado de una empresa. Se llama cuando muta un campo core
 * (p. ej. el toggle `isCompanyEnabled`) para que el cambio se vea sin esperar el
 * TTL. Fail-open: si Redis falla, el TTL corto igual acota la staleness.
 */
export async function invalidateCompanyCore(redis: any, companyId: string): Promise<void> {
  try {
    if (redisUsable(redis)) {
      await redis.del(coreKey(companyId));
    }
  } catch {
    // best-effort.
  }
}
