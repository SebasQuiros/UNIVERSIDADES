-- ============================================================
--  Migration: Hacienda CABYS + multi-currency support
--  Generated: 2026-04-20
--
--  Changes:
--    1. products.cabys_desc  — CABYS description from catalog
--    2. products.cabys_code  — already exists, ensured NOT NULL
--       constraint is intentionally left nullable (students
--       may not have completed CABYS lookup yet)
--    3. invoices.currency    — already exists (default 'CRC')
--    4. invoices.exchange_rate — already exists (default 1)
--
--  Run with: psql $DATABASE_URL -f this_file.sql
-- ============================================================

-- 1. Add cabys_desc to products (safe — IF NOT EXISTS)
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "cabys_desc" TEXT;

-- 2. Ensure cabys_code exists on products (already in schema, idempotent)
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "cabys_code" TEXT;

-- 3. Ensure currency exists on invoices (already in schema, idempotent)
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'CRC';

-- 4. Ensure exchange_rate exists on invoices (already in schema, idempotent)
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "exchange_rate" DECIMAL(10,4) NOT NULL DEFAULT 1;

-- 5. Index on products.cabys_code for fast lookups (already in schema)
CREATE INDEX IF NOT EXISTS "products_cabys_code_idx" ON "products"("cabys_code");

-- Done
