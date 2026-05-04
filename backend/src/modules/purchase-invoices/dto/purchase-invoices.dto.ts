import {
  IsString, IsOptional, IsDateString, IsNumber,
  IsBoolean, IsIn, Min, MaxLength, IsUUID,
  IsArray, ValidateNested, ArrayMinSize,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// Valid IVA rates for Costa Rica
const VALID_TAX_RATES = [0, 0.01, 0.02, 0.04, 0.08, 0.13] as const;

/**
 * Línea de compra opcional (Fase 2).
 *
 * Si el cliente envía `lines`, cada línea con `productId` crea un lote FIFO
 * con esa cantidad y costo unitario. Si NO envía `lines`, la factura se
 * registra como "compra agregada" (servicios, gastos, etc.) sin tocar
 * inventario — comportamiento histórico preservado.
 */
export class PurchaseInvoiceLineDto {
  @IsUUID('4')
  productId!: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001, { message: 'quantity debe ser mayor a 0' })
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost!: number;
}

export class CreatePurchaseInvoiceDto {
  @IsString()
  @MaxLength(255)
  supplierName: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  supplierCedula?: string;

  @IsString()
  @MaxLength(100)
  invoiceNumber: string;

  @IsDateString({}, { message: 'date debe ser una fecha válida (YYYY-MM-DD)' })
  date: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsIn(VALID_TAX_RATES, {
    message: 'taxRate debe ser 0, 0.01, 0.02, 0.04, 0.08, o 0.13',
  })
  taxRate: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isAccepted?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseInvoiceLineDto)
  lines?: PurchaseInvoiceLineDto[];
}

export class PurchaseInvoiceFilterDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  limit?: number;
}
