-- phase24_session_announcements
-- Spec Multiempresa: anuncios/noticias del profesor a la sesión (mission control).
-- Aditivo e idempotente.

CREATE TABLE IF NOT EXISTS "session_announcements" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "class_session_id" UUID         NOT NULL,
  "kind"             TEXT         NOT NULL DEFAULT 'INFO',
  "title"            TEXT         NOT NULL,
  "body"             TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "session_announcements_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "session_announcements"
    ADD CONSTRAINT "session_announcements_class_session_id_fkey"
    FOREIGN KEY ("class_session_id") REFERENCES "class_sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "session_announcements_class_session_id_idx"
  ON "session_announcements"("class_session_id");
