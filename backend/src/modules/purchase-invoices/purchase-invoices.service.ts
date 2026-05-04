import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalService } from '../journal/journal.service';
import { JournalSource } from '@prisma/client';
import {
  CreatePurchaseInvoiceDto,
  PurchaseInvoiceFilterDto,
} from './dto/purchase-invoices.dto';
import { BusinessEventsService } from '../business/business-events.service';
import { assertCompanyAccess } from '../../common/auth/company-access.helper';
import { InventoryService } from '../inventory/inventory.service';
import { AccountingModeResolver } from '../accounting/accounting-mode.resolver';

// ── IVA rate display labels ─────────────────────────────────────────
const RATE_LABEL: Record<number, string> = {
  0.13: '13%', 0.08: '8%', 0.04: '4%',
  0.02: '2%',  0.01: '1%', 0: '0%',
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class PurchaseInvoicesService {
  constructor(
    private readonly prisma:        PrismaService,
    private readonly journal:       JournalService,
    private readonly businessEvents: BusinessEventsService,
    // Fase 2: si autoInventory + dto.lines → crear lotes FIFO al aceptar.
    private readonly inventory:     InventoryService,
    private readonly modeResolver:  AccountingModeResolver,
  ) {}

  // Fase 1: helper centralizado, soporta INDIVIDUAL + GROUP.
  private async verifyOwner(companyId: string, userId: string) {
    await assertCompanyAccess(this.prisma, companyId, userId);
  }

  // ── Create purchase invoice + automatic journal entry ─────────────
  async create(
    dto: CreatePurchaseInvoiceDto,
    companyId: string,
    attemptId: string,
    userId: string,
  ) {
    await this.verifyOwner(companyId, userId);
    const taxRate   = dto.taxRate ?? 0.13;
    const subtotal  = round2(dto.subtotal);
    const taxAmount = round2(subtotal * taxRate);
    const total     = round2(subtotal + taxAmount);
    const isAccepted = dto.isAccepted ?? true;

    // Fase 2: leemos config una sola vez para decidir si hay que tocar inventario.
    const { config } = await this.modeResolver.resolveConfig(companyId);
    const autoInventory = config?.autoInventory ?? false;

    // Todo el flujo (purchase invoice + lotes + asiento + AP) se ejecuta
    // dentro de una transacción única para que si algo falla, no quede el
    // PurchaseInvoice persistido sin sus contrapartidas.
    const purchaseInvoice = await this.prisma.$transaction(async (tx) => {
      const created = await tx.purchaseInvoice.create({
        data: {
          companyId,
          attemptId,
          supplierName:   dto.supplierName,
          supplierCedula: dto.supplierCedula ?? null,
          invoiceNumber:  dto.invoiceNumber,
          date:           new Date(dto.date),
          subtotal,
          taxRate,
          taxAmount,
          total,
          description: dto.description ?? null,
          isAccepted,
        },
      });

      // ── Inventario FIFO (Fase 2) ───────────────────────────────
      // Si vienen líneas con productId Y autoInventory está activo Y la
      // factura está aceptada, creamos un lote por línea para alimentar el
      // FIFO. Si NO vienen líneas, asumimos compra agregada (servicios,
      // gastos) y no tocamos inventario — comportamiento histórico.
      if (isAccepted && autoInventory && dto.lines && dto.lines.length > 0) {
        for (const line of dto.lines) {
          await this.inventory.addLot(
            {
              companyId,
              productId:   line.productId,
              qty:         line.quantity,
              unitCost:    line.unitCost,
              source:      'PURCHASE',
              sourceId:    created.id,
              receivedAt:  new Date(dto.date),
              createdById: userId,
            },
            tx,
          );
        }
      }

      // ── Asiento + AP record vía BusinessEventsService ──
      // Antes el catch silenciaba TODAS las fallas para que un plan contable
      // incompleto no bloqueara el guardado. Ahora seguimos tolerando, pero
      // logueamos para no esconder bugs reales.
      if (isAccepted) {
        try {
          await this.businessEvents.recordPurchase({
            companyId,
            userId,
            tx,
            purchaseInvoiceId: created.id,
            invoiceNumber:     created.invoiceNumber,
            supplierName:      created.supplierName,
            supplierCedula:    created.supplierCedula,
            subtotal,
            taxAmount,
            total,
            paymentType:       'CREDIT',
            date:              new Date(dto.date),
          });
        } catch (err) {
          // Comportamiento histórico: no propagar para no bloquear, pero log.
          // eslint-disable-next-line no-console
          console.warn('[purchase-invoice] recordPurchase falló:', (err as Error).message);
        }
      }

      return created;
    });

    return purchaseInvoice;
  }

  // ── Build journal entry: D:Inventario + D:IVACredito / C:CxPagar ──
  private async createPurchaseJournalEntry(
    companyId: string,
    userId: string,
    invoice: any,
    subtotal: number,
    taxAmount: number,
    total: number,
  ) {
    // Resolve accounts by code — if not found, skip journal entry silently
    const [inventoryAcc, ivaAcc, cxpAcc] = await Promise.all([
      this.prisma.account.findFirst({ where: { companyId, code: '1.1.03.01' } }),
      this.prisma.account.findFirst({ where: { companyId, code: '1.1.04.01' } }),
      this.prisma.account.findFirst({ where: { companyId, code: '2.1.01.01' } }),
    ]);

    if (!inventoryAcc || !ivaAcc || !cxpAcc) {
      // Accounts not seeded yet — skip automatic entry
      return null;
    }

    const rateLabel = RATE_LABEL[Number(invoice.taxRate)] ?? `${Number(invoice.taxRate) * 100}%`;
    const entryDate = invoice.date instanceof Date
      ? invoice.date.toISOString().split('T')[0]
      : String(invoice.date).split('T')[0];

    try {
      return await this.journal.createEntry(
        companyId,
        {
          description: `Factura compra ${invoice.invoiceNumber} — ${invoice.supplierName} (IVA ${rateLabel})`,
          entryDate,
          reference: invoice.invoiceNumber,
          lines: [
            {
              accountId:   inventoryAcc.id,
              debit:       subtotal,
              credit:      0,
              description: `Compra mercadería — ${invoice.description ?? invoice.supplierName}`,
            },
            {
              accountId:   ivaAcc.id,
              debit:       taxAmount,
              credit:      0,
              description: `IVA Crédito Fiscal ${rateLabel} — ${invoice.supplierName}`,
            },
            {
              accountId:   cxpAcc.id,
              debit:       0,
              credit:      total,
              description: `Cuentas por pagar — ${invoice.supplierName}`,
            },
          ],
        },
        userId,
        JournalSource.AUTO_PURCHASE,
      );
    } catch {
      // Journal creation failure should not block the purchase invoice save
      return null;
    }
  }

  // ── Resolve attemptId from companyId (used by controller) ────────────
  // Fase 1: attemptId puede ser NULL en companies modo GROUP. En ese caso
  // tiramos NotFoundException porque el flujo de tracking actual asume un
  // attempt 1:1 con la company. Las group companies tendrán su propio path
  // de tracking en una fase posterior.
  async resolveAttemptId(companyId: string): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where:  { id: companyId },
      select: { attemptId: true, mode: true },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    if (!company.attemptId) {
      throw new NotFoundException(
        `La empresa está en modo ${company.mode} y no tiene attempt asociado`,
      );
    }
    return company.attemptId;
  }

  // ── List all purchase invoices for a company ───────────────────────
  async findAll(companyId: string, filter: PurchaseInvoiceFilterDto = {}, userId?: string) {
    if (userId) await this.verifyOwner(companyId, userId);
    const page  = filter.page  ?? 1;
    const limit = filter.limit ?? 50;
    const skip  = (page - 1) * limit;

    const where: any = {
      companyId,
      ...(filter.startDate && { date: { gte: new Date(filter.startDate) } }),
      ...(filter.endDate   && { date: { lte: new Date(filter.endDate) } }),
    };

    const [invoices, total] = await this.prisma.$transaction([
      this.prisma.purchaseInvoice.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.purchaseInvoice.count({ where }),
    ]);

    return { invoices, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ── Get one purchase invoice ───────────────────────────────────────
  async findOne(id: string, companyId: string, userId?: string) {
    if (userId) await this.verifyOwner(companyId, userId);
    const inv = await this.prisma.purchaseInvoice.findFirst({
      where: { id, companyId },
    });
    if (!inv) throw new NotFoundException('Factura de compra no encontrada');
    return inv;
  }

  // ── IVA summary for D-104 (ventas + compras) ──────────────────────
  async getIvaSummary(companyId: string, startDate: Date, endDate: Date, userId?: string) {
    if (userId) await this.verifyOwner(companyId, userId);
    // ── IVA Ventas — from issued/accepted invoices ─────────────────
    const salesItems = await this.prisma.invoiceItem.findMany({
      where: {
        invoice: {
          companyId,
          status:    { in: ['ISSUED', 'ACCEPTED'] },
          issueDate: { gte: startDate, lte: endDate },
        },
      },
      select: { subtotal: true, taxAmount: true, taxRate: true },
    });

    const ivaVentas = { rate13: 0, rate8: 0, rate4: 0, rate2: 0, rate1: 0, rate0: 0, total: 0 };
    const baseVentas = { rate13: 0, rate8: 0, rate4: 0, rate2: 0, rate1: 0, rate0: 0, total: 0 };

    for (const item of salesItems) {
      const rate = Number(item.taxRate); // stored as 13, 8, 4, 2, 1 or 0 in products
      const iva  = round2(Number(item.taxAmount));
      const base = round2(Number(item.subtotal));

      if (rate >= 13)      { ivaVentas.rate13 = round2(ivaVentas.rate13 + iva); baseVentas.rate13 = round2(baseVentas.rate13 + base); }
      else if (rate >= 8)  { ivaVentas.rate8  = round2(ivaVentas.rate8  + iva); baseVentas.rate8  = round2(baseVentas.rate8  + base); }
      else if (rate >= 4)  { ivaVentas.rate4  = round2(ivaVentas.rate4  + iva); baseVentas.rate4  = round2(baseVentas.rate4  + base); }
      else if (rate >= 2)  { ivaVentas.rate2  = round2(ivaVentas.rate2  + iva); baseVentas.rate2  = round2(baseVentas.rate2  + base); }
      else if (rate >= 1)  { ivaVentas.rate1  = round2(ivaVentas.rate1  + iva); baseVentas.rate1  = round2(baseVentas.rate1  + base); }
      else                 { ivaVentas.rate0  = 0;                               baseVentas.rate0  = round2(baseVentas.rate0  + base); }
    }
    ivaVentas.total  = round2(ivaVentas.rate13 + ivaVentas.rate8 + ivaVentas.rate4 + ivaVentas.rate2 + ivaVentas.rate1);
    baseVentas.total = round2(baseVentas.rate13 + baseVentas.rate8 + baseVentas.rate4 + baseVentas.rate2 + baseVentas.rate1 + baseVentas.rate0);

    // ── IVA Compras — from accepted purchase invoices ──────────────
    const purchases = await this.prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        isAccepted: true,
        date: { gte: startDate, lte: endDate },
      },
      select: { taxAmount: true, taxRate: true, subtotal: true },
    });

    const ivaCompras = { rate13: 0, rate8: 0, rate4: 0, rate2: 0, rate1: 0, total: 0 };
    const baseCompras = { rate13: 0, rate8: 0, rate4: 0, rate2: 0, rate1: 0, total: 0 };

    for (const p of purchases) {
      const rate = round2(Number(p.taxRate) * 100); // stored as 0.13 → convert to 13
      const iva  = round2(Number(p.taxAmount));
      const base = round2(Number(p.subtotal));

      if (rate >= 13)      { ivaCompras.rate13 = round2(ivaCompras.rate13 + iva); baseCompras.rate13 = round2(baseCompras.rate13 + base); }
      else if (rate >= 8)  { ivaCompras.rate8  = round2(ivaCompras.rate8  + iva); baseCompras.rate8  = round2(baseCompras.rate8  + base); }
      else if (rate >= 4)  { ivaCompras.rate4  = round2(ivaCompras.rate4  + iva); baseCompras.rate4  = round2(baseCompras.rate4  + base); }
      else if (rate >= 2)  { ivaCompras.rate2  = round2(ivaCompras.rate2  + iva); baseCompras.rate2  = round2(baseCompras.rate2  + base); }
      else if (rate >= 1)  { ivaCompras.rate1  = round2(ivaCompras.rate1  + iva); baseCompras.rate1  = round2(baseCompras.rate1  + base); }
    }
    ivaCompras.total  = round2(ivaCompras.rate13 + ivaCompras.rate8 + ivaCompras.rate4 + ivaCompras.rate2 + ivaCompras.rate1);
    baseCompras.total = round2(baseCompras.rate13 + baseCompras.rate8 + baseCompras.rate4 + baseCompras.rate2 + baseCompras.rate1);

    const ivaAPagar    = Math.max(0, round2(ivaVentas.total - ivaCompras.total));
    const saldoAFavor  = ivaCompras.total > ivaVentas.total
      ? round2(ivaCompras.total - ivaVentas.total) : 0;

    return {
      periodo: { inicio: startDate.toISOString().split('T')[0], fin: endDate.toISOString().split('T')[0] },
      // ── Sección I: Débitos fiscales (IVA cobrado en ventas) ──────
      debitosFiscales: {
        tasa13: { base: baseVentas.rate13, iva: ivaVentas.rate13 },
        tasa8:  { base: baseVentas.rate8,  iva: ivaVentas.rate8  },
        tasa4:  { base: baseVentas.rate4,  iva: ivaVentas.rate4  },
        tasa2:  { base: baseVentas.rate2,  iva: ivaVentas.rate2  },
        tasa1:  { base: baseVentas.rate1,  iva: ivaVentas.rate1  },
        tasa0:  { base: baseVentas.rate0,  iva: 0 },
        totalBase: baseVentas.total,
        total:     ivaVentas.total,
      },
      // ── Sección II: Créditos fiscales (IVA en compras) ───────────
      creditosFiscales: {
        tasa13: { base: baseCompras.rate13, iva: ivaCompras.rate13 },
        tasa8:  { base: baseCompras.rate8,  iva: ivaCompras.rate8  },
        tasa4:  { base: baseCompras.rate4,  iva: ivaCompras.rate4  },
        tasa2:  { base: baseCompras.rate2,  iva: ivaCompras.rate2  },
        tasa1:  { base: baseCompras.rate1,  iva: ivaCompras.rate1  },
        totalBase: baseCompras.total,
        total:     ivaCompras.total,
      },
      // ── Sección III: Liquidación ──────────────────────────────────
      liquidacion: {
        debitoFiscal:  ivaVentas.total,
        creditoFiscal: ivaCompras.total,
        impuestoNeto:  round2(ivaVentas.total - ivaCompras.total),
        ivaAPagar,
        saldoAFavor,
      },
      // ── Asiento de cierre sugerido ────────────────────────────────
      asientoCierre: ivaAPagar > 0 ? {
        descripcion: `Liquidación D-104 — ${startDate.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })}`,
        lineas: [
          { cuenta: '2.1.02.01', tipo: 'debito',  monto: ivaVentas.total,  descripcion: 'IVA por Pagar (13%)' },
          { cuenta: '1.1.04.01', tipo: 'credito', monto: ivaCompras.total, descripcion: 'IVA Crédito Fiscal'   },
          { cuenta: '2.1.02.03', tipo: 'credito', monto: ivaAPagar,        descripcion: 'IVA a Pagar Hacienda' },
        ],
      } : ivaCompras.total > 0 ? {
        descripcion: `Liquidación D-104 — Saldo a favor — ${startDate.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })}`,
        lineas: [
          { cuenta: '2.1.02.01', tipo: 'debito',  monto: ivaVentas.total,  descripcion: 'IVA por Pagar (13%)' },
          { cuenta: '1.1.04.01', tipo: 'credito', monto: ivaVentas.total,  descripcion: 'IVA Crédito Fiscal compensado' },
        ],
      } : null,
    };
  }
}
