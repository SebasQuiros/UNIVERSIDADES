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

  /**
   * Ficha completa de un proveedor.
   *
   * Ojo con una particularidad del modelo: las ÓRDENES de compra apuntan al
   * proveedor por id, pero las FACTURAS de compra guardan el proveedor como
   * texto libre (supplierName / supplierCedula). Así que el historial se arma
   * por los dos lados: por relación donde la hay, y por cédula —o por nombre
   * si no hay cédula— donde no la hay. Mirar solo las órdenes dejaría fuera
   * las compras registradas directamente, que son la mayoría.
   */
  async resumen(companyId: string, supplierId: string, anio?: number) {
    const proveedor = await this._get(companyId, supplierId);

    const y = anio ?? new Date().getFullYear();
    const desde = new Date(`${y}-01-01T00:00:00.000Z`);
    const hasta = new Date(`${y}-12-31T23:59:59.999Z`);

    // Identificar sus facturas: la cédula es la llave confiable; el nombre es
    // el respaldo para proveedores cargados sin identificación.
    const suyas: any = proveedor.identification
      ? { companyId, supplierCedula: proveedor.identification }
      : { companyId, supplierName: proveedor.name };

    const [agregado, delAnio, facturas, ultima, ordenes, pagos] = await Promise.all([
      this.prisma.purchaseInvoice.aggregate({
        where: suyas, _sum: { total: true, paidAmount: true }, _count: true,
      }),
      this.prisma.purchaseInvoice.aggregate({
        where: { ...suyas, date: { gte: desde, lte: hasta } },
        _sum: { total: true, paidAmount: true }, _count: true,
      }),
      this.prisma.purchaseInvoice.findMany({
        where: suyas,
        select: { id: true, invoiceNumber: true, date: true, total: true,
                  paidAmount: true, isPaid: true },
        orderBy: { date: 'desc' }, take: 20,
      }),
      this.prisma.purchaseInvoice.findFirst({
        where: suyas, select: { date: true }, orderBy: { date: 'desc' },
      }),
      this.prisma.purchaseOrder.findMany({
        where: { companyId, supplierId },
        select: { id: true, orderNumber: true, issueDate: true, total: true, status: true },
        orderBy: { issueDate: 'desc' }, take: 10,
      }),
      this.prisma.apPayment.findMany({
        where: { companyId, purchaseInvoice: suyas },
        select: { id: true, amount: true, paymentDate: true, reference: true, method: true },
        orderBy: { paymentDate: 'desc' }, take: 10,
      }),
    ]);

    const n = (v: any) => Number(v ?? 0);
    const comprado = n(agregado._sum.total);
    const pagado   = n(agregado._sum.paidAmount);

    return {
      proveedor,
      comercial: {
        anio: y,
        compradoTotal: comprado.toFixed(2),
        pagadoTotal:   pagado.toFixed(2),
        saldoPorPagar: Math.max(0, comprado - pagado).toFixed(2),
        documentos:    agregado._count,
        compradoAnio:  n(delAnio._sum.total).toFixed(2),
        pagadoAnio:    n(delAnio._sum.paidAmount).toFixed(2),
        documentosAnio: delAnio._count,
        ultimaCompra:  ultima?.date ?? null,
        ordenesPendientes: ordenes.filter(o => o.status === 'ISSUED' || o.status === 'DRAFT').length,
      },
      facturas,
      ordenes,
      pagos,
    };
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
