import {
  IsString, IsOptional, IsNumber, IsBoolean, IsEnum,
  IsDateString, IsIn, Min, MaxLength,
} from 'class-validator';
import { RecurrenceFrequency } from '@prisma/client';

// Mismas tarifas válidas que el resto del sistema (IVA de Costa Rica).
// Se guardan como PORCENTAJE (13), no como fracción: así lo espera
// PurchaseInvoicesService cuando el pago se convierte en factura real.
const VALID_TAX_RATES = [0, 1, 2, 4, 8, 13] as const;

export class CreateRecurringPaymentDto {
  @IsString()
  @MaxLength(255)
  supplierName: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  // Monto SIN IVA (subtotal). El impuesto se calcula al generar la factura,
  // para que el estudiante vea el desglose igual que en una compra normal.
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsIn(VALID_TAX_RATES, { message: 'taxRate debe ser 0, 1, 2, 4, 8 o 13 (porcentaje)' })
  taxRate?: number;

  @IsEnum(RecurrenceFrequency, { message: 'frequency inválida' })
  frequency: RecurrenceFrequency;

  // Primera fecha en que toca pagar. De ahí en adelante la calcula el servicio.
  @IsDateString({}, { message: 'nextRunAt debe ser una fecha válida' })
  nextRunAt: string;
}

export class UpdateRecurringPaymentDto {
  @IsOptional() @IsString() @MaxLength(255)
  supplierName?: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  amount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsIn(VALID_TAX_RATES, { message: 'taxRate debe ser 0, 1, 2, 4, 8 o 13 (porcentaje)' })
  taxRate?: number;

  @IsOptional() @IsEnum(RecurrenceFrequency)
  frequency?: RecurrenceFrequency;

  @IsOptional() @IsDateString()
  nextRunAt?: string;
}

export class ToggleRecurringPaymentDto {
  // Pausar (false) o reactivar (true) sin borrar el historial de corridas.
  @IsBoolean()
  isActive: boolean;
}
