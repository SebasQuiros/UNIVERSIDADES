import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Request, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import {
  CreateProductDto, UpdateProductDto, AdjustStockDto,
  CreateCategoryDto, UpdateCategoryDto,
} from './dto/products.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CompanyOwnerGuard } from '../../common/guards/company-owner.guard';

@Controller('companies/:companyId/products')
@UseGuards(JwtAuthGuard, CompanyOwnerGuard)
export class ProductsController {
  constructor(private readonly svc: ProductsService) {}

  // ── Categorías de producto ──────────────────────────────────────
  // Rutas literales ('categories/…') declaradas ANTES de las rutas
  // paramétricas (':id') para que Nest no las capture como id.

  @Get('categories')
  getCategories(@Param('companyId') companyId: string) {
    return this.svc.getCategories(companyId);
  }

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  createCategory(
    @Param('companyId') companyId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.svc.createCategory(companyId, dto);
  }

  @Patch('categories/:categoryId')
  renameCategory(
    @Param('companyId') companyId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.svc.renameCategory(companyId, categoryId, dto);
  }

  @Delete('categories/:categoryId')
  @HttpCode(HttpStatus.OK)
  deleteCategory(
    @Param('companyId') companyId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.svc.deleteCategory(companyId, categoryId);
  }

  @Get()
  findAll(@Param('companyId') companyId: string) {
    return this.svc.findAll(companyId);
  }

  @Get(':id')
  findOne(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.svc.findOne(companyId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Param('companyId') companyId: string, @Body() dto: CreateProductDto, @Request() req: any) {
    return this.svc.create(companyId, dto, req?.user?.id);
  }

  @Patch(':id')
  update(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.svc.update(companyId, id, dto);
  }

  @Post(':id/adjust-stock')
  @HttpCode(HttpStatus.OK)
  adjustStock(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
    @Request() req: any,
  ) {
    return this.svc.adjustStock(companyId, id, dto, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.svc.deactivate(companyId, id);
  }
}
