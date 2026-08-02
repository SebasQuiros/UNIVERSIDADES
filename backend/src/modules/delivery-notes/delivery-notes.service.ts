import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DeliveryNoteStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDeliveryNoteDto, UpdateDeliveryNoteStatusDto } from './dto/delivery-notes.dto';

/**
 * Transiciones permitidas del ciclo de una remisión.
 * Se declara como tabla porque el flujo es lineal y así el estudiante recibe
 * un mensaje claro en vez de un 500 cuando intenta saltarse un paso.
 */
const TRANSICIONES: Record<DeliveryNoteStatus, DeliveryNoteStatus[]> = {
  DRAFT:      ['DISPATCHED'],
  DISPATCHED: ['DELIVERED'],
  DELIVERED:  [],   // de acá solo sale al facturar (lo hace el módulo de facturas)
  INVOICED:   [],
  CANCELLED:  [],
};

/** Estados donde el documento queda congelado: ya produjo efectos contables o se anuló. */
const CONGELADOS: DeliveryNoteStatus[] = ['INVOICED', 'CANCELLED'];

@Injectable()
export class DeliveryNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    // El filtro por companyId es la barrera de aislamiento entre instituciones:
    // nunca se busca una remisión solo por id.
    return this.prisma.deliveryNote.findMany({
      where: { companyId },
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
      include: {
        client: { select: { id: true, name: true, identification: true } },
        lines: {
          orderBy: { createdAt: 'asc' },
          include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
        },
      },
    });
  }

  async findOne(companyId: string, id: string) {
    const nota = await this.prisma.deliveryNote.findFirst({
      where: { id, companyId },
      include: {
        client: true,
        lines: {
          orderBy: { createdAt: 'asc' },
          include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
        },
      },
    });
    if (!nota) throw new NotFoundException('Remisión no encontrada');
    return nota;
  }

  async create(companyId: string, dto: CreateDeliveryNoteDto) {
    // 1) El cliente debe ser de ESTA empresa. Si se buscara solo por id se
    //    podría emitir una remisión a nombre del cliente de otra institución.
    const cliente = await this.prisma.client.findFirst({
      where: { id: dto.clientId, companyId },
      select: { id: true },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado en esta empresa');

    // 2) Igual con los productos: se validan TODOS de una sola query y se
    //    compara la cantidad de ids únicos contra los encontrados.
    const idsProductos = [...new Set(dto.lines.map((l) => l.productId))];
    const productos = await this.prisma.product.findMany({
      where: { id: { in: idsProductos }, companyId },
      select: { id: true, name: true },
    });
    if (productos.length !== idsProductos.length) {
      throw new NotFoundException('Uno o más productos no pertenecen a esta empresa');
    }
    const nombrePorId = new Map(productos.map((p) => [p.id, p.name]));

    const fecha = dto.date ? new Date(dto.date) : new Date();
    if (Number.isNaN(fecha.getTime())) throw new BadRequestException('Fecha inválida');

    // 3) Crear con número consecutivo. El consecutivo se calcula contando, así
    //    que dos peticiones simultáneas pueden chocar contra
    //    @@unique([companyId, number]) → P2002. En ese caso se reintenta con el
    //    siguiente número en vez de fallarle al estudiante.
    const MAX_INTENTOS = 5;
    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      const numero = await this.siguienteNumero(companyId, intento);
      try {
        return await this.prisma.deliveryNote.create({
          data: {
            companyId,
            clientId: dto.clientId,
            number: numero,
            date: fecha,
            status: 'DRAFT',
            notes: dto.notes?.trim() || null,
            lines: {
              create: dto.lines.map((l) => ({
                productId: l.productId,
                description: l.description?.trim() || nombrePorId.get(l.productId) || 'Sin descripción',
                quantity: new Prisma.Decimal(l.quantity),
              })),
            },
          },
          include: {
            client: { select: { id: true, name: true, identification: true } },
            lines: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
          },
        });
      } catch (e) {
        const choqueDeNumero =
          e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
        if (!choqueDeNumero || intento === MAX_INTENTOS - 1) throw e;
      }
    }
    throw new ConflictException('No se pudo asignar un consecutivo de remisión, intentá de nuevo');
  }

  /** Cambio de estado siguiendo DRAFT → DISPATCHED → DELIVERED. */
  async changeStatus(companyId: string, id: string, dto: UpdateDeliveryNoteStatusDto) {
    const nota = await this.getEditable(companyId, id);

    if (dto.status === 'CANCELLED') {
      throw new BadRequestException('Para anular una remisión usá el endpoint de cancelación');
    }
    if (dto.status === 'INVOICED') {
      throw new BadRequestException('El estado facturado lo asigna el módulo de facturación');
    }
    if (!TRANSICIONES[nota.status].includes(dto.status)) {
      throw new ConflictException(
        `No se puede pasar de ${nota.status} a ${dto.status}. El flujo es borrador → despachada → entregada.`,
      );
    }

    return this.prisma.deliveryNote.update({
      where: { id: nota.id },
      data: { status: dto.status },
      include: { client: { select: { id: true, name: true } }, lines: true },
    });
  }

  /** Anular. No revierte nada contable porque la remisión nunca generó asiento. */
  async cancel(companyId: string, id: string) {
    const nota = await this.getEditable(companyId, id);
    return this.prisma.deliveryNote.update({
      where: { id: nota.id },
      data: { status: 'CANCELLED' },
      include: { client: { select: { id: true, name: true } }, lines: true },
    });
  }

  /**
   * Borrado físico. Solo para borradores: una remisión ya despachada es
   * evidencia de una entrega real, se anula pero no se borra.
   */
  async remove(companyId: string, id: string) {
    const nota = await this.prisma.deliveryNote.findFirst({ where: { id, companyId } });
    if (!nota) throw new NotFoundException('Remisión no encontrada');
    if (nota.status !== 'DRAFT') {
      throw new ConflictException(
        'Solo se pueden eliminar remisiones en borrador. Si ya salió mercancía, anulala.',
      );
    }
    // Las líneas se van solas por onDelete: Cascade.
    await this.prisma.deliveryNote.delete({ where: { id: nota.id } });
    return { deleted: true, id: nota.id };
  }

  /** Carga la remisión y bloquea las que ya no admiten cambios. */
  private async getEditable(companyId: string, id: string) {
    const nota = await this.prisma.deliveryNote.findFirst({ where: { id, companyId } });
    if (!nota) throw new NotFoundException('Remisión no encontrada');
    if (CONGELADOS.includes(nota.status)) {
      throw new ConflictException(
        nota.status === 'INVOICED'
          ? 'Esta remisión ya se facturó y no se puede modificar.'
          : 'Esta remisión está anulada y no se puede modificar.',
      );
    }
    return nota;
  }

  /**
   * Consecutivo por empresa: REM-000001. El offset lo usa el reintento de P2002
   * para saltar al siguiente número cuando otro proceso ganó la carrera.
   */
  private async siguienteNumero(companyId: string, offset = 0): Promise<string> {
    const existentes = await this.prisma.deliveryNote.count({ where: { companyId } });
    return `REM-${String(existentes + 1 + offset).padStart(6, '0')}`;
  }
}
