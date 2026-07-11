import { Controller, Get, Post, Param, Request, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';
import { InterCompanyService } from './inter-company.service';

/**
 * F2.2 · Modo Empresarial — bandeja de propuestas de compra inter-company.
 * La empresa compradora (B) ve las propuestas pendientes que le llegaron de una
 * venta de otra empresa del curso y las acepta (genera inventario + asiento +
 * CxP) o rechaza. Scopeado por CompanyOwnerGuard (solo el dueño de B opera).
 */
@Controller('companies/:companyId/purchase-proposals')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class PurchaseProposalsController {
  constructor(private readonly svc: InterCompanyService) {}

  @Get()
  list(@Param('companyId') companyId: string) {
    return this.svc.listPendingProposals(companyId);
  }

  @Post(':purchaseInvoiceId/accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @Param('companyId') companyId: string,
    @Param('purchaseInvoiceId') purchaseInvoiceId: string,
    @Request() req: any,
  ) {
    return this.svc.acceptProposal(companyId, purchaseInvoiceId, req.user.id);
  }

  @Post(':purchaseInvoiceId/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('companyId') companyId: string,
    @Param('purchaseInvoiceId') purchaseInvoiceId: string,
  ) {
    return this.svc.rejectProposal(companyId, purchaseInvoiceId);
  }
}
