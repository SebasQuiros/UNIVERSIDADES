import {
  IsString, MinLength, MaxLength, IsOptional, IsUrl,
} from 'class-validator';

// ── Update Profile ────────────────────────────────────────────
// Único DTO que sobrevive tras migrar el auth a Supabase. El resto
// (login, refresh, cambio/olvido/reset de contraseña) lo gestiona
// Supabase Auth desde el frontend.
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
