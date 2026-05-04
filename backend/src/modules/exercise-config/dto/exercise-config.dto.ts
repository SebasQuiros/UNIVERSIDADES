import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { CompanyMode } from '@prisma/client';

/**
 * DTO usado por PUT /exercises/:id/config.
 *
 * Todos los campos son opcionales: el cliente puede mandar solo los toggles
 * que cambia. El service hace un PATCH parcial sobre el registro existente.
 */
export class UpdateExerciseConfigDto {
  @IsOptional()
  @IsEnum(CompanyMode, { message: 'companyMode debe ser INDIVIDUAL o GROUP' })
  companyMode?: CompanyMode;

  @IsOptional() @IsBoolean() autoJournal?: boolean;
  @IsOptional() @IsBoolean() autoLedger?: boolean;
  @IsOptional() @IsBoolean() autoTrialBalance?: boolean;
  @IsOptional() @IsBoolean() autoAR?: boolean;
  @IsOptional() @IsBoolean() autoAP?: boolean;
  @IsOptional() @IsBoolean() autoInventory?: boolean;
  @IsOptional() @IsBoolean() autoTransactionsBetweenCompanies?: boolean;
}
