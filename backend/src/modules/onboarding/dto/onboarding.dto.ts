import {
  IsString,
  IsEmail,
  IsBoolean,
  IsOptional,
  IsUrl,
  IsUUID,
  MinLength,
  MaxLength,
  IsPhoneNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUniversityOnboardingDto {
  // ── Universidad ──────────────────────────────────────────────
  @ApiProperty({ example: 'Universidad Técnica Nacional' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  universityName: string;

  @ApiProperty({ example: 'UTN' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  universityShortName: string;

  @ApiProperty({ example: 'Costa Rica' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  country: string;

  @ApiPropertyOptional({ example: 'https://utn.ac.cr' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  // ── Admin ────────────────────────────────────────────────────
  @ApiProperty({ example: 'Juan Pérez Rojas' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  adminName: string;

  @ApiProperty({ example: 'admin@utn.ac.cr' })
  @IsEmail()
  adminEmail: string;

  @ApiPropertyOptional({ example: '+506 8888-8888' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  adminPhone?: string;

  // ── Plan (legacy — opcional, ignorado en el nuevo modelo) ────
  @ApiPropertyOptional({ example: 'uuid-del-plan' })
  @IsOptional()
  @IsString()
  planId?: string;

  // ── Términos ─────────────────────────────────────────────────
  @ApiProperty({ example: true })
  @IsBoolean()
  acceptedTerms: boolean;
}
