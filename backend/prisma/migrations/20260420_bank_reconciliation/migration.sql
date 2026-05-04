-- ================================================================
--  BANK RECONCILIATION — Migration
--  Phase 12
-- ================================================================

CREATE TABLE IF NOT EXISTS "bank_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "bank_name" TEXT NOT NULL,
  "account_number" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'CRC',
  "current_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bank_accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "bank_accounts_company_id_idx" ON "bank_accounts"("company_id");

CREATE TABLE IF NOT EXISTS "bank_statements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "bank_account_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "file_name" TEXT NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "total_credits" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total_debits" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "closing_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reconciled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bank_statements_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE CASCADE,
  CONSTRAINT "bank_statements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "bank_statements_company_id_idx" ON "bank_statements"("company_id");
CREATE INDEX IF NOT EXISTS "bank_statements_bank_account_id_idx" ON "bank_statements"("bank_account_id");

CREATE TABLE IF NOT EXISTS "bank_statement_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "statement_id" UUID NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "reference" TEXT,
  "debit" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "credit" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "balance" DECIMAL(15,2),
  "status" TEXT NOT NULL DEFAULT 'UNMATCHED',
  "matched_tx_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_statement_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bank_statement_lines_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "bank_statements"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "bank_statement_lines_statement_id_idx" ON "bank_statement_lines"("statement_id");

-- Alter existing bank_transactions table to add new columns (if they don't exist)
ALTER TABLE "bank_transactions"
  ADD COLUMN IF NOT EXISTS "bank_account_id" UUID,
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "source_id" UUID,
  ADD COLUMN IF NOT EXISTS "reconciled_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "statement_line_id" UUID;

-- Add FK for bank_account_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'bank_transactions_bank_account_id_fkey'
      AND table_name = 'bank_transactions'
  ) THEN
    ALTER TABLE "bank_transactions"
      ADD CONSTRAINT "bank_transactions_bank_account_id_fkey"
      FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "bank_transactions_bank_account_id_idx" ON "bank_transactions"("bank_account_id");
