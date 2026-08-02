import { Controller, Get, Post, Patch, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { PriceListsService } from './price-lists.service';
import { CreatePriceListDto, UpdatePriceListDto, SetPriceDto } from './dto/price-lists.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

// CompanyOwnerGuard es obligatorio: sin él, cualquier usuario autenticado
// podría leer o editar las listas de precios de otra institución.
@Controller('companies/:companyId/price-lists')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class PriceListsController {
  constructor(private readonly svc: PriceListsService) {}

  @Get()
  findAll(@Param('companyId') companyId: string) {
    return this.svc.findAll(companyId);
  }

  @Post()
  create(@Param('companyId') companyId: string, @Body() dto: CreatePriceListDto) {
    return this.svc.create(companyId, dto);
  }

  @Get(':id')
  findOne(@Param('companyId') cid: string, @Param('id') id: string) {
    return this.svc.findOne(cid, id);
  }

  @Patch(':id')
  update(@Param('companyId') cid: string, @Param('id') id: string, @Body() dto: UpdatePriceListDto) {
    return this.svc.update(cid, id, dto);
  }

  @Delete(':id')
  remove(@Param('companyId') cid: string, @Param('id') id: string) {
    return this.svc.remove(cid, id);
  }

  // PUT (no POST): fijar un precio es idempotente, se hace upsert.
  @Put(':id/items')
  setPrice(@Param('companyId') cid: string, @Param('id') id: string, @Body() dto: SetPriceDto) {
    return this.svc.setPrice(cid, id, dto);
  }

  @Delete(':id/items/:productId')
  removeItem(
    @Param('companyId') cid: string,
    @Param('id') id: string,
    @Param('productId') productId: string,
  ) {
    return this.svc.removeItem(cid, id, productId);
  }
}
