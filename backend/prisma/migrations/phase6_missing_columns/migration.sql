-- Phase 6: Add all columns that were added via db push but never migrated.
-- Uses IF NOT EXISTS so it's safe to run multiple times.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "email_verify_token"          TEXT,
  ADD COLUMN IF NOT EXISTS "email_verify_token_expires"  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "must_change_password"        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "totp_enabled"                BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "totp_secret"                 TEXT,
  ADD COLUMN IF NOT EXISTS "reset_token"                 TEXT,
  ADD COLUMN IF NOT EXISTS "reset_token_expires"         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "last_login"                  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "avatar_url"                  TEXT,
  ADD COLUMN IF NOT EXISTS "oauth_provider"              TEXT NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN IF NOT EXISTS "oauth_id"                    TEXT;
