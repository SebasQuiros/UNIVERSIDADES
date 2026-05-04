import { Injectable } from '@nestjs/common';
import { Prisma, ARStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * ────────────────────────────────────────────────────────────────
 *  ARRecordsService
 *
 *  Mantiene la tabla `accounts_receivable` (vista materializada del
 *  saldo por factura). NO genera asientos contables — eso lo hace
 *  BusinessEventsService.
 *
 *  Convención:
 *    · createFromInvoice: una vez por factura emitida a crédito
 *    · applyPayment:      reduce balance, ajusta status
 *    · cancel:            marca CANCELLED (factura anulada)
 * ────────────────────────────────────────────────────────────────
 */
@Injectable()
export class ARRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea el registro AR para una factura. Idempotente: si ya existe
   * por unique(invoiceId), no hace nada.
   */
  async createFromInvoice(
    params: {
      companyId:  string;
      invoiceId:  string;
      customerId: string | null;
      total:      number;
      dueDate?:   Date;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const existing = await client.accountReceivable.findUnique({
      where: { invoiceId: params.invoiceId },
    });
    if (existing) return existing;

    return client.accountReceivable.create({
      data: {
        companyId:  params.companyId,
        invoiceId:  params.invoiceId,
        customerId: params.customerId,
        total:      new Decimal(params.total.toFixed(2)),
        balance:    new Decimal(params.total.toFixed(2)),
        status:     ARStatus.PENDING,
        dueDate:    params.dueDate ?? null,
      },
    });
  }

  /**
   * Aplica un cobro a la AR. Reduce balance y ajusta status.
   */
  async applyPayment(
    invoiceId: string,
    amount:    number,
    tx?:       Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const ar = await client.accountReceivable.findUnique({ where: { invoiceId } });
    if (!ar) return null; // factura no rastreada en AR (ej. ventas a contado o legado)

    const newBalance = new Decimal(ar.balance.toString()).minus(new Decimal(amount.toFixed(2)));
    const cleanBalance = newBalance.lessThan(0) ? new Decimal(0) : newBalance;
    const status: ARStatus =
      cleanBalance.equals(0)        ? ARStatus.PAID    :
      cleanBalance.equals(ar.total) ? ARStatus.PENDING :
                                      ARStatus.PARTIAL;

    return client.accountReceivable.update({
      where: { id: ar.id },
      data:  { balance: cleanBalance, status },
    });
  }

  async cancel(invoiceId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.accountReceivable.updateMany({
      where: { invoiceId },
      data:  { status: ARStatus.CANCELLED, balance: new Decimal(0) },
    });
  }

  /**
   * Reconcilia AR contra la factura (fuente de verdad).
   *
   * Garantiza la invariante:
   *   AR.balance === invoice.balanceDue
   *
   * Útil después de mutar la factura por cualquier vía (registerPayment,
   * cancelación, edición admin) para asegurar que la tabla AR no quede
   * desfasada. Idempotente.
   */
  async reconcileFromInvoice(invoiceId: string, tx?: Prisma.TransactionClient) {
    const client  = tx ?? this.prisma;
    const invoice = await client.invoice.findUnique({
      where:  { id: invoiceId },
      select: { balanceDue: true, total: true },
    });
    if (!invoice) return null;

    const ar = await client.accountReceivable.findUnique({ where: { invoiceId } });
    if (!ar) return null;

    const balance = new Decimal(invoice.balanceDue.toString());
    const total   = new Decimal(invoice.total.toString());
    const status: ARStatus =
      balance.lessThanOrEqualTo(0) ? ARStatus.PAID    :
      balance.greaterThanOrEqualTo(total) ? ARStatus.PENDING :
                                            ARStatus.PARTIAL;

    return client.accountReceivable.update({
      where: { id: ar.id },
      data:  { balance, status },
    });
  }

  async findByCompany(companyId: string, status?: ARStatus) {
    return this.prisma.accountReceivable.findMany({
      where:   { companyId, ...(status && { status }) },
      include: { invoice: true, customer: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
