-- ================================================================
--  PHASE 18 — Vencimiento real de facturas a crédito (dueDate)
--  Aditivo. Agrega a `invoices`:
--    · due_date     TIMESTAMP(3)  (nullable) — vencimiento calculado
--                                  como issue_date + credit_days días
--                                  en las ventas a crédito.
--    · credit_days  INTEGER       (nullable) — días de crédito usados
--                                  para calcular el vencimiento (viene del
--                                  DTO o, por default, del cliente).
--  Las Cuentas por Cobrar (aging vigente/vencida) usan due_date en vez de
--  vencer el mismo día de emisión.
--  Idempotente (IF NOT EXISTS). Sin backfill: facturas previas quedan con
--  due_date NULL y el aging cae al fallback de issue_date.
-- ================================================================

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "due_date"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "credit_days" INTEGER;
