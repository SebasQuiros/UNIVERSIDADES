import {
  Controller, Get, Post, Param, Body, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { PurchaseInvoicesService } from './purchase-invoices.service';
import { CreatePurchaseInvoiceDto, PurchaseInvoiceFilterDto } from './dto/purchase-invoices.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CurrentUser } from '../auth/decorators/auth.decorators';

@Controller('companies/:companyId/purchase-invoices')
@UseGuards(JwtAuthGuard)
export class PurchaseInvoicesController {
  constructor(private readonly svc: PurchaseInvoicesService) {}

  // POST /api/v1/companies/:companyId/purchase-invoices
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('companyId') companyId: string,
    @Body() dto: CreatePurchaseInvoiceDto,
    @CurrentUser() user: any,
  ) {
    const attemptId = await this.svc.resolveAttemptId(companyId);
    return this.svc.create(dto, companyId, attemptId, user.id);
  }

  // GET /api/v1/companies/:companyId/purchase-invoices
  @Get()
  findAll(
    @Param('companyId') companyId: string,
    @Query() filter: PurchaseInvoiceFilterDto,
    @CurrentUser() user: any,
  ) {
    return this.svc.findAll(companyId, filter, user.id);
  }

  // GET /api/v1/companies/:companyId/purchase-invoices/iva-summary
  @Get('iva-summary')
  getIvaSummary(
    @Param('companyId') companyId: string,
    @Query('startDate') startDate: string,
    @Query('endDate')   endDate: string,
    @CurrentUser() user: any,
  ) {
    const now   = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = endDate   ? new Date(endDate)   : new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return this.svc.getIvaSummary(companyId, start, end, user.id);
  }

  // GET /api/v1/companies/:companyId/purchase-invoices/:id
  @Get(':id')
  findOne(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.findOne(id, companyId, user.id);
  }
}
