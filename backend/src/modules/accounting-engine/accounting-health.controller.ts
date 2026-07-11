import { Controller, Get, Post, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';
import { ProjectionEngine } from './projection.engine';
import { AccountingEngine } from './accounting.engine';

/**
 * Diagnóstico de consistencia contable de una empresa (Accounting Manifest §5).
 * Expone los invariantes verificables como un "health check" observable:
 * ecuación contable (V-2) + reconciliación control↔subledger (V-3/V-4).
 * No es una pantalla nueva: es infraestructura de verificación para tests,
 * el profe (evidencia de consistencia) y el propio motor.
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class AccountingHealthController {
  constructor(
    private readonly projection: ProjectionEngine,
    private readonly engine: AccountingEngine,
  ) {}

  @Get('companies/:companyId/accounting/health')
  @UseGuards(CompanyOwnerGuard)
  async health(@Param('companyId') companyId: string) {
    const [reconcile, equation] = await Promise.all([
      this.projection.reconcile(companyId),
      this.engine.checkAccountingEquation(companyId),
    ]);
    return { healthy: equation.ok && reconcile.allOk, equation, reconcile };
  }

  // Reconstruye las proyecciones desde el Diario + documentos fuente (PJ-4).
  @Post('companies/:companyId/accounting/rebuild-projections')
  @UseGuards(CompanyOwnerGuard)
  async rebuild(@Param('companyId') companyId: string, @Request() _req: any) {
    return this.projection.rebuildProjections(companyId);
  }
}
