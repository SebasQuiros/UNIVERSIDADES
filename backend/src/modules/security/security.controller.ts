import {
  Controller, Post, Body, HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/auth.decorators';

/**
 * Controller de monitoring de seguridad — recibe CSP violation reports
 * desde el browser cuando alguien intenta inyectar contenido bloqueado
 * por la Content-Security-Policy.
 *
 * El endpoint es público (lo llama el browser sin auth) y rate-limited
 * agresivamente para evitar log floods.
 */
@Controller('security')
export class SecurityController {
  private readonly logger = new Logger('CSP-Report');

  // Browsers (Chrome/Firefox/Safari) mandan POST con Content-Type variado:
  //   · application/csp-report (legacy)
  //   · application/reports+json (Reporting API moderno)
  //   · application/json
  //
  // Aceptamos cualquier shape, NO confiamos en el contenido (es input externo).
  @Public()
  @Post('csp-report')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ medium: { ttl: 60_000, limit: 100 } })   // máx 100/min/IP
  receive(@Body() report: any) {
    // Extraemos los campos típicos sin asumir shape exacto.
    const r = report?.['csp-report'] ?? report;
    const summary = {
      docUri:     r?.['document-uri']        || r?.documentURL  || null,
      blockedUri: r?.['blocked-uri']         || r?.blockedURL    || null,
      directive:  r?.['violated-directive']  || r?.effectiveDirective || null,
      sourceFile: r?.['source-file']         || null,
      line:       r?.['line-number']         || null,
      sample:     (r?.['script-sample'] || '').slice(0, 200),
    };

    // Filtramos ruido común (extensiones de browser, scripts inyectados por
    // herramientas de pentesting de los propios usuarios). Logueamos solo
    // violaciones que parecen reales.
    const blockedUri = String(summary.blockedUri || '');
    const isBrowserExtension =
      blockedUri.startsWith('chrome-extension:') ||
      blockedUri.startsWith('moz-extension:')   ||
      blockedUri.startsWith('safari-extension:');

    if (isBrowserExtension) return;  // ignorar

    this.logger.warn(`CSP violation: ${JSON.stringify(summary)}`);
  }
}
