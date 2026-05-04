import { IsNumber, IsOptional, IsString, IsObject, Max, Min } from 'class-validator';

export class GradeAttemptDto {
  @IsNumber()
  @Min(0)
  @Max(10000)
  score: number;

  @IsOptional()
  @IsString()
  feedback?: string;

  /** Per-rubric criterion comments: { [criterion]: "comment text" } */
  @IsOptional()
  @IsObject()
  rubricComments?: Record<string, string>;
}
