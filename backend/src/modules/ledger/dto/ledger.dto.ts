import { IsOptional, IsDateString } from 'class-validator';

export class LedgerFilterDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
