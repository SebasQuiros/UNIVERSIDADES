import {
  IsUUID, IsNumber, IsDateString, IsOptional, IsString,
  IsIn, Min,
} from 'class-validator';

export class RegisterArPaymentDto {
  @IsUUID('4')
  invoiceId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsDateString()
  paymentDate: string;

  @IsOptional()
  @IsString()
  @IsIn(['CASH', 'TRANSFER', 'CHECK', 'CARD'])
  method?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ArPaymentFilterDto {
  @IsOptional()
  @IsUUID('4')
  clientId?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;
}
