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
 * Con el usuario como llave, cada estudiante tiene su propio cupo y da igual
 * cuántos compartan la salida a internet.
 *
 * Las rutas públicas (login, onboarding) no tienen usuario, así que siguen
 * contando por IP: ahí el límite por IP es justamente lo que se quiere, porque
 * protege contra intentos masivos desde un mismo origen.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req?.user?.id;
    if (userId) return `user:${userId}`;

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
