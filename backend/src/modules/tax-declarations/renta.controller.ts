/**
 * renta.controller.ts
 * Routes: /api/v1/companies/:companyId/tax/...
 *
 * D-101 Income Tax declaration, quarterly partial payments, and withholdings
 * for a company (exercise attempt context).
 */

import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, Request,
} from '@nestjs/common';
import { RentaService } from './renta.service';
import {
  CalculateD101Dto,
  SchedulePartialPaymentsDto,
  MarkPartialPaymentPaidDto,
  CreateRetencionDto,
} from './dto/tax-declarations.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

@Controller('companies/:companyId/tax')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class RentaController {
  constructor(private readonly svc: RentaService) {}

  // ── D-101 Calculation ─────────────────────────────────────────────────────

  /**
   * POST /api/v1/companies/:companyId/tax/d101/calculate
   * Body: { fiscalYear: 2026 }
   */
  @Post('d101/calculate')
  @HttpCode(HttpStatus.OK)
  calculate(
    @Param('companyId') companyId: string,
    @Body() dto: CalculateD101Dto,
    @Request() req: any,
  ) {
    return this.svc.calculateD101(companyId, dto.fiscalYear, req.user.id);
  }

  // ── Pagos Parciales ───────────────────────────────────────────────────────

  /**
   * POST /api/v1/companies/:companyId/tax/d101/partial-payments
   * Body: { fiscalYear: 2026, estimatedTax: 500000 }
   * Creates 4 quarterly PartialPayment records.
   */
  @Post('d101/partial-payments')
  @HttpCode(HttpStatus.CREATED)
  schedulePartialPayments(
    @Param('companyId') companyId: string,
    @Body() dto: SchedulePartialPaymentsDto,
    @Request() req: any,
  ) {
    return this.svc.schedulePartialPayments(companyId, req.user.id, dto);
  }

  /**
   * GET /api/v1/companies/:companyId/tax/d101/partial-payments?year=2026
   */
  @Get('d101/partial-payments')
  getPartialPayments(
    @Param('companyId') companyId: string,
    @Query('year') year: string,
  ) {
    const fiscalYear = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.svc.getPartialPayments(companyId, fiscalYear);
  }

  /**
   * PATCH /api/v1/companies/:companyId/tax/d101/partial-payments/:id/pay
   * Body: { paidDate: "2026-03-31" }
   */
  @Patch('d101/partial-payments/:paymentId/pay')
  @HttpCode(HttpStatus.OK)
  markPaid(
    @Param('companyId') companyId: string,
    @Param('paymentId') paymentId: string,
    @Body() dto: MarkPartialPaymentPaidDto,
    @Request() req: any,
  ) {
    return this.svc.markPartialPaymentPaid(
      paymentId,
      companyId,
      req.user.id,
      new Date(dto.paidDate),
    );
  }

  // ── Retenciones en la Fuente ──────────────────────────────────────────────

  /**
   * POST /api/v1/companies/:companyId/tax/retenciones
   * Body: CreateRetencionDto
   */
  @Post('retenciones')
  @HttpCode(HttpStatus.CREATED)
  createRetencion(
    @Param('companyId') companyId: string,
    @Body() dto: CreateRetencionDto,
    @Request() req: any,
  ) {
    return this.svc.createRetencion(companyId, req.user.id, dto);
  }

  /**
   * GET /api/v1/companies/:companyId/tax/retenciones?year=2026
   */
  @Get('retenciones')
  getRetenciones(
    @Param('companyId') companyId: string,
    @Query('year') year: string,
  ) {
    const yearNum = year ? parseInt(year, 10) : undefined;
    return this.svc.getRetenciones(companyId, yearNum);
  }
}
