import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator';

// Los atributos describen variantes de producto (Talla: S/M/L). El nombre es lo
// único obligatorio: los valores se agregan después, uno a uno, desde la vista.
export class CreateProductAttributeDto {
  @IsString() @IsNotEmpty() @MaxLength(60) name: string;
}

export class UpdateProductAttributeDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(60) name?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateAttributeValueDto {
  @IsString() @IsNotEmpty() @MaxLength(60) value: string;
}
