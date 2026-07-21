import {
  IsString, IsDateString, IsArray, IsOptional,
  IsUUID, IsNumber, Min, IsIn, Matches, IsBoolean,
  ValidateNested, ArrayMinSize, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// Tasas de IVA válidas en Costa Rica (idénticas a invoices.dto).
const VALID_TAX_RATES = [0, 1, 2, 4, 8, 13];

/**
 * Línea de nota (crédito o débito). Mismos campos/validaciones que
 * CreateInvoiceLineDto — una nota describe montos que ajustan la factura
 * origen. `productId` solo es relevante para notas de crédito con devolución
 * de mercadería (restaura inventario); para el resto es opcional/decorativo.
 */
export class CreateNoteLineDto {
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

/**
 * Crear una NOTA DE CRÉDITO (DRAFT). Debe referenciar la factura origen
 * (misma empresa — validado en el service). `restoreInventory` indica si la
 * nota implica devolución de bienes (restaura stock + revierte COGS) o es un
 * simple descuento/ajuste (no toca inventario).
 */
export class CreateCreditNoteDto {
  @IsUUID('4', { message: 'invoiceId debe ser un UUID válido' })
  invoiceId: string;

  @IsDateString({}, { message: 'issueDate debe ser una fecha válida (YYYY-MM-DD)' })
  issueDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsBoolean()
  restoreInventory?: boolean;

  @IsArray()
  @ArrayMinSize(1, { message: 'La nota debe tener al menos una línea' })
  @ValidateNested({ each: true })
  @Type(() => CreateNoteLineDto)
  lines: CreateNoteLineDto[];
}

/**
 * Crear una NOTA DE DÉBITO (DRAFT). Referencia la factura origen (misma
 * empresa). Nunca toca inventario (por eso no hay restoreInventory).
 */
export class CreateDebitNoteDto {
  @IsUUID('4', { message: 'invoiceId debe ser un UUID válido' })
  invoiceId: string;

  @IsDateString({}, { message: 'issueDate debe ser una fecha válida (YYYY-MM-DD)' })
  issueDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'La nota debe tener al menos una línea' })
  @ValidateNested({ each: true })
  @Type(() => CreateNoteLineDto)
  lines: CreateNoteLineDto[];
}
