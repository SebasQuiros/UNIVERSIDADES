-- F3: Pedagogical Engine — eventos pedagógicos + perfil de aprendizaje.

CREATE TABLE IF NOT EXISTS "pedagogical_events" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id" UUID NOT NULL,
  "company_id" UUID,
  "attempt_id" UUID,
  "type"       TEXT NOT NULL,
  "severity"   TEXT NOT NULL DEFAULT 'INFO',
  "area"       TEXT,
  "context"    JSONB NOT NULL,
  "message"    TEXT,
  "resolved"   BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "pedagogical_events_student_id_idx" ON "pedagogical_events"("student_id");
CREATE INDEX IF NOT EXISTS "pedagogical_events_attempt_id_idx" ON "pedagogical_events"("attempt_id");
CREATE INDEX IF NOT EXISTS "pedagogical_events_type_idx"       ON "pedagogical_events"("type");

CREATE TABLE IF NOT EXISTS "learning_profiles" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id"         UUID NOT NULL UNIQUE,
  "competency_mastery" JSONB NOT NULL DEFAULT '{}',
  "strengths"          JSONB NOT NULL DEFAULT '[]',
  "recurring_errors"   JSONB NOT NULL DEFAULT '[]',
  "stats"              JSONB NOT NULL DEFAULT '{}',
  "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
