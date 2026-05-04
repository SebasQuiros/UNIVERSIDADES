import {
  IsString, IsOptional, IsBoolean, IsInt, IsEmail,
  IsUUID, MinLength, Min, Max,
} from 'class-validator';

// ── Create University ─────────────────────────────────────────────────────────

export class CreateUniversityDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsOptional()
  @IsString()
  shortName?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(10000)
  maxStudents?: number;

  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  adminName?: string;
}

// ── Update University ─────────────────────────────────────────────────────────

export class UpdateUniversityDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsString()
  shortName?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsInt()
  @Min(10)
  maxStudents?: number;
}

// ── Assign Plan ───────────────────────────────────────────────────────────────

export class AssignPlanDto {
  @IsUUID()
  planId: string;
}
