import { BadRequestException } from '@nestjs/common';

/**
 * Opciones de subida para hojas de cálculo (Excel/CSV).
 *
 * `xlsx` (SheetJS) arrastra CVEs de prototype-pollution/ReDoS sin parche
 * disponible, así que además del límite de tamaño restringimos la extensión y
 * el MIME antes de que el buffer llegue al parser: cuanto menos basura entre,
 * menor la superficie de ataque.
 */
const ALLOWED_EXT = ['.xlsx', '.xls', '.csv'];
const ALLOWED_MIME = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                          // .xls
  'text/csv',
  'application/csv',
  'text/plain',                 // algunos navegadores mandan CSV así
  'application/octet-stream',   // fallback común; la extensión ya se validó
];

export const SPREADSHEET_UPLOAD = {
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req: any, file: any, cb: any) => {
    const name = String(file?.originalname ?? '').toLowerCase();
    const okExt  = ALLOWED_EXT.some((e) => name.endsWith(e));
    const okMime = ALLOWED_MIME.includes(String(file?.mimetype ?? ''));
    if (!okExt) {
      return cb(new BadRequestException('Formato no permitido. Subí un archivo .xlsx, .xls o .csv.'), false);
    }
    if (!okMime) {
      return cb(new BadRequestException('El tipo de archivo no corresponde a una hoja de cálculo.'), false);
    }
    cb(null, true);
  },
};
