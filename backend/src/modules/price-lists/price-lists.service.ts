import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePriceListDto, UpdatePriceListDto, SetPriceDto } from './dto/price-lists.dto';

@Injectable()
export class PriceListsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Listado con conteo de productos. Se usa `_count` de Prisma en vez de traer
   * los ítems: la vista solo necesita el número y traer todos los precios de
   * todas las listas sería un N+1 innecesario.
   */
  async findAll(companyId: string) {
    const lists = await this.prisma.priceList.findMany({
      where:   { companyId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { items: true } } },
    });

    return lists.map((l) => ({
      id:        l.id,
      name:      l.name,
      currency:  l.currency,
      isDefault: l.isDefault,
      isActive:  l.isActive,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      itemCount: l._count.items,
    }));
  }

  /** Detalle con sus ítems y el precio base del producto, para poder comparar. */
  async findOne(companyId: string, id: string) {
    const list = await this._get(companyId, id);

    const items = await this.prisma.priceListItem.findMany({
      where:   { priceListId: id },
      include: {
        product: {
          select: { id: true, name: true, sku: true, unit: true, price: true, isActive: true },
        },
      },
      orderBy: { product: { name: 'asc' } },
    });

    return {
      ...list,
      items: items.map((it) => ({
        id:          it.id,
        productId:   it.productId,
        price:       Number(it.price),
        productName: it.product.name,
        sku:         it.product.sku,
        unit:        it.product.unit,
        // Precio del catálogo: la vista muestra la diferencia (descuento o
        // recargo) contra el precio base, que es el sentido de tener listas.
        basePrice:   Number(it.product.price),
        updatedAt:   it.updatedAt,
      })),
    };
  }

  async create(companyId: string, dto: CreatePriceListDto) {
    // Transacción: si esta lista nace como predeterminada hay que desmarcar las
    // demás en el mismo commit, o quedarían dos predeterminadas si algo falla.
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.priceList.updateMany({ where: { companyId }, data: { isDefault: false } });
      }
      return tx.priceList.create({
        data: {
          companyId,
          name:      dto.name,
          currency:  dto.currency ?? 'CRC',
          isDefault: dto.isDefault ?? false,
        },
      });
    });
  }

  async update(companyId: string, id: string, dto: UpdatePriceListDto) {
    await this._get(companyId, id);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        // `not: id` para no desmarcar la misma que estamos marcando.
        await tx.priceList.updateMany({
          where: { companyId, id: { not: id } },
          data:  { isDefault: false },
        });
      }
      return tx.priceList.update({
        where: { id },
        data: {
          ...(dto.name     !== undefined && { name: dto.name }),
          ...(dto.currency !== undefined && { currency: dto.currency }),
          ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
          ...(dto.isActive  !== undefined && { isActive: dto.isActive }),
        },
      });
    });
  }

  /** Borrado real: los ítems caen por el onDelete: Cascade del esquema. */
  async remove(companyId: string, id: string) {
    await this._get(companyId, id);
    await this.prisma.priceList.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Fija (o actualiza) el precio de un producto dentro de la lista.
   * Verifica que el producto sea de la MISMA empresa: sin esa comprobación un
   * companyId válido podría colgar productos de otra institución en su lista,
   * rompiendo el aislamiento multi-tenant.
   */
  async setPrice(companyId: string, id: string, dto: SetPriceDto) {
    await this._get(companyId, id);

    const product = await this.prisma.product.findFirst({
      where:  { id: dto.productId, companyId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado en esta empresa');

    return this.prisma.priceListItem.upsert({
      where:  { priceListId_productId: { priceListId: id, productId: dto.productId } },
      update: { price: dto.price },
      create: { priceListId: id, productId: dto.productId, price: dto.price },
    });
  }

  /** Quita un producto de la lista (vuelve a regir el precio base del catálogo). */
  async removeItem(companyId: string, id: string, productId: string) {
    await this._get(companyId, id);

    const item = await this.prisma.priceListItem.findFirst({
      where:  { priceListId: id, productId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('El producto no está en esta lista');

    await this.prisma.priceListItem.delete({ where: { id: item.id } });
    return { ok: true };
  }

  /** Punto único de aislamiento: siempre id + companyId, nunca solo id. */
  private async _get(companyId: string, id: string) {
    const list = await this.prisma.priceList.findFirst({ where: { id, companyId } });
    if (!list) throw new NotFoundException('Lista de precios no encontrada');
    return list;
  }
}
