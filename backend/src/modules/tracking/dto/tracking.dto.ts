import { IsEnum, IsOptional, IsObject, IsString, IsInt, Min } from 'class-validator';

export class TrackEventDto {
  @IsEnum(
    [
      'EXERCISE_OPENED',
      'EXERCISE_RESUMED',
      'INVOICE_CREATED',
      'INVOICE_ISSUED',
      'JOURNAL_ENTRY_SAVED',
      'REPORT_VIEWED',
      'EXERCISE_SUBMITTED',
      'CLIENT_CREATED',
      'PRODUCT_CREATED',
    ],
    { message: 'Evento de tracking no válido' },
  )
  event: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class TabSwitchDto {
  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  count?: number;
}
