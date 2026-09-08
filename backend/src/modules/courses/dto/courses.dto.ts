import {
  IsString, IsOptional, IsUUID, MaxLength, MinLength,
} from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  period?: string;

  /**
   * Persona responsable del curso.
   *
   * Solo ADMIN/SUPERADMIN pueden designar a otra persona: para un TEACHER el
   * servicio ignora este campo y lo deja como responsable a el mismo, porque
   * si no un profesor podria colgarle un curso a un colega sin que se entere.
   */
  @IsOptional()
  @IsUUID()
  teacherId?: string;
}

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  period?: string;

  /**
   * Persona responsable del curso.
   *
   * Solo ADMIN/SUPERADMIN pueden designar a otra persona: para un TEACHER el
   * servicio ignora este campo y lo deja como responsable a el mismo, porque
   * si no un profesor podria colgarle un curso a un colega sin que se entere.
   */
  @IsOptional()
  @IsUUID()
  teacherId?: string;
}

export class EnrollStudentDto {
  @IsUUID()
  studentId: string;
}

export class EnrollBulkDto {
  @IsString({ each: true })
  emails: string[];
}
