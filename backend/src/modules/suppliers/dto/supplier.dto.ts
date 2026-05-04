import { IsString, IsOptional } from 'class-validator';
export class CreateSupplierDto {
  @IsString() name: string;
  @IsOptional() @IsString() identification?: string;
  @IsOptional() @IsString() idType?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
}
export class UpdateSupplierDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
}
