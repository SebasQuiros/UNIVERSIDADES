-- phase25_negotiations
-- Spec Multiempresa cap. 6: motor de negociación (RFQ/oferta/contraoferta/chat).
-- Aditivo e idempotente. IDs de empresa/sesión como FK escalares.

DO $$ BEGIN
  CREATE TYPE "NegotiationStatus" AS ENUM ('ABIERTA', 'CONTRAOFERTA', 'ACEPTADA', 'RECHAZADA', 'CANCELADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "negotiations" (
  "id"                UUID              NOT NULL DEFAULT gen_random_uuid(),
  "class_session_id"  UUID,
  "buyer_company_id"  UUID              NOT NULL,
  "seller_company_id" UUID              NOT NULL,
  "subject"           TEXT              NOT NULL,
  "status"            "NegotiationStatus" NOT NULL DEFAULT 'ABIERTA',
  "agreed_qty"        INTEGER,
  "agreed_unit_price" DECIMAL(14,2),
  "created_by_id"     UUID              NOT NULL,
  "created_at"        TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "negotiations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "negotiation_entries" (
  "id"                UUID          NOT NULL DEFAULT gen_random_uuid(),
  "negotiation_id"    UUID          NOT NULL,
  "author_id"         UUID          NOT NULL,
  "author_company_id" UUID          NOT NULL,
  "kind"              TEXT          NOT NULL DEFAULT 'MENSAJE',
  "message"           TEXT,
  "qty"               INTEGER,
  "unit_price"        DECIMAL(14,2),
  "created_at"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "negotiation_entries_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "negotiations"
    ADD CONSTRAINT "negotiations_buyer_company_id_fkey"
    FOREIGN KEY ("buyer_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "negotiations"
    ADD CONSTRAINT "negotiations_seller_company_id_fkey"
    FOREIGN KEY ("seller_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "negotiation_entries"
    ADD CONSTRAINT "negotiation_entries_negotiation_id_fkey"
    FOREIGN KEY ("negotiation_id") REFERENCES "negotiations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "negotiations_class_session_id_idx" ON "negotiations"("class_session_id");
CREATE INDEX IF NOT EXISTS "negotiations_buyer_company_id_idx" ON "negotiations"("buyer_company_id");
CREATE INDEX IF NOT EXISTS "negotiations_seller_company_id_idx" ON "negotiations"("seller_company_id");
CREATE INDEX IF NOT EXISTS "negotiation_entries_negotiation_id_idx" ON "negotiation_entries"("negotiation_id");
