import {
  IsString, IsOptional, IsNumber, IsBoolean,
  IsDateString, IsIn, IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Bank Account DTOs ────────────────────────────────────────────

export class CreateBankAccountDto {
  @IsString()
  name: string;

  @IsString()
  bankName: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

// ── Bank Transaction DTOs ────────────────────────────────────────

export class CreateBankTransactionDto {
  @IsUUID()
  bankAccountId: string;

  @IsDateString()
  date: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsNumber()
  @Type(() => Number)
  amount: number;

  @IsString()
  @IsIn(['DEBIT', 'CREDIT'])
  type: string;

  @IsOptional()
  @IsString()
  @IsIn(['INVOICE', 'PURCHASE', 'PAYROLL', 'MANUAL'])
  source?: string;

  @IsOptional()
  @IsUUID()
  sourceId?: string;
}

export class BankTransactionFilterDto {
  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  unreconciled?: boolean;
}

// ── Match DTOs ───────────────────────────────────────────────────

export class MatchTransactionDto {
  @IsUUID()
  statementLineId: string;

  @IsUUID()
  bankTransactionId: string;
}
