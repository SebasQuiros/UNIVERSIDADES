import {
  IsString, IsOptional, IsUUID, IsNumber, IsBoolean,
  IsIn, IsDateString, Min, MaxLength,
} from 'class-validator';

// Tasas de IVA válidas en Costa Rica. Se repite la lista (y no se importa de
// invoices) para que el DTO falle en el borde, ANTES de crear la programación:
// una recurrente con tasa inválida solo reventaría meses después, al generar.
const VALID_TAX_RATES = [0, 1, 2, 4, 8, 13];

// Debe coincidir con enum RecurrenceFrequency del schema Prisma.
export const FRECUENCIAS = [
  'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY',
  'QUARTERLY', 'SEMIANNUAL', 'ANNUAL',
] as const;

export class CreateRecurringInvoiceDto {
  @IsUUID('4', { message: 'clientId debe ser un UUID válido' })
  clientId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  // Monto SIN impuesto: el IVA se calcula al generar la factura real, para que
  // un cambio de tarifa no obligue a reescribir la programación.
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'El monto debe ser mayor a cero' })
  amount: number;

  @IsOptional()
  @IsIn(VALID_TAX_RATES, {
    message: `taxRate debe ser una tasa válida CR: ${VALID_TAX_RATES.join(', ')}`,
  })
  taxRate?: number;

  @IsIn(FRECUENCIAS as unknown as string[])
  frequency: string;

  @IsDateString({}, { message: 'nextRunAt debe ser una fecha válida (YYYY-MM-DD)' })
  nextRunAt: string;
}

export class UpdateRecurringInvoiceDto {
  @IsOptional()
  @IsUUID('4')
  clientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsIn(VALID_TAX_RATES)
  taxRate?: number;

  @IsOptional()
  @IsIn(FRECUENCIAS as unknown as string[])
  frequency?: string;

  @IsOptional()
  @IsDateString()
  nextRunAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ToggleRecurringInvoiceDto {
  @IsBoolean()
  isActive: boolean;
}
