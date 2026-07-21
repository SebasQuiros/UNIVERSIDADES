import {
  IsString, IsOptional, IsInt, IsBoolean, IsEnum, IsNumber,
  Min, Max, Length, MaxLength,
} from 'class-validator';
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

  @IsEnum(ClassSessionArchetype)
  archetype!: ClassSessionArchetype;

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
