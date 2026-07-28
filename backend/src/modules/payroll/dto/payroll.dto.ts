import {
  IsString, IsNumber, IsOptional, IsDateString, IsBoolean,
  IsArray, IsUUID, Min, Max,
} from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  name: string;

  @IsString()
  identification: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsNumber()
  @Min(0)
  salary: number;

  @IsOptional()
  @IsString()
  salaryType?: string; // MENSUAL | QUINCENAL | SEMANAL

  @IsDateString()
  startDate: string;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salary?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ProcessPayrollDto {
  @IsString()
  period: string; // "2026-04"

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  employeeIds?: string[];
}

export class PreviewPayrollDto {
  @IsString()
  period: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  employeeIds?: string[];
}

/** @deprecated — kept for backward compat */
export class RunPayrollDto {
  @IsString()
  employeeId: string;

  @IsString()
  period: string;
}

/** Calculadora rápida de planilla (no persiste). Antes el body era un tipo de
 *  TypeScript, así que el ValidationPipe global no podía validarlo y aceptaba
 *  NaN/Infinity/negativos. */
export class CalculatePayrollLineDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  salary: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  overtime?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  bonus?: number;
}
