import {
  IsEnum, IsString, IsOptional, IsNumber, IsIn, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaxDeclarationType } from '@prisma/client';

// ── Tax attachment ────────────────────────────────────────────────────────────
// Max 2 MB base64 ≈ 2 * 1_048_576 * (4/3) ≈ 2_796_202 chars
const MAX_ATTACHMENT_B64 = 2_796_202;
const ALLOWED_MIME_TYPES = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
];

export class AddAttachmentDto {
  @IsString()
  @MaxLength(100)
  lineKey: string;

  @IsString()
  @MaxLength(200)
  lineLabel: string;

  @IsString()
  @MaxLength(255)
  fileName: string;

  @IsIn(ALLOWED_MIME_TYPES, {
    message: `mimeType must be one of: ${ALLOWED_MIME_TYPES.join(', ')}`,
  })
  mimeType: string;

  @IsString()
  @MaxLength(MAX_ATTACHMENT_B64, {
    message: 'El archivo excede el límite de 2 MB',
  })
  fileData: string;          // base64-encoded content
}

// ── Calculate (real-time, no DB write) ────────────────────────────────────────
const ALLOWED_TAX_TYPES = ['D104', 'D101'] as const;

export class CalculateTaxDto {
  @IsIn(ALLOWED_TAX_TYPES, {
    message: `type must be one of: ${ALLOWED_TAX_TYPES.join(', ')}`,
  })
  type: string;

  @IsOptional()
  formData?: Record<string, number>;
}

// ── D-104 IVA ─────────────────────────────────────────────────────

export class D104FormDto {
  // Sección I – Ventas (base imponible por tarifa)
  @IsOptional() @IsNumber() ventas13?: number;
  @IsOptional() @IsNumber() ventas8?: number;
  @IsOptional() @IsNumber() ventas4?: number;
  @IsOptional() @IsNumber() ventas2?: number;
  @IsOptional() @IsNumber() ventas1?: number;
  @IsOptional() @IsNumber() ventasExentas?: number;

  // Sección II – Compras (base imponible por tarifa)
  @IsOptional() @IsNumber() compras13?: number;
  @IsOptional() @IsNumber() compras8?: number;
  @IsOptional() @IsNumber() compras4?: number;
  @IsOptional() @IsNumber() compras2?: number;
  @IsOptional() @IsNumber() compras1?: number;
}

// ── D-101 Renta ───────────────────────────────────────────────────

export class D101FormDto {
  // Sección I – Ingresos
  @IsOptional() @IsNumber() ingresosBrutos?: number;
  @IsOptional() @IsNumber() ingresosExentos?: number;

  // Sección II – Gastos deducibles
  @IsOptional() @IsNumber() gastosSueldos?: number;
  @IsOptional() @IsNumber() gastosCargas?: number;
  @IsOptional() @IsNumber() gastosAlquileres?: number;
  @IsOptional() @IsNumber() gastosServicios?: number;
  @IsOptional() @IsNumber() gastosDepreciacion?: number;
  @IsOptional() @IsNumber() gastosPublicidad?: number;
  @IsOptional() @IsNumber() gastosSerPublicos?: number;
  @IsOptional() @IsNumber() gastosRepresentacion?: number;
  @IsOptional() @IsNumber() gastosOtros?: number;

  // Sección V – Créditos y retenciones
  @IsOptional() @IsNumber() retencionesSource?: number;
  @IsOptional() @IsNumber() pagosParciales?: number;
}

// ── DTO genérico ──────────────────────────────────────────────────

export class CreateTaxDeclarationDto {
  @IsEnum(TaxDeclarationType)
  type: TaxDeclarationType;

  @IsString()
  period: string; // "2026-03" o "2025-2026"

  @IsOptional()
  formData?: D104FormDto | D101FormDto;
}

export class SubmitTaxDeclarationDto {
  @IsOptional()
  formData?: D104FormDto | D101FormDto;
}

// ── D-104 automático desde datos de empresa ───────────────────────────────────

export class CalculateD104FromCompanyDto {
  @IsString()
  companyId: string;

  @IsNumber()
  @Min(1)
  month: number;

  @IsNumber()
  @Min(2020)
  year: number;
}

// ── D-101 Calculated (company-linked) ────────────────────────────────────────

export class CalculateD101Dto {
  @IsNumber()
  @Min(2000)
  fiscalYear: number;
}

// ── Pagos Parciales ───────────────────────────────────────────────────────────

export class SchedulePartialPaymentsDto {
  @IsNumber()
  @Min(2000)
  fiscalYear: number;

  @IsNumber()
  @Min(0)
  estimatedTax: number;
}

export class MarkPartialPaymentPaidDto {
  @IsString()
  paidDate: string; // ISO date string
}

// ── Retenciones en la Fuente ─────────────────────────────────────────────────

const RETENCION_TYPES = [
  'SERVICIOS_PROFESIONALES',
  'ALQUILER',
  'DIVIDENDOS',
  'TRANSPORTE',
] as const;

export class CreateRetencionDto {
  @IsIn(RETENCION_TYPES, {
    message: `type must be one of: ${RETENCION_TYPES.join(', ')}`,
  })
  type: string;

  @IsString()
  @MaxLength(200)
  supplierName: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  supplierCedula?: string;

  @IsNumber()
  @Min(0)
  grossAmount: number;

  @IsString()
  date: string; // ISO date string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
