import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { RecurringPaymentsService } from './recurring-payments.service';
import {
  CreateRecurringPaymentDto,
  UpdateRecurringPaymentDto,
  ToggleRecurringPaymentDto,
} from './dto/recurring-payments.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';
import { CurrentUser } from '../auth/decorators/auth.decorators';

// CompanyOwnerGuard es lo que impide que un estudiante de otra institución
// lea o genere pagos de una empresa ajena. Mismo patrón que suppliers.
@Controller('companies/:companyId/recurring-payments')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class RecurringPaymentsController {
  constructor(private readonly svc: RecurringPaymentsService) {}

  @Get()
  findAll(@Param('companyId') companyId: string) {
    return this.svc.findAll(companyId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Param('companyId') companyId: string, @Body() dto: CreateRecurringPaymentDto) {
    return this.svc.create(companyId, dto);
  }

  @Patch(':id')
  update(
    @Param('companyId') cid: string,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringPaymentDto,
  ) {
    return this.svc.update(cid, id, dto);
  }

  // Activar/pausar sin perder el historial de corridas.
  @Patch(':id/active')
  setActive(
    @Param('companyId') cid: string,
    @Param('id') id: string,
    @Body() dto: ToggleRecurringPaymentDto,
  ) {
    return this.svc.setActive(cid, id, dto.isActive);
  }

  @Delete(':id')
  remove(@Param('companyId') cid: string, @Param('id') id: string) {
    return this.svc.remove(cid, id);
  }

  // Generar ahora: crea la factura de compra real con su asiento.
  @Post(':id/generate')
  @HttpCode(HttpStatus.CREATED)
  generate(
    @Param('companyId') cid: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.generate(cid, id, user.id);
  }
}
