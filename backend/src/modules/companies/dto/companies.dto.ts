import {
  IsString, IsOptional, IsEmail,
  MinLength, MaxLength, IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCompanyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @IsString()
  @MinLength(9)
  @MaxLength(20)
  legalId: string;

  @IsIn(['01', '02', '03', '04'], {
    message: 'legalIdType debe ser: 01 (Física), 02 (Jurídica), 03 (DIMEX), 04 (NITE)',
  })
  legalIdType: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  economicActivity: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;
}

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;
}
