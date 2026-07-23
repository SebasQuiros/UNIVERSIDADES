import {
  Controller, Get, Post, Patch, Body, Param,
  Request, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderDto } from './dto/purchase-orders.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

/**
 * Órdenes de compra a proveedor, scoped por empresa. Mismo esquema de
 * guards que QuotesController / CreditNotesController.
 */
@Controller('companies/:companyId/purchase-orders')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class PurchaseOrdersController {
  constructor(private readonly svc: PurchaseOrdersService) {}

  @Get()
  findAll(@Param('companyId') companyId: string) {
    return this.svc.list(companyId);
  }

  @Get(':id')
  findOne(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.svc.get(companyId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('companyId') companyId: string,
    @Body() dto: CreatePurchaseOrderDto,
    @Request() req: any,
  ) {
    return this.svc.create(companyId, req.user.id, dto);
  }

  @Patch(':id')
  update(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.svc.update(companyId, id, dto);
  }

  @Post(':id/issue')
  @HttpCode(HttpStatus.OK)
  issue(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.svc.issue(companyId, id);
  }

  @Post(':id/receive')
  @HttpCode(HttpStatus.OK)
  receive(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.svc.receive(companyId, id, req.user.id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.svc.cancel(companyId, id);
  }
}
