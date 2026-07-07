-- Fase 9 — Borrar el auth propio legado (migrado a Supabase Auth)
-- Elimina la tabla de sesiones locales, las columnas muertas de contraseña/2FA/
-- tokens de reset/verificación/OAuth en users, y el enum OAuthProvider.
-- CONSERVA: auth_id, email_verified, must_change_password, is_active, last_login.

-- Tabla de sesiones JWT locales (ya no se usa: sesiones las gestiona Supabase)
DROP TABLE IF EXISTS "sessions" CASCADE;

-- Columnas muertas del auth propio en users
ALTER TABLE "users" DROP COLUMN IF EXISTS "password_hash";
ALTER TABLE "users" DROP COLUMN IF EXISTS "totp_secret";
ALTER TABLE "users" DROP COLUMN IF EXISTS "totp_enabled";
ALTER TABLE "users" DROP COLUMN IF EXISTS "reset_token";
ALTER TABLE "users" DROP COLUMN IF EXISTS "reset_token_expires";
ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verify_token";
ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verify_token_expires";
ALTER TABLE "users" DROP COLUMN IF EXISTS "oauth_provider";
ALTER TABLE "users" DROP COLUMN IF EXISTS "oauth_id";

-- Enum OAuthProvider (se dropea al final, tras quitar la columna que lo usaba)
DROP TYPE IF EXISTS "OAuthProvider";
