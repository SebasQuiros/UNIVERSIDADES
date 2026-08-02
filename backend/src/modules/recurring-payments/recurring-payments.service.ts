import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { RecurrenceFrequency } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PurchaseInvoicesService } from '../purchase-invoices/purchase-invoices.service';
import {
  CreateRecurringPaymentDto,
  UpdateRecurringPaymentDto,
} from './dto/recurring-payments.dto';

/**
 * Meses que avanza cada frecuencia. WEEKLY y BIWEEKLY se manejan aparte
 * porque son en días: no existe "0.25 meses" y sumar días evita el problema
 * de los meses de 28/31 días.
 */
const MESES_POR_FRECUENCIA: Record<RecurrenceFrequency, number> = {
  WEEKLY:     0,
  BIWEEKLY:   0,
  MONTHLY:    1,
  BIMONTHLY:  2,
  QUARTERLY:  3,
  SEMIANNUAL: 6,
  ANNUAL:     12,
};

const DIAS_POR_FRECUENCIA: Partial<Record<RecurrenceFrequency, number>> = {
  WEEKLY:   7,
  BIWEEKLY: 14,
};

/**
 * Avanza una fecha según la frecuencia.
 *
 * Para frecuencias mensuales usamos setMonth, que ya normaliza el desborde
 * (31 de enero + 1 mes → 2/3 de marzo). Es aceptable para un simulador
 * educativo y evita depender de una librería de fechas.
 */
export function avanzarFecha(desde: Date, frecuencia: RecurrenceFrequency): Date {
  const d = new Date(desde);
  const dias = DIAS_POR_FRECUENCIA[frecuencia];
  if (dias) {
    d.setDate(d.getDate() + dias);
    return d;
  }
  d.setMonth(d.getMonth() + MESES_POR_FRECUENCIA[frecuencia]);
  return d;
}

@Injectable()
export class RecurringPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    // Reusamos el servicio de facturas de compra en vez de duplicar la lógica
    // contable: así el asiento, el crédito fiscal y el evento de negocio
    // salen exactamente iguales que en una compra registrada a mano.
    private readonly purchaseInvoices: PurchaseInvoicesService,
  ) {}

  async findAll(companyId: string) {
    const rows = await this.prisma.recurringPayment.findMany({
      where: { companyId },
      // Los que ya tocan (nextRunAt más viejo) primero: es lo que el
      // estudiante tiene que atender.
      orderBy: [{ isActive: 'desc' }, { nextRunAt: 'asc' }],
    });

    const ahora = new Date();
    return rows.map((r) => ({
      ...r,
      amount:   Number(r.amount),
      taxRate:  Number(r.taxRate),
      // Campo derivado para que el frontend no tenga que recalcular la regla.
      isDue:    r.isActive && r.nextRunAt <= ahora,
    }));
  }

  async create(companyId: string, dto: CreateRecurringPaymentDto) {
    return this.prisma.recurringPayment.create({
      data: {
        companyId,
        supplierName: dto.supplierName,
        description:  dto.description ?? null,
        amount:       dto.amount,
        taxRate:      dto.taxRate ?? 13,
        frequency:    dto.frequency,
        nextRunAt:    new Date(dto.nextRunAt),
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateRecurringPaymentDto) {
    await this._get(companyId, id);
    return this.prisma.recurringPayment.update({
      where: { id },
      data: {
        ...(dto.supplierName !== undefined && { supplierName: dto.supplierName }),
        ...(dto.description  !== undefined && { description:  dto.description }),
        ...(dto.amount       !== undefined && { amount:       dto.amount }),
        ...(dto.taxRate      !== undefined && { taxRate:      dto.taxRate }),
        ...(dto.frequency    !== undefined && { frequency:    dto.frequency }),
        ...(dto.nextRunAt    !== undefined && { nextRunAt:    new Date(dto.nextRunAt) }),
      },
    });
  }

  /** Pausar/reactivar. No borramos: el historial de corridas es material didáctico. */
  async setActive(companyId: string, id: string, isActive: boolean) {
    await this._get(companyId, id);
    return this.prisma.recurringPayment.update({ where: { id }, data: { isActive } });
  }

  async remove(companyId: string, id: string) {
    await this._get(companyId, id);
    await this.prisma.recurringPayment.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * "Generar ahora": convierte el pago programado en una factura de compra
   * real (con su asiento y su crédito fiscal) y reprograma la siguiente corrida.
   *
   * El estudiante lo dispara a mano a propósito: la idea es que vea el momento
   * en que un gasto fijo se vuelve un documento contable, no que aparezca solo.
   */
  async generate(companyId: string, id: string, userId: string) {
    const pago = await this._get(companyId, id);
    if (!pago.isActive) {
      throw new BadRequestException('Este pago recurrente está pausado');
    }

    const monto = Number(pago.amount);
    if (monto <= 0) {
      throw new BadRequestException('El monto del pago recurrente debe ser mayor a cero');
    }

    // El attemptId solo existe si la empresa cuelga de un ejercicio. En el
    // Espacio Contador son empresas de práctica y NO lo tienen: ahí
    // `resolveAttemptId` lanza NotFoundException. Como el registro de compras
    // acepta `null`, se resuelve de forma tolerante en vez de romper — que es
    // justo el caso de uso principal de este módulo.
    const attemptId = await this.purchaseInvoices
      .resolveAttemptId(companyId)
      .catch(() => null);

    // Número de documento único por corrida. Incluye timesRun para que dos
    // generaciones del mismo pago nunca choquen con un documento ya registrado.
    const invoiceNumber = `REC-${pago.id.slice(0, 8).toUpperCase()}-${pago.timesRun + 1}`;

    // OJO con el orden real de los parámetros: (dto, companyId, attemptId, userId).
    // Y taxRate va como PORCENTAJE (13), no como fracción.
    const factura = await this.purchaseInvoices.create(
      {
        supplierName:  pago.supplierName,
        invoiceNumber,
        date:          new Date().toISOString(),
        subtotal:      monto,
        taxRate:       Number(pago.taxRate),
        description:   pago.description ?? `Pago recurrente — ${pago.supplierName}`,
      },
      companyId,
      attemptId,
      userId,
    );

    // Reprogramamos desde la fecha que tocaba (no desde hoy) para que un pago
    // atrasado no pierda su calendario: si se generó tarde, la próxima sigue
    // cayendo en el día correcto del ciclo.
    const proxima = avanzarFecha(pago.nextRunAt, pago.frequency);

    const actualizado = await this.prisma.recurringPayment.update({
      where: { id: pago.id },
      data: {
        nextRunAt: proxima,
        lastRunAt: new Date(),
        timesRun:  { increment: 1 },
      },
    });

    return { recurringPayment: actualizado, purchaseInvoice: factura };
  }

  /** Lectura siempre filtrada por companyId: aislamiento entre instituciones. */
  private async _get(companyId: string, id: string) {
    const p = await this.prisma.recurringPayment.findFirst({ where: { id, companyId } });
    if (!p) throw new NotFoundException('Pago recurrente no encontrado');
    return p;
  }
}
