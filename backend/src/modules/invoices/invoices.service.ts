import {
  Injectable, BadRequestException,
  NotFoundException, Logger,
} from '@nestjs/common';
import { PrismaService }           from '../../prisma/prisma.service';
import { JournalService }          from '../journal/journal.service';
import { PeriodsService }          from '../periods/periods.service';
import { XmlGeneratorService }     from './xml/xml-generator.service';
import { HaciendaXmlService }      from './xml/hacienda-xml.service';
import { PdfGeneratorService }     from './pdf/pdf-generator.service';
import { HaciendaSimulatorService } from './hacienda/hacienda-simulator.service';
import { Decimal }                 from '@prisma/client/runtime/library';
import { Prisma, JournalSource }   from '@prisma/client';
import { CreateInvoiceDto, InvoiceFilterDto } from './dto/invoices.dto';
import { BusinessEventsService } from '../business/business-events.service';
import { InventoryService } from '../inventory/inventory.service';
import { InterCompanyService } from '../inter-company/inter-company.service';
import { AccountingModeResolver } from '../accounting/accounting-mode.resolver';
import { ACCOUNT_CODES } from '../accounting/constants/account-codes';
import * as fs   from 'fs';
import * as path from 'path';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma:       PrismaService,
    private readonly journal:      JournalService,
    private readonly periods:      PeriodsService,
    private readonly xmlGen:       XmlGeneratorService,
    private readonly haciendaXml:  HaciendaXmlService,
    private readonly pdfGen:       PdfGeneratorService,
    private readonly hacienda:     HaciendaSimulatorService,
    // ── Nueva capa de eventos de negocio ────────────────────────
    private readonly businessEvents: BusinessEventsService,
    private readonly modeResolver:   AccountingModeResolver,
    // ── Fase 2: inventario FIFO + COGS ──────────────────────────
    private readonly inventory:      InventoryService,
    // ── Fase 4: replicación inter-company ───────────────────────
    private readonly interCompany:   InterCompanyService,
  ) {}

  // ── List invoices (paginated) ─────────────────────────────────
  async findAll(companyId: string, filter: InvoiceFilterDto) {
    const page  = filter.page  ?? 1;
    const limit = filter.limit ?? 50;
    const skip  = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {
      companyId,
      ...(filter.status         && { status:        filter.status         as any }),
      ...(filter.haciendaStatus && { haciendaStatus: filter.haciendaStatus as any }),
      ...(filter.startDate      && { issueDate: { gte: new Date(filter.startDate) } }),
      ...(filter.endDate        && { issueDate: { lte: new Date(filter.endDate)   } }),
    };

    const [invoices, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { invoices, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ── Get one invoice ───────────────────────────────────────────
  async findOne(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where:   { id: invoiceId, companyId },
      include: { items: true },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    return invoice;
  }

  // ── Create draft invoice ──────────────────────────────────────
  async create(companyId: string, userId: string, dto: CreateInvoiceDto) {
    // Validate client exists in this company
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, companyId, isActive: true },
    });
    if (!client) {
      throw new NotFoundException('Cliente no encontrado en esta empresa');
    }

    // Get company info
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');

    // Calculate totals with Decimal.js
    // (consecutive number is generated atomically inside the transaction below)
    let subtotal = new Decimal(0);
    let tax      = new Decimal(0);

    const lines = dto.lines.map((line, i) => {
      const qty       = new Decimal(line.quantity.toString());
      const unitPrice = new Decimal(line.unitPrice.toString());
      const taxRate   = new Decimal(line.taxRate.toString());

      const lineSubtotal = qty.times(unitPrice).toDecimalPlaces(2);
      const taxAmount    = lineSubtotal.times(taxRate).dividedBy(100).toDecimalPlaces(2);
      const lineTotal    = lineSubtotal.plus(taxAmount);

      subtotal = subtotal.plus(lineSubtotal);
      tax      = tax.plus(taxAmount);

      return {
        lineNo:      i + 1,
        productId:   line.productId   ?? null,
        description: line.description,
        quantity:    qty,
        unit:        line.unit ?? 'Unid',
        unitPrice,
        taxRate,
        taxAmount,
        subtotal:    lineSubtotal,
        total:       lineTotal,
        cabysCode:   line.cabysCode,
      };
    });

    const total = subtotal.plus(tax);

    return this.prisma.$transaction(async (tx) => {
      // ── Atomic consecutive number — same pattern as journal_sequences ─────
      // INSERT ... ON CONFLICT DO UPDATE ensures a single row per company and
      // atomically increments it, preventing duplicate consecutive numbers
      // under concurrent requests.
      await tx.$executeRaw`
        INSERT INTO invoice_sequences (company_id, last_number)
        VALUES (${companyId}::uuid, 1)
        ON CONFLICT (company_id) DO UPDATE
          SET last_number = invoice_sequences.last_number + 1
      `;
      const [{ last_number }] = await tx.$queryRaw<[{ last_number: number }]>`
        SELECT last_number FROM invoice_sequences WHERE company_id = ${companyId}::uuid
      `;
      // CR format: 001 (establishment) + 001 (branch) + 00001 (terminal) + 9-digit sequence = 20 chars
      const consecutiveNumber = `00100100001${String(Number(last_number)).padStart(9, '0')}`;

      const invoice = await tx.invoice.create({
        data: {
          companyId,
          clientId:          client.id,
          clientName:        client.name,
          clientIdentification: client.identification,
          consecutiveNumber,
          status:            'DRAFT',
          haciendaStatus:    'PENDING',
          issueDate:         new Date(dto.issueDate),
          subtotal,
          tax,
          total,
          notes:             dto.notes ?? null,
          createdById:       userId,
          // Persist currency / FX / sale condition cuando vienen del cliente.
          currency:          dto.currency      ?? 'CRC',
          exchangeRate:      dto.exchangeRate  ?? 1,
          saleCondition:     (dto.saleCondition as any) ?? 'CASH',
        },
      });

      await tx.invoiceItem.createMany({
        data: lines.map(l => ({
          invoiceId:   invoice.id,
          productId:   l.productId,
          lineNo:      l.lineNo,
          description: l.description,
          quantity:    l.quantity,
          unit:        l.unit,
          unitPrice:   l.unitPrice,
          discount:    new Decimal(0),
          taxRate:     l.taxRate,
          taxAmount:   l.taxAmount,
          subtotal:    l.subtotal,
          total:       l.total,
          cabysCode:   l.cabysCode,
        })),
      });

      return tx.invoice.findUnique({
        where:   { id: invoice.id },
        include: { items: true },
      });
    });
  }

  // ── ISSUE INVOICE — the full 10-step flow ─────────────────────
  async issue(companyId: string, invoiceId: string, userId: string) {
    // ── STEP 0: Idempotency check ─────────────────────────────
    const invoice = await this.prisma.invoice.findFirst({
      where:   { id: invoiceId, companyId },
      include: { items: { include: { product: true } } },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');

    if (invoice.status === 'ISSUED' && invoice.haciendaStatus === 'ACCEPTED') {
      throw new BadRequestException(
        'Esta factura ya fue emitida y aceptada por Hacienda. No se puede emitir nuevamente.',
      );
    }
    if (invoice.status === 'ISSUED' && invoice.haciendaStatus === 'REJECTED') {
      throw new BadRequestException(
        'Esta factura fue rechazada por Hacienda y quedó como historial. ' +
        'Duplícala con POST /invoices/:id/duplicate, corrígela y emite la nueva.',
      );
    }

    // ── STEP 1: Validate period is OPEN ───────────────────────
    await this.periods.validatePeriodOpen(companyId, invoice.issueDate);

    // ── STEP 2: Validate lines and CABYS ─────────────────────
    if (!invoice.items || invoice.items.length === 0) {
      throw new BadRequestException('La factura no tiene líneas. Agrega al menos un producto.');
    }
    for (const item of invoice.items) {
      if (!item.cabysCode || !/^\d{13}$/.test(item.cabysCode)) {
        throw new BadRequestException(
          `Línea ${item.lineNo} (${item.description}): CABYS "${item.cabysCode ?? 'vacío'}" inválido. ` +
          `Debe tener exactamente 13 dígitos.`,
        );
      }
      const taxRateNum = Number(item.taxRate);
      if (![0, 1, 2, 4, 8, 13].includes(taxRateNum)) {
        throw new BadRequestException(
          `Línea ${item.lineNo}: tasa de impuesto ${taxRateNum}% no es válida en CR.`,
        );
      }
    }

    // ── STEP 3: Validate required accounting accounts exist ───
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    // Códigos centralizados — usados por la rules engine al emitir facturas.
    const requiredCodes = [
      ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
      ACCOUNT_CODES.REVENUE_SALES,
      ACCOUNT_CODES.IVA_PAYABLE,
    ];
    const existingAccounts = await this.prisma.account.findMany({
      where: { companyId, code: { in: requiredCodes } },
      select: { code: true },
    });
    const foundCodes = existingAccounts.map(a => a.code);
    const missing    = requiredCodes.filter(c => !foundCodes.includes(c));
    if (missing.length > 0) {
      throw new BadRequestException(
        `No se puede emitir la factura. Las siguientes cuentas contables no existen ` +
        `en el plan de cuentas: ${missing.join(', ')}. ` +
        `Verifique que el plan de cuentas esté correctamente inicializado.`,
      );
    }

    // ── STEP 4: Validate stock (first layer — fail fast) ──────
    for (const item of invoice.items) {
      if (item.productId) {
        const product = await this.prisma.product.findFirst({
          where: { id: item.productId, companyId },
          select: { name: true, stock: true, isService: true },
        });
        if (product && !product.isService) {
          const available = new Decimal(product.stock.toString());
          const required  = new Decimal(item.quantity.toString());
          if (required.greaterThan(available)) {
            throw new BadRequestException(
              `Stock insuficiente para "${product.name}". ` +
              `Disponible: ${available.toFixed(3)}, Requerido: ${required.toFixed(3)}.`,
            );
          }
        }
      }
    }

    // ── STEP 5: Calculate clave CR (50 digits) ────────────────
    const clave = this.generateClave(company!, invoice.consecutiveNumber, invoice.issueDate);

    // ── STEP 6: Generate XML ──────────────────────────────────
    const xmlData = {
      clave,
      consecutiveNumber: invoice.consecutiveNumber,
      issueDate:         invoice.issueDate,
      issuer: {
        name:             company!.name,
        legalId:          company!.legalId,
        legalIdType:      company!.legalIdType,
        economicActivity: company!.economicActivity,
        email:            company!.email ?? 'empresa@simulado.cr',
        address:          company!.address   ?? undefined,
        province:         (company as any).province ?? undefined,
        canton:           (company as any).canton   ?? undefined,
        district:         (company as any).district ?? undefined,
        phone:            company!.phone     ?? undefined,
      },
      receiver: {
        name:           invoice.clientName,
        identification: invoice.clientIdentification,
        idType:         '02',
        email:          undefined,
      },
      lines: invoice.items.map(item => ({
        lineNo:      item.lineNo,
        cabysCode:   item.cabysCode!,
        description: item.description,
        quantity:    new Decimal(item.quantity.toString()),
        unit:        item.unit,
        unitPrice:   new Decimal(item.unitPrice.toString()),
        subtotal:    new Decimal(item.subtotal.toString()),
        taxRate:     new Decimal(item.taxRate.toString()),
        taxAmount:   new Decimal(item.taxAmount.toString()),
        total:       new Decimal(item.total.toString()),
      })),
      subtotal: new Decimal(invoice.subtotal.toString()),
      tax:      new Decimal(invoice.tax.toString()),
      total:    new Decimal(invoice.total.toString()),
    };

    const xmlContent = this.xmlGen.generate(xmlData);

    // ── STEP 7: Simulate Hacienda ─────────────────────────────
    const haciendaResult = this.hacienda.simulate({
      clave,
      consecutiveNumber: invoice.consecutiveNumber,
      xml: xmlContent,
      lines: invoice.items.map(item => ({
        lineNo:    item.lineNo,
        cabysCode: item.cabysCode!,
        taxRate:   new Decimal(item.taxRate.toString()),
        subtotal:  new Decimal(item.subtotal.toString()),
        taxAmount: new Decimal(item.taxAmount.toString()),
        total:     new Decimal(item.total.toString()),
      })),
      subtotal: new Decimal(invoice.subtotal.toString()),
      tax:      new Decimal(invoice.tax.toString()),
      total:    new Decimal(invoice.total.toString()),
    });

    // ── If REJECTED: save as history, no accounting, no inventory
    if (haciendaResult.status === 'REJECTED') {
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status:          'ISSUED',
          haciendaStatus:  'REJECTED',
          clave,
          xml:             xmlContent,
          haciendaMessage: haciendaResult.message + '\n\nErrores:\n' + haciendaResult.errors.join('\n'),
        },
      });

      return {
        status:          'REJECTED',
        haciendaMessage: haciendaResult.message,
        errors:          haciendaResult.errors,
        invoiceId,
        note: 'La factura quedó como historial. Use POST /invoices/:id/duplicate para crear una nueva versión corregida.',
      };
    }

    // ── STEP 8: Generate PDF in memory ────────────────────────
    // Fase 4: pasamos invoiceId + companyId al PDF para que dibuje el QR
    // interno SJQA (verificación independiente de TribuNet).
    const pdfBuffer = await this.pdfGen.generate({
      ...xmlData,
      receiver:  { ...xmlData.receiver, idType: '02' },
      invoiceId,
      companyId,
    }).catch(err => {
      throw new BadRequestException(`Error generando el PDF: ${err.message}`);
    });

    // ── STEP 9: Save files to disk (after PDF success, before tx) ─
    const pdfDir = path.join(process.cwd(), 'uploads', 'pdfs', companyId);
    const xmlDir = path.join(process.cwd(), 'uploads', 'xmls', companyId);
    fs.mkdirSync(pdfDir, { recursive: true });
    fs.mkdirSync(xmlDir, { recursive: true });

    const filename = `FE-${invoice.consecutiveNumber}`;
    const pdfPath  = path.join(pdfDir, `${filename}.pdf`);
    const xmlPath  = path.join(xmlDir, `${filename}.xml`);

    // ── STEP 10: Transaction — accounting + inventory + update invoice ─
    let committed = false;
    try {
      fs.writeFileSync(pdfPath, pdfBuffer);
      fs.writeFileSync(xmlPath, xmlContent, 'utf8');

      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {

        // Re-validate period inside transaction (close time window)
        const period = await tx.accountingPeriod.findFirst({
          where: {
            companyId,
            startDate: { lte: invoice.issueDate },
            endDate:   { gte: invoice.issueDate },
            status: 'OPEN',
          },
        });
        if (!period) {
          throw new BadRequestException(
            'El período contable fue cerrado mientras se procesaba la solicitud.',
          );
        }

        // Update invoice — mark as ISSUED + ACCEPTED
        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            status:          'ISSUED',
            haciendaStatus:  'ACCEPTED',
            clave,
            xml:             xmlContent,
            pdfUrl:          pdfPath,
            haciendaMessage: haciendaResult.message,
            balanceDue:      invoice.total,
          },
        });

        // ── Inventario FIFO + COGS (Fase 2) ─────────────────────────
        //
        // Si el ExerciseConfig.autoInventory está activado, cada línea con
        // producto tracked consume sus lotes más viejos (FIFO) y suma su
        // costo real al `totalCost` que se enviará a recordSale para que
        // genere el asiento de COGS contra Inventario. Si autoInventory está
        // apagado, caemos al cálculo legacy con `product.cost` y NO tocamos
        // los lotes — el estudiante registra el movimiento a mano.
        const { config } = await this.modeResolver.resolveConfig(companyId);
        const autoInventory = config?.autoInventory ?? false;

        let totalCost = new Decimal(0);

        for (const item of invoice.items) {
          if (!item.productId) continue;
          const product = await tx.product.findUnique({
            where:  { id: item.productId },
            select: { id: true, name: true, isService: true, trackInventory: true, cost: true, stock: true },
          });
          if (!product || product.isService) continue;

          if (autoInventory && product.trackInventory) {
            // Camino FIFO: consume lotes y agrega el costo real al total.
            const result = await this.inventory.consumeFIFO(
              {
                companyId,
                productId:     item.productId,
                qty:           item.quantity,
                referenceId:   invoiceId,
                referenceType: 'INVOICE',
                createdById:   userId,
              },
              tx,
            );
            totalCost = totalCost.plus(result.totalCost);
          } else {
            // Camino legacy / manual: usa product.cost para sumar al COGS si
            // hay costo definido, y mantiene el comportamiento histórico de
            // decrementar Product.stock + un único InventoryMovement.
            if (Number(product.cost) > 0) {
              totalCost = totalCost.plus(
                new Decimal(product.cost.toString())
                  .times(new Decimal(item.quantity.toString()))
                  .toDecimalPlaces(2),
              );
            }
            const required = new Decimal(item.quantity.toString());
            const currentStock = new Decimal(product.stock.toString());
            if (required.greaterThan(currentStock)) {
              throw new BadRequestException(
                `Stock insuficiente para "${product.name}" (validación final). ` +
                `Disponible: ${currentStock.toFixed(3)}, Requerido: ${required.toFixed(3)}.`,
              );
            }
            const newStock = currentStock.minus(required);
            await tx.product.update({
              where: { id: item.productId },
              data:  { stock: newStock, updatedAt: new Date() },
            });
            await tx.inventoryMovement.create({
              data: {
                productId:     item.productId,
                companyId,
                type:          'SALE',
                quantity:      required.negated(),
                unitCost:      item.unitPrice,
                referenceId:   invoiceId,
                referenceType: 'INVOICE',
                balanceAfter:  newStock,
                createdById:   userId,
              },
            });
          }
        }

        // Asiento contable de la venta (Ventas + IVA + AR/Caja + COGS).
        // BusinessEventsService.recordSale ya lee el AccountingMode y decide
        // si crear, marcar pending o saltar.
        await this.businessEvents.recordSale({
          companyId,
          userId,
          tx,
          invoiceId,
          customerId:        invoice.clientId,
          consecutiveNumber: invoice.consecutiveNumber,
          customerName:      invoice.clientName,
          subtotal:          Number(invoice.subtotal),
          taxAmount:         Number(invoice.tax),
          total:             Number(invoice.total),
          totalCost:         totalCost.toNumber(),
          paymentType:       invoice.saleCondition === 'CASH' ? 'CASH' : 'CREDIT',
          date:              invoice.issueDate,
        });

      });

      // ── Fase 4: replicación inter-company (FUERA de la tx principal) ──
      // Se ejecuta DESPUÉS del commit del seller. Si la replicación falla
      // (config inconsistente del buyer, falta de periodo abierto, plan
      // contable incompleto, etc.) NO afecta la venta. Lleva su propia
      // transacción interna en `mirrorSaleToBuyer`.
      try {
        await this.prisma.$transaction(async (mirrorTx) => {
          await this.interCompany.mirrorSaleToBuyer(
            {
              sellerCompanyId: companyId,
              userId,
              invoiceId,
              customerId:      invoice.clientId,
            },
            mirrorTx,
          );
        });
      } catch (err) {
        this.logger.warn(
          `Inter-company mirror falló para invoice ${invoiceId}: ${(err as Error).message}. ` +
          `La venta del seller fue persistida correctamente.`,
        );
      }

      committed = true;
      this.logger.log(`✓ Factura FE-${invoice.consecutiveNumber} emitida y aceptada`);

      return {
        status:          'ACCEPTED',
        haciendaMessage: haciendaResult.message,
        invoiceId,
        clave,
        consecutiveNumber: invoice.consecutiveNumber,
        pdfUrl:          `/companies/${companyId}/invoices/${invoiceId}/pdf`,
      };

    } catch (error) {
      // Cleanup files if transaction failed
      if (!committed) {
        try { fs.unlinkSync(pdfPath); } catch {}
        try { fs.unlinkSync(xmlPath); } catch {}
      }
      throw error;
    }
  }

  // ── Duplicate invoice (create new DRAFT from rejected) ────────
  async duplicate(companyId: string, invoiceId: string, userId: string) {
    const original = await this.prisma.invoice.findFirst({
      where:   { id: invoiceId, companyId },
      include: { items: true },
    });
    if (!original) throw new NotFoundException('Factura no encontrada');

    // Count for new consecutive — CR format 20 chars
    const count = await this.prisma.invoice.count({ where: { companyId } });
    const sequence = String(count + 1).padStart(9, '0');
    const consecutiveNumber = `00100100001${sequence}`;

    return this.prisma.$transaction(async (tx) => {
      const newInvoice = await tx.invoice.create({
        data: {
          companyId,
          clientId:             original.clientId,
          clientName:           original.clientName,
          clientIdentification: original.clientIdentification,
          consecutiveNumber,
          status:               'DRAFT',
          haciendaStatus:       'PENDING',
          issueDate:            new Date(),
          subtotal:             original.subtotal,
          tax:                  original.tax,
          total:                original.total,
          notes:                `Duplicada de FE-${original.consecutiveNumber}`,
          createdById:          userId,
        },
      });

      await tx.invoiceItem.createMany({
        data: original.items.map(item => ({
          invoiceId:   newInvoice.id,
          productId:   item.productId,
          lineNo:      item.lineNo,
          description: item.description,
          quantity:    item.quantity,
          unit:        item.unit,
          unitPrice:   item.unitPrice,
          discount:    item.discount,
          taxRate:     item.taxRate,
          taxAmount:   item.taxAmount,
          subtotal:    item.subtotal,
          total:       item.total,
          cabysCode:   item.cabysCode,
        })),
      });

      return {
        message:        `Factura duplicada correctamente. Corrija los datos y emítala.`,
        originalId:     invoiceId,
        newInvoiceId:   newInvoice.id,
        consecutiveNumber,
      };
    });
  }

  // ── Serve PDF file ────────────────────────────────────────────
  async getPdfPath(companyId: string, invoiceId: string): Promise<string> {
    const invoice = await this.prisma.invoice.findFirst({
      where:  { id: invoiceId, companyId },
      select: { pdfUrl: true, status: true },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    if (!invoice.pdfUrl || invoice.status === 'DRAFT') {
      throw new BadRequestException('El PDF no está disponible. La factura aún no ha sido emitida.');
    }
    if (!fs.existsSync(invoice.pdfUrl)) {
      throw new NotFoundException('El archivo PDF no se encontró en el servidor.');
    }
    return invoice.pdfUrl;
  }

  // ── Get XML content for download ──────────────────────────────
  async getInvoiceXml(companyId: string, invoiceId: string): Promise<string> {
    const invoice = await this.prisma.invoice.findFirst({
      where:  { id: invoiceId, companyId },
      select: { xml: true, status: true, consecutiveNumber: true },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    if (!invoice.xml || invoice.status === 'DRAFT') {
      throw new BadRequestException(
        'El XML no está disponible. La factura aún no ha sido emitida. ' +
        'Emita la factura primero con POST /invoices/:id/issue.',
      );
    }
    return invoice.xml;
  }

  // ── Validate invoice for Hacienda compliance ──────────────────
  async validateInvoice(companyId: string, invoiceId: string): Promise<{
    isValid: boolean;
    checks: Array<{ field: string; status: 'ok' | 'missing' | 'invalid' | 'warning'; message: string }>;
  }> {
    const invoice = await this.prisma.invoice.findFirst({
      where:   { id: invoiceId, companyId },
      include: { items: true },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Empresa no encontrada');

    type CheckStatus = 'ok' | 'missing' | 'invalid' | 'warning';
    const checks: Array<{ field: string; status: CheckStatus; message: string }> = [];

    // ── Clave ─────────────────────────────────────────────────
    if (!invoice.clave) {
      checks.push({ field: 'clave', status: 'missing', message: 'Clave no generada (la factura no ha sido emitida)' });
    } else if (!/^\d{50}$/.test(invoice.clave)) {
      checks.push({ field: 'clave', status: 'invalid', message: `Clave "${invoice.clave}" no tiene 50 dígitos numéricos` });
    } else {
      checks.push({ field: 'clave', status: 'ok', message: `Clave válida: ${invoice.clave}` });
    }

    // ── NumeroConsecutivo ─────────────────────────────────────
    if (!invoice.consecutiveNumber || invoice.consecutiveNumber.length !== 20) {
      checks.push({ field: 'numeroConsecutivo', status: 'invalid', message: `Número consecutivo debe tener 20 caracteres, tiene ${invoice.consecutiveNumber?.length ?? 0}` });
    } else {
      checks.push({ field: 'numeroConsecutivo', status: 'ok', message: `Consecutivo válido: ${invoice.consecutiveNumber}` });
    }

    // ── Emisor — Cédula ───────────────────────────────────────
    const legalIdClean = company.legalId.replace(/\D/g, '');
    if (!legalIdClean) {
      checks.push({ field: 'emisorCedula', status: 'missing', message: 'La empresa no tiene número de cédula configurado' });
    } else if (legalIdClean.length < 9 || legalIdClean.length > 12) {
      checks.push({ field: 'emisorCedula', status: 'invalid', message: `Cédula "${legalIdClean}" tiene longitud inválida (debe ser 9-12 dígitos)` });
    } else {
      checks.push({ field: 'emisorCedula', status: 'ok', message: `Cédula emisor: ${legalIdClean}` });
    }

    // ── Emisor — Tipo Identificación ──────────────────────────
    if (!['01', '02', '03', '04'].includes(company.legalIdType)) {
      checks.push({ field: 'emisorTipoId', status: 'invalid', message: `Tipo de identificación "${company.legalIdType}" inválido. Debe ser 01, 02, 03 o 04` });
    } else {
      const typeLabel: Record<string, string> = { '01': 'Física', '02': 'Jurídica', '03': 'DIMEX', '04': 'NITE' };
      checks.push({ field: 'emisorTipoId', status: 'ok', message: `Tipo: ${typeLabel[company.legalIdType]}` });
    }

    // ── Emisor — Actividad Económica ──────────────────────────
    if (!company.economicActivity || !/^\d{6}$/.test(company.economicActivity)) {
      checks.push({ field: 'codigoActividad', status: 'invalid', message: `Actividad económica "${company.economicActivity ?? ''}" inválida. Debe ser 6 dígitos` });
    } else {
      checks.push({ field: 'codigoActividad', status: 'ok', message: `Actividad: ${company.economicActivity}` });
    }

    // ── Emisor — Email ────────────────────────────────────────
    if (!company.email) {
      checks.push({ field: 'emisorEmail', status: 'warning', message: 'La empresa no tiene correo electrónico configurado' });
    } else {
      checks.push({ field: 'emisorEmail', status: 'ok', message: `Email: ${company.email}` });
    }

    // ── Receptor — Identificación ─────────────────────────────
    if (!invoice.clientIdentification || invoice.clientIdentification.replace(/\D/g, '').length === 0) {
      checks.push({ field: 'receptorIdentificacion', status: 'warning', message: 'Receptor sin identificación (válido solo para Tiquete Electrónico TE)' });
    } else {
      checks.push({ field: 'receptorIdentificacion', status: 'ok', message: `Cédula receptor: ${invoice.clientIdentification}` });
    }

    // ── Líneas — CABYS ────────────────────────────────────────
    let allCabysOk = true;
    for (const item of invoice.items) {
      if (!item.cabysCode || !/^\d{13}$/.test(item.cabysCode)) {
        checks.push({ field: `cabys_linea_${item.lineNo}`, status: 'invalid', message: `Línea ${item.lineNo} (${item.description}): CABYS "${item.cabysCode ?? 'vacío'}" inválido — debe ser 13 dígitos` });
        allCabysOk = false;
      }
    }
    if (allCabysOk && invoice.items.length > 0) {
      checks.push({ field: 'cabys', status: 'ok', message: `Todos los códigos CABYS son válidos (${invoice.items.length} línea${invoice.items.length !== 1 ? 's' : ''})` });
    }

    // ── Líneas — Tasas de IVA ─────────────────────────────────
    const validRates = [0, 1, 2, 4, 8, 13];
    let allRatesOk = true;
    for (const item of invoice.items) {
      const rate = Number(item.taxRate);
      if (!validRates.includes(rate)) {
        checks.push({ field: `iva_linea_${item.lineNo}`, status: 'invalid', message: `Línea ${item.lineNo}: tasa IVA ${rate}% no es válida en CR. Tasas permitidas: ${validRates.join('%, ')}%` });
        allRatesOk = false;
      }
    }
    if (allRatesOk && invoice.items.length > 0) {
      checks.push({ field: 'ivaTasas', status: 'ok', message: 'Todas las tasas de IVA son válidas para CR' });
    }

    // ── XML generado ──────────────────────────────────────────
    if (!invoice.xml) {
      checks.push({ field: 'xmlContent', status: 'missing', message: 'XML no generado (emita la factura primero)' });
    } else {
      const requiredNodes = ['Clave', 'NumeroConsecutivo', 'FechaEmision', 'Emisor', 'Receptor', 'DetalleServicio', 'ResumenFactura', 'TotalComprobante'];
      const missingNodes  = requiredNodes.filter(n => !invoice.xml!.includes(`<${n}>`));
      if (missingNodes.length > 0) {
        checks.push({ field: 'xmlContent', status: 'invalid', message: `XML generado pero le faltan nodos: ${missingNodes.join(', ')}` });
      } else {
        checks.push({ field: 'xmlContent', status: 'ok', message: 'XML v4.4 generado y con todos los nodos requeridos' });
      }
    }

    // ── Status de Hacienda ────────────────────────────────────
    if (invoice.haciendaStatus === 'ACCEPTED') {
      checks.push({ field: 'haciendaStatus', status: 'ok', message: 'Aceptado por Hacienda (simulación)' });
    } else if (invoice.haciendaStatus === 'REJECTED') {
      checks.push({ field: 'haciendaStatus', status: 'invalid', message: 'Rechazado por Hacienda. Duplique y corrija la factura.' });
    } else {
      checks.push({ field: 'haciendaStatus', status: 'warning', message: `Estado Hacienda: ${invoice.haciendaStatus}` });
    }

    const isValid = checks.every(c => c.status === 'ok' || c.status === 'warning');

    return { isValid, checks };
  }

  // ── Generate clave CR (50 digits) — delegates to HaciendaXmlService ────
  // Format: 506(3) + DDMMYY(6) + cedula(12) + consecutivo(20) + situacion(1) + seguridad(8) = 50
  private generateClave(company: any, consecutiveNumber: string, date: Date): string {
    return this.haciendaXml.generateClave({
      date,
      cedula:      company.legalId,
      consecutivo: consecutiveNumber,
      situacion:   '1',
    });
  }
}
