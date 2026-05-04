-- ================================================================
--  BASELINE — DB-PUSH DRIFT
--
--  Histórico: durante el desarrollo se aplicaron cambios al schema
--  via `prisma db push` directo, sin generar migration files. La DB
--  productiva tiene estos objetos pero `prisma migrate deploy` en
--  un entorno fresh fallaría por falta de migration.
--
--  Este archivo es 100% idempotente — usa IF NOT EXISTS y bloques
--  EXCEPTION para enum types — así que es seguro en cualquier estado:
--    · DB existente (productiva): no-op completo.
--    · DB fresh (CI / nuevo deploy): crea todo lo que faltaba.
--
--  Tablas/columnas cubiertas:
--    · enum APStatus, ARStatus, JournalEntryStatus, TaxDeclarationType,
--      TaxDeclarationStatus
--    · journal_entries.source_type / source_id / status / is_pending
--    · accounts_payable, accounts_receivable, invoice_sequences
--    · tax_declarations, tax_attachments
-- ================================================================

-- ── ENUM TYPES ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "APStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ARStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "JournalEntryStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TaxDeclarationType" AS ENUM ('D104_IVA', 'D101_RENTA', 'D103_RETENCION', 'D115_DIVIDENDOS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TaxDeclarationStatus" AS ENUM ('DRAFT', 'SUBMITTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── JOURNAL_ENTRIES — columnas event-driven ───────────────────
ALTER TABLE "journal_entries"
  ADD COLUMN IF NOT EXISTS "source_type" TEXT,
  ADD COLUMN IF NOT EXISTS "source_id"   TEXT,
  ADD COLUMN IF NOT EXISTS "status"      "JournalEntryStatus" NOT NULL DEFAULT 'CONFIRMED',
  ADD COLUMN IF NOT EXISTS "is_pending"  BOOLEAN              NOT NULL DEFAULT false;

CREATE INDEX        IF NOT EXISTS "journal_entries_source_type_source_id_idx"  ON "journal_entries"("source_type", "source_id");
CREATE INDEX        IF NOT EXISTS "journal_entries_status_idx"                 ON "journal_entries"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "journal_entries_source_type_source_id_key"  ON "journal_entries"("source_type", "source_id");

-- ── INVOICE_SEQUENCES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "invoice_sequences" (
  "company_id"  UUID    NOT NULL,
  "last_number" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "invoice_sequences_pkey"             PRIMARY KEY ("company_id"),
  CONSTRAINT "invoice_sequences_company_id_fkey"  FOREIGN KEY ("company_id")
    REFERENCES "companies"("id") ON UPDATE CASCADE ON DELETE CASCADE
);

-- ── ACCOUNTS_PAYABLE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "accounts_payable" (
  "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
  "company_id"          UUID         NOT NULL,
  "supplier_name"       TEXT         NOT NULL,
  "supplier_cedula"     TEXT,
  "purchase_invoice_id" UUID         NOT NULL,
  "total"               NUMERIC(15,2) NOT NULL,
  "balance"             NUMERIC(15,2) NOT NULL,
  "status"              "APStatus"   NOT NULL DEFAULT 'PENDING',
  "due_date"            TIMESTAMP(3),
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "accounts_payable_pkey"                     PRIMARY KEY ("id"),
  CONSTRAINT "accounts_payable_company_id_fkey"          FOREIGN KEY ("company_id")
    REFERENCES "companies"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "accounts_payable_purchase_invoice_id_fkey" FOREIGN KEY ("purchase_invoice_id")
    REFERENCES "purchase_invoices"("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX        IF NOT EXISTS "accounts_payable_company_id_status_idx"     ON "accounts_payable"("company_id", "status");
CREATE INDEX        IF NOT EXISTS "accounts_payable_supplier_name_idx"          ON "accounts_payable"("supplier_name");
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_payable_purchase_invoice_id_key"    ON "accounts_payable"("purchase_invoice_id");

-- ── ACCOUNTS_RECEIVABLE ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "accounts_receivable" (
  "id"          UUID          NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID          NOT NULL,
  "customer_id" UUID,
  "invoice_id"  UUID          NOT NULL,
  "total"       NUMERIC(15,2) NOT NULL,
  "balance"     NUMERIC(15,2) NOT NULL,
  "status"      "ARStatus"    NOT NULL DEFAULT 'PENDING',
  "due_date"    TIMESTAMP(3),
  "created_at"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "accounts_receivable_pkey"             PRIMARY KEY ("id"),
  CONSTRAINT "accounts_receivable_company_id_fkey"  FOREIGN KEY ("company_id")
    REFERENCES "companies"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "accounts_receivable_customer_id_fkey" FOREIGN KEY ("customer_id")
    REFERENCES "clients"("id") ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "accounts_receivable_invoice_id_fkey"  FOREIGN KEY ("invoice_id")
    REFERENCES "invoices"("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX        IF NOT EXISTS "accounts_receivable_company_id_status_idx" ON "accounts_receivable"("company_id", "status");
CREATE INDEX        IF NOT EXISTS "accounts_receivable_customer_id_idx"        ON "accounts_receivable"("customer_id");
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_receivable_invoice_id_key"         ON "accounts_receivable"("invoice_id");

-- ── TAX_DECLARATIONS + TAX_ATTACHMENTS ────────────────────────
CREATE TABLE IF NOT EXISTS "tax_declarations" (
  "id"           UUID                 NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      UUID                 NOT NULL,
  "type"         "TaxDeclarationType" NOT NULL,
  "period"       TEXT                 NOT NULL,
  "status"       "TaxDeclarationStatus" NOT NULL DEFAULT 'DRAFT',
  "form_data"    JSONB                NOT NULL,
  "result"       JSONB                NOT NULL DEFAULT '{}',
  "reference_no" TEXT,
  "submitted_at" TIMESTAMP(3),
  "created_at"   TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tax_declarations_pkey"         PRIMARY KEY ("id"),
  CONSTRAINT "tax_declarations_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "tax_declarations_user_id_idx" ON "tax_declarations"("user_id");
CREATE INDEX IF NOT EXISTS "tax_declarations_period_idx"  ON "tax_declarations"("period");
CREATE INDEX IF NOT EXISTS "tax_declarations_type_idx"    ON "tax_declarations"("type");

CREATE TABLE IF NOT EXISTS "tax_attachments" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "declaration_id" UUID         NOT NULL,
  "line_key"       TEXT         NOT NULL,
  "line_label"     TEXT         NOT NULL,
  "file_name"      TEXT         NOT NULL,
  "file_size"      INTEGER      NOT NULL,
  "mime_type"      TEXT         NOT NULL,
  "file_data"      TEXT         NOT NULL,
  "uploaded_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tax_attachments_pkey"                PRIMARY KEY ("id"),
  CONSTRAINT "tax_attachments_declaration_id_fkey" FOREIGN KEY ("declaration_id")
    REFERENCES "tax_declarations"("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "tax_attachments_declaration_id_idx" ON "tax_attachments"("declaration_id");
CREATE INDEX IF NOT EXISTS "tax_attachments_line_key_idx"        ON "tax_attachments"("line_key");
