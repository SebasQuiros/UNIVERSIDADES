import {
  IsString, IsOptional, IsEmail,
  MinLength, MaxLength, IsIn, IsNumber, Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

// CR identification types (Hacienda)
export const CR_ID_TYPES = {
  '01': 'Cédula Física',
  '02': 'Cédula Jurídica',
  '03': 'DIMEX',
  '04': 'NITE',
};

export class CreateClientDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @IsString()
  @MinLength(9)
  @MaxLength(20)
  identification: string;

  @IsIn(['01', '02', '03', '04'], {
    message: `idType debe ser: 01 (Física), 02 (Jurídica), 03 (DIMEX), 04 (NITE)`,
  })
  idType: string;

  @IsOptional()
  @IsEmail({}, { message: 'Correo electrónico no válido' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;
}

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;
}
