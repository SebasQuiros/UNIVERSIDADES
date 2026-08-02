import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouses.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

@Controller('companies/:companyId/warehouses')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class WarehousesController {
  constructor(private readonly svc: WarehousesService) {}

  @Get()
  findAll(@Param('companyId') companyId: string) {
    return this.svc.findAll(companyId);
  }

  @Post()
  create(@Param('companyId') companyId: string, @Body() dto: CreateWarehouseDto) {
    return this.svc.create(companyId, dto);
  }

  @Patch(':id')
  update(@Param('companyId') cid: string, @Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.svc.update(cid, id, dto);
  }

  @Delete(':id')
  remove(@Param('companyId') cid: string, @Param('id') id: string) {
    return this.svc.remove(cid, id);
  }
}
