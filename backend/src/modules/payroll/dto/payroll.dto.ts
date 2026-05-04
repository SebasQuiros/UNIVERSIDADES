import {
  IsString, IsNumber, IsOptional, IsDateString, IsBoolean,
  IsArray, IsUUID, Min,
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
