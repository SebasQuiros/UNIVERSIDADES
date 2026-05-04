import { Injectable } from '@nestjs/common';
import { Prisma, APStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * ────────────────────────────────────────────────────────────────
 *  APRecordsService
 *
 *  Tabla `accounts_payable` — espejo del saldo por factura de compra.
 * ────────────────────────────────────────────────────────────────
 */
@Injectable()
export class APRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async createFromPurchaseInvoice(
    params: {
      companyId:         string;
      purchaseInvoiceId: string;
      supplierName:      string;
      supplierCedula?:   string | null;
      total:             number;
      dueDate?:          Date;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const existing = await client.accountPayable.findUnique({
      where: { purchaseInvoiceId: params.purchaseInvoiceId },
    });
    if (existing) return existing;

    return client.accountPayable.create({
      data: {
        companyId:         params.companyId,
        purchaseInvoiceId: params.purchaseInvoiceId,
        supplierName:      params.supplierName,
        supplierCedula:    params.supplierCedula ?? null,
        total:             new Decimal(params.total.toFixed(2)),
        balance:           new Decimal(params.total.toFixed(2)),
        status:            APStatus.PENDING,
        dueDate:           params.dueDate ?? null,
      },
    });
  }

  async applyPayment(
    purchaseInvoiceId: string,
    amount:            number,
    tx?:               Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const ap = await client.accountPayable.findUnique({ where: { purchaseInvoiceId } });
    if (!ap) return null;

    const newBalance = new Decimal(ap.balance.toString()).minus(new Decimal(amount.toFixed(2)));
    const cleanBalance = newBalance.lessThan(0) ? new Decimal(0) : newBalance;
    const status: APStatus =
      cleanBalance.equals(0)        ? APStatus.PAID    :
      cleanBalance.equals(ap.total) ? APStatus.PENDING :
                                      APStatus.PARTIAL;

    return client.accountPayable.update({
      where: { id: ap.id },
      data:  { balance: cleanBalance, status },
    });
  }

  async cancel(purchaseInvoiceId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.accountPayable.updateMany({
      where: { purchaseInvoiceId },
      data:  { status: APStatus.CANCELLED, balance: new Decimal(0) },
    });
  }

  /**
   * Reconcilia AP contra la PurchaseInvoice (fuente de verdad).
   *
   *   AP.balance === purchaseInvoice.total - purchaseInvoice.paidAmount
   */
  async reconcileFromPurchaseInvoice(purchaseInvoiceId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    const inv = await client.purchaseInvoice.findUnique({
      where:  { id: purchaseInvoiceId },
      select: { total: true, paidAmount: true },
    });
    if (!inv) return null;

    const ap = await client.accountPayable.findUnique({ where: { purchaseInvoiceId } });
    if (!ap) return null;

    const total      = new Decimal(inv.total.toString());
    const paidAmount = new Decimal(inv.paidAmount.toString());
    const balance    = total.minus(paidAmount);
    const cleanBal   = balance.lessThan(0) ? new Decimal(0) : balance;
    const status: APStatus =
      cleanBal.lessThanOrEqualTo(0) ? APStatus.PAID    :
      cleanBal.greaterThanOrEqualTo(total) ? APStatus.PENDING :
                                             APStatus.PARTIAL;

    return client.accountPayable.update({
      where: { id: ap.id },
      data:  { balance: cleanBal, status },
    });
  }

  async findByCompany(companyId: string, status?: APStatus) {
    return this.prisma.accountPayable.findMany({
      where:   { companyId, ...(status && { status }) },
      include: { purchaseInvoice: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
