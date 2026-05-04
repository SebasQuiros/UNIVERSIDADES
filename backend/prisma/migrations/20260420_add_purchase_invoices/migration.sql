-- CreateTable: purchase_invoices
-- Tracks supplier invoices for IVA fiscal credit (crédito fiscal D-104)

CREATE TABLE IF NOT EXISTS "purchase_invoices" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "company_id"       UUID         NOT NULL,
  "attempt_id"       UUID         NOT NULL,
  "supplier_name"    TEXT         NOT NULL,
  "supplier_cedula"  TEXT,
  "invoice_number"   TEXT         NOT NULL,
  "date"             TIMESTAMP(3) NOT NULL,
  "subtotal"         DECIMAL(15,2) NOT NULL,
  "tax_rate"         DECIMAL(5,4)  NOT NULL DEFAULT 0.1300,
  "tax_amount"       DECIMAL(15,2) NOT NULL,
  "total"            DECIMAL(15,2) NOT NULL,
  "description"      TEXT,
  "is_accepted"      BOOLEAN      NOT NULL DEFAULT true,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_invoices_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
  CONSTRAINT "purchase_invoices_attempt_id_fkey"
    FOREIGN KEY ("attempt_id") REFERENCES "exercise_attempts"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "purchase_invoices_company_id_idx"
  ON "purchase_invoices"("company_id");

CREATE INDEX IF NOT EXISTS "purchase_invoices_attempt_id_idx"
  ON "purchase_invoices"("attempt_id");
