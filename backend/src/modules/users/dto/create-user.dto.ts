import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength, Matches } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*\-_])/, {
    message: 'La contraseña debe tener mayúscula, minúscula, número y símbolo',
  })
  password: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsUUID()
  universityId?: string;
}
