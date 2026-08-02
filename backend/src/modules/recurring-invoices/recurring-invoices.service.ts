import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import {
  CreateRecurringInvoiceDto,
  UpdateRecurringInvoiceDto,
} from './dto/recurring-invoices.dto';

/**
 * CABYS genérico de servicios usado cuando la programación no apunta a un
 * producto. Hacienda exige 13 dígitos en cada línea al emitir (invoices.issue
 * lo valida), así que la recurrente NO puede dejarlo vacío: la factura se
 * crearía y luego fallaría al emitir, dejando un borrador huérfano.
 */
const CABYS_SERVICIO_GENERICO = '8471000000000';

/** Meses que avanza cada frecuencia. Las semanales se manejan aparte. */
const MESES_POR_FRECUENCIA: Record<string, number> = {
  MONTHLY: 1, BIMONTHLY: 2, QUARTERLY: 3, SEMIANNUAL: 6, ANNUAL: 12,
};
const DIAS_POR_FRECUENCIA: Record<string, number> = {
  WEEKLY: 7, BIWEEKLY: 14,
};

/**
 * Avanza una fecha según la frecuencia. Para las mensuales se usa aritmética de
 * meses (no de días) porque el estudiante espera "el 30 de cada mes", no
 * "cada 30 días"; y se recorta al último día del mes destino para que un 31 de
 * enero no se desborde a marzo (comportamiento por defecto de Date.setMonth).
 */
export function avanzarFecha(desde: Date, frequency: string): Date {
  const d = new Date(desde);
  const dias = DIAS_POR_FRECUENCIA[frequency];
  if (dias) {
    d.setDate(d.getDate() + dias);
    return d;
  }
  const meses = MESES_POR_FRECUENCIA[frequency];
  if (!meses) throw new BadRequestException(`Frecuencia no soportada: ${frequency}`);

  const diaOriginal = d.getDate();
  d.setDate(1);                       // evita el desborde antes de mover el mes
  d.setMonth(d.getMonth() + meses);
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(diaOriginal, ultimoDia));
  return d;
}

@Injectable()
export class RecurringInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    // Se delega TODA la contabilidad (asiento, IVA, consecutivo, CxC,
    // inventario) a InvoicesService. Duplicar esa lógica acá sería la vía
    // rápida a dos verdades contables distintas.
    private readonly invoices: InvoicesService,
  ) {}

  async findAll(companyId: string) {
    return this.prisma.recurringInvoice.findMany({
      where:   { companyId },
      include: { client: { select: { id: true, name: true, identification: true } } },
      // Las que ya tocan primero: es la única acción pendiente del módulo.
      orderBy: [{ isActive: 'desc' }, { nextRunAt: 'asc' }],
    });
  }

  async create(companyId: string, dto: CreateRecurringInvoiceDto) {
    await this._getClient(companyId, dto.clientId);

    return this.prisma.recurringInvoice.create({
      data: {
        companyId,
        clientId:    dto.clientId,
        description: dto.description ?? null,
        amount:      dto.amount,
        taxRate:     dto.taxRate ?? 13,
        frequency:   dto.frequency as any,
        nextRunAt:   new Date(dto.nextRunAt),
      },
      include: { client: { select: { id: true, name: true, identification: true } } },
    });
  }

  async update(companyId: string, id: string, dto: UpdateRecurringInvoiceDto) {
    await this._get(companyId, id);
    // Si cambian el cliente, revalidar que sea de la misma empresa: sin esto se
    // podría facturar a un cliente de otra institución.
    if (dto.clientId) await this._getClient(companyId, dto.clientId);

    return this.prisma.recurringInvoice.update({
      where: { id },
      data: {
        ...(dto.clientId    !== undefined && { clientId:    dto.clientId }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.amount      !== undefined && { amount:      dto.amount }),
        ...(dto.taxRate     !== undefined && { taxRate:     dto.taxRate }),
        ...(dto.frequency   !== undefined && { frequency:   dto.frequency as any }),
        ...(dto.nextRunAt   !== undefined && { nextRunAt:   new Date(dto.nextRunAt) }),
        ...(dto.isActive    !== undefined && { isActive:    dto.isActive }),
      },
      include: { client: { select: { id: true, name: true, identification: true } } },
    });
  }

  /** Activar / pausar. Pausar en vez de borrar conserva el historial de corridas. */
  async toggle(companyId: string, id: string, isActive: boolean) {
    await this._get(companyId, id);
    return this.prisma.recurringInvoice.update({
      where: { id },
      data:  { isActive },
      include: { client: { select: { id: true, name: true, identification: true } } },
    });
  }

  /**
   * Borrado real: la programación no es un documento contable (las facturas ya
   * generadas son inmutables y quedan por su lado), así que no hay nada que
   * auditar en la plantilla.
   */
  async remove(companyId: string, id: string) {
    await this._get(companyId, id);
    await this.prisma.recurringInvoice.delete({ where: { id } });
    return { deleted: true, id };
  }

  /**
   * Generar ahora: crea la factura real y la emite, luego reprograma.
   * El estudiante dispara esto a mano (no hay cron) porque el valor educativo
   * está en ver el asiento que se produce, no en que ocurra a sus espaldas.
   */
  async generate(companyId: string, id: string, userId: string) {
    const rec = await this._get(companyId, id);
    if (!rec.isActive) {
      throw new BadRequestException('Esta factura recurrente está pausada. Activala para generarla.');
    }
    const client = await this._getClient(companyId, rec.clientId);

    const amount  = Number(rec.amount);
    const taxRate = Number(rec.taxRate); // PORCENTAJE (13), no fracción.
    const hoy     = new Date();

    // 1) Borrador con una sola línea por el monto programado.
    const draft = await this.invoices.create(companyId, userId, {
      clientId:  rec.clientId,
      issueDate: hoy.toISOString().split('T')[0],
      lines: [{
        description: rec.description?.trim() || `Servicio recurrente — ${client.name}`,
        quantity:    1,
        unit:        'Unid',
        unitPrice:   amount,
        taxRate,
        cabysCode:   CABYS_SERVICIO_GENERICO,
      }],
      notes: 'Generada desde una factura recurrente programada.',
    } as any);

    // 2) Emisión: acá es donde InvoicesService produce el asiento, el XML y la
    // CxC. Si falla (período cerrado, cuentas faltantes) NO se reprograma:
    // el estudiante debe poder reintentar sobre la misma fecha.
    const issued = await this.invoices.issue(companyId, (draft as any).id, userId);

    // 3) Reprogramar. Se avanza desde nextRunAt (no desde hoy) para que una
    // corrida tardía no corra el calendario hacia adelante para siempre; si la
    // fecha calculada sigue en el pasado, se itera hasta alcanzar hoy.
    let siguiente = avanzarFecha(rec.nextRunAt, rec.frequency);
    let guarda = 0;
    while (siguiente <= hoy && guarda++ < 500) {
      siguiente = avanzarFecha(siguiente, rec.frequency);
    }

    const actualizada = await this.prisma.recurringInvoice.update({
      where: { id },
      data: {
        nextRunAt: siguiente,
        lastRunAt: hoy,
        timesRun:  { increment: 1 },
      },
      include: { client: { select: { id: true, name: true, identification: true } } },
    });

    return { recurring: actualizada, invoice: issued };
  }

  // ── Helpers privados ────────────────────────────────────────────────────
  private async _get(companyId: string, id: string) {
    const r = await this.prisma.recurringInvoice.findFirst({ where: { id, companyId } });
    if (!r) throw new NotFoundException('Factura recurrente no encontrada');
    return r;
  }

  /**
   * El cliente DEBE ser de la misma empresa. Es la frontera multi-tenant del
   * módulo: sin esto, un id de cliente adivinado facturaría cruzado entre
   * instituciones.
   */
  private async _getClient(companyId: string, clientId: string) {
    const c = await this.prisma.client.findFirst({ where: { id: clientId, companyId } });
    if (!c || c.companyId !== companyId) {
      throw new NotFoundException('Cliente no encontrado en esta empresa');
    }
    return c;
  }
}
