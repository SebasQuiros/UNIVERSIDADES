-- Phase 8: Espacio Contador — empresas de práctica (isPractice).
-- Una empresa marcada isPractice=true es una empresa-cliente de práctica del
-- estudiante-contador: sin intento, sin ejercicio, sin nota.

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "is_practice" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "companies_student_practice_idx"
  ON "companies"("student_id", "is_practice");
