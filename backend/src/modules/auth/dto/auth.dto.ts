import {
  IsEmail, IsString, MinLength, MaxLength,
  IsOptional, IsUUID, IsIn, Matches, IsUrl,
} from 'class-validator';
import { Transform } from 'class-transformer';

// ── Register ──────────────────────────────────────────────────
export class RegisterDto {
  @IsString()
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  @MaxLength(100)
  name: string;

  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*\-_])[A-Za-z\d!@#$%^&*\-_]{8,}$/, {
    message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo (!@#$%^&*-_)',
  })
  password: string;

  @IsOptional()
  @IsIn(['STUDENT', 'TEACHER'], {
    message: 'El rol debe ser STUDENT o TEACHER',
  })
  role?: string;

  @IsOptional()
  @IsUUID('4', { message: 'ID de universidad inválido' })
  universityId?: string;
}

// ── Login ─────────────────────────────────────────────────────
export class LoginDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(1, { message: 'La contraseña es requerida' })
  password: string;

  // 2FA opcional. Si el usuario tiene `totpEnabled=true`, el backend devuelve
  // 401 con `code='TOTP_REQUIRED'` cuando este campo viene vacío.
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El código 2FA debe tener 6 dígitos' })
  totpCode?: string;
}

// ── Refresh Token ─────────────────────────────────────────────
export class RefreshTokenDto {
  @IsString()
  @MinLength(1)
  refresh_token: string;
}

// ── Change Password ───────────────────────────────────────────
export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'La contraseña actual es requerida' })
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres' })
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*\-_])[A-Za-z\d!@#$%^&*\-_]{8,}$/, {
    message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo (!@#$%^&*-_)',
  })
  newPassword: string;
}

// ── Forgot Password ───────────────────────────────────────────
export class ForgotPasswordDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;
}

// ── Reset Password ────────────────────────────────────────────
export class ResetPasswordDto {
  @IsString()
  @MinLength(1, { message: 'El token es requerido' })
  token: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*\-_])[A-Za-z\d!@#$%^&*\-_]{8,}$/, {
    message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo (!@#$%^&*-_)',
  })
  newPassword: string;
}

// ── Update Profile ────────────────────────────────────────────
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'El avatar debe ser una URL HTTPS válida' })
  avatarUrl?: string;
}
