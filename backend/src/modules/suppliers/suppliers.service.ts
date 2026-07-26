import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    const suppliers = await this.prisma.supplier.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });

    // Agregado de compras por proveedor (1 sola query, groupBy) — vía
    // PurchaseOrder, que sí tiene relación real supplierId (a diferencia de
    // PurchaseInvoice, que guarda el proveedor como texto libre). Reemplaza
    // métricas sin valor como "cuántos tienen correo" (spec UTN §7).
    const totals = suppliers.length === 0 ? [] : await this.prisma.purchaseOrder.groupBy({
      by:     ['supplierId'],
      where:  { companyId, status: { in: ['RECEIVED', 'INVOICED'] }, supplierId: { in: suppliers.map((s) => s.id) } },
      _sum:   { total: true },
      _count: true,
    });
    const bySupplier = new Map(totals.map((t) => [t.supplierId, t]));

    return suppliers.map((s) => ({
      ...s,
      totalPurchased: Number(bySupplier.get(s.id)?._sum.total ?? 0),
      orderCount:     bySupplier.get(s.id)?._count ?? 0,
    }));
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
