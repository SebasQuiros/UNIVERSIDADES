import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface HaciendaIssuer {
  name:             string;
  legalId:          string;
  legalIdType:      string;       // '01' física, '02' jurídica, '03' DIMEX, '04' NITE
  economicActivity: string;       // 6-digit CABYS activity code
  email:            string;
  address?:         string;
  province?:        string;       // '1'-'7'
  canton?:          string;
  district?:        string;
  phone?:           string;
}

export interface HaciendaReceiver {
  name:            string;
  identification?: string;
  idType?:         string;       // '01' física, '02' jurídica, '03' DIMEX, '04' NITE
  email?:          string;
}

export interface HaciendaLine {
  lineNo:      number;
  cabysCode:   string;
  description: string;
  quantity:    Decimal;
  unit:        string;
  unitPrice:   Decimal;
  subtotal:    Decimal;
  taxRate:     Decimal;
  taxAmount:   Decimal;
  total:       Decimal;
  discount?:   Decimal;
}

export interface HaciendaInvoiceData {
  clave:             string;
  consecutiveNumber: string;
  issueDate:         Date;
  issuer:            HaciendaIssuer;
  receiver:          HaciendaReceiver;
  saleCondition?:    string; // '01' contado, '02' crédito
  creditDays?:       number;
  paymentMethod?:    string; // '01' efectivo, '02' tarjeta, '04' transferencia
  currency?:         string; // default 'CRC'
  exchangeRate?:     Decimal;
  lines:             HaciendaLine[];
  subtotal:          Decimal;
  tax:               Decimal;
  total:             Decimal;
  discount?:         Decimal;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class HaciendaXmlService {

  // ── Public: Generate complete Hacienda v4.4 XML ──────────────────────────
  generateInvoiceXml(data: HaciendaInvoiceData): string {
    const dateStr      = this.costaRicaDateString(data.issueDate);
    const currency     = data.currency     ?? 'CRC';
    const exchangeRate = data.exchangeRate ?? new Decimal(1);
    const saleCondition = this.mapSaleCondition(data.saleCondition);
    const paymentMethod = this.mapPaymentMethod(data.paymentMethod);
    const discount      = data.discount ?? new Decimal(0);

    // Totals split by gravado/exento — services vs merchandise
    // For educational purposes we treat all lines as merchandise.
    // Gravado = taxRate > 0, Exento = taxRate === 0
    let totalMercGravadas = new Decimal(0);
    let totalMercExentas  = new Decimal(0);
    let totalServGravados = new Decimal(0);
    let totalServExentos  = new Decimal(0);

    for (const line of data.lines) {
      const taxR = Number(line.taxRate);
      if (taxR > 0) {
        totalMercGravadas = totalMercGravadas.plus(line.subtotal);
      } else {
        totalMercExentas = totalMercExentas.plus(line.subtotal);
      }
    }

    const totalGravado    = totalMercGravadas.plus(totalServGravados);
    const totalExento     = totalMercExentas.plus(totalServExentos);
    const totalVenta      = totalGravado.plus(totalExento);
    const totalVentaNeta  = totalVenta.minus(discount);
    const totalComprobante = totalVentaNeta.plus(data.tax);

    const linesXml = data.lines.map(line => this.generateLine(line)).join('\n');

    // Receiver section — optional for tiquete (type 04)
    const receiverXml = this.generateReceiver(data.receiver);

    // Credit section — only if credit
    const creditXml = saleCondition === '02' && data.creditDays
      ? `\n  <PlazoCredito>${data.creditDays}</PlazoCredito>`
      : '';

    // Ubicacion section
    const ubicacionXml = this.generateUbicacion(data.issuer);

    // Telefono section
    const telefonoXml = data.issuer.phone
      ? `\n    <Telefono>\n      <CodigoPais>506</CodigoPais>\n      <NumTelefono>${this.esc(data.issuer.phone.replace(/\D/g, ''))}</NumTelefono>\n    </Telefono>`
      : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<FacturaElectronica xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica.xsd">

  <Clave>${this.esc(data.clave)}</Clave>
  <CodigoActividad>${this.esc(data.issuer.economicActivity)}</CodigoActividad>
  <NumeroConsecutivo>${this.esc(data.consecutiveNumber)}</NumeroConsecutivo>
  <FechaEmision>${dateStr}</FechaEmision>

  <Emisor>
    <Nombre>${this.esc(data.issuer.name)}</Nombre>
    <Identificacion>
      <Tipo>${this.esc(data.issuer.legalIdType)}</Tipo>
      <Numero>${this.esc(data.issuer.legalId.replace(/\D/g, ''))}</Numero>
    </Identificacion>${data.issuer.name ? `\n    <NombreComercial>${this.esc(data.issuer.name)}</NombreComercial>` : ''}${ubicacionXml}${telefonoXml}
    <CorreoElectronico>${this.esc(data.issuer.email)}</CorreoElectronico>
  </Emisor>

${receiverXml}

  <CondicionVenta>${saleCondition}</CondicionVenta>${creditXml}
  <MedioPago>${paymentMethod}</MedioPago>

  <DetalleServicio>
${linesXml}
  </DetalleServicio>

  <ResumenFactura>
    <CodigoTipoMoneda>
      <CodigoMoneda>${this.esc(currency)}</CodigoMoneda>
      <TipoCambio>${exchangeRate.toFixed(2)}</TipoCambio>
    </CodigoTipoMoneda>
    <TotalServGravados>${totalServGravados.toFixed(2)}</TotalServGravados>
    <TotalServExentos>${totalServExentos.toFixed(2)}</TotalServExentos>
    <TotalMercanciasGravadas>${totalMercGravadas.toFixed(2)}</TotalMercanciasGravadas>
    <TotalMercanciasExentas>${totalMercExentas.toFixed(2)}</TotalMercanciasExentas>
    <TotalGravado>${totalGravado.toFixed(2)}</TotalGravado>
    <TotalExento>${totalExento.toFixed(2)}</TotalExento>
    <TotalVenta>${totalVenta.toFixed(2)}</TotalVenta>
    <TotalDescuentos>${discount.toFixed(2)}</TotalDescuentos>
    <TotalVentaNeta>${totalVentaNeta.toFixed(2)}</TotalVentaNeta>
    <TotalImpuesto>${data.tax.toFixed(2)}</TotalImpuesto>
    <TotalComprobante>${totalComprobante.toFixed(2)}</TotalComprobante>
  </ResumenFactura>

</FacturaElectronica>`;
  }

  // ── Public: Generate 50-digit clave ──────────────────────────────────────
  /**
   * Clave CR format (50 digits):
   *   506        → 3 digits  — country code Costa Rica
   *   DDMMYY     → 6 digits  — emission date
   *   cedula     → 12 digits — issuer tax ID, left-padded with zeros
   *   consecutivo → 20 digits — full NumeroConsecutivo
   *   situacion  → 1 digit   — 1=normal, 2=contingency, 3=no internet
   *   seguridad  → 8 digits  — random security code
   *   Total = 3+6+12+20+1+8 = 50
   */
  generateClave(params: {
    date:         Date;
    cedula:       string;
    consecutivo:  string;   // 20-digit NumeroConsecutivo
    situacion?:   '1' | '2' | '3';
    security?:    string;   // 8 digits, auto-generated if not provided
  }): string {
    const d       = params.date;
    const day     = String(d.getDate()).padStart(2, '0');
    const month   = String(d.getMonth() + 1).padStart(2, '0');
    const year    = String(d.getFullYear()).slice(2);

    const country    = '506';
    const dateStr    = `${day}${month}${year}`;
    // cedula: keep only digits, pad to 12
    const cedula     = params.cedula.replace(/\D/g, '').padStart(12, '0').slice(0, 12);
    const consecutivo = params.consecutivo.padStart(20, '0').slice(0, 20);
    const situacion  = params.situacion ?? '1';
    const security   = params.security
      ?? String(Math.floor(Math.random() * 99999999) + 1).padStart(8, '0');

    const clave = `${country}${dateStr}${cedula}${consecutivo}${situacion}${security}`;

    // Must be exactly 50 digits
    if (clave.length !== 50) {
      // Defensive: pad or truncate
      return clave.padEnd(50, '0').slice(0, 50);
    }
    return clave;
  }

  // ── Public: Generate 20-digit NumeroConsecutivo ───────────────────────────
  /**
   * Format: sucursal(3) + terminal(5) + tipo(2) + numero(10) = 20 digits
   * Example: 001 + 00001 + 01 + 0000000001 = 00100001010000000001
   */
  generateNumeroConsecutivo(params: {
    sucursal?: string;   // default '001'
    terminal?: string;   // default '00001'
    tipo:      string;   // '01', '02', etc.
    numero:    number;   // sequential number
  }): string {
    const sucursal = (params.sucursal ?? '001').padStart(3, '0').slice(0, 3);
    const terminal = (params.terminal ?? '00001').padStart(5, '0').slice(0, 5);
    const tipo     = params.tipo.padStart(2, '0').slice(0, 2);
    const numero   = String(params.numero).padStart(10, '0').slice(0, 10);
    return `${sucursal}${terminal}${tipo}${numero}`;
  }

  // ── Public: Convert internal tax rate to Hacienda IVA code ───────────────
  /**
   * Hacienda IVA codes:
   *   01 = Tarifa 0% (Exento)
   *   02 = Tarifa reducida 1%
   *   03 = Tarifa reducida 2%
   *   04 = Tarifa reducida 4%
   *   05 = Transitorio 0%
   *   06 = Transitorio 4%
   *   07 = Transitorio 8%
   *   08 = Tarifa general 13%
   */
  getTaxCode(rate: number): string {
    const map: Record<number, string> = {
      0:  '01',
      1:  '02',
      2:  '03',
      4:  '04',
      8:  '07',
      13: '08',
    };
    return map[rate] ?? '08';
  }

  // ── Public: Map unit string to Hacienda unit code ─────────────────────────
  getUnitCode(unit?: string): string {
    if (!unit) return 'Unid';
    const normalised = unit.toLowerCase().trim();
    const unitMap: Record<string, string> = {
      'unid':     'Unid',
      'unidad':   'Unid',
      'unidades': 'Unid',
      'sp':       'Sp',
      'servicio': 'Sp',
      'servicos': 'Sp',
      'service':  'Sp',
      'hr':       'h',
      'hora':     'h',
      'horas':    'h',
      'kg':       'kg',
      'kilogramo': 'kg',
      'kilogramos': 'kg',
      'g':        'g',
      'gramo':    'g',
      'l':        'l',
      'litro':    'l',
      'litros':   'l',
      'm':        'm',
      'metro':    'm',
      'm2':       'm²',
      'm3':       'm³',
      'cm':       'cm',
      'mm':       'mm',
      'caja':     'Caja',
      'paq':      'Paq',
      'paquete':  'Paq',
      'docena':   'Doc',
      'doc':      'Doc',
    };
    return unitMap[normalised] ?? unit;
  }

  // ── Private: Generate XML for one line ───────────────────────────────────
  private generateLine(line: HaciendaLine): string {
    const taxRateNum = Number(line.taxRate);
    const taxCode    = this.getTaxCode(taxRateNum);
    const unitCode   = this.getUnitCode(line.unit);
    const discount   = line.discount ?? new Decimal(0);

    const taxSection = taxRateNum > 0
      ? `
      <Impuesto>
        <Codigo>01</Codigo>
        <CodigoTarifa>${taxCode}</CodigoTarifa>
        <Tarifa>${line.taxRate.toFixed(2)}</Tarifa>
        <Monto>${line.taxAmount.toFixed(2)}</Monto>
      </Impuesto>
      <ImpuestoNeto>${line.taxAmount.toFixed(2)}</ImpuestoNeto>`
      : `
      <ImpuestoNeto>0.00</ImpuestoNeto>`;

    const discountSection = discount.greaterThan(0)
      ? `\n      <MontoDescuento>${discount.toFixed(2)}</MontoDescuento>\n      <NaturalezaDescuento>Descuento comercial</NaturalezaDescuento>`
      : '';

    return `    <LineaDetalle>
      <NumeroLinea>${line.lineNo}</NumeroLinea>
      <Codigo>
        <Tipo>04</Tipo>
        <Codigo>${this.esc(line.cabysCode)}</Codigo>
      </Codigo>
      <Cantidad>${line.quantity.toFixed(3)}</Cantidad>
      <UnidadMedida>${this.esc(unitCode)}</UnidadMedida>
      <Detalle>${this.esc(line.description.substring(0, 200))}</Detalle>
      <PrecioUnitario>${line.unitPrice.toFixed(2)}</PrecioUnitario>
      <MontoTotal>${line.subtotal.plus(discount).toFixed(2)}</MontoTotal>${discountSection}
      <SubTotal>${line.subtotal.toFixed(2)}</SubTotal>${taxSection}
      <MontoTotalLinea>${line.total.toFixed(2)}</MontoTotalLinea>
    </LineaDetalle>`;
  }

  // ── Private: Generate Receptor XML ───────────────────────────────────────
  private generateReceiver(receiver: HaciendaReceiver): string {
    const idSection = receiver.identification && receiver.idType
      ? `\n    <Identificacion>\n      <Tipo>${this.esc(receiver.idType)}</Tipo>\n      <Numero>${this.esc(receiver.identification.replace(/\D/g, ''))}</Numero>\n    </Identificacion>`
      : '';
    const emailSection = receiver.email
      ? `\n    <CorreoElectronico>${this.esc(receiver.email)}</CorreoElectronico>`
      : '';

    return `  <Receptor>
    <Nombre>${this.esc(receiver.name)}</Nombre>${idSection}${emailSection}
  </Receptor>`;
  }

  // ── Private: Generate Ubicacion XML ──────────────────────────────────────
  private generateUbicacion(issuer: HaciendaIssuer): string {
    const hasLocationData = issuer.province || issuer.canton || issuer.district || issuer.address;
    if (!hasLocationData) return '';

    const provinciaXml = issuer.province
      ? `\n      <Provincia>${this.esc(issuer.province)}</Provincia>`
      : '';
    const cantonXml = issuer.canton
      ? `\n      <Canton>${this.esc(issuer.canton)}</Canton>`
      : '';
    const distritoXml = issuer.district
      ? `\n      <Distrito>${this.esc(issuer.district)}</Distrito>`
      : '';
    const otrasXml = issuer.address
      ? `\n      <OtrasSenas>${this.esc(issuer.address)}</OtrasSenas>`
      : '';

    return `\n    <Ubicacion>${provinciaXml}${cantonXml}${distritoXml}${otrasXml}\n    </Ubicacion>`;
  }

  // ── Private: Map SaleCondition enum to Hacienda code ─────────────────────
  private mapSaleCondition(condition?: string): string {
    const map: Record<string, string> = {
      CASH:        '01',
      CREDIT:      '02',
      CONSIGNMENT: '03',
      APART:       '04',
      LEASE:       '05',
      OTHER:       '99',
      // Also accept raw codes
      '01': '01', '02': '02', '03': '03', '04': '04', '05': '05', '99': '99',
    };
    return map[condition ?? 'CASH'] ?? '01';
  }

  // ── Private: Map PaymentMethod enum to Hacienda code ─────────────────────
  private mapPaymentMethod(method?: string): string {
    const map: Record<string, string> = {
      CASH:     '01',
      CARD:     '02',
      CHECK:    '03',
      TRANSFER: '04',
      OTHER:    '99',
      // Also accept raw codes
      '01': '01', '02': '02', '03': '03', '04': '04', '99': '99',
    };
    return map[method ?? 'CASH'] ?? '01';
  }

  // ── Private: Format date in Costa Rica timezone (-06:00) ─────────────────
  private costaRicaDateString(date: Date): string {
    // Costa Rica is UTC-6, no DST
    const utcMs    = date.getTime();
    const crOffset = -6 * 60 * 60 * 1000;
    const crDate   = new Date(utcMs + crOffset);

    const yyyy = crDate.getUTCFullYear();
    const mm   = String(crDate.getUTCMonth() + 1).padStart(2, '0');
    const dd   = String(crDate.getUTCDate()).padStart(2, '0');
    const hh   = String(crDate.getUTCHours()).padStart(2, '0');
    const min  = String(crDate.getUTCMinutes()).padStart(2, '0');
    const ss   = String(crDate.getUTCSeconds()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}-06:00`;
  }

  // ── Private: XML escape ───────────────────────────────────────────────────
  private esc(value: string | undefined | null): string {
    if (!value) return '';
    return value
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&apos;');
  }
}
