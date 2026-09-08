import {
  IsString, IsNumber, IsOptional, IsDateString, IsBoolean,
  IsArray, IsUUID, Min, Max, IsInt, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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


  // ── Situación familiar ────────────────────────────────────────────────────
  // Mueve el impuesto sobre la renta: ₡2.580 de crédito por cónyuge y ₡1.710
  // por cada hijo menor o estudiante, mensuales.
  @IsOptional()
  @IsBoolean()
  tieneConyuge?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  cantidadHijos?: number;

  // ── Deducciones fijas, mes a mes ─────────────────────────────────────────
  @IsOptional()
  @IsNumber()
  @Min(0)
  pensionAlimenticia?: number;

  /** Porcentaje del bruto que ahorra en la asociación solidarista: 0.05 = 5%. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  tasaAhorroAsociacion?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prestamoAsociacion?: number;

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

  // ── Situación familiar ────────────────────────────────────────────────────
  // Mueve el impuesto sobre la renta: ₡2.580 de crédito por cónyuge y ₡1.710
  // por cada hijo menor o estudiante, mensuales.
  @IsOptional()
  @IsBoolean()
  tieneConyuge?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  cantidadHijos?: number;

  // ── Deducciones fijas, mes a mes ─────────────────────────────────────────
  @IsOptional()
  @IsNumber()
  @Min(0)
  pensionAlimenticia?: number;

  /** Porcentaje del bruto que ahorra en la asociación solidarista: 0.05 = 5%. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  tasaAhorroAsociacion?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prestamoAsociacion?: number;
}


/**
 * Lo que varía de un mes a otro para una persona.
 *
 * El salario base, los hijos o la pensión alimenticia viven en el empleado
 * porque se repiten; las comisiones, las horas extra o unos viáticos son de
 * ESTE mes y por eso viajan con la planilla.
 */
export class MovimientoPlanillaDto {
  @IsUUID('4')
  employeeId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  comisiones?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  horasExtra?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bonoFijo?: number;

  /** No salarial: no cotiza ni paga renta, pero sí se entrega y sí es gasto. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  viaticos?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  regalos?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  otrasDeducciones?: number;
}

export class ProcessPayrollDto {
  @IsString()
  period: string; // "2026-04"

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  employeeIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MovimientoPlanillaDto)
  movimientos?: MovimientoPlanillaDto[];
}

export class PreviewPayrollDto {
  @IsString()
  period: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  employeeIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MovimientoPlanillaDto)
  movimientos?: MovimientoPlanillaDto[];
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

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  comisiones?: number;

  @IsOptional()
  @IsBoolean()
  tieneConyuge?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  cantidadHijos?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  pensionAlimenticia?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  tasaAhorroAsociacion?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  prestamoAsociacion?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  viaticos?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  regalos?: number;
}
