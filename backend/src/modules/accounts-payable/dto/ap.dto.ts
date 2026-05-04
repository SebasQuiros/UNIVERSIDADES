import {
  IsUUID, IsNumber, IsDateString, IsOptional, IsString,
  IsIn, Min,
} from 'class-validator';

export class RegisterApPaymentDto {
  @IsUUID('4')
  purchaseInvoiceId: string;

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

export class ApPaymentFilterDto {
  @IsOptional()
  @IsString()
  supplierName?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;
}
