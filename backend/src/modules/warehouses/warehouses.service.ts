import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouses.dto';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    // La predeterminada primero: es la que el resto de módulos asume por defecto.
    return this.prisma.warehouse.findMany({
      where: { companyId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async create(companyId: string, dto: CreateWarehouseDto) {
    const { isDefault, ...resto } = dto;

    // Si nace como predeterminada hay que desmarcar las demás. Ambas
    // operaciones van en una transacción para que nunca queden dos
    // predeterminadas (ni ninguna) si falla la segunda escritura.
    if (isDefault) {
      const [, creada] = await this.prisma.$transaction([
        this.prisma.warehouse.updateMany({
          where: { companyId, isDefault: true },
          data:  { isDefault: false },
        }),
        this.prisma.warehouse.create({
          data: { companyId, ...resto, isDefault: true },
        }),
      ]);
      return creada;
    }

    return this.prisma.warehouse.create({
      data: { companyId, ...resto },
    });
  }

  async update(companyId: string, id: string, dto: UpdateWarehouseDto) {
    await this._get(companyId, id);
    const { isDefault, ...resto } = dto;

    if (isDefault === true) {
      const [, actualizada] = await this.prisma.$transaction([
        // `id: { not: id }` evita desmarcar la misma que estamos promoviendo.
        this.prisma.warehouse.updateMany({
          where: { companyId, isDefault: true, id: { not: id } },
          data:  { isDefault: false },
        }),
        this.prisma.warehouse.update({
          where: { id },
          data:  { ...resto, isDefault: true },
        }),
      ]);
      return actualizada;
    }

    return this.prisma.warehouse.update({
      where: { id },
      data:  { ...resto, ...(isDefault === false ? { isDefault: false } : {}) },
    });
  }

  async remove(companyId: string, id: string) {
    await this._get(companyId, id);
    return this.prisma.warehouse.delete({ where: { id } });
  }

  /** Lectura acotada a la empresa: nunca resolver un id sin su companyId. */
  private async _get(companyId: string, id: string) {
    const w = await this.prisma.warehouse.findFirst({ where: { id, companyId } });
    if (!w) throw new NotFoundException('Bodega no encontrada');
    return w;
  }
}
