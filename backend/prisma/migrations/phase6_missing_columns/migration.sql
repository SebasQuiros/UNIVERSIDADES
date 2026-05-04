-- Phase 6: Add missing columns that were added via db push but never migrated
-- These columns exist in schema.prisma but are absent from the production database.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "email_verify_token"         TEXT,
  ADD COLUMN IF NOT EXISTS "email_verify_token_expires"  TIMESTAMPTZ;
