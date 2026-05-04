import {
  IsString, IsEnum, IsBoolean, IsOptional,
  IsUUID, MinLength, MaxLength, IsInt, Min, Max,
} from 'class-validator';
import { AccountType, NormalBalance } from '@prisma/client';

export class CreateAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code: string;

  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @IsEnum(AccountType)
  type: AccountType;

  @IsEnum(NormalBalance)
  normalBalance: NormalBalance;

  @IsOptional()
  @IsUUID('4')
  parentId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  level?: number;

  @IsOptional()
  @IsBoolean()
  isHeader?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
