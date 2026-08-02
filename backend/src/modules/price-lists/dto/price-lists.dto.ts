import { IsString, IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';

export class CreatePriceListDto {
  @IsString() name: string;
  // La moneda es opcional: el modelo ya tiene default "CRC", que es el caso
  // normal en Costa Rica. Solo se envía cuando la lista es en dólares.
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class UpdatePriceListDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SetPriceDto {
  @IsString() productId: string;
  // Min(0) y no Min(0.01): una lista promocional puede fijar precio cero
  // (producto de cortesía) y eso sigue siendo un dato contable válido.
  @IsNumber() @Min(0) price: number;
}
