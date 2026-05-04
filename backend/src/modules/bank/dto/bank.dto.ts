import { IsString, IsNotEmpty, IsNumber, IsIn, IsOptional, IsDateString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBankTransactionDto {
  @IsDateString()
  date: string;

  @IsString() @IsNotEmpty()
  description: string;

  @IsNumber() @Type(() => Number)
  amount: number;

  @IsString() @IsIn(['CREDIT', 'DEBIT'])
  type: 'CREDIT' | 'DEBIT';

  @IsString() @IsOptional()
  reference?: string;
}

export class UpdateBankTransactionDto {
  @IsBoolean() @IsOptional()
  isReconciled?: boolean;

  @IsString() @IsOptional()
  reference?: string;
}

import { IsArray, ValidateNested } from 'class-validator';

export class BulkImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBankTransactionDto)
  items: CreateBankTransactionDto[];
}
