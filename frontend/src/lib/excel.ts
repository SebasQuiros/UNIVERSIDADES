/**
 * Pure client-side Excel export — no external dependencies.
 * Generates a real .xlsx (SpreadsheetML / OOXML) file via Blob.
 * Supports single and multi-sheet workbooks.
 */

export function exportToExcelMultiSheet(
  filename: string,
  sheets: Array<{ name: string; rows: Record<string, unknown>[] }>,
) {
  if (!sheets.length || sheets.every(s => !s.rows.length)) return;

  const enc = new TextEncoder();

  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  const cellXml = (v: unknown, col: number, row: number): string => {
    const addr = (col < 26
      ? String.fromCharCode(65 + col)
      : String.fromCharCode(64 + Math.floor(col / 26)) + String.fromCharCode(65 + (col % 26))) + row;
    if (typeof v === 'number' && !isNaN(v)) return `<c r="${addr}" t="n"><v>${v}</v></c>`;
    return `<c r="${addr}" t="inlineStr"><is><t>${escape(v)}</t></is></c>`;
  };

  const buildSheet = (rows: Record<string, unknown>[]): string => {
    if (!rows.length) return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>`;
    const headers = Object.keys(rows[0]);
    let sheetRows = `<row r="1">${headers.map((h, c) => cellXml(h, c, 1)).join('')}</row>`;
    rows.forEach((row, ri) => {
      const r = ri + 2;
      sheetRows += `<row r="${r}">${headers.map((h, c) => cellXml(row[h], c, r)).join('')}</row>`;
    });
    return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
  };

  const sheetXmls = sheets.map(s => buildSheet(s.rows));

  const sheetsEl = sheets.map((s, i) =>
    `<sheet name="${escape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
  ).join('');
  const workbook = `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetsEl}</sheets></workbook>`;

  const wbRelsRels = sheets.map((_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  ).join('');
  const wbRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wbRelsRels}</Relationships>`;

  const pkgRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const sheetOverrides = sheets.map((_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('');
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetOverrides}</Types>`;

  const files: Array<{ name: string; bytes: number[] }> = [
    { name: '[Content_Types].xml',        bytes: Array.from(enc.encode(contentTypes)) },
    { name: '_rels/.rels',                bytes: Array.from(enc.encode(pkgRels)) },
    { name: 'xl/workbook.xml',            bytes: Array.from(enc.encode(workbook)) },
    { name: 'xl/_rels/workbook.xml.rels', bytes: Array.from(enc.encode(wbRels)) },
    ...sheetXmls.map((xml, i) => ({
      name:  `xl/worksheets/sheet${i + 1}.xml`,
      bytes: Array.from(enc.encode(xml)),
    })),
  ];

  _writeZip(filename, files);
}

function _writeZip(filename: string, files: Array<{ name: string; bytes: number[] }>) {
  const enc = new TextEncoder();

  const crc32 = (buf: number[]): number => {
    const table: number[] = [];
    for (let i = 0; i < 256; i++) {
      let v = i;
      for (let j = 0; j < 8; j++) v = (v & 1) ? (0xEDB88320 ^ (v >>> 1)) : (v >>> 1);
      table[i] = v;
    }
    let c = 0xFFFFFFFF;
    for (const b of buf) c = table[(c ^ b) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };
  const u16 = (n: number): number[] => [n & 0xFF, (n >> 8) & 0xFF];
  const u32 = (n: number): number[] => [n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >> 24) & 0xFF];

  const parts: number[] = [];
  const central: number[] = [];
  let offset = 0;

  for (const { name, bytes } of files) {
    const nameBytes = Array.from(enc.encode(name));
    const crc = crc32(bytes);
    const size = bytes.length;
    const local = [
      0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ...u32(crc), ...u32(size), ...u32(size), ...u16(nameBytes.length), 0x00, 0x00, ...nameBytes,
    ];
    const cd = [
      0x50, 0x4B, 0x01, 0x02, 0x14, 0x00, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ...u32(crc), ...u32(size), ...u32(size), ...u16(nameBytes.length),
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ...u32(offset), ...nameBytes,
    ];
    parts.push(...local, ...bytes);
    central.push(...cd);
    offset += local.length + size;
  }

  const cdSize = central.length;
  const eocd = [
    0x50, 0x4B, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00,
    ...u16(files.length), ...u16(files.length),
    ...u32(cdSize), ...u32(offset), 0x00, 0x00,
  ];

  const blob = new Blob([new Uint8Array([...parts, ...central, ...eocd])], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}

export function exportToExcel(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);

  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  const cellXml = (v: unknown, col: number, row: number): string => {
    const addr = String.fromCharCode(65 + col) + row;
    if (typeof v === 'number' && !isNaN(v)) {
      return `<c r="${addr}" t="n"><v>${v}</v></c>`;
    }
    return `<c r="${addr}" t="inlineStr"><is><t>${escape(v)}</t></is></c>`;
  };

  let sheetRows = '';
  sheetRows += `<row r="1">${headers.map((h, c) => cellXml(h, c, 1)).join('')}</row>`;
  rows.forEach((row, ri) => {
    const r = ri + 2;
    sheetRows += `<row r="${r}">${headers.map((h, c) => cellXml(row[h], c, r)).join('')}</row>`;
  });

  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Datos" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  const pkgRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

  const enc = new TextEncoder();
  const files: Array<{ name: string; bytes: number[] }> = [
    { name: '[Content_Types].xml', bytes: Array.from(enc.encode(contentTypes)) },
    { name: '_rels/.rels',         bytes: Array.from(enc.encode(pkgRels)) },
    { name: 'xl/workbook.xml',     bytes: Array.from(enc.encode(workbook)) },
    { name: 'xl/_rels/workbook.xml.rels', bytes: Array.from(enc.encode(wbRels)) },
    { name: 'xl/worksheets/sheet1.xml',  bytes: Array.from(enc.encode(sheet)) },
  ];

  const crc32 = (buf: number[]): number => {
    const table: number[] = [];
    for (let i = 0; i < 256; i++) {
      let v = i;
      for (let j = 0; j < 8; j++) v = (v & 1) ? (0xEDB88320 ^ (v >>> 1)) : (v >>> 1);
      table[i] = v;
    }
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };

  const u16 = (n: number): number[] => [n & 0xFF, (n >> 8) & 0xFF];
  const u32 = (n: number): number[] => [n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >> 24) & 0xFF];

  const parts: number[] = [];
  const central: number[] = [];
  let offset = 0;

  for (const { name, bytes } of files) {
    const nameBytes = Array.from(enc.encode(name));
    const crc = crc32(bytes);
    const size = bytes.length;

    const local = [
      0x50, 0x4B, 0x03, 0x04,
      0x14, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      ...u32(crc), ...u32(size), ...u32(size),
      ...u16(nameBytes.length), 0x00, 0x00,
      ...nameBytes,
    ];
    const cd = [
      0x50, 0x4B, 0x01, 0x02,
      0x14, 0x00, 0x14, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ...u32(crc), ...u32(size), ...u32(size),
      ...u16(nameBytes.length),
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ...u32(offset),
      ...nameBytes,
    ];

    for (let i = 0; i < local.length; i++) parts.push(local[i]);
    for (let i = 0; i < bytes.length; i++) parts.push(bytes[i]);
    for (let i = 0; i < cd.length; i++) central.push(cd[i]);
    offset += local.length + size;
  }

  const cdSize = central.length;
  const eocd = [
    0x50, 0x4B, 0x05, 0x06,
    0x00, 0x00, 0x00, 0x00,
    ...u16(files.length), ...u16(files.length),
    ...u32(cdSize), ...u32(offset),
    0x00, 0x00,
  ];

  const all: number[] = [];
  for (let i = 0; i < parts.length; i++) all.push(parts[i]);
  for (let i = 0; i < central.length; i++) all.push(central[i]);
  for (let i = 0; i < eocd.length; i++) all.push(eocd[i]);

  const blob = new Blob([new Uint8Array(all)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
