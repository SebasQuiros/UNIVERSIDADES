import {
  IsString, IsNumber, IsBoolean, IsOptional,
  IsUUID, Min, MaxLength, MinLength,
  IsIn, Matches,
} from 'class-validator';

const VALID_TAX_RATES = [0, 1, 2, 4, 8, 13];

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sku?: string;

  // CABYS code — exactly 13 digits, required for invoicing
  @Matches(/^\d{13}$/, {
    message: 'cabysCode debe tener exactamente 13 dígitos numéricos (código CABYS de Hacienda CR)',
  })
  cabysCode: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'El precio no puede ser negativo' })
  price: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cost?: number;

  @IsIn(VALID_TAX_RATES, {
    message: `taxRate debe ser una tasa válida de CR: ${VALID_TAX_RATES.join(', ')}`,
  })
  taxRate: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  minStock?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsBoolean()
  isService?: boolean;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Matches(/^\d{13}$/, {
    message: 'cabysCode debe tener exactamente 13 dígitos',
  })
  cabysCode?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsIn(VALID_TAX_RATES)
  taxRate?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  minStock?: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class AdjustStockDto {
  @IsNumber({ maxDecimalPlaces: 3 })
  quantity: number;

  @IsString()
  @MinLength(2)
  reason: string;
}
