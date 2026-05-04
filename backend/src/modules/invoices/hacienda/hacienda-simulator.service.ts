import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

export interface HaciendaValidationResult {
  status:   'ACCEPTED' | 'REJECTED';
  message:  string;
  errors:   string[];
}

export interface HaciendaInvoiceData {
  clave:            string;
  consecutiveNumber: string;
  xml:              string;
  lines: Array<{
    lineNo:    number;
    cabysCode: string;
    taxRate:   Decimal;
    subtotal:  Decimal;
    taxAmount: Decimal;
    total:     Decimal;
  }>;
  subtotal: Decimal;
  tax:      Decimal;
  total:    Decimal;
}

const VALID_TAX_RATES = [0, 1, 2, 4, 8, 13];

@Injectable()
export class HaciendaSimulatorService {

  simulate(data: HaciendaInvoiceData): HaciendaValidationResult {
    const errors: string[] = [];

    // ── Validation 1: Clave (50 digits exactly) ───────────────
    if (!data.clave || !/^\d{50}$/.test(data.clave)) {
      errors.push(
        `Clave numérica inválida: "${data.clave}". ` +
        `Debe tener exactamente 50 dígitos numéricos.`,
      );
    }

    // ── Validation 2: Consecutive number format ───────────────
    if (!data.consecutiveNumber || data.consecutiveNumber.length !== 20) {
      errors.push(
        `Número consecutivo inválido. Debe tener 20 caracteres.`,
      );
    }

    // ── Validation 3: XML structure — required nodes ──────────
    const requiredNodes = [
      'Clave', 'NumeroConsecutivo', 'FechaEmision',
      'Emisor', 'Receptor', 'DetalleServicio',
      'ResumenFactura', 'TotalComprobante',
    ];
    for (const node of requiredNodes) {
      if (!data.xml.includes(`<${node}>`)) {
        errors.push(`El XML no contiene el nodo obligatorio <${node}>`);
      }
    }

    // ── Validation 4: Per-line CABYS and taxes ────────────────
    for (const line of data.lines) {
      // CABYS must be exactly 13 digits
      if (!line.cabysCode || !/^\d{13}$/.test(line.cabysCode)) {
        errors.push(
          `Línea ${line.lineNo}: Código CABYS "${line.cabysCode}" inválido. ` +
          `Debe ser exactamente 13 dígitos numéricos.`,
        );
      }

      // Tax rate must be a valid CR rate
      const taxRateNum = Number(line.taxRate);
      if (!VALID_TAX_RATES.includes(taxRateNum)) {
        errors.push(
          `Línea ${line.lineNo}: Tarifa de impuesto ${taxRateNum}% no válida en Costa Rica. ` +
          `Tasas permitidas: ${VALID_TAX_RATES.join('%, ')}%.`,
        );
      }

      // Tax amount must be mathematically correct
      const expectedTax = line.subtotal
        .times(new Decimal(line.taxRate.toString()))
        .dividedBy(new Decimal('100'))
        .toDecimalPlaces(2);

      const actualTax = line.taxAmount.toDecimalPlaces(2);
      const taxDiff   = expectedTax.minus(actualTax).abs();

      if (taxDiff.greaterThan(new Decimal('0.02'))) {
        errors.push(
          `Línea ${line.lineNo}: Monto de impuesto incorrecto. ` +
          `Esperado: ₡${expectedTax.toFixed(2)}, Declarado: ₡${actualTax.toFixed(2)}.`,
        );
      }
    }

    // ── Validation 5: Grand totals consistency ────────────────
    // Sum of line totals must match header totals
    const calcSubtotal = data.lines.reduce(
      (s, l) => s.plus(l.subtotal), new Decimal(0),
    ).toDecimalPlaces(2);

    const calcTax = data.lines.reduce(
      (s, l) => s.plus(l.taxAmount), new Decimal(0),
    ).toDecimalPlaces(2);

    const calcTotal = calcSubtotal.plus(calcTax).toDecimalPlaces(2);

    if (data.subtotal.toDecimalPlaces(2).minus(calcSubtotal).abs().greaterThan(new Decimal('0.02'))) {
      errors.push(
        `Subtotal del comprobante incorrecto. ` +
        `Calculado: ₡${calcSubtotal.toFixed(2)}, Declarado: ₡${data.subtotal.toFixed(2)}.`,
      );
    }

    if (data.tax.toDecimalPlaces(2).minus(calcTax).abs().greaterThan(new Decimal('0.02'))) {
      errors.push(
        `Total de impuestos incorrecto. ` +
        `Calculado: ₡${calcTax.toFixed(2)}, Declarado: ₡${data.tax.toFixed(2)}.`,
      );
    }

    if (data.total.toDecimalPlaces(2).minus(calcTotal).abs().greaterThan(new Decimal('0.02'))) {
      errors.push(
        `TotalComprobante incorrecto. ` +
        `Calculado: ₡${calcTotal.toFixed(2)}, Declarado: ₡${data.total.toFixed(2)}.`,
      );
    }

    // ── Validation 6: XML totals match data totals ────────────
    const xmlTotalMatch = data.xml.match(/<TotalComprobante>([\d.]+)<\/TotalComprobante>/);
    if (xmlTotalMatch) {
      const xmlTotal = new Decimal(xmlTotalMatch[1]).toDecimalPlaces(2);
      if (xmlTotal.minus(data.total.toDecimalPlaces(2)).abs().greaterThan(new Decimal('0.02'))) {
        errors.push(
          `TotalComprobante en el XML (${xmlTotal.toFixed(2)}) no coincide ` +
          `con el total calculado (${data.total.toFixed(2)}).`,
        );
      }
    }

    // ── Result ────────────────────────────────────────────────
    if (errors.length > 0) {
      return {
        status:  'REJECTED',
        message: `Comprobante rechazado por Hacienda (simulación educativa). ` +
                 `Se encontraron ${errors.length} error(es).`,
        errors,
      };
    }

    return {
      status:  'ACCEPTED',
      message: `Comprobante recibido y procesado correctamente. ` +
               `ind-estado: aceptado. Fecha: ${new Date().toISOString()}. ` +
               `[SIMULACIÓN EDUCATIVA — No se envió a Hacienda real]`,
      errors:  [],
    };
  }
}
