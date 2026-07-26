-- phase22_overdue_status
--
-- Spec UTN §2: corregir los 5 estados de un intento de práctica — faltaba
-- "Vencida" (el ejercicio venció sin que el estudiante lo entregara). Antes
-- solo existían 4 valores (NOT_STARTED/IN_PROGRESS/SUBMITTED/GRADED), sin
-- forma de distinguir "vencido" de "en progreso". Aditivo — ALTER TYPE ADD
-- VALUE no se puede correr dentro de una transacción explícita.

ALTER TYPE "ExerciseStatus" ADD VALUE IF NOT EXISTS 'OVERDUE';
