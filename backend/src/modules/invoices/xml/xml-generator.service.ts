import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { HaciendaXmlService } from './hacienda-xml.service';

export interface XmlInvoiceData {
  clave:            string;
  consecutiveNumber: string;
  issueDate:        Date;
  issuer: {
    name:             string;
    legalId:          string;
    legalIdType:      string;
    economicActivity: string;
    email:            string;
    address?:         string;
    province?:        string;
    canton?:          string;
    district?:        string;
    phone?:           string;
  };
  receiver: {
    name:           string;
    identification: string;
    idType:         string;
    email?:         string;
  };
  saleCondition?:   string;
  creditDays?:      number;
  paymentMethod?:   string;
  currency?:        string;
  exchangeRate?:    Decimal;
  lines: Array<{
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
  }>;
  subtotal: Decimal;
  tax:      Decimal;
  total:    Decimal;
  discount?: Decimal;
}

/**
 * XmlGeneratorService — thin wrapper that delegates to HaciendaXmlService.
 *
 * Kept for backward compatibility with InvoicesService.xmlGen.generate(data).
 * All logic lives in HaciendaXmlService (v4.4).
 */
@Injectable()
export class XmlGeneratorService {

  constructor(private readonly haciendaXml: HaciendaXmlService) {}

  generate(data: XmlInvoiceData): string {
    return this.haciendaXml.generateInvoiceXml({
      clave:             data.clave,
      consecutiveNumber: data.consecutiveNumber,
      issueDate:         data.issueDate,
      issuer: {
        name:             data.issuer.name,
        legalId:          data.issuer.legalId,
        legalIdType:      data.issuer.legalIdType,
        economicActivity: data.issuer.economicActivity,
        email:            data.issuer.email,
        address:          data.issuer.address,
        province:         data.issuer.province,
        canton:           data.issuer.canton,
        district:         data.issuer.district,
        phone:            data.issuer.phone,
      },
      receiver: {
        name:           data.receiver.name,
        identification: data.receiver.identification,
        idType:         data.receiver.idType,
        email:          data.receiver.email,
      },
      saleCondition:  data.saleCondition,
      creditDays:     data.creditDays,
      paymentMethod:  data.paymentMethod,
      currency:       data.currency,
      exchangeRate:   data.exchangeRate,
      lines:          data.lines,
      subtotal:       data.subtotal,
      tax:            data.tax,
      total:          data.total,
      discount:       data.discount,
    });
  }
}
