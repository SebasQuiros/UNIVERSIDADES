/**
 * hacienda-xml.service.spec.ts
 * Pruebas unitarias para HaciendaXmlService
 * Cubre: generateClave, generateNumeroConsecutivo, getTaxCode, generateInvoiceXml
 */

import { HaciendaXmlService } from './hacienda-xml.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('HaciendaXmlService', () => {
  let service: HaciendaXmlService;

  beforeEach(() => {
    service = new HaciendaXmlService();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // generateClave
  // ─────────────────────────────────────────────────────────────────────────
  describe('generateClave', () => {
    // Construir la fecha en hora local (no UTC) para evitar drift de timezone
    const baseDate = new Date(2026, 3, 15); // mes 3 = abril (0-indexed)
    const baseParams = {
      date: baseDate,
      cedula: '3101234567',
      consecutivo: '00100100001000000001',
      situacion: '1' as const,
      security: '12345678',
    };

    it('debe generar exactamente 50 caracteres', () => {
      const clave = service.generateClave(baseParams);
      expect(clave).toHaveLength(50);
    });

    it('debe comenzar con 506 (código de país Costa Rica)', () => {
      const clave = service.generateClave(baseParams);
      expect(clave.substring(0, 3)).toBe('506');
    });

    it('debe incrustar la fecha en formato DDMMYY en las posiciones 3-8', () => {
      // date = 15 de abril 2026 → DDMMYY = 150426
      const clave = service.generateClave(baseParams);
      expect(clave.substring(3, 9)).toBe('150426');
    });

    it('debe rellenar la cédula a 12 dígitos con ceros a la izquierda', () => {
      // cedula '3101234567' → 10 dígitos → pad → '003101234567'
      const clave = service.generateClave(baseParams);
      const cedula12 = clave.substring(9, 21);
      expect(cedula12).toBe('003101234567');
      expect(cedula12).toHaveLength(12);
    });

    it('debe incrustar el tipo de documento en las posiciones correctas (via consecutivo)', () => {
      // consecutivo fijo: 00100100001000000001 (20 dígitos)
      const clave = service.generateClave(baseParams);
      // El consecutivo va en posición 21-40 (índices 21..40)
      expect(clave.substring(21, 41)).toBe('00100100001000000001');
    });

    it('debe usar situación 1 (normal) por defecto cuando no se provee', () => {
      const params = { ...baseParams };
      delete (params as any).situacion;
      const clave = service.generateClave(params);
      // situacion está en la posición 41 (índice 41)
      expect(clave[41]).toBe('1');
    });

    it('debe colocar el código de seguridad de 8 dígitos al final', () => {
      const clave = service.generateClave(baseParams);
      // security = '12345678', últimos 8 caracteres (índices 42-49)
      expect(clave.substring(42, 50)).toBe('12345678');
    });

    it('debe generar un código de seguridad aleatorio de 8 dígitos si no se provee', () => {
      const params = { ...baseParams };
      delete (params as any).security;
      const clave = service.generateClave(params);
      const security = clave.substring(42, 50);
      expect(security).toHaveLength(8);
      expect(/^\d{8}$/.test(security)).toBe(true);
    });

    it('debe aceptar cédula con guiones y convertirla solo a dígitos', () => {
      const params = { ...baseParams, cedula: '3-101-234567' };
      const clave = service.generateClave(params);
      expect(clave.substring(9, 21)).toBe('003101234567');
    });

    it('debe aceptar situación 2 (contingencia)', () => {
      const params = { ...baseParams, situacion: '2' as const };
      const clave = service.generateClave(params);
      expect(clave[41]).toBe('2');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // generateNumeroConsecutivo
  // ─────────────────────────────────────────────────────────────────────────
  describe('generateNumeroConsecutivo', () => {
    it('debe generar exactamente 20 caracteres', () => {
      const consecutivo = service.generateNumeroConsecutivo({ tipo: '01', numero: 1 });
      expect(consecutivo).toHaveLength(20);
    });

    it('debe usar sucursal 001 por defecto', () => {
      const consecutivo = service.generateNumeroConsecutivo({ tipo: '01', numero: 1 });
      expect(consecutivo.substring(0, 3)).toBe('001');
    });

    it('debe usar terminal 00001 por defecto', () => {
      const consecutivo = service.generateNumeroConsecutivo({ tipo: '01', numero: 1 });
      expect(consecutivo.substring(3, 8)).toBe('00001');
    });

    it('debe incluir el tipo de documento en las posiciones 8-9', () => {
      const consecutivo = service.generateNumeroConsecutivo({ tipo: '01', numero: 1 });
      expect(consecutivo.substring(8, 10)).toBe('01');
    });

    it('debe rellenar el número secuencial a 10 dígitos con ceros', () => {
      const consecutivo = service.generateNumeroConsecutivo({ tipo: '01', numero: 1 });
      expect(consecutivo.substring(10, 20)).toBe('0000000001');
    });

    it('debe formatear número secuencial 999 correctamente', () => {
      const consecutivo = service.generateNumeroConsecutivo({ tipo: '01', numero: 999 });
      expect(consecutivo.substring(10, 20)).toBe('0000000999');
    });

    it('debe respetar sucursal y terminal personalizados', () => {
      const consecutivo = service.generateNumeroConsecutivo({
        sucursal: '002',
        terminal: '00003',
        tipo: '02',
        numero: 42,
      });
      expect(consecutivo.substring(0, 3)).toBe('002');
      expect(consecutivo.substring(3, 8)).toBe('00003');
      expect(consecutivo.substring(8, 10)).toBe('02');
      expect(consecutivo.substring(10, 20)).toBe('0000000042');
    });

    it('debe truncar sucursal a 3 dígitos si se provee más', () => {
      const consecutivo = service.generateNumeroConsecutivo({
        sucursal: '12345',
        tipo: '01',
        numero: 1,
      });
      expect(consecutivo.substring(0, 3)).toBe('123');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getTaxCode
  // ─────────────────────────────────────────────────────────────────────────
  describe('getTaxCode', () => {
    it('debe mapear tasa 13 al código 08 (tarifa general IVA)', () => {
      expect(service.getTaxCode(13)).toBe('08');
    });

    it('debe mapear tasa 8 al código 07 (transitorio 8%)', () => {
      expect(service.getTaxCode(8)).toBe('07');
    });

    it('debe mapear tasa 4 al código 04 (tarifa reducida 4%)', () => {
      expect(service.getTaxCode(4)).toBe('04');
    });

    it('debe mapear tasa 2 al código 03 (tarifa reducida 2%)', () => {
      expect(service.getTaxCode(2)).toBe('03');
    });

    it('debe mapear tasa 1 al código 02 (tarifa reducida 1%)', () => {
      expect(service.getTaxCode(1)).toBe('02');
    });

    it('debe mapear tasa 0 al código 01 (exento)', () => {
      expect(service.getTaxCode(0)).toBe('01');
    });

    it('debe devolver 08 (tarifa general) para tasas desconocidas', () => {
      // El mapa de la implementación devuelve '08' por defecto (?? '08')
      expect(service.getTaxCode(99)).toBe('08');
      expect(service.getTaxCode(5)).toBe('08');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // generateInvoiceXml
  // ─────────────────────────────────────────────────────────────────────────
  describe('generateInvoiceXml', () => {
    const buildData = (overrides = {}) => ({
      clave: '50615042600310123456700100100001000000010112345678',
      consecutiveNumber: '00100100001000000001',
      issueDate: new Date('2026-04-15T12:00:00Z'),
      issuer: {
        name: 'Empresa Demo S.A.',
        legalId: '3101234567',
        legalIdType: '02',
        economicActivity: '620100',
        email: 'demo@empresa.cr',
      },
      receiver: {
        name: 'Cliente Test S.A.',
        identification: '3102345678',
        idType: '02',
        email: 'cliente@test.cr',
      },
      lines: [
        {
          lineNo: 1,
          cabysCode: '4321012345678',
          description: 'Servicio de consultoría',
          quantity: new Decimal('1.000'),
          unit: 'Sp',
          unitPrice: new Decimal('100000.00'),
          subtotal: new Decimal('100000.00'),
          taxRate: new Decimal('13'),
          taxAmount: new Decimal('13000.00'),
          total: new Decimal('113000.00'),
        },
      ],
      subtotal: new Decimal('100000.00'),
      tax: new Decimal('13000.00'),
      total: new Decimal('113000.00'),
      ...overrides,
    });

    it('debe incluir el namespace XML correcto de Hacienda v4.4', () => {
      const xml = service.generateInvoiceXml(buildData() as any);
      expect(xml).toContain(
        'xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica"',
      );
    });

    it('debe formatear todos los montos con exactamente 2 decimales', () => {
      const xml = service.generateInvoiceXml(buildData() as any);
      // Verifica que montos clave tengan exactamente 2 decimales
      expect(xml).toContain('<TotalComprobante>113000.00</TotalComprobante>');
      expect(xml).toContain('<TotalImpuesto>13000.00</TotalImpuesto>');
      expect(xml).toContain('<TotalVentaNeta>100000.00</TotalVentaNeta>');
    });

    it('debe incluir la zona horaria de Costa Rica (-06:00) en la fecha de emisión', () => {
      const xml = service.generateInvoiceXml(buildData() as any);
      // La fecha debe terminar en -06:00
      expect(xml).toMatch(/<FechaEmision>.*-06:00<\/FechaEmision>/);
    });

    it('debe incluir el código CABYS en el elemento LineaDetalle', () => {
      const xml = service.generateInvoiceXml(buildData() as any);
      expect(xml).toContain('<Codigo>4321012345678</Codigo>');
    });

    it('debe calcular TotalComprobante = TotalVentaNeta + TotalImpuesto', () => {
      const xml = service.generateInvoiceXml(buildData() as any);
      // subtotal=100000, tax=13000, descuento=0
      // TotalVentaNeta = 100000.00, TotalImpuesto = 13000.00
      // TotalComprobante = 113000.00
      expect(xml).toContain('<TotalComprobante>113000.00</TotalComprobante>');
    });

    it('debe clasificar líneas con tasa > 0 como TotalMercanciasGravadas', () => {
      const xml = service.generateInvoiceXml(buildData() as any);
      expect(xml).toContain('<TotalMercanciasGravadas>100000.00</TotalMercanciasGravadas>');
      expect(xml).toContain('<TotalMercanciasExentas>0.00</TotalMercanciasExentas>');
    });

    it('debe clasificar líneas con tasa 0 como TotalMercanciasExentas', () => {
      const data = buildData({
        lines: [
          {
            lineNo: 1,
            cabysCode: '4321012345678',
            description: 'Producto exento',
            quantity: new Decimal('1.000'),
            unit: 'Unid',
            unitPrice: new Decimal('50000.00'),
            subtotal: new Decimal('50000.00'),
            taxRate: new Decimal('0'),
            taxAmount: new Decimal('0.00'),
            total: new Decimal('50000.00'),
          },
        ],
        subtotal: new Decimal('50000.00'),
        tax: new Decimal('0.00'),
        total: new Decimal('50000.00'),
      });
      const xml = service.generateInvoiceXml(data as any);
      expect(xml).toContain('<TotalMercanciasExentas>50000.00</TotalMercanciasExentas>');
      expect(xml).toContain('<TotalMercanciasGravadas>0.00</TotalMercanciasGravadas>');
    });

    it('debe aplicar el descuento correctamente en TotalVentaNeta', () => {
      const data = buildData({
        discount: new Decimal('5000.00'),
      });
      const xml = service.generateInvoiceXml(data as any);
      // TotalVenta=100000, descuento=5000, TotalVentaNeta=95000
      expect(xml).toContain('<TotalVentaNeta>95000.00</TotalVentaNeta>');
      expect(xml).toContain('<TotalDescuentos>5000.00</TotalDescuentos>');
    });

    it('debe incluir el nombre del emisor en el XML', () => {
      const xml = service.generateInvoiceXml(buildData() as any);
      expect(xml).toContain('<Nombre>Empresa Demo S.A.</Nombre>');
    });

    it('debe incluir el número consecutivo en el XML', () => {
      const xml = service.generateInvoiceXml(buildData() as any);
      expect(xml).toContain('<NumeroConsecutivo>00100100001000000001</NumeroConsecutivo>');
    });

    it('debe escapar correctamente caracteres especiales XML en el receptor', () => {
      const data = buildData({
        receiver: {
          name: 'Empresa & Hijos <S.A.>',
          identification: '3102345678',
          idType: '02',
        },
      });
      const xml = service.generateInvoiceXml(data as any);
      expect(xml).toContain('Empresa &amp; Hijos &lt;S.A.&gt;');
    });
  });
});
