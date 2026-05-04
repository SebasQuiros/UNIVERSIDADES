import { Injectable } from '@nestjs/common';
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage, RGB } from 'pdf-lib';

// ── Brand ─────────────────────────────────────────────────────────────────────
const BRAND_BLUE = rgb(0.118, 0.227, 0.541); // #1E3A8A

// ── Formatters ────────────────────────────────────────────────────────────────
function crs(n: number | string | undefined | null): string {
  const v = Number(n ?? 0);
  // ATENCIÓN: pdf-lib con fuente Helvetica estándar NO soporta ₡ (U+20A1).
  // Usamos "CRC" como prefijo en su lugar — la alternativa sería embeber
  // una fuente custom (~70KB extra al PDF), no vale la pena.
  return `CRC ${v.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function todayStr(): string {
  return new Date().toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' });
}
function dateTimeStr(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('es-CR', {
    year:  'numeric', month: '2-digit', day: '2-digit',
    hour:  '2-digit', minute: '2-digit',
  });
}

// ── Label maps ────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, { code: string; title: string }> = {
  D104_IVA:        { code: 'D-104', title: 'Declaración del Impuesto al Valor Agregado (IVA)' },
  D101_RENTA:      { code: 'D-101', title: 'Declaración del Impuesto sobre la Renta' },
  D103_RETENCION:  { code: 'D-103', title: 'Declaración de Retenciones en la Fuente' },
  D115_DIVIDENDOS: { code: 'D-115', title: 'Declaración de Dividendos y Participaciones' },
};

// Human-readable line labels for formData keys
const LINE_LABELS: Record<string, string> = {
  // D-104 Ventas
  ventas13:       'Ventas gravadas al 13%',
  ventas8:        'Ventas gravadas al 8%',
  ventas4:        'Ventas gravadas al 4%',
  ventas2:        'Ventas gravadas al 2%',
  ventas1:        'Ventas gravadas al 1%',
  ventasExentas:  'Ventas exentas',
  // D-104 Compras
  compras13:      'Compras gravadas al 13%',
  compras8:       'Compras gravadas al 8%',
  compras4:       'Compras gravadas al 4%',
  compras2:       'Compras gravadas al 2%',
  compras1:       'Compras gravadas al 1%',
  // D-101 Ingresos / Gastos
  ingresosBrutos:      'Ingresos brutos del período',
  ingresosExentos:     'Ingresos exentos',
  gastosSueldos:       'Sueldos y salarios',
  gastosCargas:        'Cargas sociales patronales',
  gastosAlquileres:    'Arrendamientos',
  gastosServicios:     'Servicios profesionales',
  gastosDepreciacion:  'Depreciaciones',
  gastosPublicidad:    'Publicidad y mercadeo',
  gastosSerPublicos:   'Servicios públicos',
  gastosRepresentacion:'Gastos de representación',
  gastosOtros:         'Otros gastos deducibles',
  retencionesSource:   'Retenciones en la fuente',
  pagosParciales:      'Pagos parciales a Hacienda',
};

interface DeclarationForPdf {
  type:        string;
  period:      string;
  referenceNo: string | null;
  submittedAt: Date | null;
  formData:    Record<string, any>;
  result:      Record<string, any>;
  user:        { name: string; email: string } | null;
}

@Injectable()
export class TaxDeclarationsPdfService {
  async generate(d: DeclarationForPdf): Promise<Buffer> {
    const doc  = await PDFDocument.create();
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const reg  = await doc.embedFont(StandardFonts.Helvetica);

    const black = rgb(0, 0, 0);
    const white = rgb(1, 1, 1);
    const gray  = rgb(0.55, 0.55, 0.55);
    const light = rgb(0.96, 0.97, 0.99);
    const green = rgb(0.024, 0.373, 0.275);
    const red   = rgb(0.6, 0.11, 0.11);

    const margin = 40;
    const pageW  = 595;
    const pageH  = 842;

    const meta  = TYPE_LABELS[d.type] ?? { code: d.type, title: 'Declaración Tributaria' };
    let page: PDFPage = doc.addPage([pageW, pageH]);
    let y = pageH - margin;
    let pageNum = 1;

    // ── Header band ───────────────────────────────────────────────────────────
    const drawHeader = (pg: PDFPage, num: number) => {
      pg.drawRectangle({ x: 0, y: pageH - 80, width: pageW, height: 80, color: BRAND_BLUE });
      pg.drawText('MINISTERIO DE HACIENDA', {
        x: margin, y: pageH - 22, size: 11, font: bold, color: white,
      });
      pg.drawText('TRIBU CR · Administración Tributaria Virtual', {
        x: margin, y: pageH - 38, size: 8, font: reg, color: rgb(0.7, 0.8, 1),
      });
      pg.drawText(meta.code, {
        x: margin, y: pageH - 60, size: 22, font: bold, color: white,
      });
      pg.drawText(meta.title, {
        x: margin + 70, y: pageH - 56, size: 10, font: reg, color: rgb(0.85, 0.9, 1),
      });
      // Watermark
      pg.drawText('SIMULACIÓN EDUCATIVA', {
        x: pageW - margin - 135, y: pageH - 28, size: 9, font: bold, color: rgb(1, 0.75, 0.3),
      });
      pg.drawText('SJQA GROUP - Sin validez legal', {
        x: pageW - margin - 135, y: pageH - 44, size: 7, font: reg, color: rgb(0.85, 0.9, 1),
      });
      // Footer
      pg.drawLine({ start: { x: margin, y: 30 }, end: { x: pageW - margin, y: 30 }, thickness: 0.5, color: gray });
      pg.drawText(`Página ${num} · Generado el ${todayStr()} · SJQA GROUP`, {
        x: margin, y: 18, size: 7, font: reg, color: gray,
      });
    };

    const ensureSpace = (needed: number) => {
      if (y - needed < 50) {
        pageNum++;
        page = doc.addPage([pageW, pageH]);
        drawHeader(page, pageNum);
        y = pageH - 100;
      }
    };

    const drawSectionTitle = (label: string, color: RGB) => {
      ensureSpace(24);
      page.drawRectangle({ x: margin, y: y - 18, width: pageW - margin * 2, height: 22, color: light });
      page.drawText(label, { x: margin + 8, y: y - 11, size: 10, font: bold, color });
      y -= 26;
    };

    const drawKV = (label: string, value: string, opts: { bold?: boolean; color?: RGB } = {}) => {
      ensureSpace(16);
      const font = opts.bold ? bold : reg;
      const color = opts.color ?? black;
      page.drawText(label, { x: margin + 4, y: y - 8, size: 9, font: reg, color: gray });
      const valStr = value ?? '';
      const valW   = font.widthOfTextAtSize(valStr, 9);
      page.drawText(valStr, { x: pageW - margin - 4 - valW, y: y - 8, size: 9, font, color });
      page.drawLine({ start: { x: margin, y: y - 12 }, end: { x: pageW - margin, y: y - 12 }, thickness: 0.25, color: rgb(0.92, 0.92, 0.92) });
      y -= 16;
    };

    drawHeader(page, pageNum);
    y = pageH - 100;

    // ── Section: Datos de presentación ────────────────────────────────────────
    drawSectionTitle('DATOS DE LA PRESENTACIÓN', BRAND_BLUE);
    drawKV('Número de referencia:', d.referenceNo ?? '-', { bold: true, color: BRAND_BLUE });
    drawKV('Período:', d.period);
    drawKV('Presentada el:', d.submittedAt ? dateTimeStr(d.submittedAt) : '-');
    drawKV('Estado:', d.submittedAt ? 'PRESENTADA' : 'BORRADOR', { bold: true, color: d.submittedAt ? green : red });
    drawKV('Contribuyente:', d.user?.name ?? '-');
    drawKV('Correo:', d.user?.email ?? '-');

    // ── Section: Detalle de casillas ──────────────────────────────────────────
    y -= 4;
    drawSectionTitle('DETALLE DE CASILLAS DECLARADAS', BRAND_BLUE);

    const entries = Object.entries(d.formData ?? {});
    const numericEntries = entries
      .map(([k, v]) => ({ key: k, label: LINE_LABELS[k] ?? k, value: Number(v ?? 0) }))
      .filter(e => !Number.isNaN(e.value) && e.value !== 0);

    if (numericEntries.length === 0) {
      ensureSpace(18);
      page.drawText('Sin casillas declaradas.', { x: margin + 4, y: y - 8, size: 9, font: reg, color: gray });
      y -= 16;
    } else {
      for (const e of numericEntries) {
        drawKV(e.label, crs(e.value));
      }
    }

    // ── Section: Cálculo del impuesto ─────────────────────────────────────────
    y -= 4;
    drawSectionTitle('CÁLCULO DEL IMPUESTO', BRAND_BLUE);

    const r = d.result ?? {};
    if (d.type === 'D104_IVA') {
      drawKV('Débito fiscal (ventas × tasa):',  crs(r.cas301_debitoFiscal),  { bold: true });
      drawKV('Crédito fiscal (compras × tasa):', crs(r.cas302_creditoFiscal), { bold: true });
      if (r.cas303_saldoPeriodoAnterior != null) drawKV('Saldo período anterior:', crs(r.cas303_saldoPeriodoAnterior));
      const pagar = Number(r.cas304_impuestoPagar ?? 0);
      const favor = Number(r.cas305_saldoFavor    ?? 0);
      y -= 4;
      ensureSpace(22);
      const isPagar = pagar > 0;
      const totalColor = isPagar ? red : green;
      const totalBg    = isPagar ? rgb(1, 0.95, 0.95) : rgb(0.93, 0.99, 0.96);
      const totalLabel = isPagar ? 'IMPUESTO A PAGAR' : favor > 0 ? 'SALDO A FAVOR' : 'SIN IMPUESTO CALCULADO';
      const totalValue = isPagar ? crs(pagar) : favor > 0 ? crs(favor) : crs(0);
      page.drawRectangle({ x: margin, y: y - 18, width: pageW - margin * 2, height: 22, color: totalBg });
      page.drawText(totalLabel, { x: margin + 8, y: y - 11, size: 11, font: bold, color: totalColor });
      const w = bold.widthOfTextAtSize(totalValue, 12);
      page.drawText(totalValue, { x: pageW - margin - 8 - w, y: y - 11, size: 12, font: bold, color: totalColor });
      y -= 28;
    } else if (d.type === 'D101_RENTA') {
      drawKV('Ingresos gravables:',    crs(r.cas501_ingresosGravables ?? r.cas601_ingresosGravables));
      drawKV('Gastos deducibles:',     crs(r.cas502_gastosDeducibles   ?? r.cas602_gastosDeducibles));
      drawKV('Renta imponible:',       crs(r.cas503_rentaImponible     ?? r.cas603_rentaImponible), { bold: true });
      drawKV('Impuesto a cargo:',      crs(r.cas504_impuestoCargo      ?? r.cas604_impuestoCargo));
      if (r.cas505_retenciones    != null) drawKV('Retenciones en la fuente:', crs(r.cas505_retenciones));
      if (r.cas506_pagosParciales != null) drawKV('Pagos parciales:',          crs(r.cas506_pagosParciales));
      const pagar = Number(r.cas602_impuestoPagar ?? r.cas507_impuestoPagar ?? 0);
      const favor = Number(r.cas603_saldoFavor    ?? r.cas508_saldoFavor    ?? 0);
      y -= 4;
      ensureSpace(22);
      const isPagar = pagar > 0;
      const totalColor = isPagar ? red : green;
      const totalBg    = isPagar ? rgb(1, 0.95, 0.95) : rgb(0.93, 0.99, 0.96);
      const totalLabel = isPagar ? 'IMPUESTO A PAGAR' : favor > 0 ? 'SALDO A FAVOR' : 'SIN IMPUESTO CALCULADO';
      const totalValue = isPagar ? crs(pagar) : favor > 0 ? crs(favor) : crs(0);
      page.drawRectangle({ x: margin, y: y - 18, width: pageW - margin * 2, height: 22, color: totalBg });
      page.drawText(totalLabel, { x: margin + 8, y: y - 11, size: 11, font: bold, color: totalColor });
      const w = bold.widthOfTextAtSize(totalValue, 12);
      page.drawText(totalValue, { x: pageW - margin - 8 - w, y: y - 11, size: 12, font: bold, color: totalColor });
      y -= 28;
    } else {
      // Generic: dump numeric result keys
      const resultEntries = Object.entries(r).filter(([, v]) => typeof v === 'number' || !Number.isNaN(Number(v)));
      if (resultEntries.length === 0) {
        ensureSpace(16);
        page.drawText('Sin cálculos disponibles.', { x: margin + 4, y: y - 8, size: 9, font: reg, color: gray });
        y -= 16;
      } else {
        for (const [k, v] of resultEntries) drawKV(k, crs(Number(v)));
      }
    }

    // ── Footer notice ─────────────────────────────────────────────────────────
    y -= 6;
    ensureSpace(36);
    page.drawRectangle({ x: margin, y: y - 30, width: pageW - margin * 2, height: 34, color: rgb(1, 0.98, 0.9) });
    page.drawText('AVISO - Este documento es una SIMULACION EDUCATIVA generada por SJQA GROUP.', {
      x: margin + 8, y: y - 12, size: 8, font: bold, color: rgb(0.5, 0.35, 0),
    });
    page.drawText('No constituye un comprobante legal y no ha sido presentado ante la DGT/Hacienda de Costa Rica.', {
      x: margin + 8, y: y - 24, size: 7, font: reg, color: rgb(0.5, 0.35, 0),
    });

    const bytes = await doc.save();
    return Buffer.from(bytes);
  }
}
