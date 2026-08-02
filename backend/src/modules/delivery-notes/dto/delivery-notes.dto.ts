import {
  IsString, IsOptional, IsArray, IsNumber, IsEnum, IsDateString,
  ValidateNested, ArrayMinSize, IsUUID, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DeliveryNoteStatus } from '@prisma/client';

/**
 * Línea de una remisión: solo producto + cantidad.
 * NO lleva precio a propósito: la remisión documenta la ENTREGA física,
 * el valor económico (y el asiento) aparece hasta que se factura.
 */
export class CreateDeliveryNoteLineDto {
  @IsUUID() productId: string;

  /** Opcional: si no viene, el service usa el nombre del producto. */
  @IsOptional() @IsString() description?: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001, { message: 'La cantidad debe ser mayor a cero' })
  quantity: number;
}

export class CreateDeliveryNoteDto {
  @IsUUID() clientId: string;

  /** ISO. Si no viene, el service usa la fecha de hoy. */
  @IsOptional() @IsDateString() date?: string;

  @IsOptional() @IsString() notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'La remisión necesita al menos una línea' })
  @ValidateNested({ each: true })
  @Type(() => CreateDeliveryNoteLineDto)
  lines: CreateDeliveryNoteLineDto[];
}

/**
 * Cambio de estado. Se valida contra la máquina de estados del service
 * (DRAFT → DISPATCHED → DELIVERED); CANCELLED tiene su propio endpoint.
 */
export class UpdateDeliveryNoteStatusDto {
  @IsEnum(DeliveryNoteStatus, { message: 'Estado de remisión inválido' })
  status: DeliveryNoteStatus;
}
