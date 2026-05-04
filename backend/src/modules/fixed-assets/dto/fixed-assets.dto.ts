import { IsString, IsNumber, IsOptional, IsDateString, IsIn, Min } from 'class-validator';

export class CreateFixedAssetDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsDateString() acquisitionDate: string;
  @IsNumber() acquisitionCost: number;
  @IsOptional() @IsNumber() salvageValue?: number;
  @IsNumber() @Min(1) usefulLifeYears: number;
  @IsOptional() @IsIn(['STRAIGHT_LINE','SUM_OF_DIGITS','DOUBLE_DECLINING']) depreciationMethod?: string;
}
