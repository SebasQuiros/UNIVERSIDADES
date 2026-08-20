import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Limita por USUARIO autenticado, no por IP.
 *
 * Por defecto NestJS cuenta por IP, y eso no sirve acá: un laboratorio de
 * colegio sale a internet por una sola IP pública (NAT). Con el límite por IP,
 * 500 estudiantes en la misma aula comparten un único cupo de 500 req/min —
 * una petición por alumno por minuto — y la clase entera se bloquea sola.
 *
 * ── Por qué NO alcanza con leer req.user ──────────────────────────────────
 *
 * Este guard corre ANTES que el de JWT, así que cuando llega acá `req.user`
 * todavía no existe. Leerlo y ya dejaba el conteo por IP para TODAS las
 * peticiones, incluidas las autenticadas: el arreglo estaba escrito, se veía
 * correcto, y no hacía nada.
 *
 * Medido en producción: 60 peticiones simultáneas con token inválido dieron
 * 40 respuestas de autenticación y 20 de límite excedido — o sea, el límite
 * se aplicó por IP antes de mirar quién era.
 *
 * Por eso la identidad se saca del propio token, sin verificarlo.
 *
 * ── Y por qué está bien no verificarlo ────────────────────────────────────
 *
 * Esto NO autoriza nada: es solo la llave del contador. Quien falsifique un
 * `sub` consigue su propio cupo, pero su petición muere igual en el guard de
 * JWT con un 401, que es barato. Todo lo que cuesta trabajo de verdad exige
 * un token válido. Verificar la firma acá significaría validar contra el
 * JWKS de Supabase en cada petición, antes del limitador — justo el trabajo
 * que el limitador existe para evitar.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  /** `sub` del JWT sin verificar firma. Solo sirve como llave del contador. */
  private subDelToken(auth: unknown): string | null {
    if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return null;
    const partes = auth.slice(7).split('.');
    if (partes.length !== 3) return null;
    try {
      const carga = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'));
      const sub = carga?.sub;
      // Se acota el largo: el `sub` viene de una cadena que manda el cliente y
      // termina siendo parte de una clave en Redis.
      return typeof sub === 'string' && sub.length > 0 && sub.length <= 64 ? sub : null;
    } catch {
      return null;
    }
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Si algún día el orden de los guards cambia y el usuario ya está
    // resuelto, se usa ese: es el dato confiable.
    const userId = req?.user?.id;
    if (userId) return `user:${userId}`;

    const sub = this.subDelToken(req?.headers?.authorization);
    if (sub) return `token:${sub}`;

    // Sin token: login, health, descargas firmadas. Ahí el conteo por IP es
    // justamente lo que se quiere, y esa superficie es chica.
    //
    // Detrás de un proxy (Railway, Vercel) `req.ip` puede ser el del proxy.
    // X-Forwarded-For trae la IP real del cliente en el primer tramo.
    const fwd = req?.headers?.['x-forwarded-for'];
    const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim()
      || req?.ip
      || req?.socket?.remoteAddress
      || 'desconocido';
    return `ip:${ip}`;
  }
}
