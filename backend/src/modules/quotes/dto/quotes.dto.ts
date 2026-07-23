import {
  IsString, IsDateString, IsArray, IsOptional,
  IsUUID, IsNumber, Min, IsIn, Matches,
  ValidateNested, ArrayMinSize, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// Tasas de IVA válidas en Costa Rica (idénticas a invoices.dto).
const VALID_TAX_RATES = [0, 1, 2, 4, 8, 13];

/** Línea de cotización — mismos campos/validaciones que CreateInvoiceLineDto,
 *  porque al convertir se mapea 1:1 a las líneas de la factura real. */
export class CreateQuoteLineDto {
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

/** Crear una cotización (DRAFT). No afecta el Diario ni el inventario. */
export class CreateQuoteDto {
  @IsUUID('4', { message: 'clientId debe ser un UUID válido' })
  clientId: string;

  @IsDateString({}, { message: 'issueDate debe ser una fecha válida (YYYY-MM-DD)' })
  issueDate: string;

  @IsDateString({}, { message: 'validUntil debe ser una fecha válida (YYYY-MM-DD)' })
  validUntil: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsIn(['CRC', 'USD'], { message: 'currency debe ser CRC o USD' })
  currency?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  exchangeRate?: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'La cotización debe tener al menos una línea' })
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteLineDto)
  lines: CreateQuoteLineDto[];
}

/** Editar una cotización mientras está en DRAFT — mismos campos que create. */
export class UpdateQuoteDto {
  @IsOptional()
  @IsUUID('4')
  clientId?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsIn(['CRC', 'USD'])
  currency?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  exchangeRate?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'La cotización debe tener al menos una línea' })
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteLineDto)
  lines?: CreateQuoteLineDto[];
}
