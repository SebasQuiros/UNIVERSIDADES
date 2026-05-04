-- ================================================================
--  PHASE 2 — Inventory FIFO foundations
--  Aditivo. Backfill convierte el `Product.stock` actual en un lote
--  inicial por producto con stock > 0, costo = COALESCE(cost, price).
-- ================================================================

-- ── 1. PRODUCTS — flag trackInventory ──────────────────────────
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "track_inventory" BOOLEAN NOT NULL DEFAULT true;

-- Servicios nunca trackean inventario.
UPDATE "products" SET "track_inventory" = false WHERE "is_service" = true;

-- ── 2. INVENTORY_MOVEMENTS — columnas FIFO ─────────────────────
ALTER TABLE "inventory_movements"
  ADD COLUMN IF NOT EXISTS "total_cost" NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS "lot_id"     UUID;

DO $$ BEGIN
  ALTER TABLE "inventory_movements"
    ADD CONSTRAINT "inventory_movements_lot_id_fkey"
    FOREIGN KEY ("lot_id") REFERENCES "inventory_lots"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN undefined_table  THEN null; -- inventory_lots todavía no existe en este punto del archivo
END $$;

-- ── 3. INVENTORY_LOTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "inventory_lots" (
  "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
  "product_id"    UUID          NOT NULL,
  "company_id"    UUID          NOT NULL,
  "qty_original"  NUMERIC(15,3) NOT NULL,
  "qty_remaining" NUMERIC(15,3) NOT NULL,
  "unit_cost"     NUMERIC(15,2) NOT NULL,
  "source"        TEXT          NOT NULL,
  "source_id"     TEXT,
  "received_at"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "inventory_lots_pkey"            PRIMARY KEY ("id"),
  CONSTRAINT "inventory_lots_product_id_fkey" FOREIGN KEY ("product_id")
    REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "inventory_lots_company_id_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  -- Sanity: qty_remaining no puede ser mayor a qty_original ni negativo.
  CONSTRAINT "inventory_lots_qty_check" CHECK (
    "qty_remaining" >= 0 AND "qty_remaining" <= "qty_original"
  )
);

-- Índice clave para FIFO consume — buscar lotes con qty_remaining>0 ordenados.
CREATE INDEX IF NOT EXISTS "inventory_lots_fifo_idx"
  ON "inventory_lots"("product_id", "qty_remaining", "received_at");

CREATE INDEX IF NOT EXISTS "inventory_lots_company_id_idx"
  ON "inventory_lots"("company_id");

CREATE INDEX IF NOT EXISTS "inventory_lots_source_source_id_idx"
  ON "inventory_lots"("source", "source_id");

-- Re-aplica la FK que falló arriba si la tabla existe ahora.
DO $$ BEGIN
  ALTER TABLE "inventory_movements"
    ADD CONSTRAINT "inventory_movements_lot_id_fkey"
    FOREIGN KEY ("lot_id") REFERENCES "inventory_lots"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "inventory_movements_lot_id_idx"
  ON "inventory_movements"("lot_id");

-- ── 4. BACKFILL: Product.stock → InventoryLot inicial ─────────
-- Solo para productos con stock > 0 que NO sean servicios y NO tengan ya
-- un lote (para idempotencia). Costo = COALESCE(cost, price). Si profe
-- después quiere ajustar, lo hace via endpoint de ajuste.
INSERT INTO "inventory_lots" (
  "id", "product_id", "company_id",
  "qty_original", "qty_remaining", "unit_cost",
  "source", "source_id", "received_at", "created_at"
)
SELECT
  gen_random_uuid(),
  p."id",
  p."company_id",
  p."stock",
  p."stock",
  COALESCE(NULLIF(p."cost", 0), p."price"),
  'INITIAL',
  NULL,
  p."created_at",
  CURRENT_TIMESTAMP
FROM "products" p
WHERE p."stock" > 0
  AND p."is_service" = false
  AND NOT EXISTS (
    SELECT 1 FROM "inventory_lots" l WHERE l."product_id" = p."id"
  );

-- También dejamos el InventoryMovement INITIAL_STOCK para auditoría, vinculado al lote.
INSERT INTO "inventory_movements" (
  "id", "product_id", "company_id", "type",
  "quantity", "unit_cost", "total_cost", "lot_id",
  "balance_after", "created_by", "created_at",
  "reference_type", "notes"
)
SELECT
  gen_random_uuid(),
  l."product_id",
  l."company_id",
  'INITIAL_STOCK'::"MovementType",
  l."qty_original",
  l."unit_cost",
  ROUND(l."qty_original" * l."unit_cost", 2),
  l."id",
  l."qty_original",
  COALESCE(c."student_id", c."id"),  -- fallback si studentId es null (GROUP)
  CURRENT_TIMESTAMP,
  'INITIAL_BACKFILL',
  'Stock inicial migrado a FIFO desde Product.stock'
FROM "inventory_lots" l
JOIN "companies" c ON c."id" = l."company_id"
WHERE l."source" = 'INITIAL'
  AND NOT EXISTS (
    SELECT 1 FROM "inventory_movements" m
    WHERE m."lot_id" = l."id" AND m."type" = 'INITIAL_STOCK'
  );

-- ── 5. SANITY CHECKS ──────────────────────────────────────────
-- Suma de qty_remaining de lotes activos vs Product.stock — deberían ser iguales
-- inmediatamente después del backfill. Si difieren, el profe debe revisar.
DO $$
DECLARE drift INT;
BEGIN
  SELECT COUNT(*) INTO drift FROM (
    SELECT
      p."id",
      p."stock" AS prod_stock,
      COALESCE(SUM(l."qty_remaining"), 0) AS lot_stock
    FROM "products" p
    LEFT JOIN "inventory_lots" l ON l."product_id" = p."id"
    WHERE p."is_service" = false AND p."stock" > 0
    GROUP BY p."id", p."stock"
    HAVING ABS(p."stock" - COALESCE(SUM(l."qty_remaining"), 0)) > 0.001
  ) d;
  IF drift > 0 THEN
    RAISE WARNING 'FIFO backfill: % productos con drift entre Product.stock y suma de lotes', drift;
  END IF;
END $$;
