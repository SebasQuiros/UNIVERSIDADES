import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TaxDeclarationType, TaxDeclarationStatus } from '@prisma/client';
import { CreateTaxDeclarationDto, SubmitTaxDeclarationDto } from './dto/tax-declarations.dto';
import { v4 as uuidv4 } from 'uuid';
import { assertCompanyAccess } from '../../common/auth/company-access.helper';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB límite por archivo

// ── Tramos Renta 2025-2026 (Decreto Ejecutivo Ministerio de Hacienda CR)
// Aplica a Personas Jurídicas (PYME — ingresos brutos ≤ ₡122.145.000)
const RENTA_BRACKETS_2026 = [
  { hasta: 5_610_000,  rate: 0.05 },
  { hasta: 8_415_000,  rate: 0.10 },
  { hasta: 11_220_000, rate: 0.15 },
  { hasta: 14_875_000, rate: 0.20 },
  { hasta: 17_670_000, rate: 0.25 },
  { hasta: Infinity,   rate: 0.30 },
];
const RENTA_PYME_THRESHOLD = 122_145_000; // ₡122.145.000 ingresos brutos

@Injectable()
export class TaxDeclarationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Listar declaraciones del usuario ─────────────────────────────
  async findAll(userId: string) {
    return this.prisma.taxDeclaration.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, type: true, period: true, status: true,
        referenceNo: true, submittedAt: true, createdAt: true,
        result: true,
      },
    });
  }

  // ── Obtener una declaración ───────────────────────────────────────
  async findOne(id: string, userId: string) {
    const decl = await this.prisma.taxDeclaration.findUnique({ where: { id } });
    if (!decl) throw new NotFoundException('Declaración no encontrada');
    if (decl.userId !== userId) throw new ForbiddenException();
    return decl;
  }

  // ── Obtener una declaración con datos del contribuyente (para PDF) ─
  async findOneWithUser(id: string, userId: string) {
    const decl = await this.prisma.taxDeclaration.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!decl) throw new NotFoundException('Declaración no encontrada');
    if (decl.userId !== userId) throw new ForbiddenException();
    return decl;
  }

  // ── Crear borrador ────────────────────────────────────────────────
  async create(userId: string, dto: CreateTaxDeclarationDto) {
    const result = this.calculate(dto.type, dto.formData ?? {});
    return this.prisma.taxDeclaration.create({
      data: {
        userId,
        type:     dto.type,
        period:   dto.period,
        status:   TaxDeclarationStatus.DRAFT,
        formData: (dto.formData ?? {}) as any,
        result:   result as any,
      },
    });
  }

  // ── Actualizar borrador ───────────────────────────────────────────
  async update(id: string, userId: string, dto: SubmitTaxDeclarationDto) {
    const decl = await this.findOne(id, userId);
    const result = this.calculate(decl.type, dto.formData ?? {});
    return this.prisma.taxDeclaration.update({
      where: { id },
      data: { formData: (dto.formData ?? {}) as any, result: result as any },
    });
  }

  // ── Presentar (simular envío a TRIBU) ────────────────────────────
  async submit(id: string, userId: string) {
    const decl = await this.findOne(id, userId);
    if (decl.status === TaxDeclarationStatus.SUBMITTED) {
      return decl; // idempotente
    }

    // Número de referencia simulado (igual al formato TRIBU: 2xxxxx-xxxxxxxxxx)
    const now = new Date();
    const referenceNo = `2${now.getFullYear().toString().slice(-1)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString().slice(2, 12).padStart(10, '0')}`;

    return this.prisma.taxDeclaration.update({
      where: { id },
      data: {
        status:      TaxDeclarationStatus.SUBMITTED,
        referenceNo,
        submittedAt: new Date(),
      },
    });
  }

  // ── Eliminar ──────────────────────────────────────────────────────
  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.taxDeclaration.delete({ where: { id } });
  }

  // ── Listar adjuntos ───────────────────────────────────────────────
  async listAttachments(declarationId: string, userId: string) {
    await this.findOne(declarationId, userId); // verifica propiedad
    return this.prisma.taxAttachment.findMany({
      where: { declarationId },
      select: {
        id: true, lineKey: true, lineLabel: true,
        fileName: true, fileSize: true, mimeType: true, uploadedAt: true,
      },
      orderBy: { uploadedAt: 'asc' },
    });
  }

  // ── Subir adjunto ─────────────────────────────────────────────────
  async addAttachment(
    declarationId: string,
    userId: string,
    dto: { lineKey: string; lineLabel: string; fileName: string; mimeType: string; fileData: string },
  ) {
    await this.findOne(declarationId, userId);

    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'].includes(dto.mimeType)) {
      throw new BadRequestException('Solo se admiten archivos PDF, JPG o PNG');
    }

    const buf = Buffer.from(dto.fileData, 'base64');
    if (buf.length > MAX_FILE_BYTES) {
      throw new BadRequestException('El archivo supera el límite de 10 MB');
    }

    // ── Magic-byte validation ────────────────────────────────────
    // Defense in depth: el cliente puede mentir sobre `mimeType`. Validamos
    // los primeros bytes del archivo contra la firma conocida.
    //   PDF:  25 50 44 46              ("%PDF")
    //   PNG:  89 50 4E 47 0D 0A 1A 0A
    //   JPEG: FF D8 FF
    const isPdf  = buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
    const isPng  = buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    const isJpeg = buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;

    const matches =
      (dto.mimeType === 'application/pdf' && isPdf) ||
      (dto.mimeType === 'image/png'       && isPng) ||
      ((dto.mimeType === 'image/jpeg' || dto.mimeType === 'image/jpg') && isJpeg);

    if (!matches) {
      throw new BadRequestException(
        'El contenido del archivo no coincide con el tipo declarado. Posible archivo corrupto o renombrado.',
      );
    }

    const fileBytes = buf.length;

    return this.prisma.taxAttachment.create({
      data: {
        declarationId,
        lineKey:   dto.lineKey,
        lineLabel: dto.lineLabel,
        fileName:  dto.fileName,
        fileSize:  fileBytes,
        mimeType:  dto.mimeType,
        fileData:  dto.fileData,
      },
      select: {
        id: true, lineKey: true, lineLabel: true,
        fileName: true, fileSize: true, mimeType: true, uploadedAt: true,
      },
    });
  }

  // ── Descargar adjunto (devuelve base64 + meta) ────────────────────
  async getAttachment(declarationId: string, attachmentId: string, userId: string) {
    await this.findOne(declarationId, userId);
    const att = await this.prisma.taxAttachment.findFirst({
      where: { id: attachmentId, declarationId },
    });
    if (!att) throw new NotFoundException('Adjunto no encontrado');
    return att;
  }

  // ── Eliminar adjunto ──────────────────────────────────────────────
  async removeAttachment(declarationId: string, attachmentId: string, userId: string) {
    await this.findOne(declarationId, userId);
    const att = await this.prisma.taxAttachment.findFirst({
      where: { id: attachmentId, declarationId },
    });
    if (!att) throw new NotFoundException('Adjunto no encontrado');
    await this.prisma.taxAttachment.delete({ where: { id: attachmentId } });
  }

  // ── CÁLCULO CENTRAL ──────────────────────────────────────────────

  calculate(type: TaxDeclarationType, data: any): Record<string, any> {
    if (type === TaxDeclarationType.D104_IVA)        return this.calcD104(data);
    if (type === TaxDeclarationType.D101_RENTA)      return this.calcD101(data);
    if (type === TaxDeclarationType.D103_RETENCION)  return this.calcD103(data);
    if (type === TaxDeclarationType.D115_DIVIDENDOS) return this.calcD115(data);
    return this.calcD101(data);
  }

  // ── D-104 IVA ─────────────────────────────────────────────────────
  private calcD104(d: any) {
    const v13 = Number(d.ventas13 ?? 0);
    const v8  = Number(d.ventas8  ?? 0);
    const v4  = Number(d.ventas4  ?? 0);
    const v2  = Number(d.ventas2  ?? 0);
    const v1  = Number(d.ventas1  ?? 0);
    const vEx = Number(d.ventasExentas ?? 0);

    const c13 = Number(d.compras13 ?? 0);
    const c8  = Number(d.compras8  ?? 0);
    const c4  = Number(d.compras4  ?? 0);
    const c2  = Number(d.compras2  ?? 0);
    const c1  = Number(d.compras1  ?? 0);

    // Débito fiscal (IVA cobrado en ventas)
    const ivaVentas13 = round(v13 * 0.13);
    const ivaVentas8  = round(v8  * 0.08);
    const ivaVentas4  = round(v4  * 0.04);
    const ivaVentas2  = round(v2  * 0.02);
    const ivaVentas1  = round(v1  * 0.01);
    const debitoFiscal = round(ivaVentas13 + ivaVentas8 + ivaVentas4 + ivaVentas2 + ivaVentas1);

    // Crédito fiscal (IVA pagado en compras)
    const ivaCompras13 = round(c13 * 0.13);
    const ivaCompras8  = round(c8  * 0.08);
    const ivaCompras4  = round(c4  * 0.04);
    const ivaCompras2  = round(c2  * 0.02);
    const ivaCompras1  = round(c1  * 0.01);
    const creditoFiscal = round(ivaCompras13 + ivaCompras8 + ivaCompras4 + ivaCompras2 + ivaCompras1);

    const impuestoNeto = round(debitoFiscal - creditoFiscal);
    const totalVentas  = round(v13 + v8 + v4 + v2 + v1 + vEx);
    const totalCompras = round(c13 + c8 + c4 + c2 + c1);

    return {
      // Detalle ventas
      ivaVentas: { t13: ivaVentas13, t8: ivaVentas8, t4: ivaVentas4, t2: ivaVentas2, t1: ivaVentas1 },
      // Detalle compras
      ivaCompras: { t13: ivaCompras13, t8: ivaCompras8, t4: ivaCompras4, t2: ivaCompras2, t1: ivaCompras1 },
      // Casillas resumen
      cas301_debitoFiscal:  debitoFiscal,
      cas302_creditoFiscal: creditoFiscal,
      cas303_impuestoNeto:  impuestoNeto,
      cas304_impuestoPagar: impuestoNeto > 0 ? impuestoNeto : 0,
      cas305_saldoFavor:    impuestoNeto < 0 ? Math.abs(impuestoNeto) : 0,
      // Totales base
      totalVentas,
      totalCompras,
    };
  }

  // ── D-101 Renta ───────────────────────────────────────────────────
  private calcD101(d: any) {
    const ingresosBrutos    = Number(d.ingresosBrutos ?? 0);
    const ingresosExentos   = Number(d.ingresosExentos ?? 0);
    const ingresosGravables = Math.max(0, round(ingresosBrutos - ingresosExentos));

    // Gastos deducibles
    const gSueldos       = Number(d.gastosSueldos       ?? 0);
    const gCargas        = Number(d.gastosCargas         ?? 0);
    const gAlquileres    = Number(d.gastosAlquileres     ?? 0);
    const gServicios     = Number(d.gastosServicios      ?? 0);
    const gDepreciacion  = Number(d.gastosDepreciacion   ?? 0);
    const gPublicidad    = Number(d.gastosPublicidad     ?? 0);
    const gSerPublicos   = Number(d.gastosSerPublicos    ?? 0);
    // Gastos de representación: máximo 1% de ingresos brutos (Art. 8 LISR)
    const gRepMaximo     = round(ingresosBrutos * 0.01);
    const gRepresentacion = Math.min(Number(d.gastosRepresentacion ?? 0), gRepMaximo);
    const gOtros         = Number(d.gastosOtros          ?? 0);

    const totalGastos = round(
      gSueldos + gCargas + gAlquileres + gServicios + gDepreciacion +
      gPublicidad + gSerPublicos + gRepresentacion + gOtros,
    );

    // Renta neta imponible
    const rentaNeta = Math.max(0, round(ingresosGravables - totalGastos));

    // Tipo empresa: PYME si ingresos brutos ≤ umbral
    const esPyme = ingresosBrutos <= RENTA_PYME_THRESHOLD;
    let impuestoCalculado = 0;
    const detalleTramos: Array<{ tramo: string; base: number; tasa: number; impuesto: number }> = [];

    if (rentaNeta > 0) {
      if (esPyme) {
        // Cálculo progresivo por tramos
        let base = rentaNeta;
        let anterior = 0;
        for (const tramo of RENTA_BRACKETS_2026) {
          if (base <= 0) break;
          const limiteTramo = tramo.hasta === Infinity ? rentaNeta : tramo.hasta;
          const baseTramo   = Math.min(base, limiteTramo - anterior);
          const impTramo    = round(baseTramo * tramo.rate);
          if (baseTramo > 0) {
            detalleTramos.push({
              tramo:    tramo.hasta === Infinity
                ? `Más de ₡${fmt(anterior)}`
                : `₡${fmt(anterior + 1)} a ₡${fmt(tramo.hasta)}`,
              base:     round(baseTramo),
              tasa:     tramo.rate * 100,
              impuesto: impTramo,
            });
          }
          impuestoCalculado += impTramo;
          base     -= baseTramo;
          anterior  = tramo.hasta === Infinity ? rentaNeta : tramo.hasta;
        }
        impuestoCalculado = round(impuestoCalculado);
      } else {
        // Empresa grande: 30% flat
        impuestoCalculado = round(rentaNeta * 0.30);
        detalleTramos.push({
          tramo:    'Tarifa única (empresa grande)',
          base:     rentaNeta,
          tasa:     30,
          impuesto: impuestoCalculado,
        });
      }
    }

    // Créditos y retenciones
    const retencionesSource = Number(d.retencionesSource ?? 0);
    const pagosParciales    = Number(d.pagosParciales    ?? 0);
    const totalCreditos     = round(retencionesSource + pagosParciales);

    const impuestoNeto    = round(impuestoCalculado - totalCreditos);
    const impuestoPagar   = impuestoNeto > 0 ? impuestoNeto : 0;
    const saldoFavor      = impuestoNeto < 0 ? Math.abs(impuestoNeto) : 0;

    return {
      // Sección I
      cas103_ingresosGravables: ingresosGravables,
      // Sección II
      gastoRepresentacionMaximo: gRepMaximo,
      cas210_totalGastos: totalGastos,
      // Sección III
      cas301_rentaNeta: rentaNeta,
      // Sección IV
      tipoEmpresa: esPyme ? 'PYME' : 'GRANDE',
      detalleTramos,
      cas402_impuestoCalculado: impuestoCalculado,
      // Sección V
      cas503_totalCreditos: totalCreditos,
      // Sección VI
      cas601_impuestoNeto:  impuestoNeto,
      cas602_impuestoPagar: impuestoPagar,
      cas603_saldoFavor:    saldoFavor,
    };
  }

  // ── D-103 Retención en la fuente ──────────────────────────────────
  private calcD103(d: any) {
    const bienes3    = Number(d.bienes3    ?? 0);
    const servicios8 = Number(d.servicios8 ?? 0);

    const retencionBienes    = round(bienes3    * 0.03);
    const retencionServicios = round(servicios8 * 0.08);
    const totalRetencion     = round(retencionBienes + retencionServicios);

    const creditosCertificados = Number(d.creditosCertificados ?? 0);
    const impuestoNeto         = round(totalRetencion - creditosCertificados);

    return {
      retencionBienes,
      retencionServicios,
      cas301_totalRetencion:       totalRetencion,
      cas302_creditosCertificados: round(creditosCertificados),
      cas303_impuestoNeto:         impuestoNeto,
      cas304_impuestoPagar:        impuestoNeto > 0 ? impuestoNeto : 0,
      cas305_saldoFavor:           impuestoNeto < 0 ? Math.abs(impuestoNeto) : 0,
      totalBase: round(bienes3 + servicios8),
    };
  }

  // ── D-115 Dividendos y participaciones ────────────────────────────
  private calcD115(d: any) {
    const dividendosResidentes   = Number(d.dividendosResidentes   ?? 0);
    const dividendosNoResidentes = Number(d.dividendosNoResidentes ?? 0);
    const participaciones        = Number(d.participaciones        ?? 0);
    const rentasCapital          = Number(d.rentasCapital          ?? 0);

    const impDivRes   = round(dividendosResidentes   * 0.15);
    const impDivNoRes = round(dividendosNoResidentes * 0.15);
    const impPart     = round(participaciones        * 0.15);
    const impCap      = round(rentasCapital          * 0.15);

    const totalBase     = round(dividendosResidentes + dividendosNoResidentes + participaciones + rentasCapital);
    const totalImpuesto = round(impDivRes + impDivNoRes + impPart + impCap);

    const creditosAnteriores = Number(d.creditosAnteriores ?? 0);
    const impuestoNeto       = round(totalImpuesto - creditosAnteriores);

    return {
      impDivRes, impDivNoRes, impPart, impCap,
      cas301_totalBase:     totalBase,
      cas302_totalImpuesto: totalImpuesto,
      cas303_creditos:      round(creditosAnteriores),
      cas304_impuestoNeto:  impuestoNeto,
      cas305_impuestoPagar: impuestoNeto > 0 ? impuestoNeto : 0,
      cas306_saldoFavor:    impuestoNeto < 0 ? Math.abs(impuestoNeto) : 0,
    };
  }

  // ── D-104 Cálculo automático desde datos de la empresa ───────────
  async calculateD104FromCompany(companyId: string, month: number, year: number, userId?: string) {
    // Verify ownership if userId provided (Fase 1: respeta GROUP via helper)
    if (userId) {
      await assertCompanyAccess(this.prisma, companyId, userId);
    }
    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 0, 23, 59, 59);

    // ── IVA Ventas: desde líneas de facturas emitidas/aceptadas ──────
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

    const ventas = { base13: 0, iva13: 0, base8: 0, iva8: 0, base4: 0, iva4: 0, base2: 0, iva2: 0, base1: 0, iva1: 0, base0: 0 };

    for (const item of salesItems) {
      const rate = Number(item.taxRate); // products store as integer: 13, 8, 4, 2, 1, 0
      const iva  = round(Number(item.taxAmount));
      const base = round(Number(item.subtotal));

      if      (rate >= 13) { ventas.base13 = round(ventas.base13 + base); ventas.iva13 = round(ventas.iva13 + iva); }
      else if (rate >= 8)  { ventas.base8  = round(ventas.base8  + base); ventas.iva8  = round(ventas.iva8  + iva); }
      else if (rate >= 4)  { ventas.base4  = round(ventas.base4  + base); ventas.iva4  = round(ventas.iva4  + iva); }
      else if (rate >= 2)  { ventas.base2  = round(ventas.base2  + base); ventas.iva2  = round(ventas.iva2  + iva); }
      else if (rate >= 1)  { ventas.base1  = round(ventas.base1  + base); ventas.iva1  = round(ventas.iva1  + iva); }
      else                 { ventas.base0  = round(ventas.base0  + base); }
    }

    const debitoFiscal = round(ventas.iva13 + ventas.iva8 + ventas.iva4 + ventas.iva2 + ventas.iva1);

    // ── IVA Compras: desde purchase_invoices aceptadas ────────────────
    const purchases = await this.prisma.purchaseInvoice.findMany({
      where: {
        companyId,
        isAccepted: true,
        date: { gte: startDate, lte: endDate },
      },
      select: { taxAmount: true, taxRate: true, subtotal: true },
    });

    const compras = { base13: 0, iva13: 0, base8: 0, iva8: 0, base4: 0, iva4: 0, base2: 0, iva2: 0, base1: 0, iva1: 0 };

    for (const p of purchases) {
      const rate = round(Number(p.taxRate) * 100); // stored as 0.13 → 13
      const iva  = round(Number(p.taxAmount));
      const base = round(Number(p.subtotal));

      if      (rate >= 13) { compras.base13 = round(compras.base13 + base); compras.iva13 = round(compras.iva13 + iva); }
      else if (rate >= 8)  { compras.base8  = round(compras.base8  + base); compras.iva8  = round(compras.iva8  + iva); }
      else if (rate >= 4)  { compras.base4  = round(compras.base4  + base); compras.iva4  = round(compras.iva4  + iva); }
      else if (rate >= 2)  { compras.base2  = round(compras.base2  + base); compras.iva2  = round(compras.iva2  + iva); }
      else if (rate >= 1)  { compras.base1  = round(compras.base1  + base); compras.iva1  = round(compras.iva1  + iva); }
    }

    const creditoFiscal = round(compras.iva13 + compras.iva8 + compras.iva4 + compras.iva2 + compras.iva1);
    const impuestoNeto  = round(debitoFiscal - creditoFiscal);
    const ivaAPagar     = impuestoNeto > 0 ? impuestoNeto : 0;
    const saldoAFavor   = impuestoNeto < 0 ? Math.abs(impuestoNeto) : 0;

    const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Setiembre','Octubre','Noviembre','Diciembre'];

    return {
      periodo: `${MONTHS[month - 1]} ${year}`,
      periodoISO: `${year}-${String(month).padStart(2, '0')}`,
      // ── Sección I: Débitos fiscales ─────────────────────────────
      debitosFiscales: {
        casilla101: { tasa: 13, base: ventas.base13, iva: ventas.iva13 },
        casilla102: { tasa:  8, base: ventas.base8,  iva: ventas.iva8  },
        casilla103: { tasa:  4, base: ventas.base4,  iva: ventas.iva4  },
        casilla104: { tasa:  2, base: ventas.base2,  iva: ventas.iva2  },
        casilla105: { tasa:  1, base: ventas.base1,  iva: ventas.iva1  },
        casilla106: { tasa:  0, base: ventas.base0,  iva: 0 },
        cas301_total: debitoFiscal,
      },
      // ── Sección II: Créditos fiscales ───────────────────────────
      creditosFiscales: {
        casilla201: { tasa: 13, base: compras.base13, iva: compras.iva13 },
        casilla202: { tasa:  8, base: compras.base8,  iva: compras.iva8  },
        casilla203: { tasa:  4, base: compras.base4,  iva: compras.iva4  },
        casilla204: { tasa:  2, base: compras.base2,  iva: compras.iva2  },
        casilla205: { tasa:  1, base: compras.base1,  iva: compras.iva1  },
        cas302_total: creditoFiscal,
      },
      // ── Sección III: Liquidación ─────────────────────────────────
      liquidacion: {
        cas301_debitoFiscal:  debitoFiscal,
        cas302_creditoFiscal: creditoFiscal,
        cas303_impuestoNeto:  impuestoNeto,
        cas304_impuestoPagar: ivaAPagar,
        cas305_saldoFavor:    saldoAFavor,
      },
      // ── Asiento de cierre sugerido ────────────────────────────────
      asientoCierre: debitoFiscal > 0 || creditoFiscal > 0 ? {
        descripcion: `Liquidación D-104 ${MONTHS[month - 1]} ${year}`,
        lineas: ivaAPagar > 0
          ? [
              { cuenta: '2.1.02.01', tipo: 'debito',  monto: debitoFiscal,  descripcion: 'IVA por Pagar' },
              { cuenta: '1.1.04.01', tipo: 'credito', monto: creditoFiscal, descripcion: 'IVA Crédito Fiscal' },
              { cuenta: '2.1.02.03', tipo: 'credito', monto: ivaAPagar,     descripcion: 'IVA a Pagar Hacienda' },
            ]
          : [
              { cuenta: '2.1.02.01', tipo: 'debito',  monto: debitoFiscal,  descripcion: 'IVA por Pagar' },
              { cuenta: '1.1.04.01', tipo: 'credito', monto: debitoFiscal,  descripcion: 'IVA Crédito Fiscal compensado' },
            ],
      } : null,
    };
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmt(n: number): string {
  return n.toLocaleString('es-CR');
}
