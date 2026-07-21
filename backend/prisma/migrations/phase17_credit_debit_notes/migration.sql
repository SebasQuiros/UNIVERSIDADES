-- ================================================================
--  PHASE 17 — Notas de Crédito y Débito
--  Aditivo. Crea:
--    · enum credit_debit_note_status (DRAFT/ISSUED)
--    · tablas credit_notes / credit_note_lines
--    · tablas debit_notes  / debit_note_lines
--    · tablas de consecutivo atómico credit_note_sequences / debit_note_sequences
--  Todo scoped por company_id, con FK a la factura origen (misma empresa,
--  validado en el service layer). Idempotente (IF NOT EXISTS / DO blocks).
-- ================================================================

-- ── 0. ENUM de estado ──────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "CreditDebitNoteStatus" AS ENUM ('DRAFT', 'ISSUED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── 1. CREDIT NOTES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "credit_notes" (
  "id"                UUID          NOT NULL DEFAULT gen_random_uuid(),
  "company_id"        UUID          NOT NULL,
  "invoice_id"        UUID          NOT NULL,
  "number"            INTEGER       NOT NULL,
  "issue_date"        TIMESTAMP(3)  NOT NULL,
  "reason"            TEXT,
  "subtotal"          DECIMAL(15,2) NOT NULL DEFAULT 0,
  "tax"               DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total"             DECIMAL(15,2) NOT NULL DEFAULT 0,
  "status"            "CreditDebitNoteStatus" NOT NULL DEFAULT 'DRAFT',
  "restore_inventory" BOOLEAN       NOT NULL DEFAULT false,
  "created_by_id"     UUID          NOT NULL,
  "created_at"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_notes_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "credit_notes_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")  ON UPDATE CASCADE
);

-- Consecutivo único por empresa (misma regla que invoices.consecutive_number).
CREATE UNIQUE INDEX IF NOT EXISTS "credit_notes_company_id_number_key"
  ON "credit_notes"("company_id", "number");
CREATE INDEX IF NOT EXISTS "credit_notes_company_id_idx" ON "credit_notes"("company_id");
CREATE INDEX IF NOT EXISTS "credit_notes_invoice_id_idx" ON "credit_notes"("invoice_id");
CREATE INDEX IF NOT EXISTS "credit_notes_status_idx"     ON "credit_notes"("status");

CREATE TABLE IF NOT EXISTS "credit_note_lines" (
  "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
  "credit_note_id" UUID          NOT NULL,
  "product_id"     UUID,
  "line_no"        INTEGER       NOT NULL,
  "description"    TEXT          NOT NULL,
  "quantity"       DECIMAL(15,3) NOT NULL,
  "unit"           TEXT          NOT NULL DEFAULT 'Unid',
  "unit_price"     DECIMAL(15,2) NOT NULL,
  "tax_rate"       DECIMAL(5,2)  NOT NULL,
  "tax_amount"     DECIMAL(15,2) NOT NULL,
  "subtotal"       DECIMAL(15,2) NOT NULL,
  "total"          DECIMAL(15,2) NOT NULL,
  "cabys_code"     TEXT,

  CONSTRAINT "credit_note_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_note_lines_credit_note_id_fkey"
    FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "credit_note_lines_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "credit_note_lines_credit_note_id_idx"
  ON "credit_note_lines"("credit_note_id");

-- ── 2. DEBIT NOTES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "debit_notes" (
  "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
  "company_id"    UUID          NOT NULL,
  "invoice_id"    UUID          NOT NULL,
  "number"        INTEGER       NOT NULL,
  "issue_date"    TIMESTAMP(3)  NOT NULL,
  "reason"        TEXT,
  "subtotal"      DECIMAL(15,2) NOT NULL DEFAULT 0,
  "tax"           DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total"         DECIMAL(15,2) NOT NULL DEFAULT 0,
  "status"        "CreditDebitNoteStatus" NOT NULL DEFAULT 'DRAFT',
  "created_by_id" UUID          NOT NULL,
  "created_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "debit_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "debit_notes_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "debit_notes_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")  ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "debit_notes_company_id_number_key"
  ON "debit_notes"("company_id", "number");
CREATE INDEX IF NOT EXISTS "debit_notes_company_id_idx" ON "debit_notes"("company_id");
CREATE INDEX IF NOT EXISTS "debit_notes_invoice_id_idx" ON "debit_notes"("invoice_id");
CREATE INDEX IF NOT EXISTS "debit_notes_status_idx"     ON "debit_notes"("status");

CREATE TABLE IF NOT EXISTS "debit_note_lines" (
  "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
  "debit_note_id" UUID          NOT NULL,
  "product_id"    UUID,
  "line_no"       INTEGER       NOT NULL,
  "description"   TEXT          NOT NULL,
  "quantity"      DECIMAL(15,3) NOT NULL,
  "unit"          TEXT          NOT NULL DEFAULT 'Unid',
  "unit_price"    DECIMAL(15,2) NOT NULL,
  "tax_rate"      DECIMAL(5,2)  NOT NULL,
  "tax_amount"    DECIMAL(15,2) NOT NULL,
  "subtotal"      DECIMAL(15,2) NOT NULL,
  "total"         DECIMAL(15,2) NOT NULL,
  "cabys_code"    TEXT,

  CONSTRAINT "debit_note_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "debit_note_lines_debit_note_id_fkey"
    FOREIGN KEY ("debit_note_id") REFERENCES "debit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "debit_note_lines_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "debit_note_lines_debit_note_id_idx"
  ON "debit_note_lines"("debit_note_id");

-- ── 3. SECUENCIAS ATÓMICAS (1 fila por empresa) ────────────────
-- Mismo patrón que journal_sequences / invoice_sequences: INSERT ... ON CONFLICT
-- DO UPDATE incrementa last_number de forma atómica bajo concurrencia.
CREATE TABLE IF NOT EXISTS "credit_note_sequences" (
  "company_id"  UUID    NOT NULL,
  "last_number" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "credit_note_sequences_pkey" PRIMARY KEY ("company_id"),
  CONSTRAINT "credit_note_sequences_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "debit_note_sequences" (
  "company_id"  UUID    NOT NULL,
  "last_number" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "debit_note_sequences_pkey" PRIMARY KEY ("company_id"),
  CONSTRAINT "debit_note_sequences_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
