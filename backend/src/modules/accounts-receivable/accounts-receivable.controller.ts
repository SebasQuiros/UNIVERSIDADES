import {
  Controller, Get, Post, Param, Query, Body,
  UseGuards, Req, Res,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AccountsReceivableService } from './accounts-receivable.service';
import { RegisterArPaymentDto, ArPaymentFilterDto } from './dto/ar.dto';
import { JwtAuthGuard }     from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

@Controller('companies/:companyId/ar')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class AccountsReceivableController {
  constructor(private readonly svc: AccountsReceivableService) {}

  // GET /api/v1/companies/:companyId/ar/dashboard
  @Get('dashboard')
  getDashboard(@Param('companyId') companyId: string) {
    return this.svc.getArDashboard(companyId);
  }

  // GET /api/v1/companies/:companyId/ar/aging
  @Get('aging')
  getAging(@Param('companyId') companyId: string) {
    return this.svc.getAgingReport(companyId);
  }

  // GET /api/v1/companies/:companyId/ar/aging/export
  @Get('aging/export')
  async exportAging(
    @Param('companyId') companyId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.svc.exportAgingReport(companyId);
    const date   = new Date().toISOString().split('T')[0];
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cuentas-cobrar-${date}.xlsx"`,
    );
    res.send(buffer);
  }

  // POST /api/v1/companies/:companyId/ar/payments
  @Post('payments')
  registerPayment(
    @Param('companyId') companyId: string,
    @Body() dto: RegisterArPaymentDto,
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.svc.registerPayment(companyId, dto, req.user.id);
  }

  // GET /api/v1/companies/:companyId/ar/payments
  @Get('payments')
  getPayments(
    @Param('companyId') companyId: string,
    @Query() filters: ArPaymentFilterDto,
  ) {
    return this.svc.getPayments(companyId, filters);
  }

  // GET /api/v1/companies/:companyId/ar/clients/:clientId/statement
  @Get('clients/:clientId/statement')
  getClientStatement(
    @Param('companyId') companyId: string,
    @Param('clientId')  clientId:  string,
  ) {
    return this.svc.getClientStatement(companyId, clientId);
  }

  // ── Fase 3: Customer ledger consolidado ─────────────────────
  // GET /api/v1/companies/:companyId/ar/clients/consolidated
  @Get('clients/consolidated')
  consolidated(@Param('companyId') companyId: string) {
    return this.svc.consolidatedByClient(companyId);
  }

  // ── Fase 3: Estimación de cuentas incobrables ───────────────
  // Es read-only — usamos GET con query params para que TEACHER/ADMIN
  // no sean rechazados por CompanyOwnerGuard (que solo permite GET a staff).
  // Acepta los parámetros de aging por bucket como `pct_b0_30`, etc.
  // GET /api/v1/companies/:companyId/ar/allowance/estimate?method=...
  @Get('allowance/estimate')
  estimateAllowance(
    @Param('companyId') companyId: string,
    @Query('method')   method: 'PERCENTAGE_OF_SALES' | 'PERCENTAGE_OF_AGING',
    @Query('salesPct') salesPct?: string,
    @Query('from')     from?: string,
    @Query('to')       to?: string,
    @Query('pct_b0_30')   pctB0_30?: string,
    @Query('pct_b31_60')  pctB31_60?: string,
    @Query('pct_b61_90')  pctB61_90?: string,
    @Query('pct_b91_plus') pctB91Plus?: string,
  ) {
    const num = (v?: string) => v == null ? undefined : Number(v);
    return this.svc.estimateAllowance(companyId, {
      method,
      salesPct: num(salesPct),
      from:     from ? new Date(from) : undefined,
      to:       to   ? new Date(to)   : undefined,
      agingPcts: {
        b0_30:    num(pctB0_30),
        b31_60:   num(pctB31_60),
        b61_90:   num(pctB61_90),
        b91_plus: num(pctB91Plus),
      },
    });
  }
}
