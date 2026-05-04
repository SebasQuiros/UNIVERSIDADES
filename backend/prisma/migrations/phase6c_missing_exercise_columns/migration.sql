-- Phase 6c: Missing columns on exercises and other tables added via db push.

ALTER TABLE "exercises"
  ADD COLUMN IF NOT EXISTS "is_archived" BOOLEAN NOT NULL DEFAULT FALSE;
