import {
  Controller, Get, Post, Param, Query, Body,
  UseGuards, Req, Res,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AccountsPayableService } from './accounts-payable.service';
import { RegisterApPaymentDto, ApPaymentFilterDto } from './dto/ap.dto';
import { JwtAuthGuard }      from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

@Controller('companies/:companyId/ap')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class AccountsPayableController {
  constructor(private readonly svc: AccountsPayableService) {}

  // GET /api/v1/companies/:companyId/ap/dashboard
  @Get('dashboard')
  getDashboard(@Param('companyId') companyId: string) {
    return this.svc.getApDashboard(companyId);
  }

  // GET /api/v1/companies/:companyId/ap/aging
  @Get('aging')
  getAging(@Param('companyId') companyId: string) {
    return this.svc.getApAgingReport(companyId);
  }

  // GET /api/v1/companies/:companyId/ap/aging/export
  @Get('aging/export')
  async exportAging(
    @Param('companyId') companyId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.svc.exportApReport(companyId);
    const date   = new Date().toISOString().split('T')[0];
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cuentas-pagar-${date}.xlsx"`,
    );
    res.send(buffer);
  }

  // POST /api/v1/companies/:companyId/ap/payments
  @Post('payments')
  registerPayment(
    @Param('companyId') companyId: string,
    @Body() dto: RegisterApPaymentDto,
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.svc.registerPayment(companyId, dto, req.user.id);
  }

  // GET /api/v1/companies/:companyId/ap/payments
  @Get('payments')
  getPayments(
    @Param('companyId') companyId: string,
    @Query() filters: ApPaymentFilterDto,
  ) {
    return this.svc.getPayments(companyId, filters);
  }

  // GET /api/v1/companies/:companyId/ap/suppliers/:supplierName/statement
  @Get('suppliers/:supplierName/statement')
  getSupplierStatement(
    @Param('companyId')    companyId:    string,
    @Param('supplierName') supplierName: string,
  ) {
    return this.svc.getSupplierStatement(companyId, supplierName);
  }
}
