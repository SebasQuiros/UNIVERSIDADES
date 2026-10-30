import {
  IsString, IsOptional, IsInt, IsBoolean, IsEnum, IsNumber,
  IsArray, ValidateNested, Matches,
  Min, Max, Length, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ClassSessionArchetype } from '@prisma/client';

// ── Profesor ──────────────────────────────────────────────────

export class CreateClassSessionDto {
  @IsOptional() @IsInt() @Min(1) @Max(20)
  minGroupSize?: number;

  @IsOptional() @IsInt() @Min(1) @Max(20)
  maxGroupSize?: number;
}

export class CreateSessionGroupDto {
  @IsString() @Length(1, 120)
  name!: string;

  /** Opcional desde que el tipo de negocio lo define la profe en la sesión. */
  @IsOptional() @IsEnum(ClassSessionArchetype)
  archetype?: ClassSessionArchetype;

  @IsOptional() @IsString() @MaxLength(18)
  legalId?: string;
}

export class UpdateArchetypeDto {
  @IsEnum(ClassSessionArchetype)
  archetype!: ClassSessionArchetype;
}

export class StartSessionDto {
  // Permite arrancar aunque algún grupo quede por debajo de minGroupSize.
  @IsOptional() @IsBoolean()
  force?: boolean;
}

export class CancelSessionDto {
  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

// ── Estudiante ────────────────────────────────────────────────

export class JoinClassSessionDto {
  @IsString() @Length(6, 6)
  code!: string;
}

// ── Auditoría ─────────────────────────────────────────────────

const FINDING_SECTIONS = [
  'BALANCE_SHEET', 'INCOME_STATEMENT',
  'TAX_D101', 'TAX_D104', 'TAX_D103', 'TAX_D115', 'OTHER',
];

export class SubmitFindingDto {
  @IsString()
  section!: string; // uno de FINDING_SECTIONS (validado en el service para dar mensaje claro)

  @IsOptional() @IsString() @MaxLength(40)
  accountCode?: string;

  @IsString() @Length(1, 2000)
  description!: string;

  @IsOptional() @IsNumber()
  claimedAmount?: number;
}

export class UpdateFindingDto {
  @IsOptional() @IsString()
  section?: string;

  @IsOptional() @IsString() @MaxLength(40)
  accountCode?: string;

  @IsOptional() @IsString() @Length(1, 2000)
  description?: string;

  @IsOptional() @IsNumber()
  claimedAmount?: number;
}

export { FINDING_SECTIONS };


// ── Configuración del aula: tipo de negocio y escenario de arranque ────────

export class ProductoInicialDto {
  @IsString() @Length(2, 200)
  nombre!: string;

  /** CABYS de 13 dígitos. Sin él se usa uno genérico. */
  @IsOptional() @IsString() @Matches(/^\d{13}$/, {
    message: 'El código CABYS debe tener exactamente 13 dígitos.',
  })
  cabysCode?: string;

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  precio!: number;

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  costo!: number;

  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0)
  stock!: number;

  @IsOptional() @IsNumber() @Min(0) @Max(13)
  iva?: number;
}

/**
 * Lo que la persona docente define para el aula.
 *
 * El escenario es UNO para todas las empresas: si cada grupo arrancara con un
 * capital o un inventario distinto, la nota mediría la suerte del reparto.
 */
export class ConfigurarAulaDto {
  /** "Panadería", "Taller mecánico"... en las palabras de la profe. */
  @IsOptional() @IsString() @MaxLength(120)
  tipoNegocio?: string;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  capital?: number;

  /** Parte del capital que queda en caja; el resto entra al banco. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  enCaja?: number;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProductoInicialDto)
  productos?: ProductoInicialDto[];
}

export class AsignarParticipanteDto {
  /** `null` o ausente deja al estudiante sin grupo. */
  @IsOptional() @IsString()
  companyId?: string | null;
}
