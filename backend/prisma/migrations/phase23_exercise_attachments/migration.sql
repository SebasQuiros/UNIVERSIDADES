-- phase23_exercise_attachments
--
-- Spec UTN §1: material adjunto por el profesor (PDF/Word/Excel/imágenes)
-- visible dentro del ejercicio. Binario como base64 en columna Text (mismo
-- patrón que tax_attachments) para sobrevivir el filesystem efímero de Railway.
-- Aditivo e idempotente.

CREATE TABLE IF NOT EXISTS "exercise_attachments" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "exercise_id" UUID         NOT NULL,
  "file_name"   TEXT         NOT NULL,
  "file_size"   INTEGER      NOT NULL,
  "mime_type"   TEXT         NOT NULL,
  "file_data"   TEXT         NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exercise_attachments_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "exercise_attachments"
    ADD CONSTRAINT "exercise_attachments_exercise_id_fkey"
    FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "exercise_attachments_exercise_id_idx"
  ON "exercise_attachments"("exercise_id");
