-- phase28_cost_method
-- Método de valuación de inventario por empresa: PEPS (FIFO) | UEPS (LIFO) |
-- PROMEDIO. Aditivo e idempotente; default PEPS mantiene el comportamiento actual.

DO $$ BEGIN
  CREATE TYPE "CostMethod" AS ENUM ('PEPS', 'UEPS', 'PROMEDIO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "cost_method" "CostMethod" NOT NULL DEFAULT 'PEPS';
