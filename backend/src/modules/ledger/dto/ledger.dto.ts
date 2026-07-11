import { IsOptional, IsDateString } from 'class-validator';

export class LedgerFilterDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  /** Point-in-time (I-DV-2): corte "a la fecha" (entryDate <= asOfDate). Prioridad sobre endDate. */
  @IsOptional()
  @IsDateString()
  asOfDate?: string;
}
