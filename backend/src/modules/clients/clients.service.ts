import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto, UpdateClientDto } from './dto/clients.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    const clients = await this.prisma.client.findMany({
      where:   { companyId, isActive: true },
      orderBy: { name: 'asc' },
    });

    // Agregado de compras por cliente — 1 sola query (groupBy), no N+1. Usado
    // para mostrar "cliente con más compras" en vez de métricas sin valor
    // como "cuántos tienen correo" (spec UTN §7).
    const totals = clients.length === 0 ? [] : await this.prisma.invoice.groupBy({
      by:     ['clientId'],
      where:  { companyId, status: 'ISSUED', clientId: { in: clients.map((c) => c.id) } },
      _sum:   { total: true },
      _count: true,
    });
    const byClient = new Map(totals.map((t) => [t.clientId, t]));

    return clients.map((c) => ({
      ...c,
      totalPurchased: Number(byClient.get(c.id)?._sum.total ?? 0),
      invoiceCount:   byClient.get(c.id)?._count ?? 0,
    }));
  }

  async findOne(companyId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    return client;
  }

  /**
   * Ficha completa de un cliente: sus datos, su historial comercial y sus
   * documentos.
   *
   * Todo lo agregado sale de UNA tanda de consultas en paralelo. Es la
   * pantalla que se abre al hacer clic en un cliente de la lista, o sea la
   * que más se va a abrir: si acá se encadenan consultas, se nota.
   */
  async resumen(companyId: string, clientId: string, anio?: number) {
    const client = await this.findOne(companyId, clientId);

    // Sin año explícito, el año en curso. El estudiante compara "este año"
    // contra el total, que es como se lee un historial comercial.
    const y = anio ?? new Date().getFullYear();
    const desde = new Date(`${y}-01-01T00:00:00.000Z`);
    const hasta = new Date(`${y}-12-31T23:59:59.999Z`);

    // Solo cuentan las facturas EMITIDAS: un borrador no es una venta.
    const emitidas = { companyId, clientId, status: { not: 'DRAFT' as any } };

    const [agregado, delAnio, documentos, ultima, cobros] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: emitidas,
        _sum:  { total: true, paidAmount: true, balanceDue: true },
        _count: true,
      }),
      this.prisma.invoice.aggregate({
        where: { ...emitidas, issueDate: { gte: desde, lte: hasta } },
        _sum:  { total: true, paidAmount: true },
        _count: true,
      }),
      this.prisma.invoice.findMany({
        where:  emitidas,
        select: { id: true, consecutiveNumber: true, issueDate: true, total: true,
                  balanceDue: true, status: true },
        orderBy: { issueDate: 'desc' },
        take: 20,
      }),
      this.prisma.invoice.findFirst({
        where:  emitidas,
        select: { issueDate: true },
        orderBy: { issueDate: 'desc' },
      }),
      // Los cobros del módulo de Cuentas por Cobrar viven en ArPayment y
      // cuelgan de la FACTURA, no del cliente. (Existe además una tabla
      // Payment ligada al cliente, de un flujo anterior; mirar ahí devolvía
      // cero cobros aunque la factura estuviera cobrada.)
      this.prisma.arPayment.findMany({
        where:   { companyId, invoice: { clientId } },
        select:  { id: true, amount: true, paymentDate: true, reference: true,
                   method: true, invoice: { select: { consecutiveNumber: true } } },
        orderBy: { paymentDate: 'desc' },
        take: 10,
      }),
    ]);

    const n = (v: any) => Number(v ?? 0);
    const facturado = n(agregado._sum.total);
    const cobrado   = n(agregado._sum.paidAmount);

    return {
      cliente: client,
      comercial: {
        anio: y,
        facturadoTotal:  facturado.toFixed(2),
        cobradoTotal:    cobrado.toFixed(2),
        // El saldo se toma del campo de la factura, no de facturado - cobrado:
        // una nota de crédito baja el saldo sin ser un cobro, y restar daria
        // una deuda que no existe.
        saldoPendiente:  n(agregado._sum.balanceDue).toFixed(2),
        documentos:      agregado._count,
        facturadoAnio:   n(delAnio._sum.total).toFixed(2),
        cobradoAnio:     n(delAnio._sum.paidAmount).toFixed(2),
        documentosAnio:  delAnio._count,
        ultimaCompra:    ultima?.issueDate ?? null,
        diasCredito:     client.creditDays,
        limiteCredito:   n(client.creditLimit).toFixed(2),
        // Cuánto del límite ya está consumido: es el dato que decide si se le
        // puede seguir vendiendo a crédito.
        creditoDisponible: n(client.creditLimit) > 0
          ? Math.max(0, n(client.creditLimit) - n(agregado._sum.balanceDue)).toFixed(2)
          : null,
      },
      documentos,
      cobros,
    };
  }

  async create(companyId: string, dto: CreateClientDto) {
    // Validate no duplicate identification within same company
    const existing = await this.prisma.client.findFirst({
      where: { companyId, identification: dto.identification, isActive: true },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un cliente con la identificación "${dto.identification}" en esta empresa.`,
      );
    }

    return this.prisma.client.create({
      data: {
        companyId,
        name:           dto.name,
        identification: dto.identification,
        idType:         dto.idType,
        email:          dto.email   ?? null,
        phone:          dto.phone   ?? null,
        address:        dto.address ?? null,
        creditDays:     dto.creditDays  ?? 0,
        creditLimit:    dto.creditLimit ?? 0,
        isActive:       true,
      },
    });
  }

  async update(companyId: string, clientId: string, dto: UpdateClientDto) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    return this.prisma.client.update({
      where: { id: clientId },
      data: {
        ...(dto.name        && { name:        dto.name        }),
        ...(dto.email       !== undefined && { email:       dto.email       }),
        ...(dto.phone       !== undefined && { phone:       dto.phone       }),
        ...(dto.address     !== undefined && { address:     dto.address     }),
        ...(dto.creditDays  !== undefined && { creditDays:  dto.creditDays  }),
        ...(dto.creditLimit !== undefined && { creditLimit: dto.creditLimit }),
        updatedAt: new Date(),
      },
    });
  }

  async deactivate(companyId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    return this.prisma.client.update({
      where: { id: clientId },
      data:  { isActive: false, updatedAt: new Date() },
    });
  }
}
