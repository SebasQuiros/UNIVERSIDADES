import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Request, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { RecurringInvoicesService } from './recurring-invoices.service';
import {
  CreateRecurringInvoiceDto,
  UpdateRecurringInvoiceDto,
  ToggleRecurringInvoiceDto,
} from './dto/recurring-invoices.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

// CompanyOwnerGuard es lo que impide leer/escribir programaciones de otra
// empresa (y por lo tanto de otra institución). Mismo patrón que suppliers.
@Controller('companies/:companyId/recurring-invoices')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class RecurringInvoicesController {
  constructor(private readonly svc: RecurringInvoicesService) {}

  @Get()
  findAll(@Param('companyId') companyId: string) {
    return this.svc.findAll(companyId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Param('companyId') companyId: string, @Body() dto: CreateRecurringInvoiceDto) {
    return this.svc.create(companyId, dto);
  }

  @Patch(':id')
  update(
    @Param('companyId') cid: string,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringInvoiceDto,
  ) {
    return this.svc.update(cid, id, dto);
  }

  // Activar / pausar sin perder el historial de corridas.
  @Patch(':id/toggle')
  toggle(
    @Param('companyId') cid: string,
    @Param('id') id: string,
    @Body() dto: ToggleRecurringInvoiceDto,
  ) {
    return this.svc.toggle(cid, id, dto.isActive);
  }

  @Delete(':id')
  remove(@Param('companyId') cid: string, @Param('id') id: string) {
    return this.svc.remove(cid, id);
  }

  // Generar ahora: crea y emite la factura real, y reprograma la siguiente.
  @Post(':id/generate')
  @HttpCode(HttpStatus.CREATED)
  generate(
    @Param('companyId') cid: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.svc.generate(cid, id, req.user.id);
  }
}
