import {
  IsUUID, IsNumber, IsIn, IsOptional, IsString, IsDateString, Min, MaxLength,
} from 'class-validator';

export class CreateTransferDto {
  @IsUUID('4')
  fromCompanyId: string;

  @IsUUID('4')
  toCompanyId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  /** Determina el asiento contable de cada lado. */
  @IsIn(['PRESTAMO', 'PAGO_DEUDA', 'ANTICIPO'])
  concept: 'PRESTAMO' | 'PAGO_DEUDA' | 'ANTICIPO';

  @IsOptional()
  @IsUUID('4')
  classSessionId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
