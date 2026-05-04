import {
  IsString, IsEnum, IsDateString,
  MinLength, MaxLength, IsOptional,
} from 'class-validator';
import { PeriodType } from '@prisma/client';

export class CreatePeriodDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEnum(PeriodType)
  type: PeriodType;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ClosePeriodDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
