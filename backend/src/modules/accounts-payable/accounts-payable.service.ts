import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalService } from '../journal/journal.service';
import { Decimal } from '@prisma/client/runtime/library';
import { JournalSource } from '@prisma/client';
import { RegisterApPaymentDto, ApPaymentFilterDto } from './dto/ap.dto';
import { BusinessEventsService } from '../business/business-events.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class AccountsPayableService {
  constructor(
    private readonly prisma:         PrismaService,
    private readonly journal:        JournalService,
    private readonly businessEvents: BusinessEventsService,
  ) {}

  // ── AP Dashboard ───────────────────────────────────────────────
  async getApDashboard(companyId: string) {
    const today   = new Date();
    const weekOut = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        isPaid: false,
      },
      select: {
        date:          true,
        total:         true,
        paidAmount:    true,
        supplierName:  true,
      },
    });

    let totalOwed     = new Decimal(0);
    let overdueAmount = new Decimal(0);
    let dueThisWeek   = new Decimal(0);
    const suppliers   = new Set<string>();

    for (const inv of invoices) {
      const balance = new Decimal(inv.total.toString()).minus(
        new Decimal(inv.paidAmount.toString()),
      );
      if (balance.lessThanOrEqualTo(0)) continue;

      totalOwed = totalOwed.plus(balance);
      suppliers.add(inv.supplierName);

      const daysDiff = Math.floor(
        (today.getTime() - inv.date.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysDiff > 30) {
        overdueAmount = overdueAmount.plus(balance);
      }

      // Due this week — assume 30-day payment terms from invoice date
      const dueDate = new Date(inv.date.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (dueDate >= today && dueDate <= weekOut) {
        dueThisWeek = dueThisWeek.plus(balance);
      }
    }

    return {
      totalOwed:     Number(totalOwed.toFixed(2)),
      overdueAmount: Number(overdueAmount.toFixed(2)),
      dueThisWeek:   Number(dueThisWeek.toFixed(2)),
      supplierCount: suppliers.size,
    };
  }

  // ── AP Aging Report ────────────────────────────────────────────
  async getApAgingReport(companyId: string) {
    const today = new Date();

    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        isPaid: false,
      },
      orderBy: { date: 'asc' },
    });

    // Group by supplier
    const supplierMap = new Map<string, {
      supplierName: string;
      current:      Decimal;
      days30:       Decimal;
      days60:       Decimal;
      over60:       Decimal;
      total:        Decimal;
    }>();

    for (const inv of invoices) {
      const balance = new Decimal(inv.total.toString()).minus(
        new Decimal(inv.paidAmount.toString()),
      );
      if (balance.lessThanOrEqualTo(0)) continue;

      const daysDiff = Math.floor(
        (today.getTime() - inv.date.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (!supplierMap.has(inv.supplierName)) {
        supplierMap.set(inv.supplierName, {
          supplierName: inv.supplierName,
          current:      new Decimal(0),
          days30:       new Decimal(0),
          days60:       new Decimal(0),
          over60:       new Decimal(0),
          total:        new Decimal(0),
        });
      }

      const s = supplierMap.get(inv.supplierName)!;
      s.total = s.total.plus(balance);

      if (daysDiff <= 30)      { s.current = s.current.plus(balance); }
      else if (daysDiff <= 60) { s.days30  = s.days30.plus(balance);  }
      else if (daysDiff <= 90) { s.days60  = s.days60.plus(balance);  }
      else                     { s.over60  = s.over60.plus(balance);  }
    }

    const totals = {
      current: new Decimal(0),
      days30:  new Decimal(0),
      days60:  new Decimal(0),
      over60:  new Decimal(0),
      total:   new Decimal(0),
    };

    const suppliers = Array.from(supplierMap.values()).map(s => {
      totals.current = totals.current.plus(s.current);
      totals.days30  = totals.days30.plus(s.days30);
      totals.days60  = totals.days60.plus(s.days60);
      totals.over60  = totals.over60.plus(s.over60);
      totals.total   = totals.total.plus(s.total);

      return {
        supplierName: s.supplierName,
        current:      Number(s.current.toFixed(2)),
        days30:       Number(s.days30.toFixed(2)),
        days60:       Number(s.days60.toFixed(2)),
        over60:       Number(s.over60.toFixed(2)),
        total:        Number(s.total.toFixed(2)),
      };
    });

    return {
      asOfDate: today.toISOString().split('T')[0],
      suppliers,
      totals: {
        current: Number(totals.current.toFixed(2)),
        days30:  Number(totals.days30.toFixed(2)),
        days60:  Number(totals.days60.toFixed(2)),
        over60:  Number(totals.over60.toFixed(2)),
        total:   Number(totals.total.toFixed(2)),
      },
    };
  }

  // ── Register AP payment ────────────────────────────────────────
  async registerPayment(
    companyId: string,
    dto:       RegisterApPaymentDto,
    userId:    string,
  ) {
    // 1. Verify purchase invoice belongs to this company
    const inv = await this.prisma.purchaseInvoice.findFirst({
      where: { id: dto.purchaseInvoiceId, companyId },
    });
    if (!inv) {
      throw new NotFoundException('Factura de compra no encontrada en esta empresa');
    }

    const payAmount  = new Decimal(dto.amount.toString());
    const balance    = new Decimal(inv.total.toString()).minus(
      new Decimal(inv.paidAmount.toString()),
    );

    if (payAmount.greaterThan(balance)) {
      throw new BadRequestException(
        `El monto del pago (${payAmount.toFixed(2)}) supera el saldo pendiente (${balance.toFixed(2)}).`,
      );
    }
    if (balance.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Esta factura ya está completamente pagada.');
    }

    const paymentDate = new Date(dto.paymentDate);
    const method      = dto.method ?? 'TRANSFER';

    // Determine cash/bank account from payment method
    const cashAccountCode = method === 'CASH' ? '1.1.01.01' : '1.1.02.01';

    return this.prisma.$transaction(async (tx) => {
      // 2. Create ApPayment record
      const apPayment = await tx.apPayment.create({
        data: {
          companyId,
          purchaseInvoiceId: dto.purchaseInvoiceId,
          amount:            payAmount,
          paymentDate,
          method,
          reference:         dto.reference ?? null,
          notes:             dto.notes ?? null,
        },
      });

      // 3. Update purchase invoice
      const newPaid    = new Decimal(inv.paidAmount.toString()).plus(payAmount);
      const newBalance = balance.minus(payAmount);
      const isPaid     = newBalance.lessThanOrEqualTo(new Decimal('0.01'));

      await tx.purchaseInvoice.update({
        where: { id: dto.purchaseInvoiceId },
        data: {
          paidAmount: newPaid,
          isPaid,
        },
      });

      // 4. Asiento contable + actualización AP record vía BusinessEvents
      //    (respeta accountingMode, mantiene tabla AP sincronizada)
      await this.businessEvents.recordPayment({
        companyId,
        userId,
        tx,
        purchaseInvoiceId: dto.purchaseInvoiceId,
        invoiceNumber:     inv.invoiceNumber,
        supplierName:      inv.supplierName,
        amount:            payAmount.toNumber(),
        date:              paymentDate,
      });

      return apPayment;
    });
  }

  // ── Supplier statement ─────────────────────────────────────────
  async getSupplierStatement(companyId: string, supplierName: string) {
    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        supplierName: { contains: supplierName, mode: 'insensitive' },
      },
      include: {
        apPayments: { orderBy: { paymentDate: 'asc' } },
      },
      orderBy: { date: 'asc' },
    });

    const totalInvoiced = invoices.reduce(
      (s, i) => s.plus(new Decimal(i.total.toString())), new Decimal(0),
    );
    const totalPaid = invoices.reduce(
      (s, i) => s.plus(new Decimal(i.paidAmount.toString())), new Decimal(0),
    );
    const totalBalance = totalInvoiced.minus(totalPaid);

    return {
      supplierName,
      invoices: invoices.map(inv => {
        const balance = new Decimal(inv.total.toString()).minus(
          new Decimal(inv.paidAmount.toString()),
        );
        return {
          id:            inv.id,
          invoiceNumber: inv.invoiceNumber,
          date:          inv.date.toISOString().split('T')[0],
          total:         Number(new Decimal(inv.total.toString()).toFixed(2)),
          paidAmount:    Number(new Decimal(inv.paidAmount.toString()).toFixed(2)),
          balanceDue:    Number(balance.toFixed(2)),
          isPaid:        inv.isPaid,
          payments:      inv.apPayments.map(p => ({
            id:          p.id,
            amount:      Number(new Decimal(p.amount.toString()).toFixed(2)),
            paymentDate: p.paymentDate.toISOString().split('T')[0],
            method:      p.method,
            reference:   p.reference,
          })),
        };
      }),
      summary: {
        totalInvoiced: Number(totalInvoiced.toFixed(2)),
        totalPaid:     Number(totalPaid.toFixed(2)),
        totalBalance:  Number(totalBalance.toFixed(2)),
      },
    };
  }

  // ── Get all AP payments ────────────────────────────────────────
  async getPayments(companyId: string, filters?: ApPaymentFilterDto) {
    const payments = await this.prisma.apPayment.findMany({
      where: {
        companyId,
        ...(filters?.fromDate && {
          paymentDate: { gte: new Date(filters.fromDate) },
        }),
        ...(filters?.supplierName && {
          purchaseInvoice: {
            supplierName: { contains: filters.supplierName, mode: 'insensitive' },
          },
        }),
      },
      include: {
        purchaseInvoice: {
          select: {
            invoiceNumber: true,
            supplierName:  true,
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    return payments.map(p => ({
      ...p,
      amount: Number(new Decimal(p.amount.toString()).toFixed(2)),
    }));
  }

  // ── Export AP aging report to Excel ───────────────────────────
  async exportApReport(companyId: string): Promise<Buffer> {
    const report = await this.getApAgingReport(companyId);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Antigüedad CxP');

    ws.columns = [
      { header: 'Proveedor',   key: 'proveedor', width: 30 },
      { header: 'Corriente',   key: 'current',   width: 14 },
      { header: '31-60 días',  key: 'days30',    width: 14 },
      { header: '61-90 días',  key: 'days60',    width: 14 },
      { header: 'Más de 90',   key: 'over60',    width: 14 },
      { header: 'Total',       key: 'total',     width: 14 },
    ];

    ws.getRow(1).font      = { bold: true };
    ws.getRow(1).alignment = { horizontal: 'center' };

    for (const s of report.suppliers) {
      ws.addRow({
        proveedor: s.supplierName,
        current:   s.current,
        days30:    s.days30,
        days60:    s.days60,
        over60:    s.over60,
        total:     s.total,
      });
    }

    // Totals row
    const lastRow = ws.lastRow?.number ?? 1;
    ws.addRow({
      proveedor: 'TOTALES',
      current:   report.totals.current,
      days30:    report.totals.days30,
      days60:    report.totals.days60,
      over60:    report.totals.over60,
      total:     report.totals.total,
    });
    ws.getRow(lastRow + 1).font = { bold: true };

    return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }
}
