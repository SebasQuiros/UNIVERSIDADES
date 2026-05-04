import {
  IsString, IsOptional, IsUUID, IsInt, IsEmail,
  IsIn, Min, MaxLength, MinLength,
} from 'class-validator';

// ── User management DTOs ───────────────────────────────────────────────────

const ALLOWED_ROLES = ['STUDENT', 'TEACHER', 'ADMIN'] as const;

export class CreateUniversityUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEmail()
  @MaxLength(200)
  email: string;

  @IsIn(ALLOWED_ROLES, { message: `role must be one of: ${ALLOWED_ROLES.join(', ')}` })
  role: string;
}

export class UpdateUserRoleDto {
  @IsIn(ALLOWED_ROLES, { message: `role must be one of: ${ALLOWED_ROLES.join(', ')}` })
  role: string;
}

export class CreateUniversityDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  shortName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxStudents?: number;
}

export class UpdateUniversityDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  shortName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxStudents?: number;
}
