import {
  IsString, IsDateString, IsArray, IsOptional,
  IsUUID, IsNumber, Min, IsIn,
  ValidateNested, ArrayMinSize, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

const VALID_TAX_RATES = [0, 1, 2, 4, 8, 13];

/** Línea de orden de compra. */
export class CreatePurchaseOrderLineDto {
  @IsOptional()
  @IsUUID('4')
  productId?: string;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001, { message: 'La cantidad debe ser mayor a cero' })
  quantity: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'El costo unitario no puede ser negativo' })
  unitCost: number;

  @IsIn(VALID_TAX_RATES, {
    message: `taxRate debe ser una tasa válida CR: ${VALID_TAX_RATES.join(', ')}`,
  })
  taxRate: number;
}

/** Crear una orden de compra (DRAFT). Sin impacto en inventario ni Diario. */
export class CreatePurchaseOrderDto {
  @IsUUID('4', { message: 'supplierId debe ser un UUID válido' })
  supplierId: string;

  @IsDateString({}, { message: 'issueDate debe ser una fecha válida (YYYY-MM-DD)' })
  issueDate: string;

  @IsOptional()
  @IsDateString({}, { message: 'expectedDate debe ser una fecha válida (YYYY-MM-DD)' })
  expectedDate?: string;

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
  @ArrayMinSize(1, { message: 'La orden debe tener al menos una línea' })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderLineDto)
  lines: CreatePurchaseOrderLineDto[];
}

/** Editar una orden de compra mientras esté en DRAFT. */
export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsUUID('4')
  supplierId?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;

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
  @ArrayMinSize(1, { message: 'La orden debe tener al menos una línea' })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderLineDto)
  lines?: CreatePurchaseOrderLineDto[];
}
