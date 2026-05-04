import {
  IsString, IsDateString, IsArray, IsOptional,
  IsUUID, IsNumber, Min, Max, IsInt, IsIn, Matches,
  ValidateNested, ArrayMinSize, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

const VALID_TAX_RATES = [0, 1, 2, 4, 8, 13];

export class CreateInvoiceLineDto {
  @IsOptional()
  @IsUUID('4')
  productId?: string;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001, { message: 'La cantidad debe ser mayor a cero' })
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'El precio unitario no puede ser negativo' })
  unitPrice: number;

  @IsIn(VALID_TAX_RATES, {
    message: `taxRate debe ser una tasa válida CR: ${VALID_TAX_RATES.join(', ')}`,
  })
  taxRate: number;

  @Matches(/^\d{13}$/, {
    message: 'cabysCode debe tener exactamente 13 dígitos (código CABYS de Hacienda CR)',
  })
  cabysCode: string;
}

export class CreateInvoiceDto {
  @IsUUID('4', { message: 'clientId debe ser un UUID válido' })
  clientId: string;

  @IsDateString({}, { message: 'issueDate debe ser una fecha válida (YYYY-MM-DD)' })
  issueDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  // Moneda y tipo de cambio — el frontend permite emitir en CRC o USD.
  // Si es USD, exchangeRate es el valor en colones que vale 1 dólar al
  // momento de la emisión (lo trae de `/hacienda/exchange-rate`).
  @IsOptional()
  @IsIn(['CRC', 'USD'], { message: 'currency debe ser CRC o USD' })
  currency?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  exchangeRate?: number;

  // Condición de venta — CASH (contado, debita Caja) o CREDIT (a crédito,
  // debita Cuentas por Cobrar y genera AR record).
  @IsOptional()
  @IsIn(['CASH', 'CREDIT'])
  saleCondition?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'La factura debe tener al menos una línea' })
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineDto)
  lines: CreateInvoiceLineDto[];
}

export class IssueInvoiceDto {
  // No additional fields required — issuing uses existing draft data
  // Optional override for issue date
  @IsOptional()
  @IsDateString()
  issueDate?: string;
}

export class InvoiceFilterDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ISSUED'])
  status?: string;

  @IsOptional()
  @IsIn(['PENDING', 'ACCEPTED', 'REJECTED'])
  haciendaStatus?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
