-- ================================================================
--  PHASE 4 — purchase_invoices.attempt_id pasa a NULLABLE.
--  Necesario para que el mirror inter-company pueda crear una
--  PurchaseInvoice en una company GROUP (que no tiene attempt 1:1).
--  Las INDIVIDUAL siguen llenando attempt_id como hasta ahora.
-- ================================================================

ALTER TABLE "purchase_invoices" ALTER COLUMN "attempt_id" DROP NOT NULL;

-- La FK ya existe pero apuntaba con NOT NULL implícito; la mantenemos.
-- Si la FK existente tenía ON DELETE CASCADE, la cambiamos a SET NULL para
-- permitir que un attempt borrado no arrastre la purchase invoice del buyer
-- (que puede pertenecer a OTRA company GROUP sin attempt).
DO $$
DECLARE constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'purchase_invoices_attempt_id_fkey'
      AND table_name      = 'purchase_invoices'
  ) INTO constraint_exists;

  IF constraint_exists THEN
    ALTER TABLE "purchase_invoices" DROP CONSTRAINT "purchase_invoices_attempt_id_fkey";
  END IF;
END $$;

ALTER TABLE "purchase_invoices"
  ADD CONSTRAINT "purchase_invoices_attempt_id_fkey"
  FOREIGN KEY ("attempt_id") REFERENCES "exercise_attempts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
