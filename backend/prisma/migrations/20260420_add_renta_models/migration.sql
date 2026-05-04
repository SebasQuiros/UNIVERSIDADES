-- ================================================================
--  Migration: 20260420_add_renta_models
--  Adds: partial_payments, retenciones
--  For: D-101 Income Tax declaration workflow
-- ================================================================

-- Partial Payments (Pagos Parciales Trimestrales)
CREATE TABLE IF NOT EXISTS "partial_payments" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "company_id"   UUID         NOT NULL,
  "attempt_id"   UUID         NOT NULL,
  "fiscal_year"  INTEGER      NOT NULL,
  "quarter"      INTEGER      NOT NULL,  -- 1, 2, 3, 4
  "due_date"     TIMESTAMP(3) NOT NULL,
  "amount"       DECIMAL(15,2) NOT NULL,
  "paid_date"    TIMESTAMP(3),
  "is_paid"      BOOLEAN      NOT NULL DEFAULT false,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "partial_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "partial_payments_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "partial_payments_company_id_idx"
  ON "partial_payments"("company_id");

CREATE INDEX IF NOT EXISTS "partial_payments_fiscal_year_idx"
  ON "partial_payments"("fiscal_year");

-- Retenciones en la Fuente (Withholdings)
CREATE TABLE IF NOT EXISTS "retenciones" (
  "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
  "company_id"       UUID          NOT NULL,
  "attempt_id"       UUID          NOT NULL,
  "type"             TEXT          NOT NULL,  -- SERVICIOS_PROFESIONALES | ALQUILER | DIVIDENDOS | TRANSPORTE
  "supplier_name"    TEXT          NOT NULL,
  "supplier_cedula"  TEXT,
  "gross_amount"     DECIMAL(15,2) NOT NULL,
  "retention_rate"   DECIMAL(5,4)  NOT NULL,
  "retention_amount" DECIMAL(15,2) NOT NULL,
  "net_paid"         DECIMAL(15,2) NOT NULL,
  "date"             TIMESTAMP(3)  NOT NULL,
  "description"      TEXT,
  "created_at"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "retenciones_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "retenciones_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "retenciones_company_id_idx"
  ON "retenciones"("company_id");
