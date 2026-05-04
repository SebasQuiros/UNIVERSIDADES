-- Migration: Phase 13 — AR/AP Payments
-- Created: 2026-04-20

-- ── AR Payments table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ar_payments" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "company_id"   UUID         NOT NULL,
  "invoice_id"   UUID         NOT NULL,
  "amount"       DECIMAL(15,2) NOT NULL,
  "payment_date" TIMESTAMP(3) NOT NULL,
  "method"       TEXT         NOT NULL DEFAULT 'TRANSFER',
  "reference"    TEXT,
  "notes"        TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ar_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ar_payments_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
  CONSTRAINT "ar_payments_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "ar_payments_company_id_idx" ON "ar_payments"("company_id");
CREATE INDEX IF NOT EXISTS "ar_payments_invoice_id_idx"  ON "ar_payments"("invoice_id");

-- ── AP Payments table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ap_payments" (
  "id"                   UUID         NOT NULL DEFAULT gen_random_uuid(),
  "company_id"           UUID         NOT NULL,
  "purchase_invoice_id"  UUID         NOT NULL,
  "amount"               DECIMAL(15,2) NOT NULL,
  "payment_date"         TIMESTAMP(3) NOT NULL,
  "method"               TEXT         NOT NULL DEFAULT 'TRANSFER',
  "reference"            TEXT,
  "notes"                TEXT,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ap_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ap_payments_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
  CONSTRAINT "ap_payments_purchase_invoice_id_fkey"
    FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "ap_payments_company_id_idx"          ON "ap_payments"("company_id");
CREATE INDEX IF NOT EXISTS "ap_payments_purchase_invoice_id_idx" ON "ap_payments"("purchase_invoice_id");

-- ── Add missing columns to purchase_invoices ──────────────────────
ALTER TABLE "purchase_invoices"
  ADD COLUMN IF NOT EXISTS "is_paid"    BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "paid_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;
