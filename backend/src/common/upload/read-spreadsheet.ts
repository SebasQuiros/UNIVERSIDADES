import { BadRequestException } from '@nestjs/common';

/**
 * Lee una hoja de cálculo (.xlsx/.xls/.csv) y la devuelve como matriz de filas,
 * igual que `XLSX.utils.sheet_to_json(ws, { header: 1 })`.
 *
 * Usa **exceljs** en lugar de `xlsx` (SheetJS): esta última arrastra CVEs de
 * prototype-pollution y ReDoS SIN PARCHE disponible, y aquí el buffer viene de
 * una subida de usuario. exceljs ya se usaba en el proyecto para exportar.
 *
 * Las celdas se normalizan a primitivos: los objetos de fórmula devuelven su
 * resultado y los de texto enriquecido su texto plano.
 */
function cellToPrimitive(v: any): any {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v)     return cellToPrimitive((v as any).result);   // fórmula
    if ('text' in v)       return (v as any).text;                      // hyperlink
    if ('richText' in v)   return (v as any).richText.map((r: any) => r.text).join('');
    if ('error' in v)      return '';
    return String(v);
  }
  return v;
}

export async function readSpreadsheet(
  buffer: Buffer,
  originalName = '',
): Promise<unknown[][]> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();

  try {
    if (originalName.toLowerCase().endsWith('.csv')) {
      const { Readable } = require('stream');
      await wb.csv.read(Readable.from(buffer.toString('utf8')));
    } else {
      await wb.xlsx.load(buffer);
    }
  } catch {
    throw new BadRequestException('No se pudo leer el archivo. Verificá que sea un Excel o CSV válido.');
  }

  const ws = wb.worksheets[0];
  if (!ws) throw new BadRequestException('El archivo no tiene hojas de cálculo.');

  const rows: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row: any) => {
    // row.values es 1-indexado en exceljs: descartamos la posición 0.
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    const clean = values.map(cellToPrimitive);
    if (clean.some((c: any) => c !== '' && c !== null && c !== undefined)) rows.push(clean);
  });
  return rows;
}
