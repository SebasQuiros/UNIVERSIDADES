import {
  IsString, IsDateString, IsArray,
  IsUUID, IsNumber, IsOptional, IsPositive,
  ValidateNested, MinLength, MaxLength, Min,
  ArrayMinSize,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateJournalLineDto {
  @IsUUID('4', { message: 'accountId debe ser un UUID válido' })
  accountId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'El débito no puede ser negativo' })
  debit: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'El crédito no puede ser negativo' })
  credit: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class CreateJournalEntryDto {
  @IsString()
  @MinLength(3, { message: 'La descripción debe tener al menos 3 caracteres' })
  @MaxLength(500)
  description: string;

  @IsDateString({}, { message: 'entryDate debe ser una fecha válida (YYYY-MM-DD)' })
  entryDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @IsArray()
  @ArrayMinSize(2, { message: 'Un asiento debe tener al menos 2 líneas' })
  @ValidateNested({ each: true })
  @Type(() => CreateJournalLineDto)
  lines: CreateJournalLineDto[];
}

export class ReverseJournalEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsDateString()
  reverseDate?: string;
}

export class JournalFilterDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  limit?: number;
}
