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

  /**
   * Cuenta de contrapartida: contra que se registra este movimiento.
   *
   * Un deposito de 75.000 no dice de donde salio. Sin contrapartida el
   * movimiento no es un hecho contable, es una nota: por eso antes el modulo
   * Bancos no tocaba los libros. Ahora se pide, y el sistema arma el asiento.
   *
   * Es opcional solo para la importacion de extractos: una linea del banco
   * todavia sin clasificar se registra para conciliarla despues.
   */
  @IsString() @IsOptional()
  counterAccountCode?: string;
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
