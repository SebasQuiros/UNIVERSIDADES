import { IsOptional, IsDateString, IsUUID } from 'class-validator';

export class ReportFilterDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsUUID('4')
  periodId?: string;

  /**
   * Point-in-time (Accounting Manifest I-DV-2): corte "a la fecha". Reconstruye
   * el estado del Diario hasta esta fecha (entryDate <= asOfDate). Si se omite
   * startDate, el rango es acumulado desde el inicio (snapshot as-of). Tiene
   * prioridad sobre endDate.
   */
  @IsOptional()
  @IsDateString()
  asOfDate?: string;
}
