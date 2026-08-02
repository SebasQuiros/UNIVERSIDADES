import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateProductAttributeDto,
  UpdateProductAttributeDto,
  CreateAttributeValueDto,
} from './dto/product-attributes.dto';

@Injectable()
export class ProductAttributesService {
  constructor(private readonly prisma: PrismaService) {}

  // Se devuelven siempre con sus valores incluidos: la vista muestra cada
  // atributo con sus chips, y pedirlos por separado forzaría N+1 llamadas.
  async findAll(companyId: string) {
    return this.prisma.productAttribute.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      include: { values: { orderBy: { value: 'asc' } } },
    });
  }

  async create(companyId: string, dto: CreateProductAttributeDto) {
    const name = dto.name.trim();

    // No hay unique en BD sobre (companyId, name), así que el duplicado se
    // valida acá para no acabar con dos "Talla" indistinguibles en la lista.
    const existe = await this.prisma.productAttribute.findFirst({
      where: { companyId, name },
    });
    if (existe) throw new ConflictException(`Ya existe un atributo llamado "${name}"`);

    return this.prisma.productAttribute.create({
      data: { companyId, name },
      include: { values: true },
    });
  }

  async update(companyId: string, id: string, dto: UpdateProductAttributeDto) {
    await this._get(companyId, id);

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const otro = await this.prisma.productAttribute.findFirst({
        where: { companyId, name, id: { not: id } },
      });
      if (otro) throw new ConflictException(`Ya existe un atributo llamado "${name}"`);
    }

    return this.prisma.productAttribute.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { values: { orderBy: { value: 'asc' } } },
    });
  }

  // Borrado real: un atributo mal creado no aporta historia contable que
  // conservar. Los valores caen con él (misma transacción).
  async remove(companyId: string, id: string) {
    await this._get(companyId, id);
    await this.prisma.$transaction([
      this.prisma.productAttributeValue.deleteMany({ where: { attributeId: id } }),
      this.prisma.productAttribute.delete({ where: { id } }),
    ]);
    return { id, deleted: true };
  }

  async addValue(companyId: string, attributeId: string, dto: CreateAttributeValueDto) {
    await this._get(companyId, attributeId);
    const value = dto.value.trim();

    // Hay un @@unique([attributeId, value]) en BD; se comprueba antes para
    // devolver un mensaje útil en vez de un error opaco de Prisma.
    const existe = await this.prisma.productAttributeValue.findFirst({
      where: { attributeId, value },
    });
    if (existe) throw new ConflictException(`El valor "${value}" ya existe en este atributo`);

    return this.prisma.productAttributeValue.create({
      data: { attributeId, value },
    });
  }

  async removeValue(companyId: string, attributeId: string, valueId: string) {
    await this._get(companyId, attributeId);
    const v = await this.prisma.productAttributeValue.findFirst({
      where: { id: valueId, attributeId },
    });
    if (!v) throw new NotFoundException('Valor no encontrado');

    await this.prisma.productAttributeValue.delete({ where: { id: valueId } });
    return { id: valueId, deleted: true };
  }

  // Toda lectura pasa por acá: el companyId del path debe coincidir con el del
  // registro, o el aislamiento entre instituciones se rompe.
  private async _get(companyId: string, id: string) {
    const a = await this.prisma.productAttribute.findFirst({ where: { id, companyId } });
    if (!a) throw new NotFoundException('Atributo no encontrado');
    return a;
  }
}
