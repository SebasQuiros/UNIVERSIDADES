import {
  IsString, IsUUID, IsOptional, IsInt, IsNumber, Min, MaxLength, IsIn,
} from 'class-validator';

export class CreateNegotiationDto {
  @IsUUID('4')
  buyerCompanyId: string;   // mi empresa (compradora)

  @IsUUID('4')
  sellerCompanyId: string;  // empresa a la que le pido

  @IsOptional()
  @IsUUID('4')
  classSessionId?: string;

  @IsString()
  @MaxLength(200)
  subject: string;          // qué se negocia

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;         // nota inicial (RFQ)

  @IsOptional()
  @IsInt()
  @Min(1)
  qty?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;
}

export class PostEntryDto {
  @IsIn(['MENSAJE', 'OFERTA'])
  kind: 'MENSAJE' | 'OFERTA';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  qty?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;
}
