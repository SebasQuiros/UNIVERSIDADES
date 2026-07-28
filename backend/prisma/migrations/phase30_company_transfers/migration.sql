-- phase30_company_transfers
-- Transferencias de dinero entre empresas (Multiempresa). El concepto decide
-- el asiento contable de cada lado. Aditivo e idempotente.

DO $$ BEGIN
  CREATE TYPE "TransferConcept" AS ENUM ('PRESTAMO', 'PAGO_DEUDA', 'ANTICIPO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "company_transfers" (
  "id"               UUID              NOT NULL DEFAULT gen_random_uuid(),
  "class_session_id" UUID,
  "from_company_id"  UUID              NOT NULL,
  "to_company_id"    UUID              NOT NULL,
  "amount"           DECIMAL(14,2)     NOT NULL,
  "concept"          "TransferConcept" NOT NULL,
  "note"             TEXT,
  "from_entry_id"    UUID,
  "to_entry_id"      UUID,
  "created_by_id"    UUID              NOT NULL,
  "created_at"       TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_transfers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "company_transfers_from_idx"    ON "company_transfers"("from_company_id", "created_at");
CREATE INDEX IF NOT EXISTS "company_transfers_to_idx"      ON "company_transfers"("to_company_id", "created_at");
CREATE INDEX IF NOT EXISTS "company_transfers_session_idx" ON "company_transfers"("class_session_id");
