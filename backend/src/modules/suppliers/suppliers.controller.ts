import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

@Controller('companies/:companyId/suppliers')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class SuppliersController {
  constructor(private readonly svc: SuppliersService) {}

  @Get()
  findAll(@Param('companyId') companyId: string) {
    return this.svc.findAll(companyId);
  }

  /** Ficha del proveedor: datos, historial de compras, órdenes y pagos. */
  @Get(':id/resumen')
  resumen(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Query('anio') anio?: string,
  ) {
    return this.svc.resumen(companyId, id, anio ? Number(anio) : undefined);
  }

  @Post()
  create(@Param('companyId') companyId: string, @Body() dto: CreateSupplierDto) {
    return this.svc.create(companyId, dto);
  }

  @Patch(':id')
  update(@Param('companyId') cid: string, @Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.svc.update(cid, id, dto);
  }

  @Delete(':id')
  deactivate(@Param('companyId') cid: string, @Param('id') id: string) {
    return this.svc.deactivate(cid, id);
  }
}
