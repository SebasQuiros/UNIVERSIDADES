import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument, PDFImage, rgb, degrees, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import { Decimal } from '@prisma/client/runtime/library';

export interface PdfInvoiceData {
  clave:             string;
  consecutiveNumber: string;
  issueDate:         Date;
  // Fase 4: identificadores internos (opcional). Si vienen, se renderiza un
  // segundo QR con `{invoiceId, companyId}` para verificación interna del
  // sistema SJQA (independiente de TribuNet).
  invoiceId?:        string;
  companyId?:        string;
  issuer: {
    name:    string;
    legalId: string;
    email?:  string;
    address?: string;
    phone?:  string;
  };
  receiver: {
    name:           string;
    identification: string;
    idType:         string;
    email?:         string;
  };
  lines: Array<{
    lineNo:      number;
    description: string;
    quantity:    Decimal;
    unit:        string;
    unitPrice:   Decimal;
    taxRate:     Decimal;
    taxAmount:   Decimal;
    subtotal:    Decimal;
    total:       Decimal;
  }>;
  subtotal: Decimal;
  tax:      Decimal;
  total:    Decimal;
}

// ─── Paleta SJQA GROUP ────────────────────────────────────────────────────
const C = {
  brandDark:   rgb(0.041, 0.092, 0.341), // #0B1857
  brandPrim:   rgb(0.106, 0.180, 0.431), // #1B2E6E
  brandMid:    rgb(0.118, 0.227, 0.541), // #1E3A8A
  brandAccent: rgb(0.231, 0.510, 0.965), // #3B82F6
  brandLight:  rgb(0.376, 0.647, 0.980), // #60A5FA
  white:       rgb(1, 1, 1),
  black:       rgb(0.063, 0.090, 0.157), // #101826
  textMuted:   rgb(0.42, 0.45, 0.50),
  border:      rgb(0.86, 0.89, 0.93),
  rowAlt:      rgb(0.969, 0.976, 0.984), // #F7F9FB
  rowHead:     rgb(0.945, 0.957, 0.973),
  success:     rgb(0.063, 0.514, 0.380),
  danger:      rgb(0.722, 0.063, 0.110),
  amber:       rgb(0.851, 0.467, 0.024),
};

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);

  // ── Logo cacheado (se carga una sola vez por proceso) ─────────────────
  private logoBytes: Uint8Array | null = null;
  private logoLoaded = false;

  private loadLogo(): Uint8Array | null {
    if (this.logoLoaded) return this.logoBytes;
    this.logoLoaded = true;
    // Buscamos en varias ubicaciones para tolerar dist/ vs src/ y Docker
    const candidates = [
      path.resolve(__dirname, '../../../../assets/sjqa-logo.png'),
      path.resolve(process.cwd(), 'assets/sjqa-logo.png'),
      path.resolve(process.cwd(), 'backend/assets/sjqa-logo.png'),
      path.resolve(__dirname, '../../../assets/sjqa-logo.png'),
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          this.logoBytes = fs.readFileSync(p);
          this.logger.log(`SJQA logo loaded from ${p}`);
          return this.logoBytes;
        }
      } catch { /* continue */ }
    }
    this.logger.warn('SJQA logo not found — invoice PDF will use text fallback.');
    return null;
  }

  async generate(data: PdfInvoiceData): Promise<Buffer> {
    const doc  = await PDFDocument.create();
    const page = doc.addPage([595, 842]); // A4
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const reg  = await doc.embedFont(StandardFonts.Helvetica);
    const ital = await doc.embedFont(StandardFonts.HelveticaOblique);

    const { width, height } = page.getSize();
    const margin = 36;

    // ── Logo embed (best-effort) ──────────────────────────────────────────
    let logo: PDFImage | null = null;
    const bytes = this.loadLogo();
    if (bytes) {
      try { logo = await doc.embedPng(bytes); }
      catch (err) {
        this.logger.warn(`SJQA logo embed failed: ${(err as Error).message}`);
      }
    }

    // ── Watermark "SJQA" diagonal y muy claro detrás de todo ──────────────
    page.drawText('SJQA', {
      x: 90, y: 320, size: 180, font: bold,
      color: rgb(0.95, 0.96, 0.99),
      rotate: degrees(30),
      opacity: 0.55,
    });

    // ────────────────────────────────────────────────────────────────────
    // BANDA SUPERIOR — gradiente simulado en 3 capas + acento
    // ────────────────────────────────────────────────────────────────────
    const bandH = 96;
    page.drawRectangle({ x: 0, y: height - bandH, width, height: bandH, color: C.brandDark });
    page.drawRectangle({ x: 0, y: height - bandH, width: width * 0.62, height: bandH, color: C.brandPrim });
    page.drawRectangle({ x: 0, y: height - bandH, width: width * 0.30, height: bandH, color: C.brandMid });
    // línea de acento brillante abajo del header
    page.drawRectangle({ x: 0, y: height - bandH - 3, width, height: 3, color: C.brandAccent });

    // ── Logo + brand name (lado izquierdo del header) ─────────────────
    const logoSize = 56;
    if (logo) {
      // fondo blanco circular para el logo (rectángulo redondeado simulado)
      const cx = margin + logoSize / 2;
      const cy = height - bandH / 2;
      page.drawRectangle({
        x: cx - logoSize / 2 - 2, y: cy - logoSize / 2 - 2,
        width: logoSize + 4, height: logoSize + 4,
        color: C.white, opacity: 0.95,
      });
      page.drawImage(logo, {
        x: cx - logoSize / 2, y: cy - logoSize / 2,
        width: logoSize, height: logoSize,
      });
      page.drawText('SJQA GROUP', {
        x: margin + logoSize + 14, y: height - 38, size: 16, font: bold, color: C.white,
      });
      page.drawText('Sistema Educativo Contable · Costa Rica', {
        x: margin + logoSize + 14, y: height - 56, size: 8, font: reg,
        color: rgb(0.78, 0.86, 0.99),
      });
      page.drawText('www.sjqa.cr  ·  hola@sjqa.cr', {
        x: margin + logoSize + 14, y: height - 70, size: 7, font: reg,
        color: rgb(0.65, 0.78, 0.98),
      });
    } else {
      // Fallback sin logo
      page.drawText('SJQA GROUP', {
        x: margin, y: height - 38, size: 19, font: bold, color: C.white,
      });
      page.drawText('Sistema Educativo Contable · Costa Rica', {
        x: margin, y: height - 56, size: 8, font: reg, color: rgb(0.78, 0.86, 0.99),
      });
    }

    // ── Caja "FACTURA ELECTRÓNICA" + consecutivo (lado derecho) ──────────
    const boxX = width - margin - 200;
    const boxY = height - 80;
    page.drawRectangle({
      x: boxX, y: boxY, width: 200, height: 64,
      color: rgb(1, 1, 1), opacity: 0.10,
    });
    page.drawRectangle({
      x: boxX, y: boxY + 64 - 18, width: 200, height: 18,
      color: C.brandAccent,
    });
    page.drawText('FACTURA ELECTRONICA', {
      x: boxX + 10, y: boxY + 64 - 14, size: 9, font: bold, color: C.white,
    });
    page.drawText(`No. ${data.consecutiveNumber}`, {
      x: boxX + 10, y: boxY + 64 - 36, size: 13, font: bold, color: C.white,
    });
    page.drawText(`Emitida: ${data.issueDate.toLocaleDateString('es-CR')}`, {
      x: boxX + 10, y: boxY + 64 - 52, size: 8, font: reg, color: rgb(0.85, 0.92, 1),
    });

    // ── Cuerpo: posición Y inicial ─────────────────────────────────────
    let y = height - bandH - 24;

    // ────────────────────────────────────────────────────────────────────
    // EMISOR / RECEPTOR — dos cards lado a lado
    // ────────────────────────────────────────────────────────────────────
    const cardW = (width - margin * 2 - 12) / 2;
    const cardH = 86;
    const cardY = y - cardH;

    // EMISOR
    this.drawCard(page, margin, cardY, cardW, cardH, 'EMISOR', bold, reg);
    let yy = cardY + cardH - 28;
    page.drawText(this.trim(data.issuer.name, 38), {
      x: margin + 12, y: yy, size: 10, font: bold, color: C.black,
    });
    yy -= 13;
    page.drawText(`Cedula juridica: ${data.issuer.legalId}`, {
      x: margin + 12, y: yy, size: 8, font: reg, color: C.textMuted,
    });
    if (data.issuer.email) {
      yy -= 11;
      page.drawText(this.trim(data.issuer.email, 42), {
        x: margin + 12, y: yy, size: 8, font: reg, color: C.textMuted,
      });
    }
    if (data.issuer.phone) {
      yy -= 11;
      page.drawText(`Tel: ${data.issuer.phone}`, {
        x: margin + 12, y: yy, size: 8, font: reg, color: C.textMuted,
      });
    }

    // RECEPTOR
    const rx = margin + cardW + 12;
    this.drawCard(page, rx, cardY, cardW, cardH, 'RECEPTOR', bold, reg);
    yy = cardY + cardH - 28;
    page.drawText(this.trim(data.receiver.name, 38), {
      x: rx + 12, y: yy, size: 10, font: bold, color: C.black,
    });
    yy -= 13;
    const idTypeLabel: Record<string, string> = {
      '01': 'Cedula fisica', '02': 'Cedula juridica', '03': 'DIMEX', '04': 'NITE',
    };
    page.drawText(`${idTypeLabel[data.receiver.idType] ?? 'Identificacion'}: ${data.receiver.identification}`, {
      x: rx + 12, y: yy, size: 8, font: reg, color: C.textMuted,
    });
    if (data.receiver.email) {
      yy -= 11;
      page.drawText(this.trim(data.receiver.email, 42), {
        x: rx + 12, y: yy, size: 8, font: reg, color: C.textMuted,
      });
    }

    y = cardY - 20;

    // ────────────────────────────────────────────────────────────────────
    // TABLA DE LINEAS
    // ────────────────────────────────────────────────────────────────────
    const tableX = margin;
    const tableW = width - margin * 2;
    const headH  = 22;

    // Header de la tabla con gradiente sutil (dos rectángulos)
    page.drawRectangle({ x: tableX, y: y - headH, width: tableW, height: headH, color: C.brandPrim });
    page.drawRectangle({ x: tableX, y: y - headH, width: tableW, height: 2, color: C.brandAccent });

    // Definimos columnas (proporcional al ancho disponible)
    const cols = [
      { x: tableX + 8,                        w: 22,  label: '#'      },
      { x: tableX + 32,                       w: 188, label: 'Descripcion' },
      { x: tableX + 222,                      w: 36,  label: 'Unid.'  },
      { x: tableX + 260,                      w: 38,  label: 'Cant.'  },
      { x: tableX + 300,                      w: 70,  label: 'P.Unit' },
      { x: tableX + 372,                      w: 42,  label: 'IVA %' },
      { x: tableX + 416,                      w: 45,  label: 'IVA'    },
      { x: tableX + tableW - 8,               w: 0,   label: 'Total'  }, // dinámico
    ];

    cols.forEach((c, i) => {
      const isLast = i === cols.length - 1;
      // Última columna alineada a la derecha
      const xText = isLast ? c.x : c.x;
      page.drawText(c.label, {
        x: xText - (isLast ? bold.widthOfTextAtSize(c.label, 8) : 0),
        y: y - 14, size: 8, font: bold, color: C.white,
      });
    });

    y -= headH;

    // Filas
    const rowH = 16;
    let rowsDrawn = 0;
    for (const line of data.lines) {
      if (y - rowH < 220) {
        page.drawText('... (continua)', {
          x: tableX + 6, y: y - 10, size: 8, font: ital, color: C.textMuted,
        });
        break;
      }

      // alternar color de fila
      if (rowsDrawn % 2 === 1) {
        page.drawRectangle({ x: tableX, y: y - rowH, width: tableW, height: rowH, color: C.rowAlt });
      }

      const desc = this.trim(line.description, 38);
      const totalStr = `CRC ${this.fmt(line.total)}`;
      const totalW   = reg.widthOfTextAtSize(totalStr, 8);

      const rowText = (txt: string, col: number, font = reg) => {
        page.drawText(txt, { x: cols[col].x, y: y - 11, size: 8, font, color: C.black });
      };

      rowText(String(line.lineNo), 0);
      rowText(desc, 1);
      rowText(line.unit, 2);
      rowText(line.quantity.toFixed(2), 3);
      rowText(`CRC ${this.fmt(line.unitPrice)}`, 4);
      rowText(`${line.taxRate}%`, 5);
      rowText(`CRC ${this.fmt(line.taxAmount)}`, 6);
      // total alineado a la derecha
      page.drawText(totalStr, {
        x: tableX + tableW - 8 - totalW, y: y - 11, size: 8, font: bold, color: C.black,
      });

      // separador horizontal sutil
      page.drawLine({
        start: { x: tableX, y: y - rowH }, end: { x: tableX + tableW, y: y - rowH },
        thickness: 0.3, color: C.border,
      });

      y -= rowH;
      rowsDrawn += 1;
    }

    // (no se dibuja borde exterior de la tabla — el header azul + filas alternadas
    //  ya delimitan visualmente el bloque y evitamos un drawRectangle sin fill que
    //  algunas versiones de pdf-lib rechazan.)

    // ────────────────────────────────────────────────────────────────────
    // TOTALES — bloque destacado
    // ────────────────────────────────────────────────────────────────────
    y -= 14;
    const totalsW = 240;
    const totalsX = width - margin - totalsW;

    // Sub-bloque (subtotal + IVA)
    page.drawRectangle({
      x: totalsX, y: y - 38, width: totalsW, height: 38,
      color: rgb(0.969, 0.976, 0.988), borderColor: C.border, borderWidth: 0.5,
    });
    this.drawTotalRow(page, reg, bold, totalsX + 14, y - 14, 'Subtotal',  `CRC ${this.fmt(data.subtotal)}`, C.black);
    this.drawTotalRow(page, reg, bold, totalsX + 14, y - 30, 'IVA total', `CRC ${this.fmt(data.tax)}`,      C.black);

    // Bloque TOTAL — gradiente + sombra simulada
    const totalY = y - 38 - 30;
    page.drawRectangle({
      x: totalsX + 3, y: totalY - 3, width: totalsW, height: 30,
      color: rgb(0.04, 0.09, 0.34), opacity: 0.18,
    });
    page.drawRectangle({
      x: totalsX, y: totalY, width: totalsW, height: 30,
      color: C.brandPrim,
    });
    page.drawRectangle({
      x: totalsX, y: totalY, width: 4, height: 30, color: C.brandAccent,
    });
    page.drawText('TOTAL A PAGAR', {
      x: totalsX + 14, y: totalY + 12, size: 9, font: bold, color: rgb(0.78, 0.86, 0.99),
    });
    const totalStr = `CRC ${this.fmt(data.total)}`;
    const totalW   = bold.widthOfTextAtSize(totalStr, 13);
    page.drawText(totalStr, {
      x: totalsX + totalsW - 14 - totalW, y: totalY + 9, size: 13, font: bold, color: C.white,
    });

    y = totalY - 18;

    // ────────────────────────────────────────────────────────────────────
    // CLAVE NUMERICA + QR + sello educativo
    // ────────────────────────────────────────────────────────────────────
    const claveBoxH = 70;
    page.drawRectangle({
      x: margin, y: y - claveBoxH, width: width - margin * 2, height: claveBoxH,
      color: rgb(0.969, 0.973, 0.984), borderColor: C.border, borderWidth: 0.5,
    });
    page.drawText('CLAVE NUMERICA HACIENDA', {
      x: margin + 12, y: y - 16, size: 8, font: bold, color: C.brandPrim,
    });
    // partir clave en grupos de 10 chars para que se vea menos densa
    const claveDisplay = data.clave.replace(/(.{10})/g, '$1 ').trim();
    page.drawText(claveDisplay, {
      x: margin + 12, y: y - 32, size: 8, font: reg, color: C.black,
    });
    page.drawText('Verifique este comprobante en https://tribunet.hacienda.go.cr', {
      x: margin + 12, y: y - 48, size: 7, font: ital, color: C.textMuted,
    });

    // QR Hacienda — TribuNet
    const qrSize = claveBoxH - 14;
    try {
      const qrUrl    = `https://tribunet.hacienda.go.cr/consulta?clave=${data.clave}`;
      const qrBuf    = await QRCode.toBuffer(qrUrl, { width: 180, margin: 0 });
      const qrImg    = await doc.embedPng(qrBuf);
      page.drawRectangle({
        x: width - margin - qrSize - 7, y: y - claveBoxH + 7,
        width: qrSize, height: qrSize, color: C.white,
        borderColor: C.border, borderWidth: 0.5,
      });
      page.drawImage(qrImg, {
        x: width - margin - qrSize - 4, y: y - claveBoxH + 10,
        width: qrSize - 6, height: qrSize - 6,
      });
      page.drawText('Hacienda', {
        x: width - margin - qrSize - 2,
        y: y - claveBoxH + 2,
        size: 6, font: reg, color: C.textMuted,
      });
    } catch (err) {
      this.logger.warn('QR (Hacienda) generation failed — continuing without QR');
    }

    // ── Fase 4: QR INTERNO con {invoiceId, companyId} ───────────────────
    // Codifica un payload JSON que se puede leer con cualquier app de QR
    // (sin URL hosted, funciona offline). Usado por el panel del profe para
    // verificar que el comprobante pertenece a este sistema.
    if (data.invoiceId && data.companyId) {
      try {
        const internalPayload = JSON.stringify({
          inv: data.invoiceId,
          co:  data.companyId,
          n:   data.consecutiveNumber,
          v:   1,
        });
        const buf = await QRCode.toBuffer(internalPayload, { width: 180, margin: 0 });
        const img = await doc.embedPng(buf);
        const xLeft = width - margin - qrSize * 2 - 18;
        page.drawRectangle({
          x: xLeft, y: y - claveBoxH + 7,
          width: qrSize, height: qrSize, color: C.white,
          borderColor: C.border, borderWidth: 0.5,
        });
        page.drawImage(img, {
          x: xLeft + 3, y: y - claveBoxH + 10,
          width: qrSize - 6, height: qrSize - 6,
        });
        page.drawText('SJQA verify', {
          x: xLeft + 4,
          y: y - claveBoxH + 2,
          size: 6, font: reg, color: C.textMuted,
        });
      } catch (err) {
        this.logger.warn('QR (SJQA verify) generation failed — continuing without it');
      }
    }

    // ────────────────────────────────────────────────────────────────────
    // FOOTER
    // ────────────────────────────────────────────────────────────────────
    page.drawLine({
      start: { x: margin, y: 50 }, end: { x: width - margin, y: 50 },
      thickness: 0.5, color: C.border,
    });

    // Logo pequeño en footer si está disponible
    if (logo) {
      page.drawImage(logo, { x: margin, y: 18, width: 22, height: 22 });
      page.drawText('SJQA GROUP', { x: margin + 28, y: 32, size: 8, font: bold, color: C.brandPrim });
      page.drawText(`Documento educativo · ${new Date().getFullYear()}`, {
        x: margin + 28, y: 22, size: 7, font: reg, color: C.textMuted,
      });
    } else {
      page.drawText('SJQA GROUP — Sistema Educativo Contable', {
        x: margin, y: 32, size: 8, font: bold, color: C.brandPrim,
      });
    }

    // Aviso legal a la derecha
    const aviso = 'DOCUMENTO EDUCATIVO  ·  Sin validez fiscal ante el Ministerio de Hacienda CR';
    const avisoW = ital.widthOfTextAtSize(aviso, 7);
    page.drawText(aviso, {
      x: width - margin - avisoW, y: 22, size: 7, font: ital, color: C.amber,
    });

    // página x de y (preparado por si más adelante hay paginación)
    page.drawText('Pagina 1 de 1', {
      x: width - margin - 50, y: 36, size: 7, font: reg, color: C.textMuted,
    });

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  }

  // ────────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────────

  private drawCard(
    page: PDFPage, x: number, y: number, w: number, h: number,
    label: string, bold: PDFFont, _reg: PDFFont,
  ) {
    // sombra suave
    page.drawRectangle({
      x: x + 2, y: y - 2, width: w, height: h,
      color: C.brandPrim, opacity: 0.07,
    });
    // base blanca
    page.drawRectangle({
      x, y, width: w, height: h,
      color: C.white, borderColor: C.border, borderWidth: 0.5,
    });
    // banda superior con el label
    page.drawRectangle({ x, y: y + h - 16, width: w, height: 16, color: C.brandPrim });
    page.drawRectangle({ x, y: y + h - 16, width: 4, height: 16, color: C.brandAccent });
    page.drawText(label, {
      x: x + 12, y: y + h - 12, size: 8, font: bold, color: C.white,
    });
  }

  private drawTotalRow(
    page: PDFPage, labelFont: PDFFont, valueFont: PDFFont,
    x: number, y: number, label: string, value: string, color: any,
  ) {
    page.drawText(label, { x, y, size: 9, font: labelFont, color: C.textMuted });
    const w = valueFont.widthOfTextAtSize(value, 9);
    page.drawText(value, { x: x + 230 - w - 18, y, size: 9, font: valueFont, color });
  }

  private fmt(val: Decimal | number | string): string {
    return Number(val).toLocaleString('es-CR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private trim(s: string, max: number): string {
    if (!s) return '';
    return s.length > max ? s.slice(0, max - 1) + '...' : s;
  }
}
