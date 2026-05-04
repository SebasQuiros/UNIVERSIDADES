import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.supplier.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  async create(companyId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: { companyId, ...dto },
    });
  }

  async update(companyId: string, id: string, dto: UpdateSupplierDto) {
    await this._get(companyId, id);
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async deactivate(companyId: string, id: string) {
    await this._get(companyId, id);
    return this.prisma.supplier.update({ where: { id }, data: { isActive: false } });
  }

  private async _get(companyId: string, id: string) {
    const s = await this.prisma.supplier.findFirst({ where: { id, companyId } });
    if (!s) throw new NotFoundException('Proveedor no encontrado');
    return s;
  }
}
