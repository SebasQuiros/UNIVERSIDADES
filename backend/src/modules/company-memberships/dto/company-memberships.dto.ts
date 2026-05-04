import {
  IsBoolean, IsEnum, IsOptional, IsString,
  IsUUID, MaxLength, MinLength,
} from 'class-validator';
import { CompanyRole } from '@prisma/client';

/** Crea una Company en modo GROUP atada a un Exercise. */
export class CreateGroupCompanyDto {
  @IsString() @MinLength(2) @MaxLength(100)
  name!: string;

  @IsOptional() @IsString() @MaxLength(20)
  legalId?: string;
}

/** Agrega un miembro a una Company en modo GROUP. */
export class AddCompanyMemberDto {
  @IsUUID('4')
  userId!: string;

  @IsOptional() @IsEnum(CompanyRole, { message: 'role debe ser OWNER o MEMBER' })
  role?: CompanyRole;
}

/** Toggle de isCompanyEnabled. */
export class SetCompanyEnabledDto {
  @IsBoolean()
  enabled!: boolean;
}
