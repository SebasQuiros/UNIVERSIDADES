-- phase21_teacher_preview_attempt
--
-- Vista del profesor: permite que un profesor cree/reutilice su PROPIO intento
-- de práctica (ExerciseAttempt con studentId = su propio id) sobre un ejercicio
-- de su curso, para ver exactamente la misma experiencia que ve un estudiante
-- y validar el ejercicio antes/después de publicarlo. `is_preview` marca esos
-- intentos para excluirlos de la lista de entregas reales y de estadísticas.
-- Aditivo, idempotente.

ALTER TABLE "exercise_attempts"
  ADD COLUMN IF NOT EXISTS "is_preview" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "exercise_attempts_is_preview_idx" ON "exercise_attempts"("is_preview");
