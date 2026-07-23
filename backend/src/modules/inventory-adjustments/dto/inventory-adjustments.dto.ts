import {
  IsString, IsOptional, IsUUID, IsNumber, Min, IsIn, MaxLength,
} from 'class-validator';

export class CreateInventoryAdjustmentDto {
  @IsUUID('4', { message: 'productId debe ser un UUID válido' })
  productId: string;

  @IsIn(['INCREASE', 'DECREASE'], {
    message: 'type debe ser INCREASE o DECREASE',
  })
  type: 'INCREASE' | 'DECREASE';

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001, { message: 'La cantidad debe ser mayor a cero' })
  quantity: number;

  @IsString()
  @MaxLength(500)
  reason: string;

  /**
   * Costo unitario del movimiento. REQUERIDO en INCREASE (crea un lote FIFO
   * nuevo — no hay de dónde inferirlo). Ignorado en DECREASE: el costo real
   * lo determina el consumo FIFO de los lotes existentes.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost?: number;
}
