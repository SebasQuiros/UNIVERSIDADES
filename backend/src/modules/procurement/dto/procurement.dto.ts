import {
  IsUUID, IsString, IsOptional, IsNumber, IsArray, ValidateNested,
  ArrayMinSize, Min, IsNotEmpty, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProcurementItemDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  cabysCode?: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateProcurementOrderDto {
  // Contexto: un ejercicio (empresas del curso) O un grupo de práctica
  // (multiempresa en modo Contador). Exactamente uno debe estar presente
  // (validado en el servicio).
  @IsOptional()
  @IsUUID('4')
  exerciseId?: string;

  @IsOptional()
  @IsUUID('4')
  practiceGroupId?: string;

  @IsUUID('4')
  buyerCompanyId: string;

  @IsUUID('4')
  sellerCompanyId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProcurementItemDto)
  items: ProcurementItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  taxRate?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
