-- F2.3 (Modo ERP Completo): orden de aprovisionamiento como máquina de estados
-- entre empresas del mismo curso.

CREATE TABLE IF NOT EXISTS "procurement_orders" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "exercise_id"         UUID NOT NULL,
  "buyer_company_id"    UUID NOT NULL,
  "seller_company_id"   UUID NOT NULL,
  "status"              TEXT NOT NULL DEFAULT 'PO_ISSUED',
  "items"               JSONB NOT NULL,
  "subtotal"            DECIMAL(15,2) NOT NULL,
  "tax_amount"          DECIMAL(15,2) NOT NULL,
  "total"               DECIMAL(15,2) NOT NULL,
  "seller_invoice_id"   UUID,
  "purchase_invoice_id" UUID,
  "notes"               TEXT,
  "created_by"          UUID NOT NULL,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "procurement_orders_exercise_id_idx"       ON "procurement_orders"("exercise_id");
CREATE INDEX IF NOT EXISTS "procurement_orders_buyer_company_id_idx"  ON "procurement_orders"("buyer_company_id");
CREATE INDEX IF NOT EXISTS "procurement_orders_seller_company_id_idx" ON "procurement_orders"("seller_company_id");
