-- ================================================================
--  PHASE 19 — Cotizaciones, Ordenes de compra + Recepcion, Ajustes
--  de inventario
--  Aditivo. Crea:
--    · enum quote_status (DRAFT/SENT/ACCEPTED/REJECTED/EXPIRED/CONVERTED)
--    · tablas quotes / quote_lines / quote_sequences
--    · enum purchase_order_status (DRAFT/ISSUED/RECEIVED/CANCELLED/INVOICED)
--    · tablas purchase_orders / purchase_order_lines / purchase_order_sequences
--    · columna purchase_invoices.purchase_order_id (nullable, opcional)
--    · enum inventory_adjustment_type (INCREASE/DECREASE)
--    · tabla inventory_adjustments
--  Todo scoped por company_id. Idempotente (IF NOT EXISTS / DO blocks),
--  mismo estilo que phase17_credit_debit_notes / phase18_invoice_due_date.
-- ================================================================

-- ── 0. ENUMS ───────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ISSUED', 'RECEIVED', 'CANCELLED', 'INVOICED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryAdjustmentType" AS ENUM ('INCREASE', 'DECREASE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── 1. QUOTES (cotizaciones / presupuestos) ───────────────────
CREATE TABLE IF NOT EXISTS "quotes" (
  "id"                   UUID          NOT NULL DEFAULT gen_random_uuid(),
  "company_id"           UUID          NOT NULL,
  "client_id"            UUID          NOT NULL,
  "quote_number"         INTEGER       NOT NULL,
  "issue_date"           TIMESTAMP(3)  NOT NULL,
  "valid_until"          TIMESTAMP(3)  NOT NULL,
  "status"               "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
  "currency"             TEXT          NOT NULL DEFAULT 'CRC',
  "exchange_rate"        DECIMAL(10,4) NOT NULL DEFAULT 1,
  "subtotal"             DECIMAL(15,2) NOT NULL DEFAULT 0,
  "tax_total"            DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total"                DECIMAL(15,2) NOT NULL DEFAULT 0,
  "notes"                TEXT,
  "converted_invoice_id" UUID,
  "created_by_id"        UUID          NOT NULL,
  "created_at"           TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "quotes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quotes_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quotes_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON UPDATE CASCADE,
  CONSTRAINT "quotes_converted_invoice_id_fkey"
    FOREIGN KEY ("converted_invoice_id") REFERENCES "invoices"("id") ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "quotes_company_id_quote_number_key"
  ON "quotes"("company_id", "quote_number");
CREATE UNIQUE INDEX IF NOT EXISTS "quotes_converted_invoice_id_key"
  ON "quotes"("converted_invoice_id");
CREATE INDEX IF NOT EXISTS "quotes_company_id_idx" ON "quotes"("company_id");
CREATE INDEX IF NOT EXISTS "quotes_client_id_idx"  ON "quotes"("client_id");
CREATE INDEX IF NOT EXISTS "quotes_status_idx"     ON "quotes"("status");

CREATE TABLE IF NOT EXISTS "quote_lines" (
  "id"          UUID          NOT NULL DEFAULT gen_random_uuid(),
  "quote_id"    UUID          NOT NULL,
  "product_id"  UUID,
  "line_no"     INTEGER       NOT NULL,
  "description" TEXT          NOT NULL,
  "quantity"    DECIMAL(15,3) NOT NULL,
  "unit"        TEXT          NOT NULL DEFAULT 'Unid',
  "unit_price"  DECIMAL(15,2) NOT NULL,
  "tax_rate"    DECIMAL(5,2)  NOT NULL,
  "tax_amount"  DECIMAL(15,2) NOT NULL,
  "subtotal"    DECIMAL(15,2) NOT NULL,
  "total"       DECIMAL(15,2) NOT NULL,
  "cabys_code"  TEXT,

  CONSTRAINT "quote_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quote_lines_quote_id_fkey"
    FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quote_lines_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "quote_lines_quote_id_idx" ON "quote_lines"("quote_id");

-- Consecutivo atomico por empresa (mismo patron que invoice_sequences).
CREATE TABLE IF NOT EXISTS "quote_sequences" (
  "company_id"  UUID    NOT NULL,
  "last_number" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "quote_sequences_pkey" PRIMARY KEY ("company_id"),
  CONSTRAINT "quote_sequences_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── 2. PURCHASE ORDERS (ordenes de compra a proveedor externo) ─
CREATE TABLE IF NOT EXISTS "purchase_orders" (
  "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
  "company_id"     UUID          NOT NULL,
  "supplier_id"    UUID          NOT NULL,
  "order_number"   INTEGER       NOT NULL,
  "issue_date"     TIMESTAMP(3)  NOT NULL,
  "expected_date"  TIMESTAMP(3),
  "status"         "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "currency"       TEXT          NOT NULL DEFAULT 'CRC',
  "exchange_rate"  DECIMAL(10,4) NOT NULL DEFAULT 1,
  "subtotal"       DECIMAL(15,2) NOT NULL DEFAULT 0,
  "tax_total"      DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total"          DECIMAL(15,2) NOT NULL DEFAULT 0,
  "notes"          TEXT,
  "created_by_id"  UUID          NOT NULL,
  "created_at"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_orders_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "purchase_orders_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_company_id_order_number_key"
  ON "purchase_orders"("company_id", "order_number");
CREATE INDEX IF NOT EXISTS "purchase_orders_company_id_idx"  ON "purchase_orders"("company_id");
CREATE INDEX IF NOT EXISTS "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");
CREATE INDEX IF NOT EXISTS "purchase_orders_status_idx"      ON "purchase_orders"("status");

CREATE TABLE IF NOT EXISTS "purchase_order_lines" (
  "id"                UUID          NOT NULL DEFAULT gen_random_uuid(),
  "purchase_order_id" UUID          NOT NULL,
  "product_id"        UUID,
  "line_no"           INTEGER       NOT NULL,
  "description"       TEXT          NOT NULL,
  "quantity"          DECIMAL(15,3) NOT NULL,
  "unit_cost"         DECIMAL(15,2) NOT NULL,
  "tax_rate"          DECIMAL(5,2)  NOT NULL,
  "line_total"        DECIMAL(15,2) NOT NULL,

  CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_order_lines_purchase_order_id_fkey"
    FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "purchase_order_lines_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "purchase_order_lines_purchase_order_id_idx"
  ON "purchase_order_lines"("purchase_order_id");

-- Consecutivo atomico por empresa (mismo patron que invoice_sequences).
CREATE TABLE IF NOT EXISTS "purchase_order_sequences" (
  "company_id"  UUID    NOT NULL,
  "last_number" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "purchase_order_sequences_pkey" PRIMARY KEY ("company_id"),
  CONSTRAINT "purchase_order_sequences_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Referencia opcional desde purchase_invoices hacia la orden de compra que
-- la origino (ciclo compras: PO -> recepcion -> factura real del proveedor).
-- NULL para compras registradas sin orden previa (comportamiento historico).
ALTER TABLE "purchase_invoices"
  ADD COLUMN IF NOT EXISTS "purchase_order_id" UUID;

DO $$ BEGIN
  ALTER TABLE "purchase_invoices"
    ADD CONSTRAINT "purchase_invoices_purchase_order_id_fkey"
    FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "purchase_invoices_purchase_order_id_idx"
  ON "purchase_invoices"("purchase_order_id");

-- ── 3. INVENTORY ADJUSTMENTS (mermas / conteo fisico / correcciones) ──
CREATE TABLE IF NOT EXISTS "inventory_adjustments" (
  "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
  "company_id"    UUID          NOT NULL,
  "product_id"    UUID          NOT NULL,
  "type"          "InventoryAdjustmentType" NOT NULL,
  "quantity"      DECIMAL(15,3) NOT NULL,
  "unit_cost"     DECIMAL(15,2) NOT NULL,
  "total_value"   DECIMAL(15,2) NOT NULL,
  "reason"        TEXT          NOT NULL,
  "source_type"   TEXT,
  "source_id"     TEXT,
  "created_by_id" UUID          NOT NULL,
  "created_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_adjustments_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "inventory_adjustments_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "inventory_adjustments_company_id_idx" ON "inventory_adjustments"("company_id");
CREATE INDEX IF NOT EXISTS "inventory_adjustments_product_id_idx" ON "inventory_adjustments"("product_id");

-- ── 4. BACKFILL — cuentas de ajuste de inventario para empresas existentes ──
-- Las empresas nuevas ya reciben estas 2 cuentas desde el CHART de
-- AccountsService (Fase 19). Para empresas creadas ANTES de este cambio,
-- las insertamos ahora si tienen el chart estándar (detectado por la
-- presencia de la cuenta 5.1.01.01) y todavía no las tienen.
INSERT INTO "accounts" ("id", "company_id", "code", "name", "type", "sub_type", "parent_id", "level", "is_header", "normal_balance", "is_active", "created_at")
SELECT gen_random_uuid(), c.id, '5.1.01.02', 'Ajuste de Inventario — Merma', 'EXPENSE', NULL,
       p.id, 4, false, 'DEBIT', true, CURRENT_TIMESTAMP
FROM "companies" c
JOIN "accounts" p ON p.company_id = c.id AND p.code = '5.1.01'
WHERE EXISTS (SELECT 1 FROM "accounts" a WHERE a.company_id = c.id AND a.code = '5.1.01.01')
  AND NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a.company_id = c.id AND a.code = '5.1.01.02');

INSERT INTO "accounts" ("id", "company_id", "code", "name", "type", "sub_type", "parent_id", "level", "is_header", "normal_balance", "is_active", "created_at")
SELECT gen_random_uuid(), c.id, '4.2.01.02', 'Ajuste de Inventario — Sobrante', 'INCOME', NULL,
       p.id, 4, false, 'CREDIT', true, CURRENT_TIMESTAMP
FROM "companies" c
JOIN "accounts" p ON p.company_id = c.id AND p.code = '4.2.01'
WHERE EXISTS (SELECT 1 FROM "accounts" a WHERE a.company_id = c.id AND a.code = '4.1.01.01')
  AND NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a.company_id = c.id AND a.code = '4.2.01.02');
