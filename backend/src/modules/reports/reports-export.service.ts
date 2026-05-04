import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// ── Brand constants ───────────────────────────────────────────────────────────
const BRAND_BLUE     = 'FF1E3A8A'; // SJQA GROUP dark blue (ARGB for ExcelJS)
const BRAND_BLUE_PDF = rgb(0.118, 0.227, 0.541); // #1E3A8A
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_BLUE } };
const TOTAL_FILL:  ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF8' } };
const WHITE_FONT:  Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true };
const BOLD_FONT:   Partial<ExcelJS.Font> = { bold: true };

function crsFmt(value: number): string {
  // ATENCIÓN: Esta función la usan tanto los Excel como los PDF.
  // pdf-lib con Helvetica estándar NO soporta ₡ (U+20A1) → reventaba el endpoint.
  // Usamos "CRC " como prefijo, neutral entre formatos.
  return `CRC ${value.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function todayStr(): string {
  return fmtDate(new Date());
}

// ── Shared Excel helpers ──────────────────────────────────────────────────────
function mergeHeader(ws: ExcelJS.Worksheet, text: string, cols: number, row: number) {
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font  = { ...WHITE_FONT, size: 12 };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.fill  = HEADER_FILL;
  ws.mergeCells(row, 1, row, cols);
  ws.getRow(row).height = 22;
}

function addSectionHeader(ws: ExcelJS.Worksheet, label: string, cols: number): number {
  const rowNum = ws.lastRow ? ws.lastRow.number + 1 : 1;
  const row    = ws.getRow(rowNum);
  const cell   = row.getCell(1);
  cell.value   = label;
  cell.font    = { bold: true, color: { argb: BRAND_BLUE }, size: 11 };
  cell.fill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF8' } };
  ws.mergeCells(rowNum, 1, rowNum, cols);
  row.height   = 18;
  return rowNum;
}

function addTotalRow(
  ws: ExcelJS.Worksheet,
  label: string,
  debit: number | null,
  credit: number | null,
  balance: number,
  cols: 4 | 3,
) {
  const rowNum = ws.lastRow ? ws.lastRow.number + 1 : 1;
  const row    = ws.getRow(rowNum);
  row.getCell(1).value = label;
  row.getCell(1).font  = BOLD_FONT;
  if (cols === 4) {
    if (debit  !== null) { row.getCell(2).value = debit;  row.getCell(2).numFmt = '#,##0.00'; }
    if (credit !== null) { row.getCell(3).value = credit; row.getCell(3).numFmt = '#,##0.00'; }
    row.getCell(4).value = balance;
    row.getCell(4).numFmt = '#,##0.00';
  } else {
    if (debit !== null) { row.getCell(2).value = debit;  row.getCell(2).numFmt = '#,##0.00'; }
    row.getCell(3).value = balance;
    row.getCell(3).numFmt = '#,##0.00';
  }
  for (let c = 1; c <= cols; c++) {
    row.getCell(c).fill = TOTAL_FILL;
    row.getCell(c).font = BOLD_FONT;
  }
  row.height = 16;
  return rowNum;
}

async function buildBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  const data = await wb.xlsx.writeBuffer();
  return Buffer.from(data);
}

// ══════════════════════════════════════════════════════════════════════════════
@Injectable()
export class ReportsExportService {

  // ── 1. Balance General — Excel ────────────────────────────────────────────
  async generateBalanceSheetExcel(data: any, companyName: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator  = 'SJQA GROUP';
    wb.created  = new Date();

    const ws  = wb.addWorksheet('Balance General');
    const COL = 3; // Cuenta | Saldo

    // Column widths
    ws.getColumn(1).width = 50;
    ws.getColumn(2).width = 20;
    ws.getColumn(3).width = 20;

    // ── Document header ──
    mergeHeader(ws, 'SJQA GROUP — Sistema Educativo Contable', COL, 1);
    mergeHeader(ws, companyName.toUpperCase(), COL, 2);
    mergeHeader(ws, 'BALANCE GENERAL', COL, 3);
    mergeHeader(ws, `Al ${fmtDate(data.asOfDate ?? new Date())}`, COL, 4);
    ws.addRow([]); // spacer

    // ── Column headers ──
    const colHdr = ws.addRow(['Cuenta', '', 'Saldo (CRC ₡)']);
    colHdr.eachCell((cell, i) => {
      if (i <= COL) {
        cell.fill = HEADER_FILL;
        cell.font = WHITE_FONT;
        cell.alignment = { horizontal: i === COL ? 'right' : 'left', vertical: 'middle' };
      }
    });
    colHdr.height = 18;

    // ── Sections ──
    const sections = [
      { label: 'ACTIVOS',     accounts: data.assets?.accounts      ?? [], total: Number(data.assets?.total      ?? 0), totalLabel: 'TOTAL ACTIVOS' },
      { label: 'PASIVOS',     accounts: data.liabilities?.accounts ?? [], total: Number(data.liabilities?.total ?? 0), totalLabel: 'TOTAL PASIVOS' },
      { label: 'PATRIMONIO',  accounts: data.equity?.accounts      ?? [], total: Number(data.equity?.total      ?? 0), totalLabel: 'TOTAL PATRIMONIO' },
    ];

    for (const sec of sections) {
      ws.addRow([]); // spacer
      addSectionHeader(ws, sec.label, COL);
      for (const a of sec.accounts) {
        const row = ws.addRow([`${a.code}  ${a.name}`, '', Number(a.balance ?? a.balanceNum ?? 0)]);
        row.getCell(1).alignment = { indent: 1 };
        row.getCell(3).numFmt   = '#,##0.00';
        row.getCell(3).alignment = { horizontal: 'right' };
      }
      addTotalRow(ws, sec.totalLabel, null, null, sec.total, 3);
    }

    // ── Balance check ──
    ws.addRow([]);
    const diff     = Number(data.totals?.difference ?? 0);
    const balanced = Math.abs(diff) < 0.01;
    const checkRow = ws.addRow([balanced ? '✓ Balance cuadrado' : '✗ Balance descuadrado']);
    checkRow.getCell(1).font = { bold: true, color: { argb: balanced ? 'FF065F46' : 'FF991B1B' } };
    checkRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: balanced ? 'FFECFDF5' : 'FFFEF2F2' } };
    ws.mergeCells(checkRow.number, 1, checkRow.number, COL);

    // ── Footer ──
    ws.addRow([]);
    const footRow = ws.addRow([`Generado el ${todayStr()} — SJQA GROUP`]);
    footRow.getCell(1).font = { italic: true, color: { argb: 'FF9CA3AF' }, size: 9 };
    ws.mergeCells(footRow.number, 1, footRow.number, COL);

    return buildBuffer(wb);
  }

  // ── 2. Estado de Resultados — Excel ───────────────────────────────────────
  async generateIncomeStatementExcel(data: any, companyName: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SJQA GROUP';
    wb.created = new Date();

    const ws  = wb.addWorksheet('Estado de Resultados');
    const COL = 3;

    ws.getColumn(1).width = 50;
    ws.getColumn(2).width = 20;
    ws.getColumn(3).width = 20;

    const period = data.period ?? {};
    const dateRange = period.startDate && period.endDate
      ? `Del ${fmtDate(period.startDate)} al ${fmtDate(period.endDate)}`
      : `Al ${todayStr()}`;

    mergeHeader(ws, 'SJQA GROUP — Sistema Educativo Contable', COL, 1);
    mergeHeader(ws, companyName.toUpperCase(), COL, 2);
    mergeHeader(ws, 'ESTADO DE RESULTADOS', COL, 3);
    mergeHeader(ws, dateRange, COL, 4);
    ws.addRow([]);

    const colHdr = ws.addRow(['Cuenta', '', 'Monto (CRC ₡)']);
    colHdr.eachCell((cell, i) => {
      if (i <= COL) {
        cell.fill = HEADER_FILL;
        cell.font = WHITE_FONT;
        cell.alignment = { horizontal: i === COL ? 'right' : 'left', vertical: 'middle' };
      }
    });
    colHdr.height = 18;

    // Ingresos
    ws.addRow([]);
    addSectionHeader(ws, 'INGRESOS', COL);
    for (const a of (data.income?.accounts ?? [])) {
      const row = ws.addRow([`${a.code}  ${a.name}`, '', Number(a.balance ?? 0)]);
      row.getCell(1).alignment = { indent: 1 };
      row.getCell(3).numFmt   = '#,##0.00';
      row.getCell(3).alignment = { horizontal: 'right' };
    }
    addTotalRow(ws, 'TOTAL INGRESOS', null, null, Number(data.income?.total ?? data.totals?.totalIncome ?? 0), 3);

    // Gastos
    ws.addRow([]);
    addSectionHeader(ws, 'GASTOS', COL);
    for (const a of (data.expenses?.accounts ?? [])) {
      const row = ws.addRow([`${a.code}  ${a.name}`, '', Number(a.balance ?? 0)]);
      row.getCell(1).alignment = { indent: 1 };
      row.getCell(3).numFmt   = '#,##0.00';
      row.getCell(3).alignment = { horizontal: 'right' };
    }
    addTotalRow(ws, 'TOTAL GASTOS', null, null, Number(data.expenses?.total ?? data.totals?.totalExpenses ?? 0), 3);

    // Net income
    ws.addRow([]);
    const netIncome = Number(data.totals?.netIncome ?? 0);
    const netRow = ws.addRow(['UTILIDAD / PÉRDIDA NETA', '', netIncome]);
    netRow.getCell(3).numFmt = '#,##0.00';
    netRow.getCell(3).alignment = { horizontal: 'right' };
    const netColor = netIncome >= 0 ? 'FF065F46' : 'FF991B1B';
    const netBg    = netIncome >= 0 ? 'FFECFDF5' : 'FFFEF2F2';
    for (let c = 1; c <= COL; c++) {
      netRow.getCell(c).font = { bold: true, color: { argb: netColor } };
      netRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: netBg } };
    }
    netRow.height = 18;

    // Footer
    ws.addRow([]);
    const footRow = ws.addRow([`Generado el ${todayStr()} — SJQA GROUP`]);
    footRow.getCell(1).font = { italic: true, color: { argb: 'FF9CA3AF' }, size: 9 };
    ws.mergeCells(footRow.number, 1, footRow.number, COL);

    return buildBuffer(wb);
  }

  // ── 3. Balance de Comprobación — Excel ────────────────────────────────────
  async generateTrialBalanceExcel(data: any, companyName: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SJQA GROUP';
    wb.created = new Date();

    const ws  = wb.addWorksheet('Bal. Comprobacion');
    const COL = 4;

    ws.getColumn(1).width = 45;
    ws.getColumn(2).width = 18;
    ws.getColumn(3).width = 18;
    ws.getColumn(4).width = 18;

    const period = data.period ?? {};
    const dateRange = period.startDate && period.endDate
      ? `Del ${fmtDate(period.startDate)} al ${fmtDate(period.endDate)}`
      : `Al ${todayStr()}`;

    mergeHeader(ws, 'SJQA GROUP — Sistema Educativo Contable', COL, 1);
    mergeHeader(ws, companyName.toUpperCase(), COL, 2);
    mergeHeader(ws, 'BALANCE DE COMPROBACIÓN', COL, 3);
    mergeHeader(ws, dateRange, COL, 4);
    ws.addRow([]);

    const colHdr = ws.addRow(['Cuenta', 'Total Débitos', 'Total Créditos', 'Saldo']);
    colHdr.eachCell((cell, i) => {
      if (i <= COL) {
        cell.fill = HEADER_FILL;
        cell.font = WHITE_FONT;
        cell.alignment = { horizontal: i === 1 ? 'left' : 'right', vertical: 'middle' };
      }
    });
    colHdr.height = 18;

    for (const a of (data.rows ?? [])) {
      const row = ws.addRow([
        `${a.code}  ${a.name}`,
        Number(a.totalDebit  ?? 0),
        Number(a.totalCredit ?? 0),
        Number(a.balance     ?? 0),
      ]);
      for (let c = 2; c <= COL; c++) {
        row.getCell(c).numFmt = '#,##0.00';
        row.getCell(c).alignment = { horizontal: 'right' };
      }
    }

    // Totals row
    ws.addRow([]);
    const totals = data.totals ?? {};
    const totRow = ws.addRow([
      'TOTALES',
      Number(totals.totalDebit  ?? 0),
      Number(totals.totalCredit ?? 0),
      Number(totals.difference  ?? 0),
    ]);
    for (let c = 1; c <= COL; c++) {
      totRow.getCell(c).fill = HEADER_FILL;
      totRow.getCell(c).font = WHITE_FONT;
      if (c > 1) totRow.getCell(c).numFmt = '#,##0.00';
      totRow.getCell(c).alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' };
    }
    totRow.height = 18;

    // Balanced check
    ws.addRow([]);
    const balanced = totals.isBalanced ?? false;
    const chkRow   = ws.addRow([balanced ? '✓ Balance cuadrado' : '✗ Balance descuadrado']);
    chkRow.getCell(1).font = { bold: true, color: { argb: balanced ? 'FF065F46' : 'FF991B1B' } };
    chkRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: balanced ? 'FFECFDF5' : 'FFFEF2F2' } };
    ws.mergeCells(chkRow.number, 1, chkRow.number, COL);

    // Footer
    ws.addRow([]);
    const footRow = ws.addRow([`Generado el ${todayStr()} — SJQA GROUP`]);
    footRow.getCell(1).font = { italic: true, color: { argb: 'FF9CA3AF' }, size: 9 };
    ws.mergeCells(footRow.number, 1, footRow.number, COL);

    return buildBuffer(wb);
  }

  // ── 4. Libro Diario — Excel ───────────────────────────────────────────────
  async generateJournalBookExcel(data: any, companyName: string): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SJQA GROUP';
    wb.created = new Date();

    const ws  = wb.addWorksheet('Libro Diario');
    const COL = 5;

    ws.getColumn(1).width = 12;
    ws.getColumn(2).width = 14;
    ws.getColumn(3).width = 40;
    ws.getColumn(4).width = 18;
    ws.getColumn(5).width = 18;

    const period = data.period ?? {};
    const dateRange = period.startDate && period.endDate
      ? `Del ${fmtDate(period.startDate)} al ${fmtDate(period.endDate)}`
      : `Al ${todayStr()}`;

    mergeHeader(ws, 'SJQA GROUP — Sistema Educativo Contable', COL, 1);
    mergeHeader(ws, companyName.toUpperCase(), COL, 2);
    mergeHeader(ws, 'LIBRO DIARIO', COL, 3);
    mergeHeader(ws, dateRange, COL, 4);
    ws.addRow([]);

    const colHdr = ws.addRow(['N° Asiento', 'Fecha', 'Cuenta / Descripción', 'Débito (CRC ₡)', 'Crédito (CRC ₡)']);
    colHdr.eachCell((cell, i) => {
      if (i <= COL) {
        cell.fill = HEADER_FILL;
        cell.font = WHITE_FONT;
        cell.alignment = { horizontal: i >= 4 ? 'right' : 'left', vertical: 'middle' };
      }
    });
    colHdr.height = 18;

    for (const entry of (data.entries ?? [])) {
      // Entry header row
      const dateStr  = fmtDate(entry.entryDate);
      const entryRow = ws.addRow([`#${entry.entryNumber}`, dateStr, entry.description, '', '']);
      entryRow.eachCell((cell, i) => {
        if (i <= COL) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
          cell.font = { bold: true, size: 10 };
        }
      });
      entryRow.height = 16;

      // Lines
      for (const line of (entry.lines ?? [])) {
        const lineRow = ws.addRow([
          '',
          '',
          `${line.account?.code ?? ''}  ${line.account?.name ?? ''}`,
          Number(line.debit  ?? 0) || null,
          Number(line.credit ?? 0) || null,
        ]);
        lineRow.getCell(3).alignment = { indent: 2 };
        for (let c = 4; c <= 5; c++) {
          lineRow.getCell(c).numFmt = '#,##0.00';
          lineRow.getCell(c).alignment = { horizontal: 'right' };
        }
      }
      ws.addRow([]); // spacer between entries
    }

    // Totals
    const totals = data.totals ?? {};
    const totRow = ws.addRow([
      '',
      '',
      `TOTALES — ${totals.entryCount ?? 0} asiento(s)`,
      Number(totals.totalDebit  ?? 0),
      Number(totals.totalCredit ?? 0),
    ]);
    for (let c = 1; c <= COL; c++) {
      totRow.getCell(c).fill = HEADER_FILL;
      totRow.getCell(c).font = WHITE_FONT;
      if (c >= 4) {
        totRow.getCell(c).numFmt = '#,##0.00';
        totRow.getCell(c).alignment = { horizontal: 'right' };
      }
    }
    totRow.height = 18;

    // Footer
    ws.addRow([]);
    const footRow = ws.addRow([`Generado el ${todayStr()} — SJQA GROUP`]);
    footRow.getCell(1).font = { italic: true, color: { argb: 'FF9CA3AF' }, size: 9 };
    ws.mergeCells(footRow.number, 1, footRow.number, COL);

    return buildBuffer(wb);
  }

  // ── 5. Balance General — PDF ──────────────────────────────────────────────
  async generateBalanceSheetPdf(data: any, companyName: string): Promise<Buffer> {
    const doc    = await PDFDocument.create();
    const bold   = await doc.embedFont(StandardFonts.HelveticaBold);
    const reg    = await doc.embedFont(StandardFonts.Helvetica);

    const black  = rgb(0, 0, 0);
    const white  = rgb(1, 1, 1);
    const gray   = rgb(0.55, 0.55, 0.55);
    const light  = rgb(0.96, 0.97, 0.99);
    const green  = rgb(0.024, 0.373, 0.275);
    const red    = rgb(0.6, 0.11, 0.11);

    const margin = 40;
    const colW   = [260, 130]; // [name/code col, amount col]
    const pageW  = 595;
    const pageH  = 842;

    let page = doc.addPage([pageW, pageH]);
    let y    = pageH - margin;
    let pageNum = 1;

    const drawPageHeader = (pg: ReturnType<typeof doc.addPage>, pNum: number) => {
      // Blue header band
      pg.drawRectangle({ x: 0, y: pageH - 72, width: pageW, height: 72, color: BRAND_BLUE_PDF });
      pg.drawText('SJQA GROUP', {
        x: margin, y: pageH - 24, size: 14, font: bold, color: white,
      });
      pg.drawText('Sistema Educativo Contable', {
        x: margin, y: pageH - 38, size: 8, font: reg, color: rgb(0.7, 0.8, 1),
      });
      pg.drawText(companyName.toUpperCase(), {
        x: margin, y: pageH - 54, size: 10, font: bold, color: white,
      });
      pg.drawText('BALANCE GENERAL', {
        x: pageW - margin - 130, y: pageH - 30, size: 12, font: bold, color: white,
      });
      pg.drawText(`Al ${fmtDate(data.asOfDate ?? new Date())}`, {
        x: pageW - margin - 130, y: pageH - 46, size: 8, font: reg, color: rgb(0.7, 0.8, 1),
      });
      // Page footer
      pg.drawLine({ start: { x: margin, y: 30 }, end: { x: pageW - margin, y: 30 }, thickness: 0.5, color: gray });
      pg.drawText(`Página ${pNum} · Generado el ${todayStr()} · SJQA GROUP`, {
        x: margin, y: 18, size: 7, font: reg, color: gray,
      });
    };

    drawPageHeader(page, pageNum);
    y = pageH - 90;

    const ensureSpace = (needed: number) => {
      if (y - needed < 50) {
        pageNum++;
        page = doc.addPage([pageW, pageH]);
        drawPageHeader(page, pageNum);
        y = pageH - 90;
      }
    };

    const drawRow = (code: string, name: string, amount: number | null, opts: { bold?: boolean; bg?: boolean } = {}) => {
      ensureSpace(16);
      if (opts.bg) {
        page.drawRectangle({ x: margin, y: y - 12, width: pageW - margin * 2, height: 16, color: light });
      }
      const font = opts.bold ? bold : reg;
      page.drawText(code, { x: margin + 4, y: y - 8, size: 8, font: reg, color: gray });
      const nameText = name.length > 48 ? name.slice(0, 46) + '…' : name;
      page.drawText(nameText, { x: margin + 60, y: y - 8, size: opts.bold ? 9 : 8, font, color: black });
      if (amount !== null) {
        const amtStr = crsFmt(amount);
        const amtW   = bold.widthOfTextAtSize(amtStr, 9);
        page.drawText(amtStr, { x: pageW - margin - 4 - amtW, y: y - 8, size: 9, font: opts.bold ? bold : reg, color: opts.bold ? BRAND_BLUE_PDF : black });
      }
      // separator line
      page.drawLine({ start: { x: margin, y: y - 12 }, end: { x: pageW - margin, y: y - 12 }, thickness: 0.25, color: rgb(0.9, 0.9, 0.9) });
      y -= 16;
    };

    const drawSectionTitle = (label: string, color: ReturnType<typeof rgb>) => {
      ensureSpace(22);
      page.drawRectangle({ x: margin, y: y - 16, width: pageW - margin * 2, height: 20, color: light });
      page.drawText(label, { x: margin + 6, y: y - 11, size: 9, font: bold, color });
      y -= 22;
    };

    // ── Sections ──
    const sections = [
      { label: 'ACTIVOS',    color: BRAND_BLUE_PDF, accounts: data.assets?.accounts      ?? [], total: Number(data.assets?.total      ?? 0), totalLabel: 'TOTAL ACTIVOS' },
      { label: 'PASIVOS',    color: red,             accounts: data.liabilities?.accounts ?? [], total: Number(data.liabilities?.total ?? 0), totalLabel: 'TOTAL PASIVOS' },
      { label: 'PATRIMONIO', color: rgb(0.49, 0.23, 0.87), accounts: data.equity?.accounts ?? [], total: Number(data.equity?.total    ?? 0), totalLabel: 'TOTAL PATRIMONIO' },
    ];

    for (const sec of sections) {
      y -= 8;
      drawSectionTitle(sec.label, sec.color);
      for (const a of sec.accounts) {
        drawRow(a.code, a.name, Number(a.balance ?? a.balanceNum ?? 0));
      }
      drawRow('', sec.totalLabel, sec.total, { bold: true, bg: true });
    }

    // Balance check
    y -= 10;
    ensureSpace(20);
    const diff     = Number(data.totals?.difference ?? 0);
    const balanced = Math.abs(diff) < 0.01;
    const chkColor = balanced ? green : red;
    const chkBg    = balanced ? rgb(0.93, 0.99, 0.96) : rgb(1, 0.95, 0.95);
    page.drawRectangle({ x: margin, y: y - 14, width: pageW - margin * 2, height: 18, color: chkBg });
    // Helvetica/WinAnsi NO soporta ✓ ✗ — usamos [OK] / [X] equivalentes ASCII.
    page.drawText(balanced ? '[OK] Balance cuadrado: Activos = Pasivos + Patrimonio' : '[X] Balance descuadrado', {
      x: margin + 6, y: y - 8, size: 8, font: bold, color: chkColor,
    });

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  }

  // ── 6. Estado de Resultados — PDF ─────────────────────────────────────────
  async generateIncomeStatementPdf(data: any, companyName: string): Promise<Buffer> {
    const doc    = await PDFDocument.create();
    const bold   = await doc.embedFont(StandardFonts.HelveticaBold);
    const reg    = await doc.embedFont(StandardFonts.Helvetica);

    const black  = rgb(0, 0, 0);
    const white  = rgb(1, 1, 1);
    const gray   = rgb(0.55, 0.55, 0.55);
    const light  = rgb(0.96, 0.97, 0.99);
    const green  = rgb(0.024, 0.373, 0.275);
    const red    = rgb(0.6, 0.11, 0.11);

    const margin = 40;
    const pageW  = 595;
    const pageH  = 842;

    const period = data.period ?? {};
    const dateRange = period.startDate && period.endDate
      ? `Del ${fmtDate(period.startDate)} al ${fmtDate(period.endDate)}`
      : `Al ${todayStr()}`;

    let page    = doc.addPage([pageW, pageH]);
    let y       = pageH - margin;
    let pageNum = 1;

    const drawPageHeader = (pg: ReturnType<typeof doc.addPage>, pNum: number) => {
      pg.drawRectangle({ x: 0, y: pageH - 72, width: pageW, height: 72, color: BRAND_BLUE_PDF });
      pg.drawText('SJQA GROUP', { x: margin, y: pageH - 24, size: 14, font: bold, color: white });
      pg.drawText('Sistema Educativo Contable', { x: margin, y: pageH - 38, size: 8, font: reg, color: rgb(0.7, 0.8, 1) });
      pg.drawText(companyName.toUpperCase(), { x: margin, y: pageH - 54, size: 10, font: bold, color: white });
      pg.drawText('ESTADO DE RESULTADOS', { x: pageW - margin - 155, y: pageH - 30, size: 11, font: bold, color: white });
      pg.drawText(dateRange, { x: pageW - margin - 155, y: pageH - 46, size: 8, font: reg, color: rgb(0.7, 0.8, 1) });
      pg.drawLine({ start: { x: margin, y: 30 }, end: { x: pageW - margin, y: 30 }, thickness: 0.5, color: gray });
      pg.drawText(`Página ${pNum} · Generado el ${todayStr()} · SJQA GROUP`, { x: margin, y: 18, size: 7, font: reg, color: gray });
    };

    drawPageHeader(page, pageNum);
    y = pageH - 90;

    const ensureSpace = (needed: number) => {
      if (y - needed < 50) {
        pageNum++;
        page = doc.addPage([pageW, pageH]);
        drawPageHeader(page, pageNum);
        y = pageH - 90;
      }
    };

    const drawRow = (code: string, name: string, amount: number | null, opts: { bold?: boolean; bg?: boolean } = {}) => {
      ensureSpace(16);
      if (opts.bg) {
        page.drawRectangle({ x: margin, y: y - 12, width: pageW - margin * 2, height: 16, color: light });
      }
      const font = opts.bold ? bold : reg;
      page.drawText(code, { x: margin + 4, y: y - 8, size: 8, font: reg, color: gray });
      const nameText = name.length > 48 ? name.slice(0, 46) + '…' : name;
      page.drawText(nameText, { x: margin + 60, y: y - 8, size: opts.bold ? 9 : 8, font, color: black });
      if (amount !== null) {
        const amtStr = crsFmt(amount);
        const amtW   = bold.widthOfTextAtSize(amtStr, 9);
        page.drawText(amtStr, { x: pageW - margin - 4 - amtW, y: y - 8, size: 9, font: opts.bold ? bold : reg, color: opts.bold ? BRAND_BLUE_PDF : black });
      }
      page.drawLine({ start: { x: margin, y: y - 12 }, end: { x: pageW - margin, y: y - 12 }, thickness: 0.25, color: rgb(0.9, 0.9, 0.9) });
      y -= 16;
    };

    const drawSectionTitle = (label: string, color: ReturnType<typeof rgb>) => {
      ensureSpace(22);
      page.drawRectangle({ x: margin, y: y - 16, width: pageW - margin * 2, height: 20, color: light });
      page.drawText(label, { x: margin + 6, y: y - 11, size: 9, font: bold, color });
      y -= 22;
    };

    // Ingresos
    y -= 8;
    drawSectionTitle('INGRESOS', green);
    for (const a of (data.income?.accounts ?? [])) {
      drawRow(a.code, a.name, Number(a.balance ?? 0));
    }
    drawRow('', 'TOTAL INGRESOS', Number(data.income?.total ?? data.totals?.totalIncome ?? 0), { bold: true, bg: true });

    // Gastos
    y -= 8;
    drawSectionTitle('GASTOS', red);
    for (const a of (data.expenses?.accounts ?? [])) {
      drawRow(a.code, a.name, Number(a.balance ?? 0));
    }
    drawRow('', 'TOTAL GASTOS', Number(data.expenses?.total ?? data.totals?.totalExpenses ?? 0), { bold: true, bg: true });

    // Net income
    y -= 12;
    ensureSpace(22);
    const netIncome = Number(data.totals?.netIncome ?? 0);
    const isProfit  = netIncome >= 0;
    const netBgPdf  = isProfit ? rgb(0.93, 0.99, 0.96) : rgb(1, 0.95, 0.95);
    const netColorPdf = isProfit ? green : red;
    page.drawRectangle({ x: margin, y: y - 16, width: pageW - margin * 2, height: 20, color: netBgPdf });
    page.drawText(isProfit ? 'UTILIDAD NETA' : 'PÉRDIDA NETA', { x: margin + 6, y: y - 10, size: 10, font: bold, color: netColorPdf });
    const netStr = crsFmt(Math.abs(netIncome));
    const netW   = bold.widthOfTextAtSize(netStr, 10);
    page.drawText(netStr, { x: pageW - margin - 4 - netW, y: y - 10, size: 10, font: bold, color: netColorPdf });

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  }
}
