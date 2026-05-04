-- Phase 6b: Remaining user columns missing from production DB (added via db push, never migrated).

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "must_change_password"  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "totp_enabled"          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "totp_secret"           TEXT,
  ADD COLUMN IF NOT EXISTS "reset_token"           TEXT,
  ADD COLUMN IF NOT EXISTS "reset_token_expires"   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "last_login"            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "avatar_url"            TEXT,
  ADD COLUMN IF NOT EXISTS "oauth_provider"        TEXT NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN IF NOT EXISTS "oauth_id"              TEXT;
