import {
  Injectable, NotFoundException,
  ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  CreateProductDto, UpdateProductDto, AdjustStockDto,
  CreateCategoryDto, UpdateCategoryDto,
} from './dto/products.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.product.findMany({
      where:   { companyId, isActive: true },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(companyId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where:   { id: productId, companyId },
      include: { category: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  async create(companyId: string, dto: CreateProductDto) {
    // Check for duplicate SKU within company
    if (dto.sku) {
      const existing = await this.prisma.product.findFirst({
        where: { companyId, sku: dto.sku, isActive: true },
      });
      if (existing) {
        throw new ConflictException(`Ya existe un producto con el SKU "${dto.sku}"`);
      }
    }

    return this.prisma.product.create({
      data: {
        companyId,
        name:        dto.name,
        description: dto.description ?? null,
        sku:         dto.sku         ?? null,
        cabysCode:   dto.cabysCode,
        price:       new Decimal(dto.price.toString()),
        cost:        new Decimal((dto.cost ?? 0).toString()),
        taxRate:     new Decimal(dto.taxRate.toString()),
        stock:       new Decimal((dto.stock ?? 0).toString()),
        minStock:    new Decimal((dto.minStock ?? 0).toString()),
        unit:        dto.unit      ?? 'Unid',
        isService:   dto.isService ?? false,
        categoryId:  dto.categoryId ?? null,
        isActive:    true,
      },
    });
  }

  async update(companyId: string, productId: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(dto.name        && { name:     dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.cabysCode   && { cabysCode: dto.cabysCode }),
        ...(dto.price       !== undefined && { price:    new Decimal(dto.price.toString()) }),
        ...(dto.cost        !== undefined && { cost:     new Decimal(dto.cost.toString()) }),
        ...(dto.taxRate     !== undefined && { taxRate:  new Decimal(dto.taxRate.toString()) }),
        ...(dto.minStock    !== undefined && { minStock: new Decimal(dto.minStock.toString()) }),
        ...(dto.unit        && { unit:     dto.unit }),
        updatedAt: new Date(),
      },
    });
  }

  // Manual stock adjustment (purchase, correction, etc.)
  async adjustStock(companyId: string, productId: string, dto: AdjustStockDto, userId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    if (product.isService) {
      throw new BadRequestException('Los servicios no tienen control de inventario');
    }

    const currentStock = new Decimal(product.stock.toString());
    const adjustment   = new Decimal(dto.quantity.toString());
    const newStock     = currentStock.plus(adjustment);

    if (newStock.lessThan(0)) {
      throw new BadRequestException(
        `El ajuste dejaría el stock en ${newStock.toFixed(3)}, lo cual es negativo. ` +
        `Stock actual: ${currentStock.toFixed(3)}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data:  { stock: newStock, updatedAt: new Date() },
      });

      await tx.inventoryMovement.create({
        data: {
          productId,
          companyId,
          type:         'ADJUSTMENT',
          quantity:     adjustment,
          balanceAfter: newStock,
          notes:        dto.reason,
          createdById:  userId,
        },
      });

      return { productId, previousStock: currentStock.toFixed(3), newStock: newStock.toFixed(3) };
    });
  }

  async deactivate(companyId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    return this.prisma.product.update({
      where: { id: productId },
      data:  { isActive: false, updatedAt: new Date() },
    });
  }

  // ── Categorías de producto ──────────────────────────────────────
  // NOTA: en el schema actual `ProductCategory` es una tabla global
  // (no tiene companyId); la relación por empresa vive en
  // `Product.categoryId`. Por eso la "pertenencia" se valida como
  // existencia de la categoría, y los conteos de productos sí se
  // calculan scoped a la empresa del request.

  async getCategories(companyId: string) {
    // Scoped a la empresa (phase16). Shape: escalares + `_count.products`
    // (productos activos de ESTA empresa) para la UI.
    return this.prisma.productCategory.findMany({
      where:   { companyId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            products: { where: { companyId, isActive: true } },
          },
        },
      },
    });
  }

  async createCategory(companyId: string, dto: CreateCategoryDto) {
    const name = dto.name.trim();
    if (name.length < 2) {
      throw new BadRequestException('El nombre debe tener al menos 2 caracteres');
    }

    // Duplicados por nombre DENTRO de la empresa, case-insensitive.
    const existing = await this.prisma.productCategory.findFirst({
      where: { companyId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException(`Ya existe una categoría llamada "${existing.name}"`);
    }

    return this.prisma.productCategory.create({ data: { companyId, name } });
  }

  async renameCategory(companyId: string, categoryId: string, dto: UpdateCategoryDto) {
    // Pertenencia real: la categoría debe ser de ESTA empresa.
    const category = await this.prisma.productCategory.findFirst({
      where: { id: categoryId, companyId },
    });
    if (!category) throw new NotFoundException('Categoría no encontrada');

    const name = dto.name.trim();
    if (name.length < 2) {
      throw new BadRequestException('El nombre debe tener al menos 2 caracteres');
    }

    const duplicate = await this.prisma.productCategory.findFirst({
      where: {
        companyId,
        id:   { not: categoryId },
        name: { equals: name, mode: 'insensitive' },
      },
    });
    if (duplicate) {
      throw new ConflictException(`Ya existe una categoría llamada "${duplicate.name}"`);
    }

    return this.prisma.productCategory.update({
      where: { id: categoryId },
      data:  { name },
    });
  }

  async deleteCategory(companyId: string, categoryId: string) {
    // Pertenencia real: la categoría debe ser de ESTA empresa.
    const category = await this.prisma.productCategory.findFirst({
      where: { id: categoryId, companyId },
    });
    if (!category) throw new NotFoundException('Categoría no encontrada');

    return this.prisma.$transaction(async (tx) => {
      // Cuántos productos quedan desasignados (para la UI).
      const detachedProducts = await tx.product.count({
        where: { categoryId, companyId },
      });

      // NO borrar en cascada: desasignar explícitamente y recién entonces borrar.
      await tx.product.updateMany({
        where: { categoryId, companyId },
        data:  { categoryId: null, updatedAt: new Date() },
      });

      await tx.productCategory.delete({ where: { id: categoryId } });

      return { ok: true, detachedProducts };
    });
  }
}
