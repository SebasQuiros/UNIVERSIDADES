import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ProductAttributesService } from './product-attributes.service';
import {
  CreateProductAttributeDto,
  UpdateProductAttributeDto,
  CreateAttributeValueDto,
} from './dto/product-attributes.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

// El companyId va en la ruta y lo valida CompanyOwnerGuard: es lo que impide
// que un usuario de una institución lea los atributos de otra.
@Controller('companies/:companyId/product-attributes')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class ProductAttributesController {
  constructor(private readonly svc: ProductAttributesService) {}

  @Get()
  findAll(@Param('companyId') companyId: string) {
    return this.svc.findAll(companyId);
  }

  @Post()
  create(@Param('companyId') companyId: string, @Body() dto: CreateProductAttributeDto) {
    return this.svc.create(companyId, dto);
  }

  @Patch(':id')
  update(
    @Param('companyId') cid: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductAttributeDto,
  ) {
    return this.svc.update(cid, id, dto);
  }

  @Delete(':id')
  remove(@Param('companyId') cid: string, @Param('id') id: string) {
    return this.svc.remove(cid, id);
  }

  @Post(':id/values')
  addValue(
    @Param('companyId') cid: string,
    @Param('id') id: string,
    @Body() dto: CreateAttributeValueDto,
  ) {
    return this.svc.addValue(cid, id, dto);
  }

  @Delete(':id/values/:valueId')
  removeValue(
    @Param('companyId') cid: string,
    @Param('id') id: string,
    @Param('valueId') valueId: string,
  ) {
    return this.svc.removeValue(cid, id, valueId);
  }
}
