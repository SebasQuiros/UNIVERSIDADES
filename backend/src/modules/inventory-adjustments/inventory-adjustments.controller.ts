import {
  Controller, Get, Post, Body, Param,
  Request, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';
import { CreateInventoryAdjustmentDto } from './dto/inventory-adjustments.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

/**
 * Ajustes manuales de inventario (merma/conteo físico/sobrante), scoped por
 * empresa. A diferencia de los endpoints read-only de InventoryController,
 * este SÍ muta stock y genera asiento — mismo esquema de guards que el
 * resto de módulos transaccionales.
 */
@Controller('companies/:companyId/inventory/adjustments')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class InventoryAdjustmentsController {
  constructor(private readonly svc: InventoryAdjustmentsService) {}

  @Get()
  findAll(@Param('companyId') companyId: string) {
    return this.svc.list(companyId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('companyId') companyId: string,
    @Body() dto: CreateInventoryAdjustmentDto,
    @Request() req: any,
  ) {
    return this.svc.create(companyId, req.user.id, dto);
  }
}
