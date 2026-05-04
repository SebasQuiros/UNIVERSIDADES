import {
  IsString, IsOptional, IsEnum, IsNumber, IsDateString,
  IsArray, ValidateNested, IsInt, Min, MaxLength, MinLength, IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRubricDto {
  @IsString()
  @MaxLength(100)
  criterion: string;

  @IsString()
  @MaxLength(300)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  expectedValue?: string;

  @IsNumber()
  @Min(0)
  points: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class CreateExerciseDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsEnum(['BASIC', 'INTERMEDIATE', 'ADVANCED'], {
    message: 'difficulty debe ser: BASIC, INTERMEDIATE o ADVANCED',
  })
  difficulty?: string;

  @IsOptional()
  @IsEnum(['FULL_CYCLE', 'JOURNAL_ONLY', 'INVOICING_ONLY', 'INVENTORY_ONLY'], {
    message: 'type debe ser: FULL_CYCLE, JOURNAL_ONLY, INVOICING_ONLY o INVENTORY_ONLY',
  })
  type?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxScore?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRubricDto)
  rubrics?: CreateRubricDto[];
}

export class UpdateExerciseDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsEnum(['BASIC', 'INTERMEDIATE', 'ADVANCED'])
  difficulty?: string;

  @IsOptional()
  @IsEnum(['FULL_CYCLE', 'JOURNAL_ONLY', 'INVOICING_ONLY', 'INVENTORY_ONLY'])
  type?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxScore?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
