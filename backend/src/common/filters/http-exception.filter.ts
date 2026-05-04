import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

const isProd = process.env.NODE_ENV === 'production';

/**
 * Patterns que NO deben llegar al cliente — internals de la stack:
 *   · Prisma low-level errors (P1xxx, "Invalid `prisma.…`", schema names)
 *   · Stack traces
 *   · File paths del servidor
 */
function sanitizeMessage(raw: any, status: number): string | string[] {
  // Mensajes de validación (BadRequest 400) son arrays — los preservamos
  // porque están en el DTO y son user-friendly por diseño.
  if (Array.isArray(raw)) return raw;

  if (typeof raw !== 'string') {
    return status >= 500 ? 'Error interno del servidor' : 'Solicitud inválida';
  }

  // Filtros agresivos en producción: si el mensaje huele a Prisma o stack interno
  // lo reemplazamos por uno genérico.
  if (isProd) {
    const internalSignal = /(prisma\.|Invalid `|PrismaClient|at \/?[\w/.-]+:\d+|file:\/\/|node_modules)/i;
    if (internalSignal.test(raw)) {
      return status >= 500 ? 'Error interno del servidor' : 'Solicitud inválida';
    }
  }
  return raw;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<Request>();

    // Mapeo de errores Prisma comunes a HTTP status semánticos. Antes,
    // un UUID malformado en path tiraba 500 ("Error interno del servidor")
    // cuando en realidad el cliente mandó dato inválido (400/404). Esto
    // mejora la señal en los logs y la UX del frontend.
    let status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!(exception instanceof HttpException) && exception && typeof exception === 'object') {
      const ex = exception as any;
      // Prisma typed errors:
      //   P2025 — Record to update/delete not found → 404
      //   P2002 — Unique constraint violation        → 409
      //   P2003 — FK violation                       → 400
      // Errores de parsing de UUID/Decimal/Date llegan como
      // PrismaClientKnownRequestError sin code o como PrismaClientValidationError
      // con mensaje que contiene "invalid" / "Got invalid value".
      const code = ex.code as string | undefined;
      const name = ex.name as string | undefined;
      const msg  = String(ex.message ?? '');
      if (code === 'P2025') status = HttpStatus.NOT_FOUND;
      else if (code === 'P2002') status = HttpStatus.CONFLICT;
      else if (code === 'P2003') status = HttpStatus.BAD_REQUEST;
      else if (
        name === 'PrismaClientValidationError' ||
        /Inconsistent column data|Got invalid value|Argument .* must|invalid input/i.test(msg)
      ) {
        status = HttpStatus.BAD_REQUEST;
      }
    }

    // Correlation ID — permite buscar un error específico en logs sin exponer
    // detalles al usuario. Va al cliente como referencia opaca.
    const errorId = randomUUID();

    let message: string | string[];
    // Campos extra que el caller puede haber agregado al exception body
    // (ej. `code: 'TOTP_REQUIRED'`, `code: 'MUST_CHANGE_PASSWORD'`).
    // Los preservamos para que el frontend pueda reaccionar específicamente.
    let extra: Record<string, any> = {};

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = sanitizeMessage(res, status);
      } else if (typeof res === 'object' && res !== null) {
        const body = res as any;
        message = sanitizeMessage(body.message, status);
        // Whitelist de campos extra seguros — NUNCA propagamos `error`
        // (que en algunos casos contiene el nombre de la excepción interna).
        for (const k of ['code', 'retry', 'retryAfter']) {
          if (body[k] !== undefined) extra[k] = body[k];
        }
      } else {
        message = sanitizeMessage(null, status);
      }
    } else {
      message = sanitizeMessage(null, status);
    }

    // Log 5xx con stack completo del lado del servidor — nunca al cliente.
    if (status >= 500) {
      this.logger.error(
        `[${errorId}] ${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (status === 401 || status === 403) {
      this.logger.warn(`[${errorId}] ${request.method} ${request.url} → ${status}`);
    }

    // Sanitiza el path: quita UUIDs y query string para no leakear estructura interna.
    const rawPath = (request.url || '').split('?')[0];
    const sanitizedPath = rawPath.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id',
    );

    response.status(status).json({
      statusCode: status,
      message,
      ...extra,                             // p.ej. { code: 'TOTP_REQUIRED' }
      path:       sanitizedPath,
      timestamp:  new Date().toISOString(),
      // errorId permite al usuario reportar y al ops correlacionar — sin filtrar nada útil.
      errorId,
    });
  }
}
