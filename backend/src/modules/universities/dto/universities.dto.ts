import {
  IsString, IsOptional, IsUUID, IsInt, IsEmail,
  IsIn, Min, MaxLength, MinLength,
  IsArray, ArrayMinSize, ArrayMaxSize, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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

/** Fila de la carga masiva. El rol es opcional: sin el, es estudiante. */
export class BulkUserRowDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEmail()
  @MaxLength(200)
  email: string;

  @IsOptional()
  @IsIn(ALLOWED_ROLES, { message: `role must be one of: ${ALLOWED_ROLES.join(', ')}` })
  role?: string;
}

export class BulkCreateUniversityUsersDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Enviá al menos un usuario.' })
  // El tope tambien se valida en el servicio: acá corta antes de gastar
  // trabajo, y allá protege a quien llame al servicio sin pasar por HTTP.
  @ArrayMaxSize(500, { message: 'Máximo 500 usuarios por carga. Dividí la lista.' })
  @ValidateNested({ each: true })
  @Type(() => BulkUserRowDto)
  usuarios: BulkUserRowDto[];
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
