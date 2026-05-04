import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalService } from '../journal/journal.service';
import { Decimal } from '@prisma/client/runtime/library';
import { JournalSource } from '@prisma/client';
import { RegisterArPaymentDto, ArPaymentFilterDto } from './dto/ar.dto';
import { BusinessEventsService } from '../business/business-events.service';
import * as ExcelJS from 'exceljs';

// ── Constants ──────────────────────────────────────────────────────
const OPEN_STATUSES = ['ISSUED', 'ACCEPTED'];

@Injectable()
export class AccountsReceivableService {
  constructor(
    private readonly prisma:         PrismaService,
    private readonly journal:        JournalService,
    private readonly businessEvents: BusinessEventsService,
  ) {}

  // ── AR Dashboard ───────────────────────────────────────────────
  async getArDashboard(companyId: string) {
    const today = new Date();

    const invoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        status:    { in: OPEN_STATUSES as any[] },
        balanceDue: { gt: 0 },
      },
      select: {
        issueDate:  true,
        balanceDue: true,
        clientId:   true,
      },
    });

    let totalOutstanding = new Decimal(0);
    let overdueAmount    = new Decimal(0);
    let currentAmount    = new Decimal(0);
    const clientIds      = new Set<string>();
    let oldestDays       = 0;

    for (const inv of invoices) {
      const balance = new Decimal(inv.balanceDue.toString());
      totalOutstanding = totalOutstanding.plus(balance);

      const daysDiff = Math.floor(
        (today.getTime() - inv.issueDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysDiff > oldestDays) oldestDays = daysDiff;

      if (daysDiff > 30) {
        overdueAmount = overdueAmount.plus(balance);
      } else {
        currentAmount = currentAmount.plus(balance);
      }

      if (inv.clientId) clientIds.add(inv.clientId);
    }

    return {
      totalOutstanding: Number(totalOutstanding.toFixed(2)),
      overdueAmount:    Number(overdueAmount.toFixed(2)),
      currentAmount:    Number(currentAmount.toFixed(2)),
      clientCount:      clientIds.size,
      oldestInvoiceDays: oldestDays,
    };
  }

  // ── Aging Report ───────────────────────────────────────────────
  async getAgingReport(companyId: string) {
    const today = new Date();

    const invoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        status:    { in: OPEN_STATUSES as any[] },
        balanceDue: { gt: 0 },
      },
      include: {
        client: { select: { id: true, name: true } },
      },
      orderBy: { issueDate: 'asc' },
    });

    // Group by client
    const clientMap = new Map<string, {
      clientName: string;
      clientId:   string;
      invoices:   any[];
    }>();

    for (const inv of invoices) {
      const clientKey  = inv.clientId ?? 'unknown';
      const clientName = inv.client?.name ?? inv.clientName ?? 'Sin cliente';

      if (!clientMap.has(clientKey)) {
        clientMap.set(clientKey, { clientName, clientId: clientKey, invoices: [] });
      }

      const daysDiff = Math.floor(
        (today.getTime() - inv.issueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      const paid    = new Decimal(inv.paidAmount.toString());
      const balance = new Decimal(inv.balanceDue.toString());

      clientMap.get(clientKey)!.invoices.push({
        id:          inv.id,
        number:      inv.consecutiveNumber,
        date:        inv.issueDate.toISOString().split('T')[0],
        dueDate:     inv.issueDate.toISOString().split('T')[0],
        amount:      Number(new Decimal(inv.total.toString()).toFixed(2)),
        paid:        Number(paid.toFixed(2)),
        balance:     Number(balance.toFixed(2)),
        daysOverdue: daysDiff,
      });
    }

    // Build aging buckets per client
    const totals = {
      current: new Decimal(0),
      days30:  new Decimal(0),
      days60:  new Decimal(0),
      days90:  new Decimal(0),
      over120: new Decimal(0),
      total:   new Decimal(0),
    };

    const clients = Array.from(clientMap.values()).map(c => {
      const bucket = {
        current: new Decimal(0),
        days30:  new Decimal(0),
        days60:  new Decimal(0),
        days90:  new Decimal(0),
        over120: new Decimal(0),
      };

      for (const inv of c.invoices) {
        const b   = new Decimal(inv.balance.toString());
        const age = inv.daysOverdue;

        if (age <= 30)       { bucket.current = bucket.current.plus(b); }
        else if (age <= 60)  { bucket.days30  = bucket.days30.plus(b);  }
        else if (age <= 90)  { bucket.days60  = bucket.days60.plus(b);  }
        else if (age <= 120) { bucket.days90  = bucket.days90.plus(b);  }
        else                 { bucket.over120 = bucket.over120.plus(b); }
      }

      const clientTotal = bucket.current
        .plus(bucket.days30)
        .plus(bucket.days60)
        .plus(bucket.days90)
        .plus(bucket.over120);

      totals.current = totals.current.plus(bucket.current);
      totals.days30  = totals.days30.plus(bucket.days30);
      totals.days60  = totals.days60.plus(bucket.days60);
      totals.days90  = totals.days90.plus(bucket.days90);
      totals.over120 = totals.over120.plus(bucket.over120);
      totals.total   = totals.total.plus(clientTotal);

      // Fase 3: además de los 5 buckets legacy, exponemos los 4 estándar
      // (0-30/31-60/61-90/90+) para los nuevos consumidores de la spec.
      const b91Plus = bucket.days90.plus(bucket.over120);
      return {
        clientName: c.clientName,
        clientId:   c.clientId,
        current:    Number(bucket.current.toFixed(2)),
        days30:     Number(bucket.days30.toFixed(2)),
        days60:     Number(bucket.days60.toFixed(2)),
        days90:     Number(bucket.days90.toFixed(2)),
        over120:    Number(bucket.over120.toFixed(2)),
        // 4 buckets estándar:
        b0_30:      Number(bucket.current.toFixed(2)),
        b31_60:     Number(bucket.days30.toFixed(2)),
        b61_90:     Number(bucket.days60.toFixed(2)),
        b91_plus:   Number(b91Plus.toFixed(2)),
        total:      Number(clientTotal.toFixed(2)),
        invoices:   c.invoices,
      };
    });

    const totalB91Plus = totals.days90.plus(totals.over120);

    return {
      asOfDate: today.toISOString().split('T')[0],
      clients,
      totals: {
        current: Number(totals.current.toFixed(2)),
        days30:  Number(totals.days30.toFixed(2)),
        days60:  Number(totals.days60.toFixed(2)),
        days90:  Number(totals.days90.toFixed(2)),
        over120: Number(totals.over120.toFixed(2)),
        // 4 buckets estándar:
        b0_30:    Number(totals.current.toFixed(2)),
        b31_60:   Number(totals.days30.toFixed(2)),
        b61_90:   Number(totals.days60.toFixed(2)),
        b91_plus: Number(totalB91Plus.toFixed(2)),
        total:   Number(totals.total.toFixed(2)),
      },
    };
  }

  // ──────────────────────────────────────────────────────────────
  //  Fase 3 — Customer ledger consolidado + estimación de incobrables
  // ──────────────────────────────────────────────────────────────

  /**
   * Vista por cliente: saldo total + total facturado + total cobrado +
   * número de facturas abiertas + último movimiento. Pensado para una
   * tabla resumen sin los detalles que devuelve `getAging`.
   *
   * Performance: 3 queries (no N+1) — invoices agg, ar payments agg, clients.
   */
  async consolidatedByClient(companyId: string) {
    // 1. Agg de facturas abiertas (status ISSUED/ACCEPTED, balance > 0).
    const openAgg = await this.prisma.invoice.groupBy({
      by:    ['clientId'],
      where: { companyId, status: { in: OPEN_STATUSES as any[] }, balanceDue: { gt: 0 } },
      _sum:  { balanceDue: true, total: true },
      _count: { _all: true },
      _min:  { issueDate: true },
    });

    // 2. Agg de TOTAL facturado de todas las facturas no canceladas.
    const totalAgg = await this.prisma.invoice.groupBy({
      by:    ['clientId'],
      where: { companyId, status: { not: 'CANCELLED' as any } },
      _sum:  { total: true, paidAmount: true },
    });

    // 3. Catálogo de clientes (1 query).
    const clientIds = Array.from(new Set([
      ...openAgg.map(o => o.clientId).filter(Boolean) as string[],
      ...totalAgg.map(o => o.clientId).filter(Boolean) as string[],
    ]));
    const clients = clientIds.length === 0 ? [] : await this.prisma.client.findMany({
      where:  { id: { in: clientIds } },
      select: { id: true, name: true, identification: true, email: true, phone: true },
    });
    const clientMap = new Map(clients.map(c => [c.id, c]));

    // 4. Compose por clientId.
    const byClient = new Map<string, any>();
    for (const t of totalAgg) {
      if (!t.clientId) continue;
      const c = clientMap.get(t.clientId);
      byClient.set(t.clientId, {
        clientId:    t.clientId,
        clientName:  c?.name    ?? 'Sin cliente',
        identification:     c?.identification ?? null,
        email:       c?.email   ?? null,
        phone:       c?.phone   ?? null,
        totalBilled: Number(t._sum.total      ?? 0),
        totalPaid:   Number(t._sum.paidAmount ?? 0),
        outstanding: 0,
        openInvoices: 0,
        oldestInvoiceDate: null as string | null,
      });
    }
    for (const o of openAgg) {
      if (!o.clientId) continue;
      const acc = byClient.get(o.clientId) ?? {
        clientId:    o.clientId,
        clientName:  clientMap.get(o.clientId)?.name ?? 'Sin cliente',
        identification:     clientMap.get(o.clientId)?.identification ?? null,
        email:       clientMap.get(o.clientId)?.email ?? null,
        phone:       clientMap.get(o.clientId)?.phone ?? null,
        totalBilled: 0,
        totalPaid:   0,
        outstanding: 0,
        openInvoices: 0,
        oldestInvoiceDate: null as string | null,
      };
      acc.outstanding       = Number(o._sum.balanceDue ?? 0);
      acc.openInvoices      = o._count._all;
      acc.oldestInvoiceDate = o._min.issueDate?.toISOString().slice(0, 10) ?? null;
      byClient.set(o.clientId, acc);
    }

    const list = Array.from(byClient.values()).sort((a, b) => b.outstanding - a.outstanding);
    const totals = list.reduce((s, c) => ({
      totalBilled: s.totalBilled + c.totalBilled,
      totalPaid:   s.totalPaid   + c.totalPaid,
      outstanding: s.outstanding + c.outstanding,
    }), { totalBilled: 0, totalPaid: 0, outstanding: 0 });

    return { clients: list, totals };
  }

  /**
   * Estimación de cuentas incobrables (allowance for doubtful accounts).
   *
   * Métodos:
   *   - PERCENTAGE_OF_SALES: pct sobre ventas del período (input: from/to).
   *     Asiento sugerido: D Gasto incobrables · C Estimación incobrables.
   *   - PERCENTAGE_OF_AGING: pct distinto por bucket aplicado al outstanding.
   *
   * Devuelve breakdown + total estimado + asiento sugerido (no lo persiste —
   * el estudiante decide si registrarlo).
   */
  async estimateAllowance(
    companyId: string,
    params: {
      method: 'PERCENTAGE_OF_SALES' | 'PERCENTAGE_OF_AGING';
      // PERCENTAGE_OF_SALES
      salesPct?: number;
      from?: Date;
      to?: Date;
      // PERCENTAGE_OF_AGING — pcts esperados [0..100]
      agingPcts?: { b0_30?: number; b31_60?: number; b61_90?: number; b91_plus?: number };
    },
  ) {
    if (params.method === 'PERCENTAGE_OF_SALES') {
      const pct = Math.max(0, Math.min(100, params.salesPct ?? 0));
      const where: any = { companyId, status: { not: 'CANCELLED' as any } };
      if (params.from || params.to) {
        where.issueDate = {
          ...(params.from && { gte: params.from }),
          ...(params.to   && { lte: params.to }),
        };
      }
      const agg = await this.prisma.invoice.aggregate({
        where, _sum: { total: true }, _count: { _all: true },
      });
      const sales = Number(agg._sum.total ?? 0);
      const estimated = Math.round(sales * (pct / 100) * 100) / 100;
      return {
        method:       params.method,
        period:       {
          from: params.from?.toISOString().slice(0, 10) ?? null,
          to:   params.to?.toISOString().slice(0, 10)   ?? null,
        },
        sales,
        invoiceCount: agg._count._all,
        salesPct:     pct,
        estimated,
        suggestedJournal: this._buildAllowanceJournalSpec(estimated, params.method),
      };
    }

    // PERCENTAGE_OF_AGING — reutilizamos el aging report para los buckets.
    const aging = await this.getAgingReport(companyId);
    const pcts = {
      b0_30:    Math.max(0, Math.min(100, params.agingPcts?.b0_30    ?? 1)),
      b31_60:   Math.max(0, Math.min(100, params.agingPcts?.b31_60   ?? 5)),
      b61_90:   Math.max(0, Math.min(100, params.agingPcts?.b61_90   ?? 15)),
      b91_plus: Math.max(0, Math.min(100, params.agingPcts?.b91_plus ?? 40)),
    };
    const t: any = aging.totals;
    const breakdown = {
      b0_30:    Math.round(t.b0_30    * (pcts.b0_30    / 100) * 100) / 100,
      b31_60:   Math.round(t.b31_60   * (pcts.b31_60   / 100) * 100) / 100,
      b61_90:   Math.round(t.b61_90   * (pcts.b61_90   / 100) * 100) / 100,
      b91_plus: Math.round(t.b91_plus * (pcts.b91_plus / 100) * 100) / 100,
    };
    const estimated = breakdown.b0_30 + breakdown.b31_60 + breakdown.b61_90 + breakdown.b91_plus;

    return {
      method: params.method,
      asOfDate: aging.asOfDate,
      pcts,
      buckets: {
        b0_30:    t.b0_30,
        b31_60:   t.b31_60,
        b61_90:   t.b61_90,
        b91_plus: t.b91_plus,
      },
      breakdown,
      estimated: Math.round(estimated * 100) / 100,
      suggestedJournal: this._buildAllowanceJournalSpec(estimated, params.method),
    };
  }

  /** Asiento sugerido (no se persiste). Cuentas estándar del seed. */
  private _buildAllowanceJournalSpec(amount: number, method: string) {
    return {
      description: `Estimación de cuentas incobrables (${method})`,
      lines: amount > 0 ? [
        // Gasto: cargo del período. Cuenta seedeada como 5.2.01.99 (otros gastos)
        // si no existe, el frontend deja al estudiante elegir.
        { accountCode: '5.2.01.99', side: 'DEBIT',  amount, description: 'Gasto por cuentas incobrables' },
        // Contracuenta de Activos (cuenta correctora). Convención: 1.1.02.99
        // si no existe en el seed, el estudiante la crea.
        { accountCode: '1.1.02.99', side: 'CREDIT', amount, description: 'Estimación cuentas incobrables' },
      ] : [],
    };
  }

  // ── Register AR payment ────────────────────────────────────────
  async registerPayment(
    companyId: string,
    dto:       RegisterArPaymentDto,
    userId:    string,
  ) {
    // 1. Verify invoice belongs to this company and has balance
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: dto.invoiceId, companyId },
    });
    if (!invoice) {
      throw new NotFoundException('Factura no encontrada en esta empresa');
    }

    const payAmount  = new Decimal(dto.amount.toString());
    const balanceDue = new Decimal(invoice.balanceDue.toString());

    if (payAmount.greaterThan(balanceDue)) {
      throw new BadRequestException(
        `El monto del pago (${payAmount.toFixed(2)}) supera el saldo pendiente (${balanceDue.toFixed(2)}).`,
      );
    }
    if (balanceDue.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Esta factura ya está completamente pagada.');
    }

    const paymentDate  = new Date(dto.paymentDate);
    const method       = dto.method ?? 'TRANSFER';

    // 2. Determine cash/bank account from payment method
    const cashAccountCode = method === 'CASH' ? '1.1.01.01' : '1.1.02.01';

    return this.prisma.$transaction(async (tx) => {
      // 3. Create ArPayment record
      const arPayment = await tx.arPayment.create({
        data: {
          companyId,
          invoiceId:   dto.invoiceId,
          amount:      payAmount,
          paymentDate,
          method,
          reference:   dto.reference ?? null,
          notes:       dto.notes ?? null,
        },
      });

      // 4. Update invoice paid amount and balance
      const newPaid    = new Decimal(invoice.paidAmount.toString()).plus(payAmount);
      const newBalance = balanceDue.minus(payAmount);
      const newStatus  = newBalance.lessThanOrEqualTo(new Decimal('0.01'))
        ? 'ACCEPTED'  // fully paid (keep ACCEPTED status but balanceDue = 0)
        : invoice.status;

      await tx.invoice.update({
        where: { id: dto.invoiceId },
        data: {
          paidAmount: newPaid,
          balanceDue: newBalance.lessThan(0) ? new Decimal(0) : newBalance,
        },
      });

      // 5. Asiento contable + actualización de AR record vía BusinessEvents
      //    (respeta accountingMode del ejercicio, mantiene AR table sync)
      await this.businessEvents.recordCollection({
        companyId,
        userId,
        tx,
        invoiceId:         dto.invoiceId,
        consecutiveNumber: invoice.consecutiveNumber,
        customerName:      invoice.clientName,
        amount:            payAmount.toNumber(),
        date:              paymentDate,
      });

      return arPayment;
    });
  }

  // ── Client statement ───────────────────────────────────────────
  async getClientStatement(companyId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    const invoices = await this.prisma.invoice.findMany({
      where:   { companyId, clientId },
      include: {
        arPayments: { orderBy: { paymentDate: 'asc' } },
      },
      orderBy: { issueDate: 'asc' },
    });

    const totalInvoiced = invoices.reduce(
      (s, i) => s.plus(new Decimal(i.total.toString())), new Decimal(0),
    );
    const totalPaid = invoices.reduce(
      (s, i) => s.plus(new Decimal(i.paidAmount.toString())), new Decimal(0),
    );
    const totalBalance = invoices.reduce(
      (s, i) => s.plus(new Decimal(i.balanceDue.toString())), new Decimal(0),
    );

    return {
      client: {
        id:             client.id,
        name:           client.name,
        identification: client.identification,
        email:          client.email,
        phone:          client.phone,
      },
      invoices: invoices.map(inv => ({
        id:               inv.id,
        consecutiveNumber: inv.consecutiveNumber,
        issueDate:        inv.issueDate.toISOString().split('T')[0],
        status:           inv.status,
        total:            Number(new Decimal(inv.total.toString()).toFixed(2)),
        paidAmount:       Number(new Decimal(inv.paidAmount.toString()).toFixed(2)),
        balanceDue:       Number(new Decimal(inv.balanceDue.toString()).toFixed(2)),
        payments:         inv.arPayments.map(p => ({
          id:          p.id,
          amount:      Number(new Decimal(p.amount.toString()).toFixed(2)),
          paymentDate: p.paymentDate.toISOString().split('T')[0],
          method:      p.method,
          reference:   p.reference,
        })),
      })),
      summary: {
        totalInvoiced: Number(totalInvoiced.toFixed(2)),
        totalPaid:     Number(totalPaid.toFixed(2)),
        totalBalance:  Number(totalBalance.toFixed(2)),
      },
    };
  }

  // ── Get all AR payments ────────────────────────────────────────
  async getPayments(companyId: string, filters?: ArPaymentFilterDto) {
    const payments = await this.prisma.arPayment.findMany({
      where: {
        companyId,
        ...(filters?.fromDate && {
          paymentDate: { gte: new Date(filters.fromDate) },
        }),
        ...(filters?.clientId && {
          invoice: { clientId: filters.clientId },
        }),
      },
      include: {
        invoice: {
          select: {
            consecutiveNumber: true,
            clientName:        true,
            clientId:          true,
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

  // ── Export aging report to Excel ───────────────────────────────
  async exportAgingReport(companyId: string): Promise<Buffer> {
    const report = await this.getAgingReport(companyId);

    const wb   = new ExcelJS.Workbook();
    const ws   = wb.addWorksheet('Antigüedad CxC');

    // Header row
    ws.columns = [
      { header: 'Cliente',     key: 'cliente',   width: 30 },
      { header: 'Factura',     key: 'factura',   width: 22 },
      { header: 'Monto',       key: 'monto',     width: 14 },
      { header: 'Vencimiento', key: 'venc',      width: 14 },
      { header: 'Días',        key: 'dias',      width: 10 },
      { header: 'Categoría',   key: 'categoria', width: 16 },
    ];

    // Style header
    ws.getRow(1).font      = { bold: true };
    ws.getRow(1).alignment = { horizontal: 'center' };

    for (const client of report.clients) {
      for (const inv of client.invoices) {
        let categoria: string;
        if (inv.daysOverdue <= 30)       categoria = 'Corriente (0-30)';
        else if (inv.daysOverdue <= 60)  categoria = '31-60 días';
        else if (inv.daysOverdue <= 90)  categoria = '61-90 días';
        else if (inv.daysOverdue <= 120) categoria = '91-120 días';
        else                             categoria = 'Más de 120 días';

        ws.addRow({
          cliente:   client.clientName,
          factura:   inv.number,
          monto:     inv.balance,
          venc:      inv.dueDate,
          dias:      inv.daysOverdue,
          categoria,
        });
      }
    }

    // Totals row
    const lastRow = ws.lastRow?.number ?? 1;
    ws.addRow({
      cliente:   'TOTALES',
      factura:   '',
      monto:     report.totals.total,
      venc:      '',
      dias:      '',
      categoria: '',
    });
    ws.getRow(lastRow + 1).font = { bold: true };

    return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }
}
